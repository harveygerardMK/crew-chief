# Crew Chief Agent — named Cloudflare Tunnel (stable API URL)

**Problem:** Quick tunnels (`*.trycloudflare.com`) get a **new URL every time cloudflared restarts**. The static site bakes that URL into `config.js` at build time → chat shows **“failed to fetch”** when the tunnel URL changes.

**Fix:** A **named tunnel** with a fixed hostname, e.g. **`https://agent.wheresharvey.com`**.

---

## Immediate recovery (quick tunnel still broken)

If chat fails right now:

**1. On your Mac — get the current tunnel URL from the droplet:**

```bash
ssh root@107.170.32.201 'pm2 logs cloudflared --lines 80 --nostream 2>/dev/null | grep -oE "https://[a-z0-9-]+\\.trycloudflare\\.com" | tail -1'
```

If empty, restart cloudflared only (API keeps running):

```bash
ssh root@107.170.32.201 'pm2 restart cloudflared && sleep 6 && pm2 logs cloudflared --lines 40 --nostream | grep trycloudflare | tail -1'
```

**2. Test it:**

```bash
curl -s "PASTE-URL-HERE/health"
```

Should return JSON with `"ok": true`.

**3. Update GitHub** → repo **Settings** → **Secrets and variables** → **Actions** → **Variables** → **`PUBLIC_AGENT_API_URL`** = that URL (no trailing slash).

**4. Redeploy the site:** **Actions** → **Deploy to GitHub Pages** → **Run workflow**.

**5. Hard-refresh** https://wheresharvey.com/ on your phone.

This is temporary — the next full PM2 restart can break it again.

---

## Permanent fix — named tunnel

### Why DNS must be on Cloudflare

Named tunnels need a **CNAME** to `{tunnel-uuid}.cfargotunnel.com`. Cloudflare only proxies that for zones in **your Cloudflare account**. Squarespace DNS alone cannot host the tunnel hostname.

**Options:**

| Approach | Effort |
|----------|--------|
| Move **wheresharvey.com** nameservers to Cloudflare (registrar stays Squarespace) | Best long-term; recreate GitHub Pages A records in CF |
| Use a hostname on a domain already on Cloudflare | Faster if you have one |

### Steps (droplet)

1. Add **wheresharvey.com** to [Cloudflare Dashboard](https://dash.cloudflare.com) and point Squarespace nameservers to Cloudflare (or follow CF’s import wizard).

2. In Cloudflare DNS, keep GitHub Pages records for `@` and `www` (see [wheresharvey-domain-setup.md](wheresharvey-domain-setup.md) — use CF instead of Squarespace for those A/CNAME records).

3. SSH to the droplet and run:

```bash
cd /var/crew-chief
git pull origin main
bash scripts/droplet-named-tunnel-setup.sh
```

4. Set GitHub variable **`PUBLIC_AGENT_API_URL`** = **`https://agent.wheresharvey.com`** (no trailing slash).

5. Redeploy GitHub Pages once.

6. Verify:

```bash
curl -s https://agent.wheresharvey.com/health
curl -s https://wheresharvey.com/config.js | grep CREW_CHIEF_API
```

From then on, **`PUBLIC_AGENT_API_URL` never needs to change** when you restart the API or cloudflared.

---

## Repo behavior after setup

| File | Role |
|------|------|
| `deploy/cloudflared/config.yml` | Named tunnel config (on droplet only, gitignored) |
| `deploy/ecosystem.config.cjs` | Uses named tunnel if `config.yml` exists; else quick tunnel |
| `scripts/droplet-update-code.sh` | Restarts API only — does **not** rotate tunnel URL |
| `scripts/droplet-share-prep.sh` | Same — API only after this fix |

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `failed to fetch` in chat | Stale URL in `config.js` — check `PUBLIC_AGENT_API_URL` + redeploy Pages |
| `530` from trycloudflare URL | Tunnel dead — restart cloudflared or switch to named tunnel |
| `1016` / DNS error on agent hostname | Tunnel not running, or CNAME missing/wrong in Cloudflare |
| CORS errors | Set `CORS_ORIGINS=https://wheresharvey.com` in `server/.env` on droplet |
