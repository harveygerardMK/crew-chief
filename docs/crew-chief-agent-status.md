# Crew Chief Agent 2.0 — project status

**Last updated:** 2026-05-31 (autonomous push — stack complete)

**Handoff:** [2026-05-31-agent-handoff.md](../sessions/2026-05-31-agent-handoff.md)  
**Architecture:** [crew-chief-agent-architecture.md](superpowers/specs/crew-chief-agent-architecture.md)  
**Race week ops:** [crew-chief-agent-race-week.md](superpowers/runbooks/crew-chief-agent-race-week.md)

## Live stack (verified)

| Layer | Status |
|-------|--------|
| Pages UI | https://harveygerardMK.github.io/crew-chief/agent/ |
| `PUBLIC_AGENT_API_URL` | `https://views-spirit-words-built.trycloudflare.com` |
| Droplet API :8080 | `/health` + `/ready` OK, `claude_configured` |
| Poller | `copper26` preflight — mile data live on `/status` |
| Chat smoke test | `fallback=false`, NGA `art_image_url` |
| CI deploy + agent tests | Green |
| Scheduled health | `.github/workflows/agent-health.yml` (8 AM / 8 PM UTC) |

## Phase tracker

### Phase 1 — Merge & static deploy ✅

### Phase 2 — Droplet + tunnel ✅
Poller preflight verified on droplet 2026-05-31. Run `ensure-poller-cron.sh` on droplet if cron not yet confirmed.

### Phase 3 — Content & testers
- [x] Voice approved 2026-05-31
- [x] Tester invites (family / friend / pacer / generic)
- [ ] **3 humans** complete mobile checklist — [Issue #10](https://github.com/harveygerardMK/crew-chief/issues/10)
- [ ] Harvey self-test: family vs friend tone (optional)

### Phase 4 — Race-week readiness (by June 10)
- [x] Scripts + runbooks ready
- [ ] Failure drills on droplet (`run-failure-drills.sh`)
- [ ] Code freeze June 10

### Phase 5 — Race weekend (June 12–17)
- [ ] `race-week-switch.sh` on June 12 morning
- [ ] Monitor PM2 + poller logs

## One-command checks

**Mac:**
```bash
npm run agent:preflight
```

**Droplet:**
```bash
bash scripts/droplet-full-preflight.sh
```

## Known gotchas

- Quick tunnel URL changes when `cloudflared` restarts → `tunnel-url.sh` → update GitHub variable → redeploy Pages
- API keys must be plain ASCII
- PM2 port **8080** (`deploy/ecosystem.config.cjs`)
