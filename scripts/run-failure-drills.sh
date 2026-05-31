#!/usr/bin/env bash
# Guided failure drills for Crew Chief Agent ops (run on droplet).
# Usage: bash scripts/run-failure-drills.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="http://127.0.0.1:8080"

step() { echo ""; echo "=== $1 ==="; }
pause() { read -r -p "Press Enter when ready to continue…" _; }

echo "Crew Chief Agent — failure drills"
echo "Run each drill, confirm expected behavior, then restore before the next."
echo "Repo: ${REPO_ROOT}"

step "0. Baseline"
curl -sf "${API}/health" | python3 -m json.tool
curl -sf "${API}/ready" | python3 -m json.tool
pause

step "1. Claude down (unset API key)"
echo "Backing up server/.env and clearing ANTHROPIC_API_KEY…"
cp "${REPO_ROOT}/server/.env" "${REPO_ROOT}/server/.env.drill.bak"
grep -v '^ANTHROPIC_API_KEY=' "${REPO_ROOT}/server/.env.drill.bak" > "${REPO_ROOT}/server/.env" || true
echo 'ANTHROPIC_API_KEY=' >> "${REPO_ROOT}/server/.env"
pm2 restart crew-chief-api
sleep 2
VID=$(curl -sf -X POST "${API}/visitors" -H 'Content-Type: application/json' \
  -d '{"name":"DrillBot","relationship":"stranger"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['visitor_id'])")
curl -sf -X POST "${API}/chat" -H 'Content-Type: application/json' \
  -d "{\"visitor_id\":\"${VID}\",\"message\":\"test\"}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('fallback') is True, 'Expected fallback=true'
print('OK: fallback=true')
print('Reply starts:', d.get('reply','')[:80])
"
echo "Restore: mv ${REPO_ROOT}/server/.env.drill.bak ${REPO_ROOT}/server/.env && pm2 restart crew-chief-api"
pause

step "2. Backend down"
echo "Run: pm2 stop crew-chief-api"
echo "From phone/laptop: chat send should fail gracefully; cached status may still show."
echo "Then: pm2 start crew-chief-api"
pause

step "3. Poller / stale tracker"
echo "Option A — bad slug:"
echo "  echo 'TRACKLEADERS_EVENT_SLUG=badslug99' > ${REPO_ROOT}/poller/.env"
echo "  cd ${REPO_ROOT}/poller && python3 poll.py"
echo "  curl -s ${API}/status | python3 -m json.tool   # expect data_stale"
echo "Option B — stop cron for 10 min and confirm UI stale badge."
echo "Restore poller/.env and run: bash scripts/race-week-switch.sh (or your test slug)"
pause

step "4. Full smoke after restore"
echo "Run: bash ${REPO_ROOT}/scripts/check-agent-env.sh"
echo "From laptop: ./scripts/verify-agent.sh https://YOUR-TUNNEL-URL"
echo ""
echo "Drills complete — log results in docs/superpowers/runbooks/crew-chief-agent-test-checklist.md"
