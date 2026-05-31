#!/usr/bin/env bash
# Ensure poller cron is installed (run on droplet as root).
# Usage: bash scripts/ensure-poller-cron.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRON_LINE="*/5 * * * * cd ${REPO_ROOT}/poller && /usr/bin/python3 poll.py >> /var/log/harvey-poller.log 2>&1"

( crontab -l 2>/dev/null | grep -v "harvey-poller.log" || true; echo "$CRON_LINE" ) | crontab -

echo "Poller cron installed:"
crontab -l | grep harvey-poller
