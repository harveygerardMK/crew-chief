# Crew Chief Agent 2.0 — project status

**Last updated:** 2026-05-31 (Phase 2 architecture slice)

**Architecture spec:** [crew-chief-agent-architecture.md](superpowers/specs/crew-chief-agent-architecture.md)

## Shipped in repo (on `main`)

| Piece | Path |
|-------|------|
| TrackLeaders poller | `poller/` |
| FastAPI backend | `server/` |
| Chat UI | `ui/` → `/crew-chief/agent/` |
| Voice (draft) | `voice.md` |
| Architecture spec | `docs/superpowers/specs/crew-chief-agent-architecture.md` |
| Deploy runbook | `docs/superpowers/runbooks/crew-chief-agent-deploy.md` |
| Test checklist | `docs/superpowers/runbooks/crew-chief-agent-test-checklist.md` |
| Mac mini failover | `docs/superpowers/runbooks/crew-chief-agent-failover-mac-mini.md` |
| Smoke test script | `scripts/verify-agent.sh` |
| Env validation (droplet) | `scripts/check-agent-env.sh` |
| Race-week poller switch | `scripts/race-week-switch.sh` |
| Failure drill guide | `scripts/run-failure-drills.sh` |
| Droplet git pull + restart | `scripts/droplet-update.sh` |
| NGA art card images | `data/art-pairings.json` + `server/art.py` |
| PM2 config | `deploy/ecosystem.config.cjs` (API + cloudflared) |

## Phase tracker

### Phase 1 — Merge & static deploy
- [x] Merge integration PR to `main` (2026-05-30, commit `383b442`)
- [x] Ask Harvey link on crew site home + follow page
- [x] GitHub variable `PUBLIC_AGENT_API_URL` set (trycloudflare tunnel)
- [x] `/crew-chief/agent/` on Pages wired to tunnel (config.js verified)

### Phase 2 — Droplet + tunnel
- [x] Droplet provisioned (`crew-chief-agent`, 107.170.32.201)
- [x] PM2 API running; live chat verified (Amanda test)
- [x] `/ready` ops endpoint + `check-agent-env.sh`
- [x] PM2 ecosystem includes cloudflared (restart droplet to pick up)
- [x] Tunnel URL → GitHub variable → Pages deploy (CI smoke test on build)
- [ ] Droplet `git pull` via `scripts/droplet-update.sh` (brings `/ready`, NGA art, latest UI copy)
- [ ] Poller cron returning fresh status (pre-race: `copper26` test slug OK)
- [x] CI: `agent-tests.yml` + deploy verifies `dist/agent/`

### Phase 3 — Content & testers
- [x] `voice.md` — pacer tone, pre-race section, Harvey sign-off block
- [x] Relationship-specific tone injected in system prompt
- [x] UI: pre-race status label, fallback banner when `fallback: true`
- [x] Tester checklist — sample questions by relationship
- [ ] Harvey approves `voice.md` (check box at top of file)
- [ ] 3 testers complete checklist

### Phase 4 — Race-week readiness (by June 10)
- [x] `scripts/race-week-switch.sh` — flip poller to `tahoe20026`
- [x] `scripts/run-failure-drills.sh` — guided ops drills
- [ ] Failure drills executed on droplet
- [ ] Code freeze June 10 (`voice.md` OK until June 11)

### Phase 5 — Race weekend (June 12–17)
- [ ] Monitor PM2 + poller logs
- [ ] Mac mini runbook accessible

## Quick commands

```bash
# On droplet — env + API sanity
bash scripts/check-agent-env.sh
curl -s http://127.0.0.1:8080/ready | python3 -m json.tool
pm2 logs cloudflared   # tunnel URL

# Verify API from laptop
./scripts/verify-agent.sh https://YOUR-TUNNEL-URL

# Local full stack
cd server && uvicorn app:app --port 8080
cd poller && TRACKLEADERS_EVENT_SLUG=copper26 TRACKLEADERS_RUNNER_NAME=Trailbreaker_1 python3 poll.py --dry-run
PUBLIC_AGENT_API_URL=http://127.0.0.1:8080 npm run build && npm run preview
```

## Known gotchas (from ops)

- Paste API keys as plain ASCII — em dashes and smart quotes break httpx (`UnicodeEncodeError`).
- Key must start with `sk-ant-api03-…` once — duplicated `sk-ant-sk-ant-` prefix means bad paste.
- Low Anthropic credits → `fallback: true` in `/chat` (verify script warns).
- Align API port with ecosystem: **8080** (if droplet still on 8000, restart with `deploy/ecosystem.config.cjs`).
