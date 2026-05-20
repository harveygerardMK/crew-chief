import { aidStations, crewStops } from "./data";

/** Crew stop n → aid station n (authoritative; names alone are ambiguous). */
const AID_N_BY_CREW_STOP_N: Record<number, number> = {
  1: 0, // Heavenly (Start) → Start (Heavenly Stagecoach)
  2: 4, // Sierra at Tahoe
  3: 6, // Loon Lake
  4: 9, // Tahoe City
  5: 10, // Brockway Summit
  6: 11, // Village Green
  7: 13, // Finish (Heavenly)
};

const CREW_STOP_N_BY_AID_N: Record<number, number> = Object.fromEntries(
  Object.entries(AID_N_BY_CREW_STOP_N).map(([crewN, aidN]) => [aidN, Number(crewN)]),
) as Record<number, number>;

export function findCrewStopByN(n: number) {
  return crewStops.find((s) => s.n === n) ?? null;
}

export function findAidByN(n: number) {
  return aidStations.find((a) => a.n === n) ?? null;
}

export function findCrewStopForAid(aidName: string, aidN?: number) {
  if (aidN !== undefined && CREW_STOP_N_BY_AID_N[aidN] !== undefined) {
    return findCrewStopByN(CREW_STOP_N_BY_AID_N[aidN]);
  }
  const aid = aidStations.find((a) => a.name === aidName);
  if (aid && CREW_STOP_N_BY_AID_N[aid.n] !== undefined) {
    return findCrewStopByN(CREW_STOP_N_BY_AID_N[aid.n]);
  }
  return null;
}

export function findAidStationForCrew(crewAidName: string) {
  const stop = crewStops.find((s) => s.aid_station === crewAidName);
  if (stop && AID_N_BY_CREW_STOP_N[stop.n] !== undefined) {
    return findAidByN(AID_N_BY_CREW_STOP_N[stop.n]);
  }
  if (stop) {
    return aidStations.find((a) => a.mile === stop.mile) ?? null;
  }
  return null;
}

export function aidNForCrewStopN(crewStopN: number): number | undefined {
  return AID_N_BY_CREW_STOP_N[crewStopN];
}

/** Parse "Coordinates: lat, lng" or return null. */
export function parseCoordinates(driveNotes: string): { lat: number; lng: number } | null {
  const m = driveNotes.match(/Coordinates:\s*([-\d.]+),\s*([-\d.]+)/i);
  if (!m) return null;
  return { lat: Number(m[1]), lng: Number(m[2]) };
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}
