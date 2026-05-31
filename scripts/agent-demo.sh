#!/usr/bin/env bash
# One-command local demo: API + Astro agent UI + race simulation.
#
# Usage:
#   ./scripts/agent-demo.sh
#   ./scripts/agent-demo.sh --speed 50
#   ./scripts/agent-demo.sh --chapter aid-station --speed 100
#   ./scripts/agent-demo.sh --chapter dnf --speed 200
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PORT="${AGENT_DEMO_PORT:-8080}"
ASTRO_PORT="${AGENT_DEMO_ASTRO_PORT:-4321}"
API_URL="http://127.0.0.1:${PORT}"
UI_URL="http://localhost:${ASTRO_PORT}/agent/"
PIDS=()

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    echo "==> Stopping process on port $port"
    kill $pids 2>/dev/null || true
    sleep 0.5
  fi
}

cleanup() {
  local code=$?
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  kill_port "$PORT"
  kill_port "$ASTRO_PORT"
  python3 "$REPO_ROOT/scripts/restore_real_status.py" 2>/dev/null || true
  if [[ $code -ne 0 ]]; then
    echo "Demo stopped (exit $code)." >&2
  else
    echo "Demo stopped."
  fi
}
trap cleanup EXIT INT TERM

if [[ ! -f "$REPO_ROOT/data/simulation_track.json" ]]; then
  echo "==> Generating simulation track (first run)…"
  python3 "$REPO_ROOT/scripts/parse_simulation_track.py"
fi

kill_port "$PORT"
kill_port "$ASTRO_PORT"

echo "==> Copying agent UI (API → $API_URL)"
PUBLIC_AGENT_API_URL="$API_URL" npm run ui:copy --silent

echo "==> Starting API on $API_URL"
(
  cd "$REPO_ROOT/server"
  uvicorn app:app --port "$PORT"
) &
PIDS+=($!)

echo "==> Starting Astro dev server"
npm run dev --silent &
PIDS+=($!)

echo "==> Waiting for services…"
for _ in $(seq 1 40); do
  if curl -sf "$API_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -sf "$API_URL/health" >/dev/null 2>&1; then
  echo "ERROR: API did not start on $API_URL" >&2
  echo "If port $PORT is stuck, run: lsof -ti :$PORT | xargs kill" >&2
  exit 1
fi

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│  Ask Harvey demo                                            │"
echo "│  UI:  $UI_URL"
echo "│  API: $API_URL"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo "Chapters: early, aid-station, signal-gap, sleep, dnf"
echo "Example:  ./scripts/agent-demo.sh --chapter sleep --speed 100"
echo ""

SIM_ARGS=("$@")
if [[ ${#SIM_ARGS[@]} -eq 0 ]]; then
  SIM_ARGS=(--speed 50)
  echo "==> Default simulation speed: 50× (~77 min for full replay)"
fi

python3 "$REPO_ROOT/scripts/simulate_race.py" --no-auto-restore "${SIM_ARGS[@]}"
