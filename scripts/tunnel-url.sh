#!/usr/bin/env bash
# Print the current Cloudflare quick-tunnel URL from PM2 logs (run on droplet).
# Usage: bash scripts/tunnel-url.sh
set -euo pipefail

URL=$(pm2 logs cloudflared --lines 80 --nostream 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)

if [[ -z "$URL" ]]; then
  echo "No trycloudflare URL found. Is cloudflared running?" >&2
  echo "  pm2 status" >&2
  echo "  pm2 logs cloudflared --lines 50" >&2
  exit 1
fi

echo "$URL"
echo ""
echo "GitHub variable PUBLIC_AGENT_API_URL should match (no trailing slash)."
echo "Then: gh workflow run 'Deploy to GitHub Pages' -R harveygerardMK/crew-chief"
