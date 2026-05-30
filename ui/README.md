# Crew Chief Agent — Chat UI

Minimal static chat front-end for the FastAPI backend (PR #6). No build step in this folder — vanilla HTML/CSS/JS.

## Local development

1. Start the API (`server/`):

   ```bash
   cd server && uvicorn app:app --host 127.0.0.1 --port 8080
   ```

2. Point the UI at it:

   ```bash
   cp ui/config.example.js ui/config.local.js
   # edit: window.CREW_CHIEF_API = "http://127.0.0.1:8080";
   ```

3. Serve the folder (needed for CORS + modules):

   ```bash
   npx --yes serve ui -p 5199
   ```

   Open http://localhost:5199

## Production (GitHub Pages)

The UI is copied to `public/agent/` before each Astro build:

```bash
PUBLIC_AGENT_API_URL=https://your-tunnel.trycloudflare.com npm run ui:copy
npm run build
```

Live URL: **https://harveygerardMK.github.io/crew-chief/agent/**

Set repository variable **`PUBLIC_AGENT_API_URL`** in GitHub Actions to your Cloudflare Tunnel URL.

## Features

- First-visit onboarding → `POST /visitors` → `localStorage`
- Session greeting → `POST /chat` with `{ visitor_id }` only
- Chat → `POST /chat` with message
- Status strip → `GET /status` every 60s + cached in `localStorage` when offline
- Art card → Wikimedia Commons thumbnail from Claude’s `art_prompt` (text-only fallback)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Layout: status strip, onboarding, messages, composer |
| `styles.css` | Crew Chief palette + compact chat layout |
| `app.js` | API client + UI logic |
| `config.js` | API URL (injected at deploy) |
| `config.local.js` | Local overrides (gitignored) |
