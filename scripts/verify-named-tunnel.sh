#!/usr/bin/env bash
# Check named-tunnel readiness from your laptop (DNS + API + site config).
# Usage:
#   bash scripts/verify-named-tunnel.sh
#   bash scripts/verify-named-tunnel.sh https://agent.wheresharvey.com
set -euo pipefail

AGENT_URL="${1:-https://agent.wheresharvey.com}"
AGENT_URL="${AGENT_URL%/}"
HOST="${AGENT_URL#https://}"
HOST="${HOST#http://}"
ZONE="wheresharvey.com"

pass() { echo "✓ $1"; }
fail() { echo "✗ $1"; }
warn() { echo "! $1"; }

echo "Named tunnel verification"
echo "  Agent URL: ${AGENT_URL}"
echo ""

echo "==> 1. Nameservers (zone must be on Cloudflare for agent.${ZONE})"
NS=$(dig NS "${ZONE}" +short 2>/dev/null | tr '[:upper:]' '[:lower:]' | sort)
if echo "$NS" | grep -q 'cloudflare.com'; then
  pass "${ZONE} uses Cloudflare nameservers"
  echo "$NS" | sed 's/^/    /'
else
  fail "${ZONE} is still on Squarespace (or other) DNS — add the zone to Cloudflare first"
  echo "$NS" | sed 's/^/    /'
  echo ""
  echo "  Next: docs/superpowers/runbooks/crew-chief-agent-named-tunnel.md (Phase 1)"
fi
echo ""

echo "==> 2. GitHub Pages A records for ${ZONE}"
for ip in 185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153; do
  if dig A "${ZONE}" +short 2>/dev/null | grep -qx "$ip"; then
    pass "A ${ip}"
  else
    warn "Missing A ${ip} (site may break after nameserver switch if not added in Cloudflare)"
  fi
done
echo ""

echo "==> 3. Agent hostname DNS (${HOST})"
CNAME=$(dig CNAME "${HOST}" +short 2>/dev/null | head -1 || true)
if [[ -n "$CNAME" ]]; then
  pass "CNAME ${HOST} → ${CNAME}"
elif dig A "${HOST}" +short 2>/dev/null | grep -q .; then
  pass "${HOST} resolves (A/AAAA)"
else
  fail "No DNS for ${HOST} — run droplet-named-tunnel-setup.sh on the droplet after zone is on Cloudflare"
fi
echo ""

echo "==> 4. Agent API health"
if curl -sf "${AGENT_URL}/health" >/tmp/agent-health.json 2>/dev/null; then
  pass "${AGENT_URL}/health"
  python3 -m json.tool </tmp/agent-health.json | head -6 | sed 's/^/    /'
else
  code=$(curl -s -o /dev/null -w "%{http_code}" "${AGENT_URL}/health" 2>/dev/null || echo "000")
  fail "${AGENT_URL}/health (HTTP ${code})"
  echo "    Tunnel not running or DNS not propagated yet."
fi
echo ""

echo "==> 5. Static site config.js"
if CONFIG=$(curl -sf "https://${ZONE}/config.js" 2>/dev/null); then
  API=$(echo "$CONFIG" | grep -oE 'CREW_CHIEF_API = "https://[^"]+"' | head -1 || true)
  if [[ -z "$API" ]]; then
    fail "config.js has no CREW_CHIEF_API"
  elif echo "$API" | grep -q "${HOST}"; then
    pass "config.js points at named tunnel: ${API}"
  else
    warn "config.js still uses quick tunnel or old URL: ${API}"
    echo "    Set GitHub variable PUBLIC_AGENT_API_URL=${AGENT_URL} and redeploy Pages."
  fi
else
  fail "Could not fetch https://${ZONE}/config.js"
fi
echo ""
echo "Done."
