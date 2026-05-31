#!/usr/bin/env bash
# Print the agent API public URL (named tunnel hostname or quick-tunnel from PM2 logs).
# Usage: bash scripts/tunnel-url.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAMED_CONFIG="${REPO_ROOT}/deploy/cloudflared/config.yml"

if [[ -f "$NAMED_CONFIG" ]]; then
  HOST=$(grep -E '^\s*-\s*hostname:' "$NAMED_CONFIG" | head -1 | awk '{print $3}')
  if [[ -n "$HOST" ]]; then
    echo "https://${HOST}"
    echo ""
    echo "Named tunnel (stable). PUBLIC_AGENT_API_URL should be the line above."
    exit 0
  fi
fi

URL=$(pm2 logs cloudflared --lines 80 --nostream 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)

if [[ -z "$URL" ]]; then
  echo "No tunnel URL found." >&2
  echo "  Quick tunnel: pm2 logs cloudflared --lines 50" >&2
  echo "  Or set up stable URL: bash scripts/droplet-named-tunnel-setup.sh" >&2
  exit 1
fi

echo "$URL"
echo ""
echo "WARNING: Quick tunnel — URL changes when cloudflared restarts."
echo "Set GitHub PUBLIC_AGENT_API_URL to the URL above, then redeploy Pages."
echo "Permanent fix: docs/superpowers/runbooks/crew-chief-agent-named-tunnel.md"
