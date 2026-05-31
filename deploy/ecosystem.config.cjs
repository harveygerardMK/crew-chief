/**
 * PM2 process file — run from repo root on the droplet:
 *   pm2 start deploy/ecosystem.config.cjs
 *
 * Named tunnel (stable URL): deploy/cloudflared/config.yml exists after
 *   bash scripts/droplet-named-tunnel-setup.sh
 * Quick tunnel (URL changes on restart): used when config.yml is absent.
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const namedConfig = path.join(repoRoot, "deploy", "cloudflared", "config.yml");

function cloudflaredApp() {
  if (fs.existsSync(namedConfig)) {
    return {
      name: "cloudflared",
      script: "cloudflared",
      args: `tunnel --config ${namedConfig} run crew-chief-agent`,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
    };
  }
  return {
    name: "cloudflared",
    script: "cloudflared",
    args: "tunnel --url http://127.0.0.1:8080",
    autorestart: true,
    max_restarts: 20,
    restart_delay: 5000,
  };
}

module.exports = {
  apps: [
    {
      name: "crew-chief-api",
      cwd: "./server",
      script: "python3",
      args: "-m uvicorn app:app --host 127.0.0.1 --port 8080",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 20,
      restart_delay: 3000,
    },
    cloudflaredApp(),
  ],
};
