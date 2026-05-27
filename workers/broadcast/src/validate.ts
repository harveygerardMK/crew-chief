const MAX_DOING = 200;
const MAX_NOTE = 500;
const MAX_STATION = 80;
const MAX_TIME = 80;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 2;

export type BroadcastFields = {
  doing: string;
  station: string;
  timeLabel: string;
  note: string;
};

/** Normalize form values before validation and save. */
export function prepareBroadcastFields(raw: BroadcastFields): BroadcastFields {
  let station = raw.station.trim();
  if (station === "__other__") station = "";

  let timeLabel = raw.timeLabel.trim();
  if (station && !timeLabel) {
    timeLabel = pacificNowLabel();
  }

  return {
    doing: raw.doing.trim(),
    station,
    timeLabel,
    note: raw.note.trim(),
  };
}

export function validateBroadcastFields(
  fields: BroadcastFields,
): { ok: true } | { ok: false; message: string } {
  const doing = fields.doing;
  const station = fields.station;
  const timeLabel = fields.timeLabel;
  const note = fields.note;

  if (!doing && !station) {
    return { ok: false, message: "Add how Harvey is doing or pick a last-seen station." };
  }
  if (doing.length > MAX_DOING) {
    return { ok: false, message: `"How he's doing" must be ${MAX_DOING} characters or less.` };
  }
  if (note.length > MAX_NOTE) {
    return { ok: false, message: `Note must be ${MAX_NOTE} characters or less.` };
  }
  if (station.length > MAX_STATION) {
    return { ok: false, message: "Station name is too long." };
  }
  if (timeLabel.length > MAX_TIME) {
    return { ok: false, message: "Time field is too long." };
  }
  if (station && !timeLabel) {
    return { ok: false, message: "Add a time for last seen." };
  }
  return { ok: true };
}

function pacificNowLabel(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
