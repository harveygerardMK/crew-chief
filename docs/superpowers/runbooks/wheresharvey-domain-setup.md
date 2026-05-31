# wheresharvey.com — domain setup

**Goal:** Serve the crew-chief site at **https://wheresharvey.com/** (and Ask Harvey at **https://wheresharvey.com/agent/**).

Hosting stays **GitHub Pages** (same repo, same deploy workflow). The domain registrar is **Squarespace** (DNS only — the site does not run on Squarespace).

---

## Part 1 — GitHub (do this first)

1. Open https://github.com/harveygerardMK/crew-chief/settings/pages
2. Under **Custom domain**, enter: `wheresharvey.com`
3. Click **Save**
4. Wait for GitHub to show a DNS check (may say “not configured yet” until Part 2)
5. When DNS is correct, enable **Enforce HTTPS**
6. Optional: add `www.wheresharvey.com` as a second custom domain (GitHub will suggest a www redirect)

The repo already includes `public/CNAME` with `wheresharvey.com` — that file is deployed on the next push to `main`.

---

## Part 2 — Squarespace DNS

Open: **Domains → wheresharvey.com → DNS → DNS Settings** (the screen in your screenshot).

### Remove Squarespace hosting defaults

The **Squarespace Defaults** block currently points `@` and `www` at Squarespace’s servers. Delete or replace those so GitHub can serve the site:

| Remove or replace | Type | Host | Current value |
|-----------------|------|------|----------------|
| Delete all four | **A** | `@` | `198.185.159.x` / `198.49.23.x` |
| Delete or replace | **CNAME** | `www` | `ext-sq.squarespace.com` |
| Leave alone | **HTTPS** | `@` | (Squarespace may remove this when A records change) |

Use **Custom records → ADD RECORD** (or edit the defaults if Squarespace lets you).

### Add GitHub Pages records

Add **four A records** for the root domain (`@`):

| Type | Host | Data / points to | TTL |
|------|------|------------------|-----|
| A | `@` | `185.199.108.153` | 4 hrs |
| A | `@` | `185.199.109.153` | 4 hrs |
| A | `@` | `185.199.110.153` | 4 hrs |
| A | `@` | `185.199.111.153` | 4 hrs |

Add **one CNAME** for `www`:

| Type | Host | Data / points to | TTL |
|------|------|------------------|-----|
| CNAME | `www` | `harveygerardmk.github.io` | 4 hrs |

**Email Security** records (DKIM, DMARC, SPF) can stay unless you add email later.

---

## Part 3 — Deploy the code change

After DNS records are saved, merge/push the domain migration on `main`. That triggers **Deploy to GitHub Pages** with:

- Site root at `/` (no more `/crew-chief/` prefix)
- `CNAME` for GitHub Pages

From your laptop:

```bash
cd /Users/harveyschaefer/Downloads/CB/projects/crew-chief
git push origin main
```

Watch the workflow: https://github.com/harveygerardMK/crew-chief/actions

---

## Part 4 — Broadcast Worker (one-time)

Photo uploads and CORS were updated for `wheresharvey.com`. Redeploy the Worker:

```bash
cd workers/broadcast
npm run deploy
```

(Uses your existing Cloudflare login — same as before.)

---

## Part 5 — Verify (15 min – 48 hrs after DNS)

DNS can take a while. When ready:

| Check | URL |
|-------|-----|
| Home | https://wheresharvey.com/ |
| Ask Harvey | https://wheresharvey.com/agent/ |
| Crew update form | https://wheresharvey.com/update/ |
| GitHub Pages health | Repo → Settings → Pages → “DNS check successful” |

Quick terminal checks:

```bash
curl -sI https://wheresharvey.com/ | head -5
curl -s https://wheresharvey.com/agent/config.js | head -3
```

---

## What changed in the repo

| Before | After |
|--------|-------|
| `https://harveygerardmk.github.io/crew-chief/` | `https://wheresharvey.com/` |
| `…/crew-chief/agent/` | `https://wheresharvey.com/agent/` |
| Photo paths `/crew-chief/race-updates/…` | `/race-updates/…` |

The old `github.io/crew-chief/` URLs will **stop working** after deploy (paths moved to site root). Update bookmarks and tester invites.

---

## Troubleshooting

**“DNS check failed” on GitHub** — Confirm all four A records exist for `@`, no conflicting Squarespace A records left, wait up to 24h.

**Site loads but styles broken** — Hard refresh; confirm latest deploy finished.

**Ask Harvey chat errors** — Agent API is separate (Cloudflare tunnel). `PUBLIC_AGENT_API_URL` in GitHub repo variables is unchanged; only the static UI URL changed.

**www vs non-www** — Prefer `wheresharvey.com`; add both in GitHub Pages custom domain settings.

---

## Local dev

After the config change, local dev is:

```bash
npm run dev
```

Open **http://localhost:4321/** (no `/crew-chief/` prefix anymore).
