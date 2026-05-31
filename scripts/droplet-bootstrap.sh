#!/usr/bin/env bash
# Bootstrap Crew Chief Agent on a fresh Ubuntu droplet.
# Run as root on the droplet after: git clone https://github.com/harveygerardMK/crew-chief.git /var/crew-chief
#
# Usage:
#   cd /var/crew-chief && sudo bash scripts/droplet-bootstrap.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Crew Chief Agent droplet bootstrap"
echo "    Repo: $REPO_ROOT"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root (or with sudo)." >&2
  exit 1
fi

echo "==> Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv git curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "==> Installing cloudflared..."
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb" -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
fi

echo "==> Python dependencies (server)..."
python3 -m pip install -q -r server/requirements.txt

echo "==> Data files..."
mkdir -p data
if [[ ! -f data/harvey_status.json ]]; then
  cp data/harvey_status.example.json data/harvey_status.json
fi
if [[ ! -f data/visitors.json ]]; then
  cp data/visitors.example.json data/visitors.json
fi

if [[ ! -f server/.env ]]; then
  cp server/.env.example server/.env
  echo ""
  echo "!! Create server/.env and set ANTHROPIC_API_KEY before chat will work."
fi

if [[ ! -f poller/.env ]]; then
  cp poller/.env.example poller/.env
  echo "!! Edit poller/.env when TrackLeaders slug is known."
fi

echo "==> Starting API with PM2..."
pm2 delete crew-chief-api 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> Installing poller cron (every 5 min)..."
CRON_LINE="*/5 * * * * cd $REPO_ROOT/poller && /usr/bin/python3 poll.py >> /var/log/harvey-poller.log 2>&1"
( crontab -l 2>/dev/null | grep -v "harvey-poller.log" || true; echo "$CRON_LINE" ) | crontab -

echo "==> First poller run..."
cd poller && python3 poll.py || echo "(poller skipped — configure poller/.env)"

echo ""
echo "==> Health check..."
sleep 2
curl -sf http://127.0.0.1:8080/health && echo "" || echo "API not responding yet — check: pm2 logs crew-chief-api"

cat <<'EOF'

==> Next steps (manual)

1. Edit server/.env — set ANTHROPIC_API_KEY (required for live chat)
2. Edit poller/.env — TRACKLEADERS_EVENT_SLUG + TRACKLEADERS_RUNNER_NAME when live
3. Start Cloudflare Tunnel:
     cloudflared tunnel --url http://127.0.0.1:8080
   Or persist with PM2:
     pm2 start "cloudflared tunnel --url http://127.0.0.1:8080" --name cloudflared && pm2 save
4. GitHub repo → Settings → Actions → Variables → PUBLIC_AGENT_API_URL = tunnel URL
5. Re-run "Deploy to GitHub Pages" workflow
6. From your laptop: ./scripts/verify-agent.sh https://YOUR-TUNNEL-URL

Full runbook: docs/superpowers/runbooks/crew-chief-agent-deploy.md
EOF
