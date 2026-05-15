const RACE_START = new Date("2026-06-12T09:00:00-07:00");
const RACE_END = new Date("2026-06-16T18:00:00-07:00");

export function getRacePhase(now = new Date()): "pre-race" | "on-course" | "finished" {
  if (now < RACE_START) return "pre-race";
  if (now <= RACE_END) return "on-course";
  return "finished";
}

export function getCountdown(now = new Date()): string | null {
  if (now >= RACE_START) return null;
  const ms = RACE_START.getTime() - now.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `T-minus ${days} day${days === 1 ? "" : "s"}`;
  if (hours > 0) return `T-minus ${hours} hour${hours === 1 ? "" : "s"}`;
  return "Race starts soon";
}

export function formatRaceDates(): string {
  return "June 12–16, 2026";
}
