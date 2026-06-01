# Design: Race Context Files for Ask Harvey

**Date:** 2026-06-01  
**Status:** Approved

---

## Problem

The agent loads `voice.md`, `harvey.md`, `data/aid-stations.json`, and `data/known-people.json` — but not the four prose content pages published at wheresharvey.com/course/. Visitors asking "what's the plan" or "what's the course like" got incomplete answers. Named individuals (Amanda, Brendan, Zuzy) also lacked operational detail beyond the brief notes in `known-people.json`.

---

## Solution

Two complementary additions:

### 1. Site content pages → all visitors

Load all four `src/content/pages/*.md` files into every system prompt.

**Files:**
- `course-overview.md` — route narrative, what to expect on trail
- `about-the-race.md` — race background
- `pacer-onboarding.md` — general pacer info
- `rules-summary.md` — rules

**Implementation:** New `load_course_content(settings)` function in `server/prompt.py`. Injected after `harvey.md`, before the status block. Matches the existing `load_harvey_profile()` pattern.

**Cost:** ~1–2K tokens per request. Acceptable.

### 2. `agent-context/` files → named individuals only

New `agent-context/` directory at repo root. A new `load_agent_context(visitor, settings)` function injects the matching file when the visitor's display name matches.

**Files to create:**
- `agent-context/amanda.md` — crew chief playbook: aid stops she's hitting, what to have ready, parking notes, Harvey's needs per stop
- `agent-context/brendan.md` — Leg B (Barker Pass → Tahoe City): what Harvey needs, sleep risk, Stephen Jones note, sunrise payoff
- `agent-context/zuzy.md` — Leg C (Tahoe City → Brockway Summit): what Harvey needs, legend treatment

**Matching:** Reuse `match_names` arrays from `known-people.json` as the source of truth for nicknames (Gangle → `brendan.md`, Queen Z → `zuzy.md`). Loader cross-references known-people to resolve the filename.

**Position in prompt:** Injected immediately after the known-person block so the two layers stack cleanly.

---

## Files changed

| File | Change |
|------|--------|
| `server/prompt.py` | Add `load_course_content()` and `load_agent_context()`, call both in `build_system_prompt()` |
| `agent-context/amanda.md` | New — crew chief playbook |
| `agent-context/brendan.md` | New — Leg B pacer brief |
| `agent-context/zuzy.md` | New — Leg C pacer brief |

`known-people.json` and `voice.md` unchanged (existing notes remain; `agent-context/` files add depth, not replace).

---

## What does NOT change

- `voice.md` tone sections — unchanged
- `data/known-people.json` existing entries — unchanged, still loaded
- `data/aid-stations.json` + remote fetch — unchanged
- Deploy workflow — same `droplet-update-code.sh` after push to main
