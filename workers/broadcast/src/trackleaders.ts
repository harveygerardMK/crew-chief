export interface TrackerSnapshot {
  enabled: boolean;
  fetched_at: string;
  race_status: "active" | "finished" | "unknown";
  last_update_at: string | null;
  last_update_label: string | null;
  route_mile: number | null;
  elevation_gain_ft: number | null;
  current_speed_mph: number | null;
  stale: boolean;
  source_url: string;
  error?: string;
}

export interface TrackLeadersEnv {
  TRACKLEADERS_EVENT_SLUG?: string;
  TRACKLEADERS_RUNNER_NAME?: string;
}

const STALE_MS = 65 * 60 * 1000;
const CACHE_TTL_MS = 60_000;

let cache: { data: TrackerSnapshot; expiresAt: number } | null = null;
let inFlight: Promise<TrackerSnapshot> | null = null;

/** Test helper — clears module cache between vitest cases. */
export function resetTrackerCacheForTests(): void {
  cache = null;
  inFlight = null;
}

export async function getTrackerSnapshot(env: TrackLeadersEnv): Promise<TrackerSnapshot> {
  const slug = env.TRACKLEADERS_EVENT_SLUG?.trim();
  const name = env.TRACKLEADERS_RUNNER_NAME?.trim();

  if (!slug || !name) {
    return disabledSnapshot("TrackLeaders not configured.");
  }

  const now = Date.now();
  if (cache && now < cache.expiresAt) return cache.data;

  if (inFlight) return inFlight;

  inFlight = fetchSnapshot(slug, name).finally(() => {
    inFlight = null;
  });

  const data = await inFlight;
  cache = { data, expiresAt: now + CACHE_TTL_MS };
  return data;
}

function disabledSnapshot(message: string): TrackerSnapshot {
  return {
    enabled: false,
    fetched_at: new Date().toISOString(),
    race_status: "unknown",
    last_update_at: null,
    last_update_label: null,
    route_mile: null,
    elevation_gain_ft: null,
    current_speed_mph: null,
    stale: false,
    source_url: "",
    error: message,
  };
}

async function fetchSnapshot(slug: string, name: string): Promise<TrackerSnapshot> {
  const runnerKey = name.replace(/\s+/g, "_");
  const sourceUrl = `https://trackleaders.com/spot/${slug}/${runnerKey}-status.json`;

  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "crew-chief-tracker/1.0" },
    });

    if (!res.ok) {
      const htmlUrl = `https://trackleaders.com/${slug}i.php?name=${encodeURIComponent(name)}`;
      return parseHtmlFallback(htmlUrl, sourceUrl);
    }

    const body = (await res.json()) as { data?: [string, string][] };
    const rows = body.data ?? [];
    const stats = new Map(rows.map(([k, v]) => [k.toLowerCase(), v]));

    const lastUpdateLabel = stats.get("last update rec'd") ?? null;
    const lastUpdateAt = parseTrackLeadersTime(lastUpdateLabel);
    const routeMile = parseMiles(stats.get("route mile"));
    const elevationGain = parseFeet(stats.get("elevation gain"));
    const speedMph = parseMph(stats.get("current speed"));
    const raceStatusRaw = stats.get("race status")?.toLowerCase() ?? "";

    let raceStatus: TrackerSnapshot["race_status"] = "unknown";
    if (raceStatusRaw.includes("finish")) raceStatus = "finished";
    else if (raceStatusRaw.includes("active")) raceStatus = "active";

    const stale =
      lastUpdateAt != null ? Date.now() - lastUpdateAt.getTime() > STALE_MS : false;

    return {
      enabled: true,
      fetched_at: new Date().toISOString(),
      race_status: raceStatus,
      last_update_at: lastUpdateAt?.toISOString() ?? null,
      last_update_label: lastUpdateLabel,
      route_mile: routeMile,
      elevation_gain_ft: elevationGain,
      current_speed_mph: speedMph,
      stale,
      source_url: sourceUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "fetch failed";
    return {
      ...disabledSnapshot(message),
      enabled: true,
      source_url: sourceUrl,
    };
  }
}

async function parseHtmlFallback(htmlUrl: string, jsonUrl: string): Promise<TrackerSnapshot> {
  try {
    const res = await fetch(htmlUrl, {
      headers: { "User-Agent": "crew-chief-tracker/1.0" },
    });
    if (!res.ok) {
      return { ...disabledSnapshot(`TrackLeaders returned ${res.status}.`), enabled: true, source_url: jsonUrl };
    }
    const html = await res.text();
    const stats = parseHtmlStatsTable(html);

    const lastUpdateLabel = stats.get("last update rec'd") ?? null;
    const lastUpdateAt = parseTrackLeadersTime(lastUpdateLabel);

    return {
      enabled: true,
      fetched_at: new Date().toISOString(),
      race_status: parseRaceStatus(stats.get("race status")),
      last_update_at: lastUpdateAt?.toISOString() ?? null,
      last_update_label: lastUpdateLabel,
      route_mile: parseMiles(stats.get("route mile")),
      elevation_gain_ft: parseFeet(stats.get("elevation gain")),
      current_speed_mph: parseMph(stats.get("current speed")),
      stale: lastUpdateAt != null ? Date.now() - lastUpdateAt.getTime() > STALE_MS : false,
      source_url: htmlUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "parse failed";
    return { ...disabledSnapshot(message), enabled: true, source_url: jsonUrl };
  }
}

function parseHtmlStatsTable(html: string): Map<string, string> {
  const stats = new Map<string, string>();
  const rowRe = /<tr><td>([^<]+)<\/td><td>([^<]+)<\/td><\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(html)) !== null) {
    stats.set(match[1].trim().toLowerCase(), match[2].trim());
  }
  return stats;
}

function parseRaceStatus(raw: string | undefined): TrackerSnapshot["race_status"] {
  const s = raw?.toLowerCase() ?? "";
  if (s.includes("finish")) return "finished";
  if (s.includes("active")) return "active";
  return "unknown";
}

function parseMiles(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseFeet(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseMph(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number.parseFloat(raw.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Best-effort parse of labels like "05:02:05 PM (AKST) 01/12/26". */
export function parseTrackLeadersTime(label: string | null): Date | null {
  if (!label) return null;

  const m = label.match(
    /(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\s*\((\w+)\)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i,
  );
  if (!m) return null;

  let hour = Number.parseInt(m[1], 10);
  const minute = Number.parseInt(m[2], 10);
  const second = Number.parseInt(m[3], 10);
  const ampm = m[4].toUpperCase();
  const month = Number.parseInt(m[6], 10);
  const day = Number.parseInt(m[7], 10);
  let year = Number.parseInt(m[8], 10);
  if (year < 100) year += 2000;

  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  const tz = timezoneOffsetForAbbr(m[5]);
  if (tz == null) {
    return new Date(year, month - 1, day, hour, minute, second);
  }

  const utcMs = Date.UTC(year, month - 1, day, hour, minute, second) - tz * 60_000;
  return new Date(utcMs);
}

function timezoneOffsetForAbbr(abbr: string): number | null {
  const map: Record<string, number> = {
    PDT: -420,
    PST: -480,
    MST: -420,
    MDT: -360,
    AKST: -540,
    AKDT: -480,
    HST: -600,
  };
  return map[abbr.toUpperCase()] ?? null;
}
