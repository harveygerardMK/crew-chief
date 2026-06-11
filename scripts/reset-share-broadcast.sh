#!/usr/bin/env bash
# Sync data/race-broadcast.json on the droplet with the live crew site.
# Clears stale local test posts when wheresharvey.com/data/race-broadcast.json is empty.
# Usage (on droplet): bash scripts/reset-share-broadcast.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BROADCAST="${REPO_ROOT}/data/race-broadcast.json"
REMOTE_URL="${BROADCAST_REMOTE_URL:-https://wheresharvey.com/data/race-broadcast.json}"

mkdir -p "$(dirname "$BROADCAST")"

REMOTE="$(curl -sf "$REMOTE_URL" 2>/dev/null || true)"
if [[ -n "$REMOTE" ]]; then
  echo "$REMOTE" | python3 -c "
import json, sys
raw = json.load(sys.stdin)
assert isinstance(raw, dict), 'race-broadcast.json must be an object'
assert isinstance(raw.get('updates'), list), 'updates must be a list'
print(len(raw.get('updates', [])))
" >/tmp/broadcast-update-count.txt
  UPDATE_COUNT="$(cat /tmp/broadcast-update-count.txt)"
  echo "$REMOTE" >"$BROADCAST"
  echo "==> Synced ${BROADCAST} from ${REMOTE_URL} (${UPDATE_COUNT} update(s))"
else
  echo '{"updates": []}' >"$BROADCAST"
  echo "==> Wrote empty ${BROADCAST} (remote fetch failed — local test posts cleared)"
fi

python3 -m json.tool "$BROADCAST" >/dev/null
