#!/usr/bin/env bash
# Switch poller to live Tahoe 200 TrackLeaders config. Run on droplet as root.
# Usage: sudo bash scripts/race-week-switch.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
POLLER_ENV="${REPO_ROOT}/poller/.env"
STATUS_PATH="${REPO_ROOT}/data/harvey_status.json"

EVENT_SLUG="${TRACKLEADERS_EVENT_SLUG:-tahoe20026}"
RUNNER_NAME="${TRACKLEADERS_RUNNER_NAME:-Harvey Schaefer}"

echo "==> Race-week poller switch"
echo "    Event: ${EVENT_SLUG}"
echo "    Runner: ${RUNNER_NAME}"

PIN="${REPO_ROOT}/data/.pin-status"
if [[ -f "$PIN" ]]; then
  rm -f "$PIN"
  echo "    Removed status pin (data/.pin-status) — poller may update harvey_status.json again."
fi

mkdir -p "$(dirname "$POLLER_ENV")"
if [[ -f "$POLLER_ENV" ]]; then
  cp "$POLLER_ENV" "${POLLER_ENV}.bak.$(date +%Y%m%d%H%M%S)"
fi

cat > "$POLLER_ENV" <<EOF
TRACKLEADERS_EVENT_SLUG=${EVENT_SLUG}
TRACKLEADERS_RUNNER_NAME=${RUNNER_NAME}
HARVEY_STATUS_PATH=${STATUS_PATH}
EOF

echo "==> Wrote ${POLLER_ENV}"
echo "==> Running poller once..."
cd "${REPO_ROOT}/poller"
python3 poll.py

echo ""
echo "==> Status snapshot:"
python3 -c "import json; d=json.load(open('${STATUS_PATH}')); print(json.dumps({k:d.get(k) for k in ('enabled','race_status','route_mile','data_stale','stale','error')}, indent=2))"

echo ""
echo "Done. Cron should keep polling every 5 min."
echo "Verify: curl -s http://127.0.0.1:8080/status | python3 -m json.tool"
