# Crew Chief Agent — droplet deploy (Harvey / ops)

One-time setup for the **Ask Harvey** chat stack on a DigitalOcean droplet. The static chat UI lives on GitHub Pages; the droplet runs the poller + API.

**Chat UI (after deploy):** https://harveygerardMK.github.io/crew-chief/agent/

---

## What you need

- DigitalOcean droplet — Ubuntu 22.04+, **$5/mo** tier is enough
- **Anthropic API key** for Claude
- **Cloudflare** account (free) for Tunnel
- Optional: **GitHub fine-grained token** to backup `visitors.json` to the repo

About **1–2 hours** first time.

---

## 1. Create the droplet

1. DigitalOcean → **Create Droplet**
2. Image: **Ubuntu 22.04 LTS**
3. Size: Basic **$5/mo** (1 vCPU, 1 GB RAM)
4. Auth: SSH key (recommended) or password
5. Hostname: e.g. `crew-chief-agent`

SSH in:

```bash
ssh root@YOUR_DROPLET_IP
```

---


## 2. Quick bootstrap (recommended)

```bash
git clone https://github.com/harveygerardMK/crew-chief.git /var/crew-chief
cd /var/crew-chief
sudo bash scripts/droplet-bootstrap.sh
```

This installs Python/Node/PM2, server deps, PM2 API process, poller cron, and seed data files.  
Then continue at **section 5** (configure `.env` files) — bootstrap creates templates from `.env.example`.

---

## 3. Manual install (alternative)

## 3. Install system packages

```bash
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv git

# Node.js 22 (for PM2)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pm2
```

---

## 4. Clone the repo

```bash
mkdir -p /var/crew-chief
cd /var/crew-chief
git clone https://github.com/harveygerardMK/crew-chief.git .
git checkout main   # after agent PRs are merged
```

Create data directory:

```bash
mkdir -p data
cp data/harvey_status.example.json data/harvey_status.json
cp data/visitors.example.json data/visitors.json
```

---

## 5. Python dependencies (poller + server)

```bash
cd /var/crew-chief/server
python3 -m pip install -r requirements.txt

cd /var/crew-chief/poller
python3 -m pip install -r requirements-dev.txt   # optional; poller runtime is stdlib-only
```

---

## 6. Configure environment

### Poller (`poller/.env`)

```bash
cd /var/crew-chief/poller
cp .env.example .env
nano .env
```

When TrackLeaders goes live:

```env
TRACKLEADERS_EVENT_SLUG=tahoe20026
TRACKLEADERS_RUNNER_NAME=Harvey Schaefer
HARVEY_STATUS_PATH=/var/crew-chief/data/harvey_status.json
```

Pre-race test (known event):

```env
TRACKLEADERS_EVENT_SLUG=copper26
TRACKLEADERS_RUNNER_NAME=Trailbreaker_1
```

### Server (`server/.env`)

```bash
cd /var/crew-chief/server
cp .env.example .env
nano .env
```

Required:

```env
ANTHROPIC_API_KEY=sk-ant-...
HARVEY_STATUS_PATH=/var/crew-chief/data/harvey_status.json
VISITORS_PATH=/var/crew-chief/data/visitors.json
VOICE_PATH=/var/crew-chief/voice.md
CORS_ORIGINS=*
```

Optional GitHub backup of visitors:

```env
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=harveygerardMK
GITHUB_REPO=crew-chief
VISITORS_EXPORT_PATH=data/visitors.json
```

**Post-race logs & race data (May 2026 bundle)** — defaults point at `data/` under the repo; create empty files on first deploy if you want explicit paths:

```env
AID_STATIONS_PATH=/var/crew-chief/data/aid-stations.json
QUESTIONS_PATH=/var/crew-chief/data/questions.json
NOTES_PATH=/var/crew-chief/data/notes.json
```

| File / endpoint | Purpose |
|-----------------|--------|
| `data/questions.json` | Append-only log of every `/chat` (for Harvey after the race). Not sent to Claude. |
| `data/notes.json` | Notes from visitors via **`POST /notes`** `{ visitor_id, note_text }`. Not sent to Claude. |
| RACE DATA in prompts | Loaded at API startup from `aid-stations.json`; refreshes from GitHub Pages every 30 min. |

After deploy, confirm writes:

```bash
touch /var/crew-chief/data/questions.json /var/crew-chief/data/notes.json
echo '[]' | tee /var/crew-chief/data/questions.json /var/crew-chief/data/notes.json
# Send a test chat + note from the UI, then:
ls -la /var/crew-chief/data/questions.json /var/crew-chief/data/notes.json
```

---

## 7. Start with PM2

From repo root:

```bash
cd /var/crew-chief
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # run the command it prints so PM2 survives reboot
```

Verify:

```bash
curl -s http://127.0.0.1:8080/health
curl -s http://127.0.0.1:8080/status | head
```

---

## 8. Poller cron (every 5 minutes)

```bash
crontab -e
```

Add:

```cron
*/5 * * * * cd /var/crew-chief/poller && /usr/bin/python3 poll.py >> /var/log/harvey-poller.log 2>&1
```

Run once manually:

```bash
cd /var/crew-chief/poller && python3 poll.py
cat /var/crew-chief/data/harvey_status.json
```

---

## 9. Cloudflare Tunnel (public HTTPS)

On the droplet:

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb
dpkg -i cloudflared.deb
cloudflared tunnel login
cloudflared tunnel create crew-chief-agent
cloudflared tunnel route dns crew-chief-agent agent.yourdomain.com   # OR skip for quick tunnel
```

**Quick tunnel (v1 — no custom domain):**

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

Copy the `https://….trycloudflare.com` URL.

**Persistent tunnel** — see [Cloudflare docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) or run quick tunnel under PM2:

```bash
pm2 start "cloudflared tunnel --url http://127.0.0.1:8080" --name cloudflared
pm2 save
```

Note: quick tunnel URLs change on restart. For race week, use a named tunnel or stable trycloudflare with PM2.

---

## 10. Wire GitHub Pages to the API

1. GitHub → `harveygerardMK/crew-chief` → **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. New variable: **`PUBLIC_AGENT_API_URL`** = your tunnel URL (no trailing slash)
3. Re-run the **Deploy to GitHub Pages** workflow (or push to `main`)

After deploy, open https://harveygerardMK.github.io/crew-chief/agent/ on your phone and complete onboarding.

---

## 11. Smoke test

From your laptop:

```bash
cd /path/to/crew-chief
./scripts/verify-agent.sh https://YOUR-TUNNEL-URL
```

Or follow **docs/superpowers/runbooks/crew-chief-agent-test-checklist.md**.

**Bundle smoke (phone):** onboarding → chat → ask **“How is he doing?”** (art card should appear) → **Leave Harvey a note** → return visit (catch-up offer). Greeting alone should **not** show an art card.

---

## Share week (pre-race preview, before June 12)

When sharing Ask Harvey with testers before the race, reset the header and pin status so the 5‑minute poller does not overwrite it with test-tracker miles:

```bash
cd /var/crew-chief
bash scripts/droplet-share-prep.sh
```

This pulls `main`, writes the clean status (mile **0**, last ping **none**, status **anxious**, simulation off), touches `data/.pin-status`, and restarts PM2. Copy the tunnel URL it prints into GitHub → **Settings** → **Actions** → **Variables** → **`PUBLIC_AGENT_API_URL`**, then re-run **Deploy to GitHub Pages** if the URL changed.

On **June 12**, run `sudo bash scripts/race-week-switch.sh` — that removes the pin and switches the poller to live Tahoe 200.

---

## Logs & monitoring

| Service | Command |
|---------|---------|
| API logs | `pm2 logs crew-chief-api` |
| PM2 status | `pm2 status` |
| Poller log | `tail -f /var/log/harvey-poller.log` |
| Status file | `cat /var/crew-chief/data/harvey_status.json` |

---

## Mac mini standby

If the droplet fails during race week, see **crew-chief-agent-failover-mac-mini.md**.

---

## What stays on Cloudflare Worker

The **broadcast Worker** (`workers/broadcast/`) is unchanged — crew still uses `/crew-chief/update/` for photos and family broadcast JSON. The agent droplet is separate.
