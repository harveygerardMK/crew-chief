#!/usr/bin/env bash
# Pull latest main and restart the API only (keeps cloudflared tunnel URL stable).
# Used by GitHub Actions on push to main. For full PM2 restart, use droplet-update.sh.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Pulling latest from origin/main..."
git fetch origin main
git checkout main
git pull --ff-only origin main

echo "==> Installing server dependencies..."
python3 -m pip install -q -r server/requirements.txt

echo "==> Restarting API (cloudflared unchanged)..."
pm2 restart crew-chief-api --update-env || {
  echo "WARN: crew-chief-api not running — starting full PM2 stack..."
  pm2 delete all 2>/dev/null || true
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
}

echo "==> Waiting for API..."
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

curl -sf http://127.0.0.1:8080/health | python3 -m json.tool
echo "Code deploy complete."
