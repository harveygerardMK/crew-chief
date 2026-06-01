# Agent persona content guide

**Purpose:** Context for writing and updating persona-focused content for Ask Harvey (crew chief, pacers, friends, family) without breaking chat, the tunnel, or the crew site.

**Last updated:** 2026-06-01

---

## How Ask Harvey knows who is talking

On first visit, the visitor picks **How do you know Harvey?**


| UI label | Stored value | Use for                         |
| -------- | ------------ | ------------------------------- |
| Family   | `family`     | Parents, siblings, close family |
| Friend   | `friend`     | Friends (“the shitheads”)       |
| Crew     | `crew`       | Crew chief, pit crew, logistics |
| Pacer    | `pacer`      | Anyone pacing on course         |
| Curious  | `stranger`   | New visitors                    |


That choice is saved in the browser and sent with every chat message.

**Amanda (crew chief)** should pick **Crew** at onboarding. **Gangle / Queen Z** should pick **Pacer**. Relationship sets tone; personal briefs load by **name** (see below).

---

## What the server loads into every chat

Built in `server/prompt.py` — order matters:


| Source               | File / data                                                 | Who receives it                                              |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| Scope lock           | `server/race_data.py`                                       | Everyone                                                     |
| Race logistics       | `data/aid-stations.json` (+ site `/data/aid-stations.json`) | Everyone — **authoritative for miles, cutoffs, crew access** |
| Voice & tone         | `voice.md` (repo root)                                      | **Entire file, every visitor**                               |
| Inner voice          | `harvey.md` (repo root)                                     | Everyone                                                     |
| Course pages         | `src/content/pages/*.md` (four pages, concatenated)         | Everyone                                                     |
| Live tracker         | `data/harvey_status.json`                                   | Everyone                                                     |
| Visitor block        | `data/visitors.json`                                        | That session’s name + relationship                           |
| Known person bullets | `data/known-people.json`                                    | If **display name** matches `match_names`                    |
| **Personal brief**   | `agent-context/{stem}.md`                                   | If name maps via `known-people.json` (see below)             |
| Relationship tone    | `prompt.py` `RELATIONSHIP_TONE`                             | Matching relationship pill only                              |


Random `.md` under `docs/` is **not** read by the agent.

---

## Personal briefs (`agent-context/*.md`) — shipped

Long-form playbooks load **only when the visitor’s onboarding name** matches an entry in `data/known-people.json`.

### How matching works

1. `known-people.json` lists `match_names` per person (e.g. `"amanda"`, `"gangle"`, `"queen z"`).
2. The **first** `match_names` entry becomes the file stem: `amanda` → `agent-context/amanda.md`, `brendan` → `agent-context/brendan.md`, `zuzy` → `agent-context/zuzy.md`.
3. Any alias in `match_names` resolves to that same file.
4. `load_agent_context()` in `server/prompt.py` injects the file under `**## Personal context for this visitor`**.

### Current files


| File                       | Typical signup names         |
| -------------------------- | ---------------------------- |
| `agent-context/amanda.md`  | Amanda                       |
| `agent-context/brendan.md` | Brendan, Gangle, Gangl       |
| `agent-context/zuzy.md`    | Zuzy, Queen Z, Queen-Z, etc. |


### Adding a new person

1. Add `agent-context/{stem}.md` where `{stem}` is the normalized first alias (lowercase, spaces → hyphens): e.g. first alias `"cody"` → `cody.md`.
2. Add or extend an object in `data/known-people.json` with `match_names`, `label`, and short `notes` (still shown in the visitor block).
3. Push to `main` — droplet auto-deploy runs if GitHub secrets are set (see below).
4. Test with a **new** session using a matching name.

**Not relationship-based:** A `crew.md` for all crew pills does **not** exist yet. Everyone with relationship `crew` still only gets the personal brief if their **name** matches.

---

## Where to put new content

### 1. `agent-context/{person}.md` — deep briefs for named people

**Good for:** Crew chief playbook, pacer leg briefs, long logistics Amanda/Gangle need.

**Requires:** Matching `match_names` in `data/known-people.json`.

### 2. `data/known-people.json` — short bullets + name routing

**Good for:** Nicknames, one-line leg summary, pointers that also **wire** the MD file via first `match_names` entry.

```json
{
  "match_names": ["amanda"],
  "label": "Amanda Schaefer — Harvey's wife, crew chief",
  "notes": [
    "Short bullets still appear in the visitor block.",
    "Full playbook lives in agent-context/amanda.md."
  ]
}
```

Changing `match_names` or adding a person **requires a droplet deploy** (or auto-deploy on push to `main`).

### 3. `voice.md` — audience tone for everyone

Sections: `### Family`, `### Friends`, `### Crew`, `### Pacers`, `### Strangers`.

**Good for:** General tone, Nilbog, example lines — not 10-page playbooks (use `agent-context/`).

**Caution:** Whole file every request — keep it lean.

### 4. `harvey.md` — inner voice (everyone)

Substack frames, adventure language — not race logistics.

### 5. `data/aid-stations.json` — race facts only

Miles, cutoffs, crew access. Never contradict in MD.

### 6. `src/content/pages/*.md` — course copy (everyone)

Loaded as `## Course & race context`. Edits deploy to droplet via the same auto-deploy paths as `agent-context/`.

---

## Content routing cheat sheet


| You are writing…                              | Put it in                                       | Do not put it in         |
| --------------------------------------------- | ----------------------------------------------- | ------------------------ |
| Aid miles, cutoffs, crew access               | `data/aid-stations.json`                        | Persona MD               |
| Long crew/pacer playbook for Amanda/Gangle    | `agent-context/{stem}.md` + `known-people.json` | `voice.md` walls of text |
| How Harvey talks to crew vs friends (general) | `voice.md` sections                             | Duplicate aid tables     |
| Short nicknames / leg one-liners              | `known-people.json` `notes`                     | Secrets                  |
| Philosophy, “loosely held”                    | `harvey.md`                                     | Chat email sign-offs     |
| API keys, tunnel URLs                         | **Never in git**                                | Any MD                   |


**Citation rule:** Aid cutoffs and crew access → *(per race plan — confirm with crew before moving)*. Do not invent logistics outside the race data block.

---

## Deploy workflow

### Auto-deploy (preferred)

Pushes to `main` that touch any of these trigger **Deploy agent to droplet** (needs `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY`):

- `server/`**, `voice.md`, `harvey.md`
- `agent-context/`**
- `data/known-people.json`
- `src/content/pages/**`
- (see `.github/workflows/agent-droplet-deploy.yml` for full list)

Runs `scripts/droplet-update-code.sh` — **API only**; tunnel URL unchanged.

### Manual deploy

```bash
ssh root@107.170.32.201 'cd /var/crew-chief && git pull origin main && bash scripts/droplet-update-code.sh'
```

- **No** Pages redeploy for agent-only text changes.
- **Do not** run `droplet-update.sh` or `pm2 restart all` unless you mean to restart cloudflared.

### After editing

1. Push to `main` (or merge PR).
2. Confirm Actions workflow succeeded (or run manual SSH above).
3. Test on phone with matching **name** + correct relationship pill.

---

## Infrastructure (for writers)


| Piece     | URL                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------- |
| Crew site | [https://wheresharvey.com/](https://wheresharvey.com/)                                             |
| Agent API | [https://agent.wheresharvey.com](https://agent.wheresharvey.com)                                   |
| Race JSON | [https://wheresharvey.com/data/aid-stations.json](https://wheresharvey.com/data/aid-stations.json) |


```bash
curl -s https://agent.wheresharvey.com/health
curl -s https://wheresharvey.com/config.js | grep CREW_CHIEF_API
bash scripts/verify-named-tunnel.sh
```

---

## Pre-race vs race week

- **Pre-race:** No invented on-course miles; explain site if asked.
- **Race week:** Ground answers in `harvey_status.json`; say when GPS is stale.
- **Simulation:** If `simulation: true`, say demo tracker plainly.

---

## Nilbog

**Nilbog** = Harvey and Amanda’s Pomeranian (home). Dog questions are in scope; no scope-lock deflection. See `voice.md`.

---

## Tests

```bash
cd server && python3 -m pytest -q tests/test_prompt.py
```

Covers `load_agent_context()` for Amanda, Gangle, Queen Z.

---

## Related files


| File                                                         | Role                                            |
| ------------------------------------------------------------ | ----------------------------------------------- |
| `agent-context/*.md`                                         | Personal briefs (name-matched)                  |
| `data/known-people.json`                                     | Aliases + routing to MD stem                    |
| `voice.md`                                                   | Global tone by relationship                     |
| `harvey.md`                                                  | Inner voice                                     |
| `server/prompt.py`                                           | `load_agent_context()`, `load_course_content()` |
| `server/visitors.py`                                         | Visitor + known-person blocks                   |
| `.github/workflows/agent-droplet-deploy.yml`                 | Auto-deploy paths                               |
| `docs/superpowers/runbooks/crew-chief-agent-named-tunnel.md` | Stable tunnel                                   |
| `docs/superpowers/runbooks/crew-chief-agent-deploy.md`       | Full deploy runbook                             |


---

## Unplanned questions (approved strategy)

Blend **in-character Harvey** + **helpful ultra/Tahoe perspective** when facts aren’t in the prompt. Don’t invent logistics; do offer sensible 200-mile wisdom and defer to crew/site when unsure.

Full policy: [2026-06-01-agent-content-strategy-design.md](../specs/2026-06-01-agent-content-strategy-design.md) — includes copy-ready `voice.md` section to add.

**Not learning from chat:** each message is stateless except return-visitor catch-up in `visitors.json`. No RAG.

---

## Optional future improvement

**Relationship-scoped** files (e.g. `agent-context/crew.md` for every crew pill, not only Amanda) would need a separate loader — not implemented today.

**Multi-turn chat** — spec approved: [2026-06-01-chat-session-memory-design.md](../specs/2026-06-01-chat-session-memory-design.md) (history in tab only; fresh greeting each page load).