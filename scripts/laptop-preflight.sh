#!/usr/bin/env bash
# One-command preflight from your Mac. Usage:
#   ./scripts/laptop-preflight.sh
#   ./scripts/laptop-preflight.sh https://your-tunnel.trycloudflare.com
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

URL="${1:-}"
if [[ -z "$URL" ]]; then
  if command -v gh >/dev/null 2>&1; then
    URL=$(gh variable get PUBLIC_AGENT_API_URL -R harveygerardMK/crew-chief 2>/dev/null || true)
  fi
fi
if [[ -z "$URL" ]]; then
  echo "Usage: $0 <API_BASE_URL> or set gh + PUBLIC_AGENT_API_URL variable" >&2
  exit 1
fi

echo "==> Agent API: $URL"
./scripts/verify-agent.sh "$URL"

echo ""
echo "==> Pages config.js"
CONFIG=$(curl -sf "https://harveygerardMK.github.io/crew-chief/agent/config.js")
echo "$CONFIG" | grep CREW_CHIEF_API
echo "$CONFIG" | grep -qF "$URL" || {
  echo "WARN: Pages config does not match API URL — redeploy GitHub Pages" >&2
  exit 1
}

echo ""
echo "==> Ask Harvey UI"
curl -sf -o /dev/null -w "HTTP %{http_code}\n" "https://harveygerardMK.github.io/crew-chief/agent/"

echo ""
echo "Laptop preflight passed."
