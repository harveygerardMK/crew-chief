# Crew Chief Agent — Mac mini failover (manual)

Use this if the DigitalOcean droplet is unreachable during race week. **No automation** — follow these steps by hand.

---

## When to failover

- Droplet SSH fails for 15+ minutes
- Cloudflare Tunnel returns 502/503 consistently
- `curl https://YOUR-TUNNEL/health` fails from two different networks

The **GitHub Pages chat UI** will show cached status and fallback messages until the API is back.

---

## Prerequisites (do before race week)

On the Mac mini:

1. Clone the repo: `git clone https://github.com/harveygerardMK/crew-chief.git`
2. Install Python 3.12+, Node 22, PM2: `npm install -g pm2`
3. Copy `server/.env` and `poller/.env` from the droplet (or recreate from `.env.example`)
4. Test once: `pm2 start deploy/ecosystem.config.cjs` locally, `curl localhost:8080/health`

Keep a copy of **`ANTHROPIC_API_KEY`** in a password manager.

---

## Failover steps

### 1. Confirm droplet is really down

```bash
ping YOUR_DROPLET_IP
ssh root@YOUR_DROPLET_IP
```

If both fail, proceed.

### 2. Start stack on Mac mini

```bash
cd ~/crew-chief   # or your clone path
git pull origin main
mkdir -p data
# Restore harvey_status.json + visitors.json from droplet backup or GitHub if available

cd server && pip3 install -r requirements.txt
cd ../poller && python3 poll.py   # verify TrackLeaders fetch

cd /path/to/crew-chief
pm2 start deploy/ecosystem.config.cjs
pm2 start "cloudflared tunnel --url http://127.0.0.1:8080" --name cloudflared
```

Copy the **new** tunnel URL from cloudflared output.

### 3. Update GitHub Pages API URL

1. GitHub → repo → **Settings** → **Actions** → **Variables**
2. Set **`PUBLIC_AGENT_API_URL`** to the new tunnel URL
3. **Actions** → **Deploy to GitHub Pages** → **Run workflow**

Wait ~3 minutes for Pages rebuild.

### 4. Verify

```bash
./scripts/verify-agent.sh https://NEW-TUNNEL-URL
```

Test `/crew-chief/agent/` on a phone.

### 5. Poller on Mac mini

Add cron locally or run poller every 5 min via launchd — same as droplet:

```bash
*/5 * * * * cd /path/to/crew-chief/poller && python3 poll.py >> ~/harvey-poller.log 2>&1
```

---

## Fail back to droplet

When the droplet is healthy again:

1. Stop PM2 on Mac mini: `pm2 delete all`
2. Restore tunnel on droplet (or update `PUBLIC_AGENT_API_URL` back to droplet tunnel)
3. Redeploy GitHub Pages if the URL changed
4. Sync `data/visitors.json` from Mac mini back to droplet if Mac mini served traffic

---

## What you cannot recover automatically

- Visitor records written only on Mac mini (export `data/visitors.json` manually)
- In-chat session history (session-only by design — nothing to restore)

---

*Keep this runbook printed or offline during race week.*
