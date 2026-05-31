#!/usr/bin/env bash
# Copy server/.env from this laptop to the droplet (Anthropic + Langfuse keys) and restart API.
# Usage (from repo root on your Mac): bash scripts/sync-anthropic-key-to-droplet.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_LOCAL="${REPO_ROOT}/server/.env"
DROPLET="${DROPLET:-root@107.170.32.201}"
REMOTE_ENV="/var/crew-chief/server/.env"

[[ -f "$ENV_LOCAL" ]] || {
  echo "Missing ${ENV_LOCAL}" >&2
  exit 1
}

python3 - <<'PY' "$ENV_LOCAL"
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    print("Install: python3 -m pip install python-dotenv", file=sys.stderr)
    sys.exit(1)

load_dotenv(Path(sys.argv[1]))
key = os.getenv("ANTHROPIC_API_KEY", "").strip()
if not key:
    print("✗ ANTHROPIC_API_KEY empty in server/.env", file=sys.stderr)
    sys.exit(1)
if not key.startswith("sk-ant-"):
    print("✗ ANTHROPIC_API_KEY should start with sk-ant-", file=sys.stderr)
    sys.exit(1)
print("✓ Local server/.env has Anthropic key")
PY

echo "==> Copying server/.env to ${DROPLET} (you may be prompted for SSH password) ..."
scp "$ENV_LOCAL" "${DROPLET}:${REMOTE_ENV}"

echo "==> Restarting API with fresh env ..."
ssh "$DROPLET" "cd /var/crew-chief && pm2 restart crew-chief-api --update-env && sleep 4"

echo "==> Testing Claude auth on droplet ..."
ssh "$DROPLET" "cd /var/crew-chief/server && python3 - <<'PY'
from config import load_settings
from claude import chat_completion, ClaudeError

s = load_settings()
try:
    chat_completion(
        s,
        system='Reply with JSON only: {\"reply\": \"ok\"}',
        user_message='Say ok.',
        require_art=False,
    )
    print('✓ Claude OK on droplet (no 401)')
except ClaudeError as e:
    print('✗ Claude failed:', e)
    raise SystemExit(1)
PY"

TUNNEL="$(ssh "$DROPLET" "pm2 logs cloudflared --lines 80 --nostream 2>/dev/null | grep -oE 'https://[a-z0-9-]+\\.trycloudflare\\.com' | tail -1" || true)"
echo ""
echo "Done."
if [[ -n "$TUNNEL" ]]; then
  echo "Tunnel URL: ${TUNNEL}"
  echo "If this changed, update GitHub variable PUBLIC_AGENT_API_URL and redeploy Pages."
fi
echo "Phone test: open https://wheresharvey.com/ and send a chat message."
