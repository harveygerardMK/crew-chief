#!/usr/bin/env bash
# One-shot droplet prep before sharing Ask Harvey: pull code, clean status, restart API.
# Run on the droplet as root:
#   cd /var/crew-chief && bash scripts/droplet-share-prep.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Pulling latest main..."
git fetch origin main
git checkout main
git pull --ff-only origin main

echo "==> Resetting status to pre-race share state (mile 0, last ping none, anxious)..."
bash scripts/reset-share-status.sh

echo "==> Installing server dependencies..."
python3 -m pip install -q -r server/requirements.txt

echo "==> Restarting PM2 (API + cloudflared)..."
pm2 delete all 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> Waiting for API..."
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo ""
echo "==> /status (should show route_mile 0, last_update_label none, race_status anxious):"
curl -sf http://127.0.0.1:8080/status | python3 -m json.tool

echo ""
echo "==> Tunnel URL (update GitHub PUBLIC_AGENT_API_URL if this changed):"
bash scripts/tunnel-url.sh 2>/dev/null || echo "  (run: pm2 logs cloudflared | grep trycloudflare)"

echo ""
bash scripts/check-agent-env.sh 2>/dev/null || echo "WARN: check-agent-env.sh had issues — see above"

echo ""
echo "Share prep complete."
echo "  • Status is PINNED — poller cron will not overwrite until race week."
echo "  • June 12: sudo bash scripts/race-week-switch.sh (unpins + live TrackLeaders)."
echo "  • Redeploy GitHub Pages if tunnel URL changed (repo variable PUBLIC_AGENT_API_URL)."
