# Handoff — Ask Harvey agent (2026-05-31)

Harvey went to bed with the stack **live**. No action required unless something breaks.

## What's working

- **Chat:** https://harveygerardMK.github.io/crew-chief/agent/
- **API tunnel:** `https://views-spirit-words-built.trycloudflare.com`
- **GitHub variable:** `PUBLIC_AGENT_API_URL` set and Pages deployed
- **Droplet:** PM2 `crew-chief-api` + `cloudflared` on port **8080**
- **Smoke test:** `fallback=false`, NGA art images, `/ready` OK

## When you wake up (optional, 5 min)

1. Phone-test Ask Harvey — send one message
2. On droplet (if tracker still shows stale):
   ```bash
   ssh root@107.170.32.201
   cd /var/crew-chief && bash scripts/poller-preflight-setup.sh
   ```
3. ~~Sign off **`voice.md`**~~ — approved 2026-05-31
4. Send tester invite to 3 people — `docs/superpowers/runbooks/crew-chief-agent-tester-invite.md`

## Still on you (not automated)

- [x] Harvey approves `voice.md` (2026-05-31)
- [ ] 3 testers complete checklist
- [ ] Failure drills once (`bash scripts/run-failure-drills.sh` on droplet)
- [ ] **June 12:** `sudo bash scripts/race-week-switch.sh`

## If tunnel URL changes

Quick tunnel URLs change when `cloudflared` restarts:

```bash
bash scripts/tunnel-url.sh   # on droplet
```

Update GitHub variable → redeploy Pages (or ask Cursor to run `gh variable set` + workflow).

## Cursor can continue from

- Status: `docs/crew-chief-agent-status.md`
- Architecture: `docs/superpowers/specs/crew-chief-agent-architecture.md`
- Race week: `docs/superpowers/runbooks/crew-chief-agent-race-week.md`
