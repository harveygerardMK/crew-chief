import { aidStations, crewStops } from "./data";

/** Normalize station names for cross-linking aid ↔ crew data. */
export function normalizeStationName(name: string): string {
  return name
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/^Finish\s*/i, "")
    .replace(/^Start\s*/i, "")
    .trim()
    .toLowerCase();
}

export function findCrewStopForAid(aidName: string) {
  const key = normalizeStationName(aidName);
  return crewStops.find((s) => normalizeStationName(s.aid_station) === key) ?? null;
}

export function findAidStationForCrew(crewAidName: string) {
  const key = normalizeStationName(crewAidName);
  return aidStations.find((s) => normalizeStationName(s.name) === key) ?? null;
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
