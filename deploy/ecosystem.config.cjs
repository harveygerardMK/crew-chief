/**
 * PM2 process file — run from repo root on the droplet:
 *   pm2 start deploy/ecosystem.config.cjs
 */
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
    {
      name: "cloudflared",
      script: "cloudflared",
      args: "tunnel --url http://127.0.0.1:8080",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
    },
  ],
};
