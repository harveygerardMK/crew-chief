# Crew broadcast — one-time setup (Harvey)

Amanda posts updates at the **Worker `/update`** form (one bookmark). Saves appear in **Ask Harvey chat** in a few minutes after GitHub Pages rebuilds. `https://wheresharvey.com/update/` redirects to the Worker.

You only do this once before race weekend.

---

## What you need

- A **Cloudflare** account (free): https://dash.cloudflare.com/sign-up
- A **GitHub fine-grained token** for this repo (contents write)
- About **1–2 hours** the first time

---

## 1. Create a GitHub token

1. Open GitHub → your profile picture → **Settings**
2. Left sidebar → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
3. **Generate new token**
4. Name: `crew-chief-broadcast`
5. Repository access: **Only** `harveygerardMK/crew-chief`
6. Permissions → **Contents**: **Read and write**
7. Generate and **copy the token** (you won’t see it again). Store it in a password manager.

---

## 2. Install the Worker tools (on your Mac)

Open **Terminal** and run:

```bash
cd /Users/harveyschaefer/Downloads/CB/projects/crew-chief/workers/broadcast
npm install
```

Log in to Cloudflare:

```bash
npx wrangler login
```

(A browser window opens — approve access.)

---

## 3. Set Worker secrets

Still in `workers/broadcast`:

**Family password** (share only with your wife):

```bash
npx wrangler secret put FAMILY_PASSWORD
```

Type the password when prompted (nothing shows as you type — that’s normal).

**GitHub token** (paste the token from step 1):

```bash
npx wrangler secret put GITHUB_TOKEN
```

**Session signing key** (random; you don’t need to remember it):

```bash
openssl rand -hex 32 | npx wrangler secret put SESSION_SIGNING_KEY
```

---

## 4. Deploy the Worker

```bash
npm run deploy
```

Copy the URL it prints, e.g. `https://crew-chief-broadcast.your-subdomain.workers.dev`  
(No trailing slash.)

---

## 5. Tell GitHub Actions the Worker URL

1. Repo: https://github.com/harveygerardMK/crew-chief  
2. **Settings** → **Secrets and variables** → **Actions** → **Variables** tab  
3. **New repository variable**  
   - Name: `PUBLIC_BROADCAST_API_URL`  
   - Value: your Worker URL (e.g. `https://crew-chief-broadcast….workers.dev`)  
4. Save  

Push any commit to `main` (or re-run the Pages workflow) so the site build picks up the variable.

---

## 6. Test end-to-end

1. Open https://crew-chief-broadcast.harvey-schaefer.workers.dev/update (or https://wheresharvey.com/update/)  
2. Enter the family password → **Continue**  
3. Fill a short test message → **Save update**  
4. On GitHub, confirm a new commit changed `data/race-broadcast.json`  
5. Wait **3–5 minutes** for Pages to deploy  
6. Refresh the **homepage** — your test message should appear  

Delete or overwrite the test message before race weekend if you like.

---

## 7. Wife’s phone

**Bookmark the direct update link** (works on hotel/work Wi‑Fi that blocks the main site):

`https://crew-chief-broadcast.harvey-schaefer.workers.dev/update`

(Replace with your Worker URL + `/update` if different.)

1. Open the Worker link (or `https://wheresharvey.com/update/`, which redirects) in Safari/Chrome  
2. **Share** → **Add to Home Screen** (optional but helpful)  
3. Tell her the **password** (voice or text — not in the public site)  

At each aid station she can post: how you’re doing, last seen station/time, a note, and up to two photos.

---

## Local dev (optional)

Terminal 1 — Worker:

```bash
cd workers/broadcast
npx wrangler secret put FAMILY_PASSWORD   # once
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put SESSION_SIGNING_KEY
npm run dev
```

Terminal 2 — site:

```bash
cd /Users/harveyschaefer/Downloads/CB/projects/crew-chief
PUBLIC_BROADCAST_API_URL=http://127.0.0.1:8787 npm run dev
```

Open `http://localhost:4321/crew-chief/update/`

---

## Troubleshooting

| Problem | Fix |
|--------|-----|
| Save does nothing or no message | Hard-refresh `/update/`; try the **direct link**; fix `GITHUB_TOKEN` (row below) |
| “GitHub token expired or wrong” on save | New fine-grained PAT with **Contents: Read and write** on this repo → `npx wrangler secret put GITHUB_TOKEN` in `workers/broadcast` |
| “Could not reach the server” on GitHub Pages update | Use the **direct link** (`…workers.dev/update`) — same form, no cross-site blocking |
| “Not connected yet” on update page | Set `PUBLIC_BROADCAST_API_URL` in GitHub Actions variables and redeploy |
| Homepage unchanged after save | Wait for green check on **Actions** → Deploy to GitHub Pages |

---

## Security note

This is **light** protection (shared password, unlisted URL). Good enough to stop random visitors; not for highly sensitive data.
