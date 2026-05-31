# Crew Chief Agent — race week ops (Harvey / crew)

One-page reference for **June 12–17, 2026**. Full detail in [deploy runbook](crew-chief-agent-deploy.md).

## URLs

| What | URL |
|------|-----|
| Ask Harvey (public) | https://harveygerardMK.github.io/crew-chief/agent/ |
| Crew site | https://harveygerardMK.github.io/crew-chief/ |
| Droplet SSH | `ssh root@107.170.32.201` |

## Daily check (2 min)

On droplet:

```bash
cd /var/crew-chief
pm2 status
bash scripts/check-agent-env.sh
curl -s http://127.0.0.1:8080/ready | python3 -m json.tool
tail -5 /var/log/harvey-poller.log
```

From laptop:

```bash
./scripts/verify-agent.sh "$(gh variable get PUBLIC_AGENT_API_URL -R harveygerardMK/crew-chief)"
```

## Before race start (June 12 morning)

```bash
cd /var/crew-chief
sudo bash scripts/race-week-switch.sh   # tahoe20026 + Harvey Schaefer
pm2 restart crew-chief-api
bash scripts/tunnel-url.sh              # if tunnel changed, update GitHub variable + redeploy Pages
```

## If chat shows fallback message

1. `bash scripts/check-agent-env.sh` — key ASCII? credits?
2. `pm2 logs crew-chief-api --lines 30`
3. Anthropic console → billing

## If chat won't connect at all

1. `bash scripts/tunnel-url.sh` — URL changed?
2. Update **Settings → Secrets and variables → Actions → Variables → `PUBLIC_AGENT_API_URL`**
3. Re-run **Deploy to GitHub Pages** workflow
4. Confirm: `curl -s https://harveygerardMK.github.io/crew-chief/agent/config.js | grep CREW_CHIEF_API`

## If tracker stale

Normal in canyons. If persistent:

```bash
cd /var/crew-chief/poller && python3 poll.py
cat /var/crew-chief/data/harvey_status.json
```

## Droplet down → Mac mini

See [failover runbook](crew-chief-agent-failover-mac-mini.md).

## Code freeze

**June 10** — no deploys except hotfixes until after the race.
