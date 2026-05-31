import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "ui");
const dest = join(root, "public", "agent");

const files = ["index.html", "styles.css", "app.js", "config.example.js"];

mkdirSync(dest, { recursive: true });

for (const file of files) {
  cpSync(join(src, file), join(dest, file), { force: true });
}

let config = readFileSync(join(src, "config.js"), "utf8");
const apiUrl = process.env.PUBLIC_AGENT_API_URL || "";
config = config.replace(
  'window.CREW_CHIEF_API = "";',
  `window.CREW_CHIEF_API = ${JSON.stringify(apiUrl)};`,
);
writeFileSync(join(dest, "config.js"), config);

console.log(`Copied ui/ → public/agent/ (API: ${apiUrl || "(set PUBLIC_AGENT_API_URL at build)"})`);
