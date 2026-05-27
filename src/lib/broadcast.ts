export type RaceBroadcastPhoto = {
  url: string;
  alt: string;
};

export type RaceBroadcastLastSeen = {
  station: string;
  time_label: string;
};

export type RaceBroadcastEntry = {
  updated_at: string;
  updated_by: string | null;
  doing: string | null;
  last_seen: RaceBroadcastLastSeen | null;
  note: string | null;
  photos: RaceBroadcastPhoto[];
};

/** @deprecated use RaceBroadcastEntry */
export type RaceBroadcast = RaceBroadcastEntry;

export type RaceBroadcastFile = {
  updates: RaceBroadcastEntry[];
};

const MAX_UPDATES = 50;

export function entryHasContent(b: RaceBroadcastEntry): boolean {
  return Boolean(
    b.doing?.trim() ||
      b.last_seen?.station?.trim() ||
      b.note?.trim() ||
      b.photos.length > 0,
  );
}

export function hasBroadcast(b: RaceBroadcastEntry): boolean {
  return entryHasContent(b);
}

export function hasBroadcastUpdates(updates: RaceBroadcastEntry[]): boolean {
  return updates.some(entryHasContent);
}

export function getBroadcastUpdates(raw: unknown): RaceBroadcastEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(isEntry)
      .filter(entryHasContent)
      .sort(sortNewestFirst);
  }
  return parseBroadcastFile(raw);
}

function parseBroadcastFile(raw: unknown): RaceBroadcastEntry[] {
  if (!raw || typeof raw !== "object") return [];

  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.updates)) {
    return obj.updates
      .filter(isEntry)
      .filter(entryHasContent)
      .sort(sortNewestFirst);
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
    updated_by: typeof obj.updated_by === "string" ? obj.updated_by : null,
    doing: typeof obj.doing === "string" ? obj.doing : null,
    last_seen:
      lastSeen &&
      typeof lastSeen === "object" &&
      typeof (lastSeen as RaceBroadcastLastSeen).station === "string"
        ? {
            station: (lastSeen as RaceBroadcastLastSeen).station,
            time_label:
              typeof (lastSeen as RaceBroadcastLastSeen).time_label === "string"
                ? (lastSeen as RaceBroadcastLastSeen).time_label
                : "",
          }
        : null,
    note: typeof obj.note === "string" ? obj.note : null,
    photos: Array.isArray(obj.photos)
      ? obj.photos.filter(
          (p): p is RaceBroadcastPhoto =>
            p !== null &&
            typeof p === "object" &&
            typeof (p as RaceBroadcastPhoto).url === "string",
        )
      : [],
  };
}

function sortNewestFirst(a: RaceBroadcastEntry, b: RaceBroadcastEntry): number {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export function appendBroadcastUpdate(
  existing: unknown,
  newEntry: RaceBroadcastEntry,
): RaceBroadcastFile {
  const prior = parseBroadcastFile(existing);
  const updates = [newEntry, ...prior].slice(0, MAX_UPDATES);
  return { updates };
}
