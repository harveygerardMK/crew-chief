import race from "../../data/race.json";
import bighorn from "../../data/bighorn-100-2025.json";
import elevationCompare from "../../data/elevation-compare.json";
import aidStations from "../../data/aid-stations.json";
import crewStops from "../../data/crew-stops.json";
import site from "../../data/site.json";
import type { AidStation } from "./data";
import { aidNForCrewStopN, findAidStationForCrew, mapsUrl, parseCoordinates } from "./station-links";

export const RACE_START_ISO = "2026-06-12T09:00:00-07:00";

/** Harvey's plan: finish Monday June 15 ~6 PM (official cutoff remains Tuesday). */
export const PLANNED_FINISH_ISO = "2026-06-15T18:00:00-07:00";

/** First-half crew target: Sierra ~52 mi by Saturday midnight (Bighorn 50 mi prep). */
export const FIRST_HALF_TARGET_ISO = bighorn.tahoe_prep.target_arrival;

const PLANNED_FINISH_HOURS =
  (new Date(PLANNED_FINISH_ISO).getTime() - new Date(RACE_START_ISO).getTime()) / 3_600_000;

const FIRST_HALF_TARGET_HOURS = bighorn.tahoe_prep.hours_from_tahoe_start;
const TAHOE_FIRST_CREW_MILE = bighorn.tahoe_prep.analog_mile_on_tahoe;

const BIGHORN_FINISH_HOURS = bighorn.finish_elapsed_hours;
const BIGHORN_MILES = bighorn.distance_miles;
const TAHOE_MILES = race.distance_miles;

type PacePoint = { mile: number; hours: number };

const bighornPaceCurve: PacePoint[] = [
  { mile: 0, hours: 0 },
  ...bighorn.checkpoints.map((c) => ({ mile: c.mile, hours: c.elapsed_hours })),
  { mile: BIGHORN_MILES, hours: BIGHORN_FINISH_HOURS },
].sort((a, b) => a.mile - b.mile);

function interpolateHoursAtMile(mile: number, curve: PacePoint[]): number {
  if (mile <= 0) return 0;
  if (mile >= curve[curve.length - 1].mile) return curve[curve.length - 1].hours;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (mile >= a.mile && mile <= b.mile) {
      const span = b.mile - a.mile;
      const fraction = span > 0 ? (mile - a.mile) / span : 0;
      return a.hours + fraction * (b.hours - a.hours);
    }
  }
  return curve[curve.length - 1].hours;
}

function bighornHoursAtTahoeMile(tahoeMile: number): number {
  const equivBighornMile = tahoeMile * (BIGHORN_MILES / TAHOE_MILES);
  return interpolateHoursAtMile(equivBighornMile, bighornPaceCurve);
}

function bighornHoursAtFirstCrewMile(): number {
  return bighornHoursAtTahoeMile(TAHOE_FIRST_CREW_MILE);
}

/**
 * First ~52 mi: Bighorn 100 shape (9 AM start splits), scaled so Sierra lands Saturday midnight.
 * After that: same Bighorn *shape* from turnaround to finish, scaled to Monday ~6 PM at mile 200.4.
 */
export function baselineHoursAtMile(mile: number): number {
  if (mile <= TAHOE_FIRST_CREW_MILE) {
    const bh = bighornHoursAtTahoeMile(mile);
    const bhAtCrew = bighornHoursAtFirstCrewMile();
    return bhAtCrew > 0 ? bh * (FIRST_HALF_TARGET_HOURS / bhAtCrew) : 0;
  }

  const bhAtCrew = bighornHoursAtFirstCrewMile();
  const bhAtFinish = BIGHORN_FINISH_HOURS;
  const bhNow = bighornHoursAtTahoeMile(mile);
  const span = bhAtFinish - bhAtCrew;
  const fraction = span > 0 ? (bhNow - bhAtCrew) / span : 0;
  return FIRST_HALF_TARGET_HOURS + fraction * (PLANNED_FINISH_HOURS - FIRST_HALF_TARGET_HOURS);
}

export type PaceScenario = "optimistic" | "baseline" | "conservative";

const PACE_MULTIPLIER: Record<PaceScenario, number> = {
  optimistic: 0.92,
  baseline: 1,
  conservative: 1.1,
};

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

export function formatPlanWindow(d: Date, hoursBefore = 0.75, hoursAfter = 1.25): string {
  const start = new Date(d.getTime() - hoursBefore * 3600000);
  const end = new Date(d.getTime() + hoursAfter * 3600000);
  return `${formatPlanTimeShort(start)} – ${formatPlanTimeShort(end)}`;
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

export function planSourceNote(): string {
  return `First ~${TAHOE_FIRST_CREW_MILE} mi: Bighorn 100 (${bighorn.year}, 9 AM start, ${bighorn.tahoe_prep.target_label} at Sierra). Back half → Monday finish.`;
}

export function firstHalfPrepNote(): string {
  return `Bighorn Jaws (~48 mi) in 14:20 → target ${bighorn.tahoe_prep.analog_aid} by ${bighorn.tahoe_prep.target_label} (${FIRST_HALF_TARGET_HOURS} h from Friday 9 AM start).`;
}

export { race, aidStations, crewStops, site, bighorn, elevationCompare };
