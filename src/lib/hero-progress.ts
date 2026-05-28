import aidStations from "../../data/aid-stations.json";
import race from "../../data/race.json";

interface CheckInsLike {
  stations?: Record<string, string>;
}

export interface HeroProgressState {
  mile: number;
  percent: number;
  stationName: string | null;
}

/** Horizontal inset so the beacon (centered with translateX(-50%)) is not clipped at mile 0. */
export const HERO_RUNNER_MIN_PERCENT = 3;
export const HERO_RUNNER_MAX_PERCENT = 97;

export function heroRunnerDisplayPercent(milePercent: number): number {
  const clamped = clamp(milePercent, 0, 100);
  const span = HERO_RUNNER_MAX_PERCENT - HERO_RUNNER_MIN_PERCENT;
  return HERO_RUNNER_MIN_PERCENT + (clamped / 100) * span;
}

const aidMilesById = new Map<number, { mile: number; name: string }>(
  aidStations.map((station) => [station.n, { mile: station.mile, name: station.name }]),
);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function safeParseCheckIns(raw: string | null): CheckInsLike {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as CheckInsLike;
  } catch {
    return {};
  }
}

export function resolveHeroProgress(checkIns: CheckInsLike): HeroProgressState {
  const stations = checkIns.stations ?? {};
  let latestAidId: number | null = null;
  let latestTs = -1;

  for (const [aidIdRaw, iso] of Object.entries(stations)) {
    const aidId = Number(aidIdRaw);
    const ts = Date.parse(iso);
    if (!Number.isFinite(aidId) || !Number.isFinite(ts)) continue;
    if (ts > latestTs) {
      latestTs = ts;
      latestAidId = aidId;
    }
  }

  // Guardrail: if aid id is unknown/malformed, clamp to start.
  if (latestAidId == null || !aidMilesById.has(latestAidId)) {
    return { mile: 0, percent: 0, stationName: null };
  }

  const resolved = aidMilesById.get(latestAidId)!;
  const rawPercent = (resolved.mile / race.distance_miles) * 100;
  const percent = clamp(rawPercent, 0, 100);

  return {
    mile: resolved.mile,
    percent,
    stationName: resolved.name,
  };
}

export function readHeroProgressFromStorage(): HeroProgressState {
  const checkIns = safeParseCheckIns(localStorage.getItem("tahoe200-checkins"));
  return resolveHeroProgress(checkIns);
}
