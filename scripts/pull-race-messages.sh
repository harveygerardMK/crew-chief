#!/usr/bin/env bash
# Pull notes and chat logs from the production droplet and print a readable report.
# Usage (from repo root on your Mac, with SSH access to the droplet):
#   bash scripts/pull-race-messages.sh
# Optional:
#   DROPLET=root@107.170.32.201 bash scripts/pull-race-messages.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DROPLET="${DROPLET:-root@107.170.32.201}"
REMOTE_DIR="/var/crew-chief/data"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> Fetching race messages from ${DROPLET} ..."
scp "${DROPLET}:${REMOTE_DIR}/notes.json" "${TMP_DIR}/notes.json" 2>/dev/null || echo '[]' > "${TMP_DIR}/notes.json"
scp "${DROPLET}:${REMOTE_DIR}/questions.json" "${TMP_DIR}/questions.json" 2>/dev/null || echo '[]' > "${TMP_DIR}/questions.json"

python3 "${REPO_ROOT}/scripts/format-race-messages.py" \
  "${TMP_DIR}/notes.json" \
  "${TMP_DIR}/questions.json"
