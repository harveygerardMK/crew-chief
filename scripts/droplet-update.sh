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
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> Waiting for API..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo "==> Health checks..."
if curl -sf http://127.0.0.1:8080/health | python3 -m json.tool; then
  :
else
  echo "WARN: /health on :8080 failed — check: pm2 logs crew-chief-api"
  if curl -sf http://127.0.0.1:8000/health | python3 -m json.tool 2>/dev/null; then
    echo "NOTE: API still on :8000 — run: pm2 delete all && pm2 start deploy/ecosystem.config.cjs"
  fi
fi

READY_CODE=$(curl -s -o /tmp/ready.json -w "%{http_code}" http://127.0.0.1:8080/ready)
if [[ "$READY_CODE" == "200" ]]; then
  python3 -m json.tool /tmp/ready.json
else
  echo "WARN: /ready returned HTTP $READY_CODE"
fi

echo ""
echo "==> Tunnel URL:"
bash scripts/tunnel-url.sh 2>/dev/null || echo "(run: pm2 logs cloudflared | grep trycloudflare)"

echo ""
echo "Next: bash scripts/check-agent-env.sh"
echo "Pre-race poller: bash scripts/poller-preflight-setup.sh"
