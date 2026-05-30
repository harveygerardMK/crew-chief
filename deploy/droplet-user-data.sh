#!/bin/bash
# DigitalOcean droplet "User data" — paste into Advanced Options → User data when creating the droplet.
# Runs once on first boot. Log: /var/log/crew-chief-init.log
#
# After ~5–10 minutes, SSH in and finish:
#   nano /var/crew-chief/server/.env   # ANTHROPIC_API_KEY
#   pm2 restart crew-chief-api
#   cloudflared tunnel --url http://127.0.0.1:8080
exec > /var/log/crew-chief-init.log 2>&1
set -euo pipefail

echo "==> crew-chief cloud-init $(date -Is)"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates

if [[ ! -d /var/crew-chief/.git ]]; then
  git clone https://github.com/harveygerardMK/crew-chief.git /var/crew-chief
fi

bash /var/crew-chief/scripts/droplet-bootstrap.sh

echo "==> cloud-init complete $(date -Is)"
