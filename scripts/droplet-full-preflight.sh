#!/usr/bin/env bash
# Droplet one-shot: pull, PM2, poller, cron, env check. Run as root on droplet.
# Usage: bash scripts/droplet-full-preflight.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

bash scripts/droplet-update.sh
bash scripts/poller-preflight-setup.sh
bash scripts/ensure-poller-cron.sh
bash scripts/check-agent-env.sh

echo ""
echo "Droplet full preflight complete."
