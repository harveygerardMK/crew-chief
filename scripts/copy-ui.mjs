import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const src = join(root, "ui");
const apiUrl = process.env.PUBLIC_AGENT_API_URL || "";

const files = ["index.html", "styles.css", "app.js", "config.example.js", "splash-rabbit.svg"];

let config = readFileSync(join(src, "config.js"), "utf8");
config = config.replace(
  'window.CREW_CHIEF_API = "";',
  `window.CREW_CHIEF_API = ${JSON.stringify(apiUrl)};`,
);

/** Ask Harvey UI: site root (primary) and /agent/ (legacy bookmarks). */
for (const destDir of ["", "agent"]) {
  const dest = destDir ? join(root, "public", destDir) : join(root, "public");
  mkdirSync(dest, { recursive: true });
  for (const file of files) {
    cpSync(join(src, file), join(dest, file), { force: true });
  }
  writeFileSync(join(dest, "config.js"), config);
}

console.log(
  `Copied ui/ → public/ and public/agent/ (API: ${apiUrl || "(set PUBLIC_AGENT_API_URL at build)"})`,
);
