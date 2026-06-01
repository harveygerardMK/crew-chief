# Race Context Files Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Load the four wheresharvey.com content pages into every chat prompt, and add per-person `agent-context/` markdown files for Amanda, Brendan, and Zuzy that inject when their name matches.

**Architecture:** Two new loaders in `server/prompt.py` — `load_course_content()` reads all four `src/content/pages/*.md` files for every visitor; `load_agent_context()` matches the visitor's display name against `known-people.json` `match_names` arrays to resolve a filename in `agent-context/` and injects it. Both are called from `build_system_prompt()`. No new config required — paths are derived from `REPO_ROOT`.

**Tech Stack:** Python 3.11+, `pathlib.Path`, existing `known_people.lookup_known_person()` for name resolution, `pytest` for tests.

---

### Task 1: Add `load_course_content()` to `server/prompt.py`

**Files:**
- Modify: `server/prompt.py`
- Modify: `server/tests/test_known_people.py` (or create `server/tests/test_prompt.py`)

**Step 1: Write a failing test in `server/tests/test_prompt.py` (create file)**

```python
"""Tests for prompt assembly helpers."""

from __future__ import annotations

import sys
from pathlib import Path

# server/ is on sys.path when pytest runs from there
from config import REPO_ROOT
from prompt import load_course_content


def test_load_course_content_returns_nonempty_string() -> None:
    text = load_course_content()
    assert isinstance(text, str)
    assert len(text) > 100


def test_load_course_content_includes_all_pages() -> None:
    text = load_course_content()
    # Each page should contribute at least its filename or a key phrase
    assert "course" in text.lower()
    assert "pacer" in text.lower()
    assert "rules" in text.lower()
```

**Step 2: Run to verify it fails**

```bash
cd /path/to/repo/server && python -m pytest tests/test_prompt.py -v
```

Expected: `ImportError: cannot import name 'load_course_content'`

**Step 3: Implement `load_course_content()` in `server/prompt.py`**

Add after `load_harvey_profile()`:

```python
_CONTENT_PAGES_DIR = REPO_ROOT / "src" / "content" / "pages"
_CONTENT_PAGE_ORDER = [
    "about-the-race.md",
    "course-overview.md",
    "pacer-onboarding.md",
    "rules-summary.md",
]


def load_course_content() -> str:
    parts = []
    for filename in _CONTENT_PAGE_ORDER:
        path = _CONTENT_PAGES_DIR / filename
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8").strip())
    return "\n\n---\n\n".join(parts)
```

**Step 4: Wire into `build_system_prompt()`**

In `build_system_prompt()`, after the `load_harvey_profile()` block:

```python
course_content = load_course_content()
if course_content:
    parts.append(f"## Course & race context\n\n{course_content}")
```

**Step 5: Run tests**

```bash
cd server && python -m pytest tests/test_prompt.py -v
```

Expected: PASS

**Step 6: Commit**

```bash
git add server/prompt.py server/tests/test_prompt.py
git commit -m "feat: load course content pages into every system prompt"
```

---

### Task 2: Add `load_agent_context()` to `server/prompt.py`

**Files:**
- Modify: `server/prompt.py`
- Modify: `server/tests/test_prompt.py`

**Step 1: Write failing tests — append to `server/tests/test_prompt.py`**

```python
from prompt import load_agent_context

_AGENT_CONTEXT_DIR = REPO_ROOT / "agent-context"


def test_load_agent_context_returns_none_for_unknown() -> None:
    assert load_agent_context("Random Person") is None


def test_load_agent_context_matches_amanda() -> None:
    # Requires agent-context/amanda.md to exist (created in Task 3)
    result = load_agent_context("Amanda")
    assert result is not None
    assert "amanda" in result.lower() or "crew" in result.lower()


def test_load_agent_context_matches_nickname_gangle() -> None:
    # Gangle → brendan.md (requires agent-context/brendan.md from Task 3)
    result = load_agent_context("Gangle")
    assert result is not None
    assert "brendan" in result.lower() or "barker" in result.lower()


def test_load_agent_context_matches_queen_z() -> None:
    result = load_agent_context("Queen Z")
    assert result is not None
    assert "zuzy" in result.lower() or "tahoe city" in result.lower()
```

**Step 2: Run to verify they fail**

```bash
cd server && python -m pytest tests/test_prompt.py::test_load_agent_context_returns_none_for_unknown -v
```

Expected: `ImportError: cannot import name 'load_agent_context'`

**Step 3: Implement `load_agent_context()` in `server/prompt.py`**

The function uses `known_people.lookup_known_person()` to resolve a canonical filename from the visitor's display name. The canonical name is derived from `match_names[0]` (the base name, e.g. `"brendan"`).

Add after `load_course_content()`:

```python
_AGENT_CONTEXT_DIR = REPO_ROOT / "agent-context"

# Map each known person's first match_name to a context filename.
# Derived at import time from known-people.json so there's one source of truth.
def _build_context_filename_map() -> dict[str, str]:
    from known_people import _load_known_people, _normalize_name
    mapping: dict[str, str] = {}
    for person in _load_known_people():
        aliases = person.get("match_names") or []
        if not aliases:
            continue
        # First entry is the canonical filename stem (e.g. "brendan" → brendan.md)
        canonical = _normalize_name(str(aliases[0])).replace(" ", "-")
        for alias in aliases:
            mapping[_normalize_name(str(alias))] = canonical
    return mapping


_CONTEXT_FILENAME_MAP: dict[str, str] = {}


def _get_context_filename_map() -> dict[str, str]:
    global _CONTEXT_FILENAME_MAP
    if not _CONTEXT_FILENAME_MAP:
        _CONTEXT_FILENAME_MAP = _build_context_filename_map()
    return _CONTEXT_FILENAME_MAP


def load_agent_context(visitor_name: str) -> str | None:
    from known_people import _normalize_name
    normalized = _normalize_name(visitor_name)
    if not normalized:
        return None
    filename_stem = _get_context_filename_map().get(normalized)
    if not filename_stem:
        return None
    path = _AGENT_CONTEXT_DIR / f"{filename_stem}.md"
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8").strip()
```

**Step 4: Wire into `build_system_prompt()`**

After the `format_visitor_block(visitor)` line in `build_system_prompt()`:

```python
agent_context = load_agent_context(str(visitor.get("name") or ""))
if agent_context:
    parts.append(f"## Personal context for this visitor\n\n{agent_context}")
```

**Step 5: Run the "unknown" test only (others need files from Task 3)**

```bash
cd server && python -m pytest tests/test_prompt.py::test_load_agent_context_returns_none_for_unknown -v
```

Expected: PASS

**Step 6: Commit**

```bash
git add server/prompt.py server/tests/test_prompt.py
git commit -m "feat: add agent-context loader — injects per-person MD on name match"
```

---

### Task 3: Create `agent-context/amanda.md`

**Files:**
- Create: `agent-context/amanda.md`

**Step 1: Create the file**

Harvey needs to fill in the specifics (exact timing, what to pack at each stop), but the structure should be complete. Write the file with placeholders clearly marked `[TODO: Harvey fills this in]`.

```markdown
# Amanda — Crew Chief Playbook

You are talking to Amanda Schaefer — Harvey's wife, crew chief, and the operational brain of this whole endeavor. She knows the race plan, she knows him, and she does not need hand-holding. Give her status clearly and trust that she knows what to do with it.

---

## Her crew stops (crew-accessible aid stations)

| Mile | Aid station | Cutoff | Parking note |
|------|-------------|--------|--------------|
| 0 / 10 | Start / Heavenly | Fri 9:00 AM | Lower parking lot. Runners may park overnight. |
| 52.2 | Sierra at Tahoe | Sat 11:30 AM | — |
| 87.6 | Loon Lake | Sun 6:30 AM | Use Icehouse Rd — NO crew on Wrights Lake Rd. First pacer pickup here. |
| 130.0 | Tahoe City | Mon 4:30 AM | Park at Transit Center, walk 0.2 mi to aid. |
| 148.6 | Brockway Summit | Mon 2:30 PM | Designated parking, walk 0.6 mi. |
| 163.6 | Village Green | Mon 10:00 PM | Park in designated crew areas (marked green). |
| 200.4 | Finish (Heavenly) | Tue 6:00 PM | Same site as start. |

---

## What Harvey typically needs at each stop

[TODO: Harvey fills in specifics — food preferences, gear swaps, drop bag numbers, sleep stop expectations, blister kit, poles, etc.]

General defaults until Harvey updates this:
- Food: real food over gels after mile 50. Broth, grilled cheese, quesadillas if available.
- Feet: check blisters at every crew stop after mile 87.6.
- Headlamp swap: charged lamp ready at every night stop.
- Drop bags: Harvey has drop bags at most stops — Amanda's crew bag supplements, not replaces.
- Sleep stops: Wrights Lake (mi 70.7) and Barker Pass (mi 103.1) are NO crew access. She cannot get to him there. Brockway Summit (mi 148.6) IS crew accessible — plan to be there.

---

## Logistics between stops

[TODO: Harvey fills in — which stops she's prioritizing, any car logistics, who else is on crew, hotel or car sleep plan between stops.]

---

## Pacer handoffs she's managing

- **Loon Lake (mi 87.6):** First pacer pickup. [TODO: which pacer, A/B/C leg?]
- **Barker Pass (mi 103.1):** NO crew access — pacer continuation only.
- **Tahoe City (mi 130.0):** Pacer swap. Gangle (Leg B) hands off to Queen Z (Leg C).
- **Brockway Summit (mi 148.6):** Queen Z's leg ends here. Solo or new pacer from here.

---

## Tone notes for this chat

Amanda is family and crew simultaneously. She does not need protection from brutal detail — she needs accurate status delivered clearly. She knows when something is hard; say so plainly, then tell her what it means operationally. She is funnier than Harvey, taller than Harvey, and has heard every height joke already. She can handle the truth.
```

**Step 2: Run the Amanda agent-context test**

```bash
cd server && python -m pytest tests/test_prompt.py::test_load_agent_context_matches_amanda -v
```

Expected: PASS

**Step 3: Commit**

```bash
git add agent-context/amanda.md
git commit -m "feat: add Amanda crew chief playbook (agent-context/amanda.md)"
```

---

### Task 4: Create `agent-context/brendan.md`

**Files:**
- Create: `agent-context/brendan.md`

**Step 1: Create the file**

```markdown
# Brendan (Gangle) — Leg B Pacer Brief

You are talking to Brendan Gangl — call him Gangle. He is pacing Harvey on Leg B, the highest-risk leg on the plan. He knows what he signed up for.

---

## His leg

**Leg B: Barker Pass (mi 103.1) → Tahoe City (mi 130.0)**
- Distance: ~26.9 miles
- Timing: Saturday afternoon/evening into night two (Harvey's plan puts him at Barker Pass ~Sun 2:30 AM; exact timing shifts with race conditions)
- Cutoff at Barker Pass: Sun 2:30 PM
- Cutoff at Tahoe City: Mon 4:30 AM

---

## Why this leg is the hardest

- Only one intermediate aid station: **Stephen Jones Memorial (mi 110.6)** — crew cannot access it. Once Gangle and Harvey are in, there is no backing out and no crew support until Tahoe City.
- If Harvey hits a sleep wall, it will probably be on this leg. He may need to stop and sleep, which adds time — Gangle should be mentally ready for that.
- Long, sustained effort with no bailout option once underway.

---

## The upside

Gangle gets the sunrise. Harvey expects the Sunday morning light over the rim to be genuinely beautiful — that's the reward for being on the hardest leg.

---

## What Harvey needs from Gangle on this leg

[TODO: Harvey fills in specifics — pacing style, whether to push or hold back, what to say when Harvey wants to quit, food carry, poles.]

General defaults:
- Let Harvey complain for a mile when he needs to. Then make him eat something.
- Don't let him stop unless it's a real sleep stop — brief sit-downs are a trap after mile 100.
- Keep pace conservative through Stephen Jones. The leg is long.

---

## Logistics

- **Meet point:** Barker Pass aid station. No crew access — Gangle gets there as a pacer.
- **Crew handoff at Tahoe City:** Amanda and crew will be at Tahoe City. Park at Transit Center, walk 0.2 mi.
- **After handoff:** Queen Z takes over Leg C from Tahoe City.
```

**Step 2: Run the Gangle test**

```bash
cd server && python -m pytest tests/test_prompt.py::test_load_agent_context_matches_nickname_gangle -v
```

Expected: PASS

**Step 3: Commit**

```bash
git add agent-context/brendan.md
git commit -m "feat: add Brendan/Gangle Leg B pacer brief (agent-context/brendan.md)"
```

---

### Task 5: Create `agent-context/zuzy.md`

**Files:**
- Create: `agent-context/zuzy.md`

**Step 1: Create the file**

```markdown
# Zuzy (Queen Z) — Leg C Pacer Brief

You are talking to Zuzy — call her Queen Z. She is pacing Harvey on Leg C, picking up from Gangle at Tahoe City. She is a legend. Treat her accordingly.

---

## Her leg

**Leg C: Tahoe City (mi 130.0) → Brockway Summit (mi 148.6)**
- Distance: ~18.6 miles
- Timing: After Gangle hands off — Harvey's plan targets Tahoe City ~Mon 4:30 AM; actual time depends on Leg B conditions
- Cutoff at Tahoe City: Mon 4:30 AM
- Cutoff at Brockway Summit: Mon 2:30 PM

---

## What to know about this leg

- Tahoe City is a full-service aid station with crew access. She meets Harvey and Gangle there.
- Brockway Summit is also crew-accessible — Amanda will be there. Parking is designated, 0.6 mi walk to aid.
- This leg is shorter than Leg B and has crew access at both ends — that's the relative relief after the Gangle stretch.
- Harvey will be tired and past mile 130. The job is to get him to Brockway in good enough shape for the final 52 miles solo (or with a new pacer — [TODO: Harvey confirms]).

---

## What Harvey needs from Queen Z on this leg

[TODO: Harvey fills in specifics — pacing approach, food, poles, what kind of energy she should bring.]

General defaults:
- He'll be in deep race mode. Energy and humor help; demands and urgency don't.
- Keep him eating. Real food if available.
- Brockway is a sleep station — Amanda will have a sleep plan ready. Queen Z's job is to get him there.

---

## Logistics

- **Meet point:** Tahoe City aid. Park at Transit Center, walk 0.2 mi.
- **End point:** Brockway Summit. Designated crew parking, 0.6 mi walk.
- **After handoff:** Harvey continues with crew support. Queen Z is released into legend status.
```

**Step 2: Run the Queen Z test**

```bash
cd server && python -m pytest tests/test_prompt.py::test_load_agent_context_matches_queen_z -v
```

Expected: PASS

**Step 3: Commit**

```bash
git add agent-context/zuzy.md
git commit -m "feat: add Zuzy/Queen Z Leg C pacer brief (agent-context/zuzy.md)"
```

---

### Task 6: Full test suite pass + final smoke check

**Step 1: Run all server tests**

```bash
cd server && python -m pytest tests/ -v
```

Expected: All green. If any existing test breaks, investigate before proceeding.

**Step 2: Smoke check the full prompt assembly (optional but recommended)**

```python
# Run from server/ directory
python - <<'EOF'
import sys
sys.path.insert(0, ".")
from config import load_settings
from status import load_status
from prompt import build_system_prompt

settings = load_settings()
status = load_status(settings)
visitor = {"name": "Amanda", "relationship": "crew", "checkin_count": 0, "last_seen": "2026-06-12T09:00:00Z"}
prompt = build_system_prompt(settings, status=status, visitor=visitor)

print(f"Total prompt length: {len(prompt)} chars")
print("--- Course content present:", "Course & race context" in prompt)
print("--- Agent context present:", "Personal context" in prompt)
print("--- Amanda content present:", "crew chief" in prompt.lower())
EOF
```

Expected output includes all three True lines.

**Step 3: Repeat smoke check for Gangle**

Change visitor name to `"Gangle"`, relationship to `"pacer"`. Verify "Personal context" present and "Leg B" in prompt.

**Step 4: Final commit (if any test fixes needed)**

```bash
git add -p
git commit -m "fix: address test failures from race context file integration"
```

---

### Task 7: Deploy to droplet

**Step 1: Push to main**

```bash
git push origin main
```

**Step 2: Pull and restart on droplet (API only — tunnel stays up)**

```bash
ssh root@107.170.32.201 'cd /var/crew-chief && git pull origin main && bash scripts/droplet-update-code.sh'
```

**Step 3: Phone test**

- Open Ask Harvey on your phone
- Set relationship to **Crew**, name **Amanda** → send "what do I need to know for today?"
- Verify she gets crew-chief context + course detail
- Set relationship to **Pacer**, name **Gangle** → verify Leg B content appears
- Set relationship to **Stranger** → verify NO personal context block, but course info IS present

**Step 4: Done.**
