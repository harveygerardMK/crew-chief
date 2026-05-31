#!/usr/bin/env bash
# Validate server/.env on the droplet before race week.
# Usage: bash scripts/check-agent-env.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/server/.env"

pass() { echo "✓ $1"; }
fail() { echo "✗ $1" >&2; exit 1; }
warn() { echo "! $1"; }

echo "Checking agent environment in ${ENV_FILE} ..."

[[ -f "$ENV_FILE" ]] || fail "Missing server/.env — copy from server/.env.example"

python3 - <<'PY' "$ENV_FILE"
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    print("Install server deps first: python3 -m pip install -r server/requirements.txt", file=sys.stderr)
    sys.exit(1)

env_path = Path(sys.argv[1])
load_dotenv(env_path)

key = os.getenv("ANTHROPIC_API_KEY", "")
if not key:
    print("✗ ANTHROPIC_API_KEY is empty", file=sys.stderr)
    sys.exit(1)

if not key.isascii():
    bad = next((c for c in key if ord(c) > 127), None)
    print(f"✗ ANTHROPIC_API_KEY contains non-ASCII character {bad!r} — re-paste from Anthropic console", file=sys.stderr)
    sys.exit(1)

if not key.startswith("sk-ant-"):
    print(f"! ANTHROPIC_API_KEY does not start with sk-ant- (starts with {key[:12]!r}) — double-check paste", file=sys.stderr)

if key.count("sk-ant-") > 1:
    print("! ANTHROPIC_API_KEY may be duplicated (sk-ant- appears more than once)", file=sys.stderr)

print("✓ ANTHROPIC_API_KEY present and ASCII-safe")
print(f"  length={len(key)} prefix={key[:15]}…")

status_path = Path(os.getenv("HARVEY_STATUS_PATH", f"{env_path.parent.parent}/data/harvey_status.json"))
if status_path.is_file():
    print(f"✓ Status file exists: {status_path}")
else:
    print(f"! Status file missing: {status_path}", file=sys.stderr)

visitors_path = Path(os.getenv("VISITORS_PATH", f"{env_path.parent.parent}/data/visitors.json"))
if visitors_path.is_file():
    print(f"✓ Visitors file exists: {visitors_path}")
else:
    print(f"! Visitors file missing: {visitors_path}", file=sys.stderr)
PY

pass "server/.env checks complete"

if curl -sf http://127.0.0.1:8080/health >/dev/null 2>&1; then
  pass "API responding on :8080"
  READY=$(curl -sf http://127.0.0.1:8080/ready) || fail "GET /ready failed"
  echo "$READY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if not d.get('claude_configured'):
    raise SystemExit('claude_configured=false — key not loaded; pm2 restart crew-chief-api')
if not d.get('api_key_ascii'):
    raise SystemExit('api_key_ascii=false')
lf = d.get('langfuse_configured')
lf_ok = d.get('langfuse_ok')
print('✓ /ready:', 'claude_configured', d.get('claude_configured'), '| race_status', d.get('race_status'))
if lf:
    if lf_ok is True:
        print('✓ Langfuse configured and authenticated')
    else:
        print('! Langfuse keys set but auth failed — check LANGFUSE_* in server/.env')
else:
    print('  Langfuse not configured (optional for test-week tracing)')
"
else
  warn "API not running on :8080 — start with: pm2 start deploy/ecosystem.config.cjs"
fi

echo ""
echo "Env check done."
