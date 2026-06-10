# Ask Harvey — Cody race simulation (local demo)

Replay **Cody Delorenzo’s Cocodona 250** SPOT history as fake “live” miles for Harvey’s Tahoe 200. Use this to stress-test chat, stale banners, art cards, return visits, and audience chips **before race week**.

**Rule:** Run simulation on your **laptop only**. Never write simulation status to the **production droplet** while `https://wheresharvey.com/agent/` points at that API.

---

## What it does

| Piece | Role |
|-------|------|
| `data/simulation_track.json` | ~623 pings parsed from Cody’s TrackLeaders JS |
| `scripts/simulate_race.py` | Replays pings into `data/harvey_status.json` with `"simulation": true` |
| `scripts/agent-demo.sh` | API + Astro `/agent/` + simulation (one command) |
| Poller | **Skips** writes while `simulation: true` (unless `--force`) |
| Agent prompt | Instructs Claude to say **demo replay**, not live Tahoe GPS |

---

## Safety checklist

- [ ] Use **http://localhost:4321/** or **http://localhost:4321/agent/** during the demo (not the public site URL). Both serve Ask Harvey after `ui:copy` + `npm run dev`.
- [ ] Do **not** run `simulate_race.py` against `/var/crew-chief/data/harvey_status.json` on the droplet.
- [ ] Do **not** change GitHub `PUBLIC_AGENT_API_URL` to localhost for testing.
- [ ] Optional: leave `GITHUB_TOKEN` unset in local `server/.env` so test chats don’t auto-backup `visitors.json` to GitHub.
- [ ] After the demo: confirm `data/harvey_status.json` has no `"simulation": true` (or run restore — below).

---

## One-time setup

From repo root:

```bash
cd /path/to/crew-chief
```

Generate the track file (skipped if `data/simulation_track.json` already exists):

```bash
python3 scripts/parse_simulation_track.py
```

Optional: refresh from TrackLeaders:

```bash
python3 scripts/parse_simulation_track.py --fetch
```

Local API keys (for live Claude replies, not fallback):

```bash
cp server/.env.example server/.env
# Edit server/.env — at minimum ANTHROPIC_API_KEY
cd server && python3 -m pip install -r requirements.txt
```

---

## Full demo (recommended)

Starts API on **8080**, Astro dev on **4321**, then replays Cody at **50×** (~77 minutes for the full track):

```bash
npm run agent:demo
```

Open **http://localhost:4321/** (primary) or **http://localhost:4321/agent/**.

If you see **404** on `/` or `/agent/`, restart `npm run dev` (needs current `astro.config.mjs`), or open **http://localhost:4321/index.html** directly.

Stop with **Ctrl+C**. The script restores `harvey_status.json` from `harvey_status_real.json` on exit.

### Chapters (focused runs)

| Chapter | Starts at ping | Use for |
|---------|----------------|---------|
| `early` | 1 | Onboarding, first miles, demo disclaimer |
| `aid-station` | 197 | Long stop ~mile 51 |
| `signal-gap` | 241 | 65‑min blackout ~mile 59 |
| `sleep` | 333 | Sleep station ~mile 83 |
| `dnf` | 568 | DNF zone ~mile 124 |

Examples:

```bash
npm run agent:demo -- --chapter signal-gap --speed 100
npm run agent:demo -- --chapter dnf --speed 200
```

### Speed

`--speed N` compresses real time (gap minutes ÷ N). Higher = faster replay.

---

## API + simulation only

If Astro is already running (`npm run dev:agent` in another terminal — wires API URL automatically):

```bash
# Terminal A — API
cd server && uvicorn app:app --port 8080

# Terminal B — UI (config.js → http://127.0.0.1:8080)
npm run dev:agent

# Terminal C — simulation
npm run agent:sim -- --chapter early --speed 100
```

Plain `npm run dev` does **not** set `CREW_CHIEF_API`; use `dev:agent` or `PUBLIC_AGENT_API_URL=http://127.0.0.1:8080 npm run ui:copy` before `npm run dev`.

---

## Dry run (no file writes, no sleep)

Print the ping schedule only:

```bash
python3 scripts/simulate_race.py --dry-run --speed 50
python3 scripts/simulate_race.py --dry-run --chapter sleep --speed 100
```

---

## Restore real status

If simulation left `harvey_status.json` in demo mode:

```bash
npm run agent:restore
# or
python3 scripts/restore_real_status.py
```

Verify:

```bash
python3 -c "import json; d=json.load(open('data/harvey_status.json')); print('simulation=', d.get('simulation'))"
```

Expect `simulation= None` or `False`.

---

## Quick smoke test (no full replay)

With API running on 8080:

```bash
./scripts/verify-agent.sh http://127.0.0.1:8080
```

Write one simulation ping and check `/status`:

```bash
python3 - <<'PY'
import json
from pathlib import Path
import sys
sys.path.insert(0, "scripts")
from simulate_race import TRACK_FILE, STATUS_FILE, backup_status, build_status, write_status

pings = json.loads(Path(TRACK_FILE).read_text(encoding="utf-8"))
backup_status(STATUS_FILE)
write_status(STATUS_FILE, build_status(pings[0]))
print("Wrote ping #1 mile", pings[0]["route_mile"])
PY

curl -s http://127.0.0.1:8080/status | python3 -m json.tool | grep -E 'simulation|route_mile|source_url'

npm run agent:restore
```

`verify-agent.sh` registers a test visitor with `{"name":"…","audience":"remote"}` (or `on_course`).

---

## What to exercise in the UI

1. **Early** — complete onboarding; ask *“How is he doing?”*; reply should mention **demo replay**; amber simulation banner (dismissible).
2. **Signal-gap** — stale / signal-gap UI; agent acknowledges old GPS.
3. **Sleep** — long stop; close tab and reopen for **return visit** / catch-up.
4. **DNF** — final chapter; stale handling after last ping.
5. **Audience chips** / known visitors — if configured in `data/known-people.json`.

---

## Langfuse (optional)

With keys in `server/.env`, chat traces include `simulation: true` in metadata. See **crew-chief-agent-langfuse.md**.

```bash
npm run agent:demo
# chat in UI, then filter traces by simulation in Langfuse
```

Heuristic check script:

```bash
./scripts/verify-langfuse-traces.sh http://127.0.0.1:8080
```

---

## Production vs simulation

| Environment | Cody simulation? |
|-------------|------------------|
| Laptop `npm run agent:demo` | ✅ Yes |
| Droplet share week (`droplet-share-prep.sh`) | ❌ Mile 0, anxious, **pinned** — not Cody |
| Droplet race week (`race-week-switch.sh`) | ❌ Live TrackLeaders poller only |

---

## Related docs

- **crew-chief-agent-test-checklist.md** — family tester pass on public URL
- **crew-chief-agent-langfuse.md** — trace audits during sim
- **agent-persona-content-guide.md** — simulation voice rules
- `cursor-simulation-prompt.md` — original spec (milestones / flags)
