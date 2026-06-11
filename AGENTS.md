# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Harvey's Tahoe 200 (2026) crew/family site: **Astro 5** static site at repo root, plus an optional **Cloudflare broadcast Worker** in `workers/broadcast/`. Race data lives in `data/*.json`. No database, no Docker.

### Services

| Service | Command | URL |
|---------|---------|-----|
| Astro dev (primary) | `npm run dev` (repo root) | http://localhost:4321/ |
| Ask Harvey local UI | `npm run dev:agent` (repo root) | http://localhost:4321/ → API :8080 |
| Astro preview | `npm run build && npm run preview` | printed in terminal |
| Broadcast Worker | `cd workers/broadcast && npm run dev` | http://127.0.0.1:8787 |

### Standard commands

See `README.md` and root `package.json`:

- **Install:** `npm ci --ignore-scripts` at repo root; same in `workers/broadcast/` for the Worker.
- **Build:** `npm run build` (root)
- **Worker tests:** `cd workers/broadcast && npm test` (Vitest; no server required)
- **Lint:** not configured in this repo.

Node **22** matches CI (`.github/workflows/deploy.yml`).

### Non-obvious gotchas

1. **Wrangler interactive prompt:** First `npm run dev` in `workers/broadcast/` may ask whether to install Cloudflare skills for Cursor. Answer `n` (or send `n` via tmux) so the dev server can start non-interactively.
2. **Base path:** Astro serves at `/` locally and on **https://wheresharvey.com/** (`astro.config.mjs`). Legacy `/crew-chief/` paths are retired.
3. **Broadcast E2E locally:** Copy `.env.example` to `.env` (`PUBLIC_BROADCAST_API_URL=http://127.0.0.1:8787`) and run both Astro dev and Worker dev. `/update/` needs a real `GITHUB_TOKEN` on the Worker for saves.
4. **TrackLeaders preview:** `/preview/wheres-harvey/?mode=demo` works without Worker secrets.

### Long-running processes

Use tmux for dev servers, e.g. session `astro-dev-server` with `npm run dev` at repo root.

### Crew Chief Agent 2.0 (poller + API + chat UI)

| Service | Command | URL |
|---------|---------|-----|
| FastAPI backend | `cd server && uvicorn app:app --port 8080` | http://127.0.0.1:8080 |
| TrackLeaders poller | `cd poller && python3 poll.py` | writes `data/harvey_status.json` |
| Chat UI (built) | `PUBLIC_AGENT_API_URL=http://127.0.0.1:8080 npm run build && npm run preview` | http://localhost:4321/ |

- **Deploy runbook:** `docs/superpowers/runbooks/crew-chief-agent-deploy.md`
- **Cody simulation demo (local):** `docs/superpowers/runbooks/agent-simulation-demo.md`
- **Architecture spec:** `docs/superpowers/specs/crew-chief-agent-architecture.md`
- **Smoke test:** `./scripts/verify-agent.sh http://127.0.0.1:8080`
- **Droplet env check:** `bash scripts/check-agent-env.sh`
- **Race-week poller:** `sudo bash scripts/race-week-switch.sh`
- **Failure drills:** `bash scripts/run-failure-drills.sh`
- **Failure drills:** `bash scripts/run-failure-drills.sh`
- **Droplet update:** `bash scripts/droplet-update.sh` (on server — pull + full PM2 restart)
- **Droplet code-only update:** `bash scripts/droplet-update-code.sh` (pull + API restart; keeps tunnel URL)
- **Droplet share prep:** `bash scripts/droplet-share-prep.sh` (on server — pull, reset status, pin, PM2 restart)
- **Droplet auto-deploy:** GitHub Actions `agent-droplet-deploy.yml` on push to `main` (needs `DROPLET_*` secrets)
- **Tunnel URL:** `bash scripts/tunnel-url.sh` (on server)
- **Named tunnel setup:** `bash scripts/droplet-named-tunnel-setup.sh` (on server, once — stable `https://agent.wheresharvey.com`)
- **Pre-race poller:** `bash scripts/poller-preflight-setup.sh` (on server)
- **Droplet full preflight:** `bash scripts/droplet-full-preflight.sh` (on server)
- **Laptop preflight:** `npm run agent:preflight`
- **Server tests:** `cd server && python3 -m pytest -q`
- **Poller tests:** `cd poller && python3 -m pytest -q`
- Set `ANTHROPIC_API_KEY` in `server/.env` for live Claude replies (otherwise `/chat` returns `fallback.md`).
