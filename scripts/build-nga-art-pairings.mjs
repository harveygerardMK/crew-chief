/**
 * Build data/art-pairings.json from NGA open-access collection (IIIF images).
 * @see https://www.nga.gov/open-access-images/open-data.html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const TARGET = Number(process.env.ART_PAIRING_COUNT ?? 500);
const UA = { "User-Agent": "CrewChief-Tahoe200/1.0 (https://github.com/harveygerardMK/crew-chief)" };

const DEFAULT_RATIONALES = {
  stopped: "Aid-station chair gravity — hard to leave.",
  shuffle: "Forward motion, questionable enthusiasm.",
  cruising: "Steady effort; museum docent pace.",
  flying: "Brief downhill heroics (payback pending).",
  clear: "Good visibility, suspicious optimism.",
  cloudy: "Overcast matches the internal forecast.",
  rain: "Sky and socks negotiating terms.",
  snow: "Cold clarity on the pass.",
  hot: "Exposed ridge, melting resolve.",
  cold: "Hypothermia chic at mile who-knows.",
  early: "Day-one legs still believe in glory.",
  mid: "Halfway through the party; quads left early.",
  deep: "Mile 120+ energy: majestic, slightly unhinged.",
  finish: "Towed toward the line — exhausted, luminous.",
  night: "Headlamp hours; brain doing gallery loops.",
  dawn: "First light — legs disagree with the beauty.",
  crew_aid: "Crew table energy at the next stop.",
  sleep: "Chair nap that wasn't restful.",
  storm: "Weather window closing on the climb.",
  climb: "Vert that never seems to end.",
  lake: "Too pretty to bonk here. Bonking anyway.",
};

const TAG_RULES = [
  { tag: "night", re: /\b(night|nocturne|moon|moonlight|midnight|evening|dusk|dark)\b/i },
  { tag: "dawn", re: /\b(sunrise|dawn|morning|daybreak)\b/i },
  { tag: "rain", re: /\b(rain|storm|shower|wet|flood)\b/i },
  { tag: "storm", re: /\b(storm|tempest|gale|hurricane|wave|lightning|thunder)\b/i },
  { tag: "climb", re: /\b(mountain|cliff|ridge|peak|summit|ascent|volcano|alps|rocky)\b/i },
  { tag: "lake", re: /\b(lake|river|sea|ocean|water|harbor|shore|coast|beach|wave)\b/i },
  { tag: "crew_aid", re: /\b(crowd|group|family|gather|procession|banquet|feast)\b/i },
  { tag: "sleep", re: /\b(sleep|dream|rest|bed|reclin|nap)\b/i },
  { tag: "flying", re: /\b(gallop|horse|race|run|hunt|sport|athlete|jump|steeplechase)\b/i },
  { tag: "shuffle", re: /\b(walk|trudge|labor|glean|sower|peasant|road|path|journey)\b/i },
  { tag: "deep", re: /\b(death|skull|ghost|misery|despair|war|battle|shipwreck|raft)\b/i },
  { tag: "finish", re: /\b(victory|triumph|crossing|finish|coronation|celebration)\b/i },
];

const PHASE_TAGS = ["early", "mid", "deep", "finish"];
const PACE_TAGS = ["stopped", "shuffle", "cruising", "flying"];
const WEATHER_TAGS = ["clear", "cloudy", "rain", "snow", "hot", "cold"];

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

async function loadCsv(url) {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.text();
}

function artistKey(attribution) {
  const s = (attribution ?? "").trim();
  if (!s) return "unknown";
  const parts = s.split(/\s+/);
  return parts[parts.length - 1].toLowerCase().replace(/[^a-z]/g, "") || "unknown";
}

function cleanArtist(attribution) {
  return (attribution ?? "Unknown")
    .replace(/^after\s+/i, "")
    .split(",")[0]
    .trim();
}

function autoTags(text, index) {
  const tags = new Set();
  for (const { tag, re } of TAG_RULES) {
    if (re.test(text)) tags.add(tag);
  }
  tags.add(PHASE_TAGS[index % PHASE_TAGS.length]);
  tags.add(PACE_TAGS[Math.floor(index / PHASE_TAGS.length) % PACE_TAGS.length]);
  tags.add(WEATHER_TAGS[Math.floor(index / (PHASE_TAGS.length * PACE_TAGS.length)) % WEATHER_TAGS.length]);
  if (tags.size < 4) tags.add("cruising");
  return [...tags];
}

function segmentKeywords(text) {
  const kws = [];
  if (/\b(pass|summit|ridge|mountain)\b/i.test(text)) kws.push("pass", "summit");
  if (/\b(lake|tahoe|water|shore)\b/i.test(text)) kws.push("lake", "tahoe");
  if (/\b(desolation|wilderness|forest)\b/i.test(text)) kws.push("desolation", "loon");
  if (/\b(spooner|brockway)\b/i.test(text)) kws.push("spooner", "brockway");
  return kws.length ? [...new Set(kws)] : undefined;
}

function pickDiverse(candidates, count) {
  const byArtist = new Map();
  for (const c of candidates) {
    const key = artistKey(c.artist);
    if (!byArtist.has(key)) byArtist.set(key, []);
    byArtist.get(key).push(c);
  }
  for (const list of byArtist.values()) {
    list.sort((a, b) => a.objectId.localeCompare(b.objectId));
  }
  const keys = [...byArtist.keys()].sort();
  const picked = [];
  const seen = new Set();
  let round = 0;
  while (picked.length < count && round < 2000) {
    let added = false;
    for (const key of keys) {
      const list = byArtist.get(key);
      const item = list[round];
      if (item && !seen.has(item.objectId)) {
        picked.push(item);
        seen.add(item.objectId);
        added = true;
        if (picked.length >= count) break;
      }
    }
    if (!added) break;
    round++;
  }
  return picked;
}

async function main() {
  console.log(`Building ${TARGET} NGA art pairings…`);
  const [objText, imgText] = await Promise.all([
    loadCsv("https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/objects.csv"),
    loadCsv("https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/published_images.csv"),
  ]);

  const oh = parseCsvLine(objText.split("\n")[0]);
  const oi = Object.fromEntries(oh.map((h, i) => [h, i]));
  const objects = new Map();
  for (const line of objText.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    objects.set(row[oi.objectid], {
      title: row[oi.title] ?? "",
      artist: row[oi.attribution] ?? "",
      year: row[oi.beginyear] ?? "",
      classification: row[oi.classification] ?? "",
      medium: row[oi.medium] ?? "",
    });
  }

  const ih = parseCsvLine(imgText.split("\n")[0]);
  const ii = Object.fromEntries(ih.map((h, i) => [h, i]));
  const candidates = [];
  const seenObjects = new Set();

  for (const line of imgText.split("\n").slice(1)) {
    if (!line.trim()) continue;
    const row = parseCsvLine(line);
    if (row[ii.openaccess] !== "1" || row[ii.viewtype] !== "primary") continue;
    const objectId = row[ii.depictstmsobjectid];
    if (!objectId || seenObjects.has(objectId)) continue;
    const width = Number(row[ii.width]) || 0;
    const height = Number(row[ii.height]) || 0;
    if (width < 400 || height < 400) continue;

    const obj = objects.get(objectId);
    if (!obj?.title) continue;
    const cls = obj.classification.toLowerCase();
    if (cls && !/(painting|print|drawing|photograph)/i.test(cls)) continue;

    seenObjects.add(objectId);
    candidates.push({
      objectId,
      uuid: row[ii.uuid],
      assistive: row[ii.assistivetext] ?? "",
      ...obj,
    });
  }

  console.log(`Eligible open-access objects: ${candidates.length}`);
  const selected = pickDiverse(candidates, Math.min(TARGET, candidates.length));

  const pairings = selected.map((item, index) => {
    const blob = `${item.title} ${item.artist} ${item.medium} ${item.assistive}`;
    const tags = autoTags(blob, index);
    const segment_keywords = segmentKeywords(blob);
    return {
      title: item.title,
      artist: cleanArtist(item.artist),
      year: item.year || "",
      image_url: `https://api.nga.gov/iiif/${item.uuid}/full/!640,480/0/default.jpg`,
      nga_object_id: item.objectId,
      nga_image_uuid: item.uuid,
      source_url: `https://www.nga.gov/collection/art-object-page.${item.objectId}.html`,
      tags,
      rationales: { ...DEFAULT_RATIONALES },
      ...(segment_keywords ? { segment_keywords } : {}),
    };
  });

  const outPath = path.join(ROOT, "data/art-pairings.json");
  fs.writeFileSync(outPath, `${JSON.stringify(pairings, null, 2)}\n`);
  console.log(`Wrote ${pairings.length} pairings to data/art-pairings.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
