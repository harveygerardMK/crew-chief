#!/usr/bin/env bash
# Pull latest main on the droplet and restart PM2 processes.
# Usage (on droplet as root): bash scripts/droplet-update.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Pulling latest from origin/main..."
git fetch origin main
git checkout main
git pull --ff-only origin main

echo "==> Installing server dependencies..."
python3 -m pip install -q -r server/requirements.txt

echo "==> Restarting PM2 (API + cloudflared)..."
pm2 startOrRestart deploy/ecosystem.config.cjs
pm2 save

sleep 2
echo ""
echo "==> Health checks..."
curl -sf http://127.0.0.1:8080/health | python3 -m json.tool

READY_CODE=$(curl -s -o /tmp/ready.json -w "%{http_code}" http://127.0.0.1:8080/ready)
if [[ "$READY_CODE" == "200" ]]; then
  python3 -m json.tool /tmp/ready.json
else
  echo "WARN: /ready returned HTTP $READY_CODE"
fi

echo ""
echo "Tunnel URL (if cloudflared running):"
pm2 logs cloudflared --lines 20 --nostream 2>/dev/null | grep -o 'https://[^ ]*trycloudflare.com' | tail -1 || echo "(check: pm2 logs cloudflared)"

echo ""
echo "Next: bash scripts/check-agent-env.sh"
echo "If tunnel URL changed, update GitHub variable PUBLIC_AGENT_API_URL and redeploy Pages."
