import aidStations from "../../data/aid-stations.json";
import segments from "../../data/segments.json";
import race from "../../data/race.json";

export type PaceBucket = "stopped" | "shuffle" | "cruising" | "flying";
export type WeatherBucket = "clear" | "cloudy" | "rain" | "snow" | "hot" | "cold" | "unknown";

export interface AidStationRef {
  name: string;
  mile: number;
}

export interface HeadSongInput {
  hour: number;
  elapsedHours: number;
  weather: WeatherBucket;
  paceBucket: PaceBucket;
  mile: number;
}

export interface HeadSong {
  title: string;
  artist: string;
  rationale: string;
}

interface SongEntry {
  title: string;
  artist: string;
  tags: string[];
  rationales: Partial<Record<PaceBucket | WeatherBucket | "night" | "deep" | "early", string>>;
}

const SONGS: SongEntry[] = [
  { title: "Runnin' Down a Dream", artist: "Tom Petty", tags: ["cruising"], rationales: { cruising: "Classic forward motion when the legs agree." } },
  { title: "Eye of the Tiger", artist: "Survivor", tags: ["flying"], rationales: { flying: "Unearned confidence at an unsustainable pace." } },
  { title: "The Sound of Silence", artist: "Simon & Garfunkel", tags: ["stopped", "night"], rationales: { stopped: "Aid-station chair hypnosis.", night: "3 AM brain static on a forest road." } },
  { title: "Don't Stop Believin'", artist: "Journey", tags: ["shuffle"], rationales: { shuffle: "Crew said I looked fine. I did not look fine." } },
  { title: "Thunderstruck", artist: "AC/DC", tags: ["rain", "flying"], rationales: { rain: "Hail on the ridge, volume inappropriate.", flying: "Temporary hubris before the next climb." } },
  { title: "Here Comes the Sun", artist: "The Beatles", tags: ["early", "clear"], rationales: { early: "First daylight after a long night.", clear: "Alpine morning, suspicious optimism." } },
  { title: "Lose Yourself", artist: "Eminem", tags: ["cruising", "deep"], rationales: { cruising: "One shot, one opportunity — mostly the opportunity to eat." } },
  { title: "Take On Me", artist: "a-ha", tags: ["shuffle"], rationales: { shuffle: "High note, low blood sugar." } },
  { title: "Bohemian Rhapsody", artist: "Queen", tags: ["deep", "night"], rationales: { deep: "Mile 150+: is this real life?", night: "Full opera at mile who-knows." } },
  { title: "I Will Survive", artist: "Gloria Gaynor", tags: ["rain", "shuffle"], rationales: { rain: "Wet socks, undefeated attitude (barely)." } },
  { title: "Blinding Lights", artist: "The Weeknd", tags: ["night", "flying"], rationales: { night: "Headlamp tunnel vision synth loop." } },
  { title: "Walking on Sunshine", artist: "Katrina & The Waves", tags: ["clear", "cruising"], rationales: { clear: "Too cheerful for current suffering level." } },
  { title: "Under Pressure", artist: "Queen & David Bowie", tags: ["deep"], rationales: { deep: "Cutoff math getting louder than footsteps." } },
  { title: "Mr. Blue Sky", artist: "Electric Light Orchestra", tags: ["clear"], rationales: { clear: "Unreasonably pretty weather for this much vert." } },
  { title: "Africa", artist: "Toto", tags: ["shuffle"], rationales: { shuffle: "Bless the rains down in… Tahoe, apparently." } },
  { title: "Dreams", artist: "Fleetwood Mac", tags: ["stopped"], rationales: { stopped: "Micro-nap playlist accidentally left on." } },
  { title: "Sabotage", artist: "Beastie Boys", tags: ["flying"], rationales: { flying: "Downhill lie — legs pretending they're fresh." } },
  { title: "Creep", artist: "Radiohead", tags: ["cold", "night"], rationales: { cold: "Hypothermia-adjacent self-assessment.", night: "What am I doing out here?" } },
  { title: "Hot in Herre", artist: "Nelly", tags: ["hot"], rationales: { hot: "Midday exposed ridge, poor song choice, accurate." } },
  { title: "Ice Ice Baby", artist: "Vanilla Ice", tags: ["cold", "snow"], rationales: { cold: "Too cold to stop.", snow: "Mandatory snow-line earworm." } },
  { title: "All Star", artist: "Smash Mouth", tags: ["shuffle"], rationales: { shuffle: "Somebody once told me… to keep moving." } },
  { title: "Float On", artist: "Modest Mouse", tags: ["cruising"], rationales: { cruising: "Good news: still moving. Bad news: still far." } },
  { title: "Dog Days Are Over", artist: "Florence + The Machine", tags: ["hot", "deep"], rationales: { hot: "Sun-exposed climb, dramatic internal soundtrack." } },
  { title: "Run the World (Girls)", artist: "Beyoncé", tags: ["flying"], rationales: { flying: "Briefly convinced I'm winning. I'm not winning." } },
  { title: "The Middle", artist: "Jimmy Eat World", tags: ["deep"], rationales: { deep: "It just takes some time — a lot of time." } },
  { title: "Send Me On My Way", artist: "Rusted Root", tags: ["cruising", "clear"], rationales: { cruising: "Whistling past the next aid station." } },
  { title: "Bitter Sweet Symphony", artist: "The Verve", tags: ["shuffle"], rationales: { shuffle: "Long road, existential shuffle." } },
  { title: "Stronger", artist: "Kanye West", tags: ["rain"], rationales: { rain: "What doesn't kill you makes you… wetter." } },
  { title: "Zombie", artist: "The Cranberries", tags: ["night", "deep"], rationales: { night: "Sleep-deprived loop, no questions asked." } },
  { title: "Happy", artist: "Pharrell Williams", tags: ["clear", "early"], rationales: { clear: "Delusional morning cheer after 40 miles." } },
  { title: "Paint It Black", artist: "The Rolling Stones", tags: ["night"], rationales: { night: "Second night out mood." } },
  { title: "Shake It Off", artist: "Taylor Swift", tags: ["shuffle"], rationales: { shuffle: "Blister denial anthem." } },
  { title: "Born to Run", artist: "Bruce Springsteen", tags: ["cruising", "flying"], rationales: { cruising: "Obvious. Still slaps.", flying: "Born to run, forced to power-hike later." } },
  { title: "Time After Time", artist: "Cyndi Lauper", tags: ["deep"], rationales: { deep: "Every aid stop feels like déjà vu." } },
  { title: "Sweet Child O' Mine", artist: "Guns N' Roses", tags: ["flying"], rationales: { flying: "Downhill guitar riff, temporary invincibility." } },
  { title: "Wake Me Up Before You Go-Go", artist: "Wham!", tags: ["stopped"], rationales: { stopped: "Crew trying to kick me out of the chair." } },
  { title: "Rocket Man", artist: "Elton John", tags: ["night", "deep"], rationales: { night: "Mars is closer than the next aid station.", deep: "Floating in a most peculiar way." } },
  { title: "I Ran", artist: "A Flock of Seagulls", tags: ["flying"], rationales: { flying: "Hair volume aspirational; pace temporary." } },
  { title: "Toxic", artist: "Britney Spears", tags: ["hot", "deep"], rationales: { hot: "Questionable decisions still ahead." } },
  { title: "Fix You", artist: "Coldplay", tags: ["cold", "rain"], rationales: { rain: "Crew fixing feet while this plays in my head." } },
];

export function getNextAidStation(mile: number): AidStationRef | null {
  const next = aidStations.find((s) => s.mile > mile + 0.05);
  if (!next) return null;
  if (mile >= race.distance_miles - 0.5) return { name: "Finish", mile: race.distance_miles };
  return { name: next.name, mile: next.mile };
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

function seedFromInput(input: HeadSongInput): number {
  const hourBucket = Math.floor(input.hour);
  const mileBucket = Math.floor(input.mile / 5);
  const elapsedBucket = Math.floor(input.elapsedHours / 4);
  const raw = `${hourBucket}|${mileBucket}|${elapsedBucket}|${input.paceBucket}|${input.weather}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function guessHeadSong(input: HeadSongInput): HeadSong {
  const isNight = input.hour < 6 || input.hour >= 20;
  const isDeep = input.mile >= 120;
  const isEarly = input.elapsedHours < 12;

  const candidates = SONGS.filter((song) => {
    if (song.tags.includes(input.paceBucket)) return true;
    if (song.tags.includes(input.weather)) return true;
    if (isNight && song.tags.includes("night")) return true;
    if (isDeep && song.tags.includes("deep")) return true;
    if (isEarly && song.tags.includes("early")) return true;
    return false;
  });

  const pool = candidates.length > 0 ? candidates : SONGS;
  const pick = pool[seedFromInput(input) % pool.length];

  const rationale =
    pick.rationales[input.paceBucket] ??
    pick.rationales[input.weather] ??
    (isNight ? pick.rationales.night : undefined) ??
    (isDeep ? pick.rationales.deep : undefined) ??
    (isEarly ? pick.rationales.early : undefined) ??
    "Earworm selected by committee (me, tired).";

  return { title: pick.title, artist: pick.artist, rationale };
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
