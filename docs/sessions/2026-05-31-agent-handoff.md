# Handoff — Ask Harvey agent (2026-05-31)

**Status:** Stack live. Phases 1–2 complete. Phase 3 = send invites.

## Live

| What | URL |
|------|-----|
| Ask Harvey | https://harveygerardMK.github.io/crew-chief/agent/ |
| API tunnel | `https://views-spirit-words-built.trycloudflare.com` |
| Preflight (Mac) | `npm run agent:preflight` |
| Tester tracking | [Issue #10](https://github.com/harveygerardMK/crew-chief/issues/10) |

Verified: chat `fallback=false`, NGA art, `/ready` OK, poller mile data on `/status`.

## Done without you

- [x] voice.md approved
- [x] GitHub variable + Pages deploy
- [x] Droplet pull, poller preflight, env check
- [x] Tester invite copy (family / friend / pacer / generic)
- [x] Scheduled CI health checks (8 AM / 8 PM UTC)
- [x] `npm run agent:preflight` one-command Mac verify

## Still needs a human

| Task | How |
|------|-----|
| **3 testers** | Send invites from `crew-chief-agent-tester-invite.md` → log in checklist → close #10 |
| **Poller cron confirm** | On droplet: `bash scripts/ensure-poller-cron.sh` |
| **Failure drills** | On droplet: `bash scripts/run-failure-drills.sh` |
| **June 12** | `sudo bash scripts/race-week-switch.sh` |

## Tunnel URL changed?

```bash
bash scripts/tunnel-url.sh   # droplet
gh variable set PUBLIC_AGENT_API_URL --body "NEW_URL" -R harveygerardMK/crew-chief
gh workflow run "Deploy to GitHub Pages" -R harveygerardMK/crew-chief
```

## Cursor / SSH

Agent SSH from Cursor still blocked (`Permission denied`). Your Terminal SSH works. Droplet one-liner:

```bash
bash scripts/droplet-full-preflight.sh
```
