import race from "../../data/race.json";
import segments from "../../data/segments.json";
import aidStations from "../../data/aid-stations.json";
import crewStops from "../../data/crew-stops.json";
import pacerLegs from "../../data/pacer-legs.json";
import gear from "../../data/gear.json";
import racePrep from "../../data/race-prep.json";
import raceWeek from "../../data/race-week.json";
import keyNotes from "../../data/key-notes.json";
import status from "../../data/status.json";
import raceBroadcastRaw from "../../data/race-broadcast.json";
import { getBroadcastUpdates } from "./broadcast";

const raceBroadcastUpdates = getBroadcastUpdates(raceBroadcastRaw);

export {
  race,
  segments,
  aidStations,
  crewStops,
  pacerLegs,
  gear,
  racePrep,
  raceWeek,
  keyNotes,
  status,
  raceBroadcastUpdates,
};

export type {
  RaceBroadcast,
  RaceBroadcastEntry,
  RaceBroadcastPhoto,
} from "./broadcast";

export type AidStation = (typeof aidStations)[number];
export type CrewStop = (typeof crewStops)[number];
export type PacerLeg = (typeof pacerLegs)[number];
export type RaceStatus = typeof status;
