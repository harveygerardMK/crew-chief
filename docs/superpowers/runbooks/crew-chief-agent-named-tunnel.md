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

**Target:** `https://agent.wheresharvey.com` — set GitHub **`PUBLIC_AGENT_API_URL`** once, never again.

Check progress anytime from your Mac:

```bash
bash scripts/verify-named-tunnel.sh
```

---

### Phase 1 — Move DNS to Cloudflare (do this on your Mac)

Named tunnels need a **CNAME** to `{tunnel-uuid}.cfargotunnel.com`. That only works when **wheresharvey.com** is managed in **your Cloudflare account**. Squarespace can stay the registrar; you only change **nameservers**.

#### 1A. Add the site to Cloudflare

1. Open https://dash.cloudflare.com → **Add a site** → enter **`wheresharvey.com`**
2. Pick the **Free** plan
3. Cloudflare scans existing DNS — confirm you see the four GitHub Pages **A** records for `@` (185.199.108–111.153) and **CNAME** `www` → `harveygerardmk.github.io`
4. If anything is missing, add it manually (same table as [wheresharvey-domain-setup.md](wheresharvey-domain-setup.md) Part 2)
5. Copy the **two Cloudflare nameservers** Cloudflare shows (e.g. `ada.ns.cloudflare.com` and `bob.ns.cloudflare.com`)

#### 1B. Switch nameservers at Squarespace

1. Squarespace → **Domains** → **wheresharvey.com** → **DNS** (or **Nameservers**)
2. Choose **Use custom nameservers** (wording varies)
3. Paste Cloudflare’s two nameservers → **Save**

Propagation usually takes **15 minutes to a few hours**. The main site should keep working if Cloudflare has the same A/CNAME records as before.

#### 1C. Confirm in Cloudflare

- Cloudflare dashboard shows **Active** for wheresharvey.com
- From your Mac:

```bash
dig NS wheresharvey.com +short
# should show *.cloudflare.com, not squarespacedns.com
```

---

### Phase 2 — Create the tunnel on the droplet (SSH)

When Phase 1 is **Active**, SSH to the droplet:

```bash
ssh root@107.170.32.201
cd /var/crew-chief
git pull origin main
bash scripts/droplet-named-tunnel-setup.sh
```

What happens:

1. **`cloudflared tunnel login`** — prints a URL; open it in your browser and authorize (pick the wheresharvey.com zone)
2. Creates tunnel **`crew-chief-agent`**
3. Writes **`deploy/cloudflared/config.yml`** (gitignored, stays on server)
4. Adds DNS **`agent.wheresharvey.com`** → tunnel (CNAME, proxied)
5. Restarts **cloudflared only** — API keeps running

At the end the script prints:

```text
https://agent.wheresharvey.com
```

Test on the droplet:

```bash
curl -s https://agent.wheresharvey.com/health
```

You want JSON with `"ok": true`.

---

### Phase 3 — Point the static site at the stable URL (GitHub)

1. GitHub → repo **Settings** → **Secrets and variables** → **Actions** → **Variables**
2. Set **`PUBLIC_AGENT_API_URL`** = **`https://agent.wheresharvey.com`** (no trailing slash)
3. **Actions** → **Deploy to GitHub Pages** → **Run workflow** (or push to `main`)

---

### Phase 4 — Verify (Mac)

```bash
bash scripts/verify-named-tunnel.sh
curl -s https://wheresharvey.com/config.js | grep CREW_CHIEF_API
```

Open https://wheresharvey.com/ on your phone, send a chat message — no more “failed to fetch” after API restarts.

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
