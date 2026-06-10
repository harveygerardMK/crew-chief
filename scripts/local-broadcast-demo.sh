#!/usr/bin/env bash
# Local demo: crew broadcast → inline photos + return-visit push in Ask Harvey.
#
# Usage:
#   ./scripts/local-broadcast-demo.sh
#   ./scripts/local-broadcast-demo.sh --stop   # stop background servers
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

API_PORT="${LOCAL_AGENT_PORT:-8080}"
UI_PORT="${LOCAL_ASTRO_PORT:-4321}"
API_URL="http://127.0.0.1:${API_PORT}"
PID_FILE="$REPO_ROOT/.local-broadcast-demo.pids"
BROADCAST_BACKUP="$REPO_ROOT/data/.race-broadcast.demo-backup.json"
TEST_PHOTO="/race-updates/2026-05-27T21-08-57-484Z-tahoe-city-1.jpg"

stop_demo() {
  if [[ -f "$PID_FILE" ]]; then
    while read -r pid _; do
      kill "$pid" 2>/dev/null || true
    done < "$PID_FILE"
    rm -f "$PID_FILE"
  fi
  lsof -ti :"$API_PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  lsof -ti :"$UI_PORT" 2>/dev/null | xargs kill 2>/dev/null || true
  if [[ -f "$BROADCAST_BACKUP" ]]; then
    cp "$BROADCAST_BACKUP" "$REPO_ROOT/data/race-broadcast.json"
    rm -f "$BROADCAST_BACKUP"
    echo "Restored race-broadcast.json"
  fi
  echo "Stopped local broadcast demo."
}

if [[ "${1:-}" == "--stop" ]]; then
  stop_demo
  exit 0
fi

if [[ "${1:-}" == "--refresh-post" ]]; then
  python3 - <<'PY'
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

visitors_path = Path("data/visitors.json")
path = Path("data/race-broadcast.json")
last_seen = None
if visitors_path.is_file():
    data = json.loads(visitors_path.read_text(encoding="utf-8"))
    visitors = data.get("visitors") or []
    if visitors:
        last_seen = max(
            (str(v.get("last_seen") or "") for v in visitors),
            default="",
        ) or None

posted = datetime.now(timezone.utc)
if last_seen:
    after = datetime.fromisoformat(last_seen.replace("Z", "+00:00"))
    posted = max(posted, after + timedelta(seconds=3))

payload = {
    "updates": [
        {
            "updated_at": posted.isoformat().replace("+00:00", "Z"),
            "updated_by": "crew",
            "doing": "LOCAL TEST: Harvey is eating grilled cheese at Sierra at Tahoe",
            "last_seen": {
                "station": "Sierra at Tahoe",
                "time_label": "Just now (local test)",
            },
            "note": "Safe to ignore — local demo only.",
            "photos": [
                {
                    "url": "/race-updates/2026-05-27T21-08-57-484Z-tahoe-city-1.jpg",
                    "alt": "Harvey at Tahoe City (local test photo)",
                }
            ],
        }
    ]
}
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print("Refreshed crew post timestamp — hard-refresh the browser tab now.")
PY
  exit 0
fi

stop_demo

if [[ -f "$REPO_ROOT/data/race-broadcast.json" ]]; then
  cp "$REPO_ROOT/data/race-broadcast.json" "$BROADCAST_BACKUP"
fi

python3 - <<'PY'
import json
from datetime import datetime, timezone
from pathlib import Path

path = Path("data/race-broadcast.json")
payload = {
    "updates": [
        {
            "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "updated_by": "crew",
            "doing": "LOCAL TEST: Harvey is eating grilled cheese at Sierra at Tahoe",
            "last_seen": {
                "station": "Sierra at Tahoe",
                "time_label": "Local test time",
            },
            "note": "Safe to ignore — local demo only.",
            "photos": [
                {
                    "url": "/race-updates/2026-05-27T21-08-57-484Z-tahoe-city-1.jpg",
                    "alt": "Harvey at Tahoe City (local test photo)",
                }
            ],
        }
    ]
}
path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
print("Seeded data/race-broadcast.json for local demo")
PY

node scripts/copy-ui.mjs
node scripts/copy-data.mjs

export BROADCAST_FORCE_LOCAL=1
(
  cd server
  exec python3 -m uvicorn app:app --port "$API_PORT"
) &
API_PID=$!

(
  PUBLIC_AGENT_API_URL="$API_URL" npm run dev -- --port "$UI_PORT" --host
) &
UI_PID=$!

echo "$API_PID api" > "$PID_FILE"
echo "$UI_PID ui" >> "$PID_FILE"

echo "Waiting for API and Astro dev server..."
for _ in $(seq 1 40); do
  if curl -sf "$API_URL/health" >/dev/null 2>&1 && curl -sf "http://127.0.0.1:${UI_PORT}/" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

echo ""
echo "=========================================="
echo " Local broadcast demo is running"
echo "=========================================="
echo " Chat UI:  http://127.0.0.1:${UI_PORT}/"
echo " API:      ${API_URL}"
echo ""
echo " Try it in your browser (step by step):"
echo "  1. Open http://127.0.0.1:${UI_PORT}/"
echo "  2. Enter any name + Remote, tap Let's go"
echo "  3. Wait for Harvey's first greeting, then send one short message"
echo "  4. Wait for Harvey's reply to finish (important!)"
echo "  5. In a NEW terminal window, run:"
echo "       ./scripts/local-broadcast-demo.sh --refresh-post"
echo "  6. Hard-refresh the browser tab (Cmd+Shift+R on Mac)"
echo "  6. You should see:"
echo "       - 'Since you were here'"
echo "       - A 'From crew' card with an inline photo"
echo "       - Harvey's recap greeting below"
echo ""
echo " Stop when done:"
echo "   ./scripts/local-broadcast-demo.sh --stop"
echo "=========================================="
