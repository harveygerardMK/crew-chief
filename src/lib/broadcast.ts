export type RaceBroadcastPhoto = {
  url: string;
  alt: string;
};

export type RaceBroadcastLastSeen = {
  station: string;
  time_label: string;
};

export type RaceBroadcast = {
  updated_at: string | null;
  updated_by: string | null;
  doing: string | null;
  last_seen: RaceBroadcastLastSeen | null;
  note: string | null;
  photos: RaceBroadcastPhoto[];
};

export function hasBroadcast(b: RaceBroadcast): boolean {
  return Boolean(
    b.updated_at &&
      (b.doing?.trim() || b.last_seen?.station?.trim() || b.note?.trim() || b.photos.length > 0),
  );
}
