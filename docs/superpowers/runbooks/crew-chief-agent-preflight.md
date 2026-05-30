# Crew Chief Agent — preflight (phone or laptop)

Gather these **before** you sit down to create the droplet. Everything else is copy-paste.

---

## Accounts (confirm you can log in)

- [ ] **DigitalOcean** — https://cloud.digitalocean.com (payment method on file)
- [ ] **Cloudflare** — https://dash.cloudflare.com (free tier)
- [ ] **GitHub** — access to `harveygerardMK/crew-chief` repo settings
- [ ] **Anthropic** — https://console.anthropic.com (API key)

---

## Secrets to have ready (password manager)

| Name | Where it goes | Required? |
|------|----------------|-----------|
| `ANTHROPIC_API_KEY` | `/var/crew-chief/server/.env` on droplet | **Yes** for live chat |
| `GITHUB_TOKEN` | same `.env` (optional) | No — backs up `visitors.json` only |
| SSH key | DigitalOcean droplet create screen | Recommended |

Generate Anthropic key if needed: Console → API Keys → Create Key.

---

## Optional: create droplet from your phone

DigitalOcean app or mobile browser:

1. **Create Droplet**
2. **Ubuntu 22.04**, **$5/mo** plan, your SSH key
3. **Advanced → User data** — paste entire contents of:  
   **`deploy/droplet-user-data.sh`** from the repo  
   (GitHub raw: https://raw.githubusercontent.com/harveygerardMK/crew-chief/main/deploy/droplet-user-data.sh)
4. Create → wait **5–10 min** for first-boot install
5. SSH from laptop when home: `ssh root@DROPLET_IP`
6. Check log: `tail -50 /var/log/crew-chief-init.log`
7. Only manual steps left: `.env`, tunnel, GitHub variable (below)

---

## At the computer (~15 min after droplet exists)

```bash
ssh root@YOUR_DROPLET_IP
nano /var/crew-chief/server/.env    # paste ANTHROPIC_API_KEY
pm2 restart crew-chief-api
curl http://127.0.0.1:8080/health

cloudflared tunnel --url http://127.0.0.1:8080
# Copy the https://….trycloudflare.com URL
```

**GitHub (browser):**  
Repo → Settings → Secrets and variables → Actions → **Variables** →  
`PUBLIC_AGENT_API_URL` = tunnel URL (no trailing slash)

**GitHub:** Actions → Deploy to GitHub Pages → **Run workflow**

**Phone test:** https://harveygerardMK.github.io/crew-chief/agent/

---

## One-liner (if you skipped user-data)

```bash
ssh root@YOUR_DROPLET_IP
git clone https://github.com/harveygerardMK/crew-chief.git /var/crew-chief && cd /var/crew-chief && bash scripts/droplet-bootstrap.sh
```

---

## What the agent cannot do for you

- Create the droplet on your DO account (needs your login + billing)
- Store your Anthropic key (you paste it on the server)
- Approve Cloudflare tunnel in your browser (one-time login)

## What is already done in the repo

- Bootstrap script, PM2 config, poller cron, runbooks, CI tests
- Chat UI live on GitHub Pages (waits for `PUBLIC_AGENT_API_URL`)

---

*When ready, tell Cursor "droplet time" for step-by-step alongside you.*
