/**
 * PM2 process file — run from repo root on the droplet:
 *   pm2 start deploy/ecosystem.config.cjs
 */
const path = require("path");
const fs = require("fs");

function loadEnvFile(envPath) {
  const env = {};
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const repoRoot = path.join(__dirname, "..");
const serverEnv = loadEnvFile(path.join(repoRoot, "server", ".env"));

module.exports = {
  apps: [
    {
      name: "crew-chief-api",
      cwd: path.join(repoRoot, "server"),
      script: "python3",
      args: "-m uvicorn app:app --host 127.0.0.1 --port 8080",
      env: {
        NODE_ENV: "production",
        ...serverEnv,
      },
      max_restarts: 20,
      restart_delay: 3000,
    },
  ],
};
