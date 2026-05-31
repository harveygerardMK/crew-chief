#!/usr/bin/env bash
# Reset harvey_status.json to the clean pre-race share state and pin it (poller skips).
# Usage (on droplet): bash scripts/reset-share-status.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLE="${REPO_ROOT}/data/harvey_status.example.json"
STATUS="${REPO_ROOT}/data/harvey_status.json"
PIN="${REPO_ROOT}/data/.pin-status"

[[ -f "$EXAMPLE" ]] || {
  echo "Missing ${EXAMPLE}" >&2
  exit 1
}

mkdir -p "$(dirname "$STATUS")"
cp "$EXAMPLE" "$STATUS"
rm -f "${REPO_ROOT}/data/harvey_status_real.json"
touch "$PIN"

echo "==> Wrote ${STATUS} (pinned — poller will skip until race-week-switch.sh)"
python3 -m json.tool "$STATUS"
