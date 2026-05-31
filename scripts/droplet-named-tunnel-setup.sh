#!/usr/bin/env bash
# Create a named Cloudflare Tunnel with a stable hostname (agent.wheresharvey.com).
# Run ONCE on the droplet as root, after wheresharvey.com is on Cloudflare DNS.
#
# Usage: bash scripts/droplet-named-tunnel-setup.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

TUNNEL_NAME="${TUNNEL_NAME:-crew-chief-agent}"
HOSTNAME="${AGENT_TUNNEL_HOSTNAME:-agent.wheresharvey.com}"
CONFIG_DIR="${REPO_ROOT}/deploy/cloudflared"
CONFIG_FILE="${CONFIG_DIR}/config.yml"
CREDS_DIR="/root/.cloudflared"

echo "==> Named Cloudflare Tunnel setup"
echo "    Tunnel name: ${TUNNEL_NAME}"
echo "    Hostname:    https://${HOSTNAME}"
echo ""
echo "Prerequisite: ${HOSTNAME} DNS zone must be on Cloudflare (not Squarespace-only)."
echo "See docs/superpowers/runbooks/crew-chief-agent-named-tunnel.md"
echo ""

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "Installing cloudflared..."
  curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb" -o /tmp/cloudflared.deb
  dpkg -i /tmp/cloudflared.deb
  rm -f /tmp/cloudflared.deb
fi

if [[ ! -f "${CREDS_DIR}/cert.pem" ]]; then
  echo ""
  echo "==> Login to Cloudflare (opens a browser URL — paste it if headless):"
  cloudflared tunnel login
fi

if ! cloudflared tunnel list 2>/dev/null | grep -q "${TUNNEL_NAME}"; then
  echo "==> Creating tunnel ${TUNNEL_NAME}..."
  cloudflared tunnel create "${TUNNEL_NAME}"
else
  echo "==> Tunnel ${TUNNEL_NAME} already exists."
fi

CREDS_FILE=""
if cloudflared tunnel list 2>/dev/null | grep -q "${TUNNEL_NAME}"; then
  TUNNEL_UUID=$(cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" '$0 ~ n {print $1; exit}')
  if [[ -n "$TUNNEL_UUID" && -f "${CREDS_DIR}/${TUNNEL_UUID}.json" ]]; then
    CREDS_FILE="${CREDS_DIR}/${TUNNEL_UUID}.json"
  fi
fi
if [[ -z "$CREDS_FILE" ]]; then
  CREDS_FILE=$(ls "${CREDS_DIR}"/*.json 2>/dev/null | grep -v cert.pem | head -1 || true)
fi
if [[ -z "$CREDS_FILE" ]]; then
  echo "ERROR: No tunnel credentials JSON in ${CREDS_DIR}" >&2
  exit 1
fi

TUNNEL_UUID=$(basename "$CREDS_FILE" .json)
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_FILE" <<EOF
tunnel: ${TUNNEL_NAME}
credentials-file: ${CREDS_FILE}

ingress:
  - hostname: ${HOSTNAME}
    service: http://127.0.0.1:8080
  - service: http_status:404
EOF

echo "==> Wrote ${CONFIG_FILE}"
echo "==> Routing DNS ${HOSTNAME} → tunnel..."
cloudflared tunnel route dns "${TUNNEL_NAME}" "${HOSTNAME}" || {
  echo ""
  echo "WARN: cloudflared route dns failed."
  echo "Add manually in Cloudflare DNS: CNAME ${HOSTNAME} → ${TUNNEL_UUID}.cfargotunnel.com (proxied)"
}

echo "==> Restarting cloudflared with named tunnel..."
pm2 delete cloudflared 2>/dev/null || true
cd "$REPO_ROOT"
pm2 start deploy/ecosystem.config.cjs --only cloudflared 2>/dev/null || {
  pm2 start deploy/ecosystem.config.cjs
}
pm2 save

sleep 4
echo ""
echo "==> Stable API URL (set GitHub variable PUBLIC_AGENT_API_URL to this — once):"
echo "https://${HOSTNAME}"
echo ""
echo "Verify:"
echo "  curl -s https://${HOSTNAME}/health"
echo ""
echo "Then redeploy GitHub Pages (or push to main) so config.js picks up the new URL."
