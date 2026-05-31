#!/usr/bin/env bash
# Pre-race poller config (TrackLeaders test event). Run on droplet.
# Usage: bash scripts/poller-preflight-setup.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLLER_ENV="${REPO_ROOT}/poller/.env"
STATUS_PATH="${REPO_ROOT}/data/harvey_status.json"

EVENT_SLUG="${TRACKLEADERS_EVENT_SLUG:-copper26}"
RUNNER_NAME="${TRACKLEADERS_RUNNER_NAME:-Trailbreaker_1}"

echo "==> Pre-race poller setup"
echo "    Event: ${EVENT_SLUG} (test — switch with race-week-switch.sh for Tahoe 200)"

if [[ -f "$POLLER_ENV" ]]; then
  cp "$POLLER_ENV" "${POLLER_ENV}.bak.$(date +%Y%m%d%H%M%S)"
fi

cat > "$POLLER_ENV" <<EOF
TRACKLEADERS_EVENT_SLUG=${EVENT_SLUG}
TRACKLEADERS_RUNNER_NAME=${RUNNER_NAME}
HARVEY_STATUS_PATH=${STATUS_PATH}
EOF

echo "==> Running poller..."
cd "${REPO_ROOT}/poller"
python3 poll.py

echo ""
python3 -c "import json; d=json.load(open('${STATUS_PATH}')); print(json.dumps({k:d.get(k) for k in ('enabled','race_status','route_mile','data_stale','stale','fetched_at')}, indent=2))"
echo ""
echo "Cron should run every 5 min. Verify: curl -s http://127.0.0.1:8080/status | python3 -m json.tool"
