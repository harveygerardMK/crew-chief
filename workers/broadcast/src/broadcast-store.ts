export type RaceBroadcastEntry = {
  updated_at: string;
  updated_by: string;
  doing: string | null;
  last_seen: { station: string; time_label: string } | null;
  note: string | null;
  photos: { url: string; alt: string }[];
};

export type RaceBroadcastFile = {
  updates: RaceBroadcastEntry[];
};

const MAX_UPDATES = 50;

export function entryHasContent(entry: RaceBroadcastEntry): boolean {
  return Boolean(
    entry.doing?.trim() ||
      entry.last_seen?.station?.trim() ||
      entry.note?.trim() ||
      entry.photos.length > 0,
  );
}

export function parseBroadcastFile(raw: unknown): RaceBroadcastEntry[] {
  if (!raw || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.updates)) {
    return obj.updates
      .filter(isEntry)
      .filter(entryHasContent)
      .sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
  }

  if (typeof obj.updated_at === "string") {
    const legacy = legacyToEntry(obj);
    return entryHasContent(legacy) ? [legacy] : [];
  }

  return [];
}

function isEntry(value: unknown): value is RaceBroadcastEntry {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as RaceBroadcastEntry).updated_at === "string"
  );
}

function legacyToEntry(obj: Record<string, unknown>): RaceBroadcastEntry {
  const lastSeen = obj.last_seen;
  return {
    updated_at: String(obj.updated_at),
    updated_by: typeof obj.updated_by === "string" ? obj.updated_by : "crew",
    doing: typeof obj.doing === "string" ? obj.doing : null,
    last_seen:
      lastSeen &&
      typeof lastSeen === "object" &&
      typeof (lastSeen as { station: string }).station === "string"
        ? {
            station: (lastSeen as { station: string }).station,
            time_label:
              typeof (lastSeen as { time_label: string }).time_label === "string"
                ? (lastSeen as { time_label: string }).time_label
                : "",
          }
        : null,
    note: typeof obj.note === "string" ? obj.note : null,
    photos: Array.isArray(obj.photos)
      ? (obj.photos as { url: string; alt: string }[]).filter(
          (p) => p && typeof p.url === "string",
        )
      : [],
  };
}

export function appendBroadcastUpdate(
  existing: unknown,
  newEntry: RaceBroadcastEntry,
): RaceBroadcastFile {
  const prior = parseBroadcastFile(existing);
  return { updates: [newEntry, ...prior].slice(0, MAX_UPDATES) };
}
