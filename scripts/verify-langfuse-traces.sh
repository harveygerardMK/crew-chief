#!/usr/bin/env bash
# Smoke-test /chat + verify trace landed in Langfuse with accuracy heuristics.
# Usage:
#   LANGFUSE_PUBLIC_KEY=... LANGFUSE_SECRET_KEY=... \
#     ./scripts/verify-langfuse-traces.sh https://your-tunnel.trycloudflare.com
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${1:-}"
if [[ -z "$BASE" ]]; then
  echo "Usage: $0 <API_BASE_URL>" >&2
  exit 1
fi
BASE="${BASE%/}"

pass() { echo "✓ $1"; }
fail() { echo "✗ $1" >&2; exit 1; }

[[ -n "${LANGFUSE_PUBLIC_KEY:-}" ]] || fail "LANGFUSE_PUBLIC_KEY not set"
[[ -n "${LANGFUSE_SECRET_KEY:-}" ]] || fail "LANGFUSE_SECRET_KEY not set"
export LANGFUSE_BASE_URL="${LANGFUSE_BASE_URL:-https://us.cloud.langfuse.com}"

echo "Langfuse trace check against $BASE ..."

READY=$(curl -sf "$BASE/ready") || fail "GET /ready"
echo "$READY" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert d.get('langfuse_configured'), 'langfuse_configured=false on server'
assert d.get('langfuse_ok'), 'langfuse_ok=false on server — check LANGFUSE_* in server/.env'
if not d.get('claude_configured'):
    raise SystemExit('claude_configured=false — accuracy check needs live Claude')
if not d.get('api_key_ascii', True):
    raise SystemExit('api_key_ascii=false — fix ANTHROPIC_API_KEY on server')
"
pass "server /ready (Langfuse + Claude OK)"

VISITOR=$(curl -sf -X POST "$BASE/visitors" \
  -H 'Content-Type: application/json' \
  -d '{"name":"LangfuseCI","relationship":"friend"}') || fail "POST /visitors"
VID=$(echo "$VISITOR" | python3 -c "import sys,json; print(json.load(sys.stdin)['visitor_id'])")

CHAT=$(curl -sf -X POST "$BASE/chat" \
  -H 'Content-Type: application/json' \
  -d "{\"visitor_id\":\"$VID\",\"message\":\"Where is Harvey?\"}") || fail "POST /chat"
echo "$CHAT" > /tmp/agent-langfuse-chat.json
pass "POST /chat (saved to /tmp/agent-langfuse-chat.json)"

python3 "$REPO_ROOT/scripts/verify_langfuse_trace.py" /tmp/agent-langfuse-chat.json
