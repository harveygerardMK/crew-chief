# Audience-based suggested questions (on course vs remote)

**Status:** Implemented (2026-06-01)  
**Date:** 2026-06-01  
**Goal:** One onboarding fork drives suggested chips and primary chat tone. Fixes cases like Amanda choosing “family” while needing crew-logistics prompts.

---

## Problem

Onboarding asks **“How do you know Harvey?”** (`family` | `friend` | `crew` | `pacer` | `stranger`). That single field drives:

- Suggested question chips (`PROMPT_CHIPS` in `ui/app.js`)
- Relationship tone in the system prompt (`RELATIONSHIP_TONE` in `server/prompt.py`)

Personal briefs (`agent-context/*.md`) load by **display name**, not relationship. A crew chief can pick **family**, get family chips and family tone, while still receiving `amanda.md` in the prompt — confusing and wrong for UX.

What actually matters for the UI: **Are you on the course helping, or following from afar?**

---

## Decision

**Two paths only:**

| `audience` | Meaning |
|------------|---------|
| `on_course` | Helping at the race — crew chief, crew, pacer, anyone in the van or at aids |
| `remote` | Watching from home — family, friends, curious visitors |

No second onboarding step for crew vs pacer vs family. Optional: keep `relationship` in storage for analytics only (see migration) or drop it from new signups.

---

## Onboarding UX

Replace the five relationship pills with one fieldset:

**Legend (example copy):**

> Will you be **helping at the race**, or **watching from afar**?

**Options:**

1. **Helping at the race** — crew chief, crew, pacer (`audience=on_course`)
2. **Watching from afar** — family, friends, or just checking in (`audience=remote`)

Subtext on remote (optional, Harvey voice):

> Same question we’re all asking: *what’s he doing out there?*

Collect **name** (unchanged) + **audience** (required).

---

## Suggested question chips

Two static lists in `ui/app.js` (names TBD in implementation):

### `on_course`

- What’s the next crew-access aid?
- What should we have ready at the next stop?
- Is he on pace for the next cutoff?

### `remote`

- How is he doing right now?
- Is he resting or still moving?
- Where is he on the course?

Render chips from `visitor.audience` (localStorage `cc_visitor_audience`), not `relationship`.

---

## Server / prompt behavior

### Visitor record (`data/visitors.json`)

Add field:

```json
"audience": "on_course" | "remote"
```

`POST /visitors` (or equivalent create endpoint) accepts `audience` instead of (or in addition to) `relationship`.

### Tone (`server/prompt.py`)

Replace or supplement `RELATIONSHIP_TONE` with **`AUDIENCE_TONE`**:

| `audience` | Tone |
|------------|------|
| `on_course` | Operational, brief, clear. They know the plan; status, next aids, cutoffs, crew logistics. |
| `remote` | Warm, reassuring, less jargon. Pulse-check: moving vs resting, where on course, don’t invent detail. |

**Known people** (`data/known-people.json` + `agent-context/*.md`): unchanged — still by name. Amanda gets `amanda.md` **and** `on_course` tone/chips when she selects helping at the race.

**Optional smart default (D, minimal):** If `lookup_known_person(name)` matches an entry with `"default_audience": "on_course"`, pre-check “Helping at the race” in the UI before submit. Does not block remote if they choose it.

### Validation

`VALID_AUDIENCES = frozenset({"on_course", "remote"})` in `server/config.py`.

---

## What happens to `relationship`

| Option | Recommendation |
|--------|----------------|
| **A. Remove from new signups** | New visitors only have `audience`. Simplest. |
| **B. Keep but optional** | Accept `relationship` if sent; ignore for chips/tone. Use for post-race analytics. |

**Recommendation:** **A** for race week — one source of truth. Migrate old records (below).

---

## Migration (existing visitors)

On read or one-time script when loading visitor:

| Old `relationship` | New `audience` |
|--------------------|----------------|
| `crew`, `pacer` | `on_course` |
| `family`, `friend`, `stranger` | `remote` |

If `audience` already set, leave it.

**Amanda** (and similar): If already in DB as `family`, migration sets `remote` unless manually fixed or she re-onboards. **Pre-select** `on_course` when name matches `known-people` with `default_audience: on_course` (add to Amanda’s entry).

---

## Files to touch (implementation plan preview)

| Area | Files |
|------|--------|
| UI onboarding + chips | `ui/index.html`, `ui/app.js`, `ui/styles.css` |
| Built assets | `public/app.js` via `node scripts/copy-ui.mjs` |
| API | `server/app.py` (create visitor body), `server/visitors.py`, `server/config.py` |
| Prompt | `server/prompt.py` (`AUDIENCE_TONE`, `format_visitor_block`) |
| Tests | `server/tests/test_server.py` |
| Docs | `docs/superpowers/runbooks/agent-persona-content-guide.md` |

---

## Out of scope

- Per-name chip sets (beyond optional pre-select)
- Second question for crew vs pacer
- Changing `agent-context` loading rules
- Server-generated dynamic chips from live status (future)

---

## Success criteria

- New visitor picks **on course** → sees logistics-oriented chips; chat tone operational.
- New visitor picks **remote** → sees pulse-check chips; chat tone warm and simple.
- Amanda (and crew) selecting **on course** get crew chips even if she is family in real life.
- Existing `crew`/`pacer` visitors behave as `on_course` after deploy without re-onboarding (migration).

---

## Test plan

- [ ] Create visitor `on_course` → chips match on_course list
- [ ] Create visitor `remote` → chips match remote list
- [ ] System prompt includes `AUDIENCE_TONE` for each
- [ ] Migration: old `crew` record → `on_course` chips on return visit
- [ ] Known-person pre-select (if implemented): typing “Amanda” highlights on course
