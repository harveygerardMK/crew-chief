import aidStations from "../../data/aid-stations.json";
import artPairings from "../../data/art-pairings.json";
import segments from "../../data/segments.json";
import race from "../../data/race.json";

export type PaceBucket = "stopped" | "shuffle" | "cruising" | "flying";
export type WeatherBucket = "clear" | "cloudy" | "rain" | "snow" | "hot" | "cold" | "unknown";
export type RacePhaseBand = "early" | "mid" | "deep" | "finish";

export interface AidStationRef {
  name: string;
  mile: number;
}

export interface ArtMatchInput {
  hour: number;
  elapsedHours: number;
  weather: WeatherBucket;
  paceBucket: PaceBucket;
  mile: number;
  lastAid: AidStationRef | null;
  nextAid: AidStationRef | null;
  nextAidIsCrew: boolean;
  segmentName: string | null;
  phaseBand: RacePhaseBand;
}

export interface ArtPairingResult {
  title: string;
  artist: string;
  year: string;
  imageUrl: string;
  sourceUrl: string;
  objectId: string;
  sportsMoment: string;
  caption: string;
}

export interface PickArtPairingOptions {
  /** NGA object IDs already shown this race — skipped until pool is exhausted. */
  excludeObjectIds?: ReadonlySet<string>;
}

interface ArtPairingEntry {
  title: string;
  artist: string;
  year: string;
  image_url: string;
  source_url?: string;
  nga_object_id?: string;
  tags: string[];
  segment_keywords?: string[];
  rationales: Partial<
    Record<PaceBucket | WeatherBucket | RacePhaseBand | "night" | "dawn" | "early" | "crew_aid" | "sleep" | "storm" | "climb" | "lake", string>
  >;
}

const PAIRINGS = artPairings as ArtPairingEntry[];

export function getNextAidStation(mile: number): AidStationRef | null {
  const next = aidStations.find((s) => s.mile > mile + 0.05);
  if (!next) return null;
  if (mile >= race.distance_miles - 0.5) return { name: "Finish", mile: race.distance_miles };
  return { name: next.name, mile: next.mile };
}

export function getLastAidStation(mile: number): AidStationRef | null {
  let last: (typeof aidStations)[number] | null = null;
  for (const station of aidStations) {
    if (station.mile <= mile + 0.05) last = station;
    else break;
  }
  if (!last || last.mile === 0) return null;
  return { name: last.name, mile: last.mile };
}

export function isNextAidCrew(mile: number): boolean {
  const next = aidStations.find((s) => s.mile > mile + 0.05);
  return next?.crew_access === true;
}

export function getCurrentSegment(mile: number): { name: string; milesToEnd: number } | null {
  for (const seg of segments) {
    if (mile <= seg.cumulative_miles + 0.001) {
      return { name: seg.name, milesToEnd: Math.max(0, seg.cumulative_miles - mile) };
    }
  }
  return null;
}

export function milesToNextAid(mile: number): number | null {
  const next = getNextAidStation(mile);
  if (!next) return null;
  return Math.max(0, next.mile - mile);
}

export function racePhaseBand(mile: number): RacePhaseBand {
  if (mile >= 180) return "finish";
  if (mile >= 120) return "deep";
  if (mile >= 52) return "mid";
  return "early";
}

export function milesRemaining(routeMile: number): number {
  return Math.max(0, race.distance_miles - routeMile);
}

export function elevationAtMile(mile: number): number {
  if (mile <= 0) return 0;
  const sorted = [...segments].sort((a, b) => a.cumulative_miles - b.cumulative_miles);
  if (mile >= sorted[sorted.length - 1].cumulative_miles) {
    return sorted[sorted.length - 1].cumulative_gain_ft;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (mile >= a.cumulative_miles && mile <= b.cumulative_miles) {
      const span = b.cumulative_miles - a.cumulative_miles;
      const fraction = span > 0 ? (mile - a.cumulative_miles) / span : 0;
      return Math.round(a.cumulative_gain_ft + fraction * (b.cumulative_gain_ft - a.cumulative_gain_ft));
    }
  }
  return 0;
}

export function formatPaceBucket(speedMph: number | null): PaceBucket {
  if (speedMph == null || speedMph < 0.3) return "stopped";
  if (speedMph < 3) return "shuffle";
  if (speedMph < 5) return "cruising";
  return "flying";
}

export function weatherBucketFromCode(code: number | undefined): WeatherBucket {
  if (code == null) return "unknown";
  if (code === 0 || code === 1) return "clear";
  if (code >= 2 && code <= 3) return "cloudy";
  if (code >= 51 && code <= 67) return "rain";
  if (code >= 71 && code <= 86) return "snow";
  if (code >= 95) return "rain";
  return "cloudy";
}

export function weatherBucketFromTemp(tempF: number | null): WeatherBucket | null {
  if (tempF == null) return null;
  if (tempF >= 85) return "hot";
  if (tempF <= 35) return "cold";
  return null;
}

function isNight(hour: number): boolean {
  return hour < 6 || hour >= 20;
}

function isDawn(hour: number): boolean {
  return hour >= 5 && hour < 8;
}

function seedFromInput(input: ArtMatchInput): number {
  const mileBucket = Math.floor(input.mile / 5);
  const hourBucket = Math.floor(input.hour);
  const nextName = input.nextAid?.name ?? "finish";
  const raw = `${hourBucket}|${mileBucket}|${input.paceBucket}|${input.weather}|${input.phaseBand}|${nextName}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function scoreEntry(entry: ArtPairingEntry, input: ArtMatchInput): number {
  const tags = new Set(entry.tags);
  let score = 0;

  if (tags.has(input.paceBucket)) score += 2;
  if (tags.has(input.weather)) score += 2;
  if (tags.has(input.phaseBand)) score += 2;
  if (isNight(input.hour) && tags.has("night")) score += 2;
  if (isDawn(input.hour) && tags.has("dawn")) score += 2;
  if (input.elapsedHours < 12 && tags.has("early")) score += 1;
  if (input.nextAidIsCrew && tags.has("crew_aid")) score += 1;
  if (input.paceBucket === "stopped" && tags.has("sleep")) score += 1;

  const segLower = input.segmentName?.toLowerCase() ?? "";
  for (const kw of entry.segment_keywords ?? []) {
    if (segLower.includes(kw.toLowerCase())) score += 1;
  }

  return score;
}

function sportsMomentFor(input: ArtMatchInput): string {
  const parts: string[] = [];
  if (input.lastAid) parts.push(`leaving ${input.lastAid.name}`);
  if (input.nextAid) {
    const dist = milesToNextAid(input.mile);
    const distLabel = dist != null && dist > 0 ? `${dist.toFixed(1)} mi to ` : "heading to ";
    parts.push(`${distLabel}${input.nextAid.name}`);
  }
  if (input.segmentName) parts.push(`on ${input.segmentName}`);
  if (parts.length === 0) return "Harvey is on course.";
  return `Harvey is ${parts.join(", ")}.`;
}

function captionFor(entry: ArtPairingEntry, input: ArtMatchInput): string {
  const r = entry.rationales;
  return (
    r[input.paceBucket] ??
    r[input.weather] ??
    r[input.phaseBand] ??
    (isNight(input.hour) ? r.night : undefined) ??
    (isDawn(input.hour) ? r.dawn : undefined) ??
    (input.elapsedHours < 12 ? r.early : undefined) ??
    (input.nextAidIsCrew ? r.crew_aid : undefined) ??
    (input.paceBucket === "stopped" ? r.sleep : undefined) ??
    r.climb ??
    "Museum committee says this matches the vibe."
  );
}

export function pickArtPairing(input: ArtMatchInput, options: PickArtPairingOptions = {}): ArtPairingResult {
  const exclude = options.excludeObjectIds ?? new Set<string>();

  function rankPool(pool: ArtPairingEntry[]) {
    const scored = pool.map((entry) => ({ entry, score: scoreEntry(entry, input) }));
    const maxScore = Math.max(...scored.map((s) => s.score));
    return maxScore > 0 ? scored.filter((s) => s.score === maxScore) : scored;
  }

  let pool = rankPool(PAIRINGS.filter((e) => !exclude.has(e.nga_object_id ?? "")));
  if (pool.length === 0) {
    pool = rankPool(PAIRINGS);
  }

  const pick = pool[seedFromInput(input) % pool.length].entry;

  return {
    title: pick.title,
    artist: pick.artist,
    year: pick.year,
    imageUrl: pick.image_url,
    objectId: pick.nga_object_id ?? "",
    sourceUrl:
      pick.source_url ??
      (pick.nga_object_id
        ? `https://www.nga.gov/collection/art-object-page.${pick.nga_object_id}.html`
        : "https://www.nga.gov/artwork-search"),
    sportsMoment: sportsMomentFor(input),
    caption: captionFor(pick, input),
  };
}

export function aidStationNearMile(mile: number): { lat: number; lng: number } | null {
  let best = aidStations[0];
  let bestDist = Infinity;
  for (const station of aidStations) {
    const dist = Math.abs(station.mile - mile);
    if (dist < bestDist) {
      bestDist = dist;
      best = station;
    }
  }
  const coords = best?.coordinates;
  if (!coords) return null;
  return { lat: coords.lat, lng: coords.lng };
}

export { race as raceMeta };
