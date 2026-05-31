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

# Ready (ops probe — optional until droplet pulls latest server)
READY_CODE=$(curl -s -o /tmp/agent-ready.json -w "%{http_code}" "$BASE/ready") || fail "GET /ready"
if [[ "$READY_CODE" == "200" ]]; then
  python3 -c "
import json
d = json.load(open('/tmp/agent-ready.json'))
assert d.get('ok') is True, d
if not d.get('claude_configured'):
    print('  WARNING: claude_configured=false — chat will use fallback')
if not d.get('api_key_ascii', True):
    print('  WARNING: api_key_ascii=false — fix ANTHROPIC_API_KEY encoding on droplet')
"
  pass "GET /ready"
elif [[ "$READY_CODE" == "404" ]]; then
  echo "  NOTE: /ready not found — droplet needs: git pull && pm2 restart crew-chief-api"
  pass "GET /ready (skipped — deploy pending)"
else
  fail "GET /ready (HTTP $READY_CODE)"
fi

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
echo "$CHAT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('reply')
assert d.get('art_prompt') is None, 'greeting should not include art_prompt'
fb = d.get('fallback', False)
print('  fallback=' + str(fb))
if fb:
    print('  WARNING: fallback=True — check ANTHROPIC_API_KEY, credits, and pm2 logs')
"
pass "POST /chat greeting (reply, no art_prompt)"

CHAT_ART=$(curl -sf -X POST "$BASE/chat" \
  -H 'Content-Type: application/json' \
  -d "{\"visitor_id\":\"$VID\",\"message\":\"How is he doing?\"}") || fail "POST /chat (art trigger)"
echo "$CHAT_ART" | python3 -c "
import sys, json
d = json.load(sys.stdin)
assert d.get('reply')
assert d.get('art_prompt'), 'art trigger should return art_prompt'
img = d.get('art_image_url')
if img:
    print('  art_image_url=set (NGA)')
"
pass "POST /chat art trigger"

# Message chat
CHAT2=$(curl -sf -X POST "$BASE/chat" \
  -H 'Content-Type: application/json' \
  -d "{\"visitor_id\":\"$VID\",\"message\":\"How many miles so far?\"}") || fail "POST /chat (message)"
echo "$CHAT2" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('reply')"
pass "POST /chat message"

echo ""
echo "All agent API checks passed."
