const MAX_DOING = 200;
const MAX_NOTE = 500;
const MAX_STATION = 80;
const MAX_TIME = 60;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 2;

export type BroadcastFields = {
  doing: string;
  station: string;
  timeLabel: string;
  note: string;
};

export function validateBroadcastFields(
  fields: BroadcastFields,
): { ok: true } | { ok: false; message: string } {
  const doing = fields.doing.trim();
  const station = fields.station.trim();
  const timeLabel = fields.timeLabel.trim();
  const note = fields.note.trim();

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
