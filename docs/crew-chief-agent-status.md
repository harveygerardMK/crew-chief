# Crew Chief Agent 2.0 — project status

**Last updated:** 2026-05-31 (stack live — handoff)

**Handoff:** [2026-05-31-agent-handoff.md](../sessions/2026-05-31-agent-handoff.md)  
**Architecture:** [crew-chief-agent-architecture.md](superpowers/specs/crew-chief-agent-architecture.md)  
**Race week ops:** [crew-chief-agent-race-week.md](superpowers/runbooks/crew-chief-agent-race-week.md)

## Live stack (verified)

| Layer | Status |
|-------|--------|
| Pages UI | https://harveygerardMK.github.io/crew-chief/agent/ |
| `PUBLIC_AGENT_API_URL` | `https://views-spirit-words-built.trycloudflare.com` |
| Droplet API :8080 | `/health` + `/ready` OK, `claude_configured` |
| Chat smoke test | `fallback=false`, NGA `art_image_url` |
| CI deploy | Green |

## Phase tracker

### Phase 1 — Merge & static deploy ✅
All complete.

### Phase 2 — Droplet + tunnel ✅
All complete. Poller preflight (`copper26`) verified on droplet 2026-05-31.

### Phase 3 — Content & testers
- [x] Voice, prompts, UI, checklist ready
- [x] Harvey approves `voice.md` (2026-05-31)
- [ ] 3 testers complete checklist

### Phase 4 — Race-week readiness (by June 10)
- [x] Scripts: race-week switch, failure drills, race-week runbook
- [ ] Failure drills executed on droplet
- [ ] Code freeze June 10

### Phase 5 — Race weekend (June 12–17)
- [ ] Monitor PM2 + poller
- [ ] Mac mini failover runbook accessible

## Ops scripts (on droplet)

```bash
bash scripts/droplet-update.sh          # pull + PM2 restart
bash scripts/tunnel-url.sh              # print trycloudflare URL
bash scripts/poller-preflight-setup.sh  # copper26 test poller
bash scripts/check-agent-env.sh         # .env + /ready
sudo bash scripts/race-week-switch.sh   # June 12 — tahoe20026
bash scripts/run-failure-drills.sh      # failure drills
```

## From laptop

```bash
npm run agent:verify
# or
./scripts/verify-agent.sh https://views-spirit-words-built.trycloudflare.com
```

## Known gotchas

- Quick tunnel URL changes when `cloudflared` restarts → `tunnel-url.sh` → update GitHub variable → redeploy Pages
- API keys must be plain ASCII (no em dashes)
- PM2 must use port **8080** (`deploy/ecosystem.config.cjs`)
