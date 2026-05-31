#!/usr/bin/env bash
# Smoke-test the Crew Chief Agent API. Usage:
#   ./scripts/verify-agent.sh https://your-tunnel.trycloudflare.com
set -euo pipefail

BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "Usage: $0 <API_BASE_URL>" >&2
  exit 1
fi
BASE="${BASE%/}"

pass() { echo "✓ $1"; }
fail() { echo "✗ $1" >&2; exit 1; }

echo "Testing $BASE ..."

# Health
HEALTH=$(curl -sf "$BASE/health") || fail "GET /health"
echo "$HEALTH" | grep -q '"ok"' || echo "$HEALTH" | grep -q 'true' || fail "/health body"
pass "GET /health"

# Status
STATUS=$(curl -sf "$BASE/status") || fail "GET /status"
echo "$STATUS" | grep -q 'race_status' || fail "/status JSON shape"
pass "GET /status"

# Register visitor
VISITOR=$(curl -sf -X POST "$BASE/visitors" \
  -H 'Content-Type: application/json' \
  -d '{"name":"VerifyBot","relationship":"stranger"}') || fail "POST /visitors"
VID=$(echo "$VISITOR" | python3 -c "import sys,json; print(json.load(sys.stdin)['visitor_id'])") || fail "visitor_id parse"
pass "POST /visitors → $VID"

# Greeting chat
CHAT=$(curl -sf -X POST "$BASE/chat" \
  -H 'Content-Type: application/json' \
  -d "{\"visitor_id\":\"$VID\"}") || fail "POST /chat (greeting)"
echo "$CHAT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('reply'); assert d.get('art_prompt'); print('  fallback='+str(d.get('fallback',False)))"
pass "POST /chat greeting (reply + art_prompt)"

# Message chat
CHAT2=$(curl -sf -X POST "$BASE/chat" \
  -H 'Content-Type: application/json' \
  -d "{\"visitor_id\":\"$VID\",\"message\":\"How many miles so far?\"}") || fail "POST /chat (message)"
echo "$CHAT2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('reply')"
pass "POST /chat message"

echo ""
echo "All agent API checks passed."
