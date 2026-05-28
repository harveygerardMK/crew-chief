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

export async function fetchTrackerSnapshot(apiUrl: string): Promise<TrackerSnapshot | null> {
  try {
    const res = await fetch(apiUrl, { credentials: "omit" });
    if (!res.ok) return null;
    return (await res.json()) as TrackerSnapshot;
  } catch {
    return null;
  }
}

export function formatRelativeAge(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const mins = Math.round((now - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m ago` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
