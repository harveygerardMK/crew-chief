# Crew Chief Agent — FastAPI server

Conversational backend for Crew Chief Agent 2.0. Reads `voice.md`, live `harvey_status.json` (from the poller), and `visitors.json`. Calls Claude for chat replies and art prompts.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Liveness check |
| `GET` | `/status` | Raw `harvey_status.json` |
| `POST` | `/visitors` | Register visitor `{ name, relationship }` |
| `POST` | `/chat` | Chat `{ visitor_id, message? }` — omit `message` for session greeting |

**Relationships:** `family`, `friend`, `crew`, `pacer`, `stranger`

## Setup

```bash
cd server
python3 -m pip install -r requirements.txt
cp .env.example .env
# Set ANTHROPIC_API_KEY
```

Ensure data files exist (poller writes status; server creates visitors on first POST):

```bash
mkdir -p ../data
cp ../data/harvey_status.example.json ../data/harvey_status.json   # until poller runs
```

## Run locally

```bash
cd server
uvicorn app:app --host 0.0.0.0 --port 8080 --reload
```

## Droplet + PM2

```bash
cd /var/crew-chief/server
pip install -r requirements.txt
pm2 start "uvicorn app:app --host 127.0.0.1 --port 8080" --name crew-chief-agent
pm2 save
```

Expose via Cloudflare Tunnel (v1: `*.trycloudflare.com` is fine). Set `CORS_ORIGINS` to your GitHub Pages URL when the UI ships.

## Environment

See `.env.example`. Key variables:

- `ANTHROPIC_API_KEY` — required for live chat
- `HARVEY_STATUS_PATH` / `VISITORS_PATH` — JSON data files on the droplet
- `GITHUB_TOKEN` — optional; backs up `visitors.json` to the repo on each write

## Failure modes

- **Claude down / no API key:** `/chat` returns `fallback.md` with `"fallback": true`
- **Missing status file:** `/status` returns a safe empty snapshot
- **Stale tracker data:** injected into system prompt; Harvey's voice rules apply (see `voice.md`)

## Tests

```bash
cd server
pip install -r requirements-dev.txt
python -m pytest -q
```

## Chat flow

1. UI `POST /visitors` → store `visitor_id` in localStorage
2. UI `POST /chat` with `{ visitor_id }` only → backend greeting (return visits reference last mile)
3. UI `POST /chat` with `{ visitor_id, message }` → grounded reply + `art_prompt`

Pre-race: before June 12, 2026 9:00 AM PDT, system prompt adds training/planning context automatically.
