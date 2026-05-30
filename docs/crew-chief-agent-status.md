# Crew Chief Agent 2.0 — project status

**Last updated:** 2026-05-30

## Shipped in repo (pending merge to `main`)

| Piece | Path | PR |
|-------|------|-----|
| TrackLeaders poller | `poller/` | #5 |
| FastAPI backend | `server/` | #6 / #7 |
| Chat UI | `ui/` → `/crew-chief/agent/` | #7 |
| Voice (draft) | `voice.md` | #7 |
| Deploy runbook | `docs/superpowers/runbooks/crew-chief-agent-deploy.md` | this branch |
| Test checklist | `docs/superpowers/runbooks/crew-chief-agent-test-checklist.md` | this branch |
| Mac mini failover | `docs/superpowers/runbooks/crew-chief-agent-failover-mac-mini.md` | this branch |
| Smoke test script | `scripts/verify-agent.sh` | this branch |
| PM2 config | `deploy/ecosystem.config.cjs` | this branch |

## Phase tracker

### Phase 1 — Merge & static deploy
- [x] Merge integration PR to `main` (2026-05-30, commit `383b442`)
- [ ] Set GitHub variable `PUBLIC_AGENT_API_URL`
- [ ] Confirm `/crew-chief/agent/` on Pages

### Phase 2 — Droplet + tunnel
- [ ] Follow `crew-chief-agent-deploy.md`
- [ ] PM2 + poller cron running
- [ ] Tunnel URL → GitHub variable → Pages redeploy

### Phase 3 — Content & testers
- [ ] Harvey approves `voice.md`
- [ ] 3 testers complete checklist

### Phase 4 — Race-week readiness (by June 10)
- [ ] Live TrackLeaders slug configured
- [ ] Failure drills complete
- [ ] Code freeze June 10 (`voice.md` OK until June 11)

### Phase 5 — Race weekend (June 12–17)
- [ ] Monitor PM2 + poller logs
- [ ] Mac mini runbook accessible

## Quick commands

```bash
# Verify API
./scripts/verify-agent.sh https://YOUR-TUNNEL-URL

# Local full stack
cd server && uvicorn app:app --port 8080
cd poller && TRACKLEADERS_EVENT_SLUG=copper26 TRACKLEADERS_RUNNER_NAME=Trailbreaker_1 python3 poll.py --dry-run
PUBLIC_AGENT_API_URL=http://127.0.0.1:8080 npm run build && npm run preview
```
