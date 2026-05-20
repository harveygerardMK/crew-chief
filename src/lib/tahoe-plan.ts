import race from "../../data/race.json";
import segments from "../../data/segments.json";
import aidStations from "../../data/aid-stations.json";
import crewStops from "../../data/crew-stops.json";
import site from "../../data/site.json";
import type { AidStation } from "./data";
import { aidNForCrewStopN, findAidStationForCrew, mapsUrl, parseCoordinates } from "./station-links";

export const RACE_START_ISO = "2026-06-12T09:00:00-07:00";

/** Harvey's plan: finish Monday June 15 ~6 PM (official cutoff remains Tuesday). */
export const PLANNED_FINISH_ISO = "2026-06-15T18:00:00-07:00";

const COURSE_BASELINE_HOURS =
  segments[segments.length - 1]?.cumulative_baseline_hours ?? race.cutoff_hours;

const PLANNED_FINISH_HOURS =
  (new Date(PLANNED_FINISH_ISO).getTime() - new Date(RACE_START_ISO).getTime()) / 3_600_000;

/** Scale segment splits so baseline pace reaches the finish on Monday, not at 105h. */
const PLAN_HOURS_SCALE = PLANNED_FINISH_HOURS / COURSE_BASELINE_HOURS;

export type PaceScenario = "optimistic" | "baseline" | "conservative";

const PACE_MULTIPLIER: Record<PaceScenario, number> = {
  optimistic: 0.92,
  baseline: 1,
  conservative: 1.1,
};

/** Hours on course at a given mile using segment baseline splits */
export function baselineHoursAtMile(mile: number): number {
  if (mile <= 0) return 0;
  let prevCumMiles = 0;
  let prevCumHours = 0;

  for (const seg of segments) {
    if (mile <= seg.cumulative_miles) {
      const segStartMiles = prevCumMiles;
      const segLen = seg.miles;
      const fraction = segLen > 0 ? (mile - segStartMiles) / segLen : 1;
      const hoursInSeg = seg.manual_baseline_hours * fraction;
      return (prevCumHours + hoursInSeg) * PLAN_HOURS_SCALE;
    }
    prevCumMiles = seg.cumulative_miles;
    prevCumHours = seg.cumulative_baseline_hours;
  }
  return COURSE_BASELINE_HOURS * PLAN_HOURS_SCALE;
}

export function plannedArrivalDate(mile: number, pace: PaceScenario = "baseline"): Date {
  const hours = baselineHoursAtMile(mile) * PACE_MULTIPLIER[pace];
  return new Date(new Date(RACE_START_ISO).getTime() + hours * 3600000);
}

export function formatPlanTime(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatPlanTimeShort(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export interface BoardRow {
  aid_n: number;
  name: string;
  mile: number;
  crew_access: boolean;
  cutoff: string;
  optimistic: string;
  baseline: string;
  conservative: string;
  optimistic_iso: string;
  conservative_iso: string;
}

export function buildBoardRows(): BoardRow[] {
  return aidStations.map((a) => ({
    aid_n: a.n,
    name: a.name,
    mile: a.mile,
    crew_access: a.crew_access,
    cutoff: a.cutoff,
    optimistic: formatPlanTimeShort(plannedArrivalDate(a.mile, "optimistic")),
    baseline: formatPlanTimeShort(plannedArrivalDate(a.mile, "baseline")),
    conservative: formatPlanTimeShort(plannedArrivalDate(a.mile, "conservative")),
    optimistic_iso: plannedArrivalDate(a.mile, "optimistic").toISOString(),
    conservative_iso: plannedArrivalDate(a.mile, "conservative").toISOString(),
  }));
}

export function getAidByN(n: number): AidStation | undefined {
  return aidStations.find((a) => a.n === n);
}

export function getCrewStopPayload() {
  return crewStops.map((stop) => {
    const aidN = aidNForCrewStopN(stop.n);
    const aid = aidN !== undefined ? aidStations.find((a) => a.n === aidN) : findAidStationForCrew(stop.aid_station);
    const coords = parseCoordinates(stop.drive_notes) ?? aid?.coordinates;
    const mapsHref = coords ? mapsUrl(coords.lat, coords.lng) : undefined;
    return {
      crew_stop_n: stop.n,
      aid_n: aid?.n ?? aidN ?? stop.n,
      name: stop.aid_station,
      mile: stop.mile,
      cutoff: stop.cutoff,
      parking: stop.parking,
      optimistic_iso: plannedArrivalDate(stop.mile, "optimistic").toISOString(),
      baseline_iso: plannedArrivalDate(stop.mile, "baseline").toISOString(),
      conservative_iso: plannedArrivalDate(stop.mile, "conservative").toISOString(),
      maps_href: mapsHref,
    };
  });
}

/** Next crew stop for status display (server-side; ignores local check-ins). */
export function getNextPlannedCrewStop(lastSeenStation: string | null) {
  const stops = getCrewStopPayload();
  if (!lastSeenStation) return stops[0] ?? null;

  const key = lastSeenStation.toLowerCase();
  const idx = stops.findIndex(
    (s) =>
      key.includes(s.name.toLowerCase().split("(")[0].trim()) ||
      s.name.toLowerCase().includes(key) ||
      key.includes(`mile ${s.mile}`),
  );
  if (idx >= 0 && idx < stops.length - 1) return stops[idx + 1];
  if (idx >= 0) return null;
  return stops[0] ?? null;
}

export { race, aidStations, crewStops, site };
