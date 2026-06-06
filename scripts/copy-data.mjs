import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Race JSON the static site and agent API fetch from /data/*.json */
const FILES = [
  "aid-stations.json",
  "segments.json",
  "family-stops.json",
  "crew-stops.json",
  "race.json",
  "race-week.json",
  "race-broadcast.json",
];

const root = process.cwd();
const srcDir = join(root, "data");
const destDir = join(root, "public", "data");
mkdirSync(destDir, { recursive: true });

for (const file of FILES) {
  cpSync(join(srcDir, file), join(destDir, file), { force: true });
}

console.log(`Copied ${FILES.length} data files → public/data/`);
