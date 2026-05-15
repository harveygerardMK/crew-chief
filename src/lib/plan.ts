import site from "../../data/site.json";
import planStations from "../../data/plan-stations.json";
import crewRoster from "../../data/crew-roster.json";
import shotList from "../../data/shot-list.json";

export { site, planStations, crewRoster, shotList };

export type PlanStation = (typeof planStations)[number];

export function isCrewStation(station: PlanStation): boolean {
  const who = station.who?.toUpperCase() ?? "";
  if (who.includes("NO CREW")) return false;
  return who.includes("CREW") || who.includes("EVERYONE") || who.includes("ALL INTERESTED");
}

export function mapsLink(address: string | null): string | undefined {
  if (!address) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
