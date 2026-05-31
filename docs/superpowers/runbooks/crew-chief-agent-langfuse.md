# Crew Chief Agent — Langfuse tracing (test week)

Use Langfuse this week to audit **why** Harvey said what he said. Tracing follows [langfuse/skills](https://github.com/langfuse/skills) instrumentation best practices:

- **Anthropic OpenTelemetry integration** — auto-captures model, tokens, prompts, and responses (no duplicate manual generation spans)
- **`chat-response` trace** — explicit user-message input, status/visitor in metadata
- **`session_id`** — visitor ID groups multi-turn conversations in Langfuse Sessions
- **`trace_id` in `/chat` response** — paste into Langfuse to jump straight to a suspicious reply

Tracing is **off by default** until you add keys to `server/.env`.

## 1. Create a Langfuse project (free tier is fine)

1. Sign up at [https://cloud.langfuse.com](https://cloud.langfuse.com) (US: [https://us.cloud.langfuse.com](https://us.cloud.langfuse.com)).
2. Create a project (e.g. `crew-chief-test`).
3. **Settings → API keys** → create keys. Copy:
   - Public key (`pk-lf-…`)
   - Secret key (`sk-lf-…`)

## 2. Add keys locally or on the droplet

Edit `server/.env`:

```bash
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
# Only if not on EU cloud:
# LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

Install deps and restart:

```bash
cd server
python3 -m pip install -r requirements.txt
# Local:
uvicorn app:app --port 8080
# Droplet:
pm2 restart crew-chief-api
```

Verify:

```bash
curl -s http://127.0.0.1:8080/ready | python3 -m json.tool
```

Expect `"langfuse_configured": true` and `"langfuse_ok": true`.

## 3. Generate traces

Run your usual test flow:

```bash
npm run agent:demo
# or
./scripts/verify-agent.sh http://127.0.0.1:8080
```

Each chat turn appears in Langfuse within a few seconds.

## 4. Trace structure (what you'll see)

```
chat-response          ← user message input, status/visitor metadata, final reply output
├── claude …           ← auto from AnthropicInstrumentor (model, tokens, system+user prompt)
└── fallback-response  ← only when Claude/key failed
```

## 5. Auditing bad data / wrong replies

When a reply looks wrong:

1. Copy `trace_id` from the `/chat` JSON response (or find it in Langfuse Traces).
2. Open the trace and compare layers:

| Layer | What to check |
|-------|----------------|
| **Trace input** | User message only (by design — not leaking system prompt in trace input) |
| **Trace metadata → status** | `route_mile`, `stale`, `data_stale`, `simulation`, `place_label` |
| **Nested generation** | Full system prompt + user message Claude saw; token usage |
| **Trace output** | Final reply, `fallback`, `status_snapshot` |
| **`fallback-response` span** | Claude/key issue, not a data bug |

Common patterns:

- **Wrong mile in reply** → check `status.route_mile` in trace metadata. If wrong there, fix poller/simulation data.
- **Stale data not acknowledged** → check `data_stale` / `signal_gap_*`; compare to system prompt in the nested generation.
- **Fallback copy** → `fallback: true` or `fallback-response` span.
- **Simulation vs live** → `simulation: true` in metadata.

Use **Sessions** view in Langfuse (grouped by visitor ID) to review a full conversation.

## 6. Debugging

If traces don't appear:

```bash
export LANGFUSE_DEBUG=True
# restart server, send one /chat, check terminal logs
```

## 7. After test week

Remove or comment out Langfuse keys from `server/.env` and restart. Chat behavior is unchanged when keys are absent.

## Files

- `server/langfuse_setup.py` — AnthropicInstrumentor init (after dotenv, before first Claude call)
- `server/observability.py` — `chat-response` trace wrapper
- `server/app.py` — wraps `POST /chat`, returns `trace_id`
- `~/.cursor/skills/langfuse/` — Langfuse agent skill (installed from github.com/langfuse/skills)
