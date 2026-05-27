export const CHECKINS_KEY = "tahoe200-checkins";
export const PACE_KEY = "tahoe200-pace";
export const DRIVE_KEY = "tahoe200-drive-min";
export const PLAYBOOK_KEY = "tahoe200-playbook";
export const GLOVE_KEY = "tahoe200-trailhead";

export type PaceScenario = "optimistic" | "baseline" | "conservative";

export interface CrewStopPayload {
  crew_stop_n: number;
  aid_n: number;
  name: string;
  mile: number;
  cutoff: string;
  parking: string;
  optimistic_iso: string;
  baseline_iso: string;
  conservative_iso: string;
  maps_href?: string;
}

export interface CheckInsStore {
  updated_at: string | null;
  stations: Record<string, string>;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getCheckIns(): CheckInsStore {
  return readJson<CheckInsStore>(CHECKINS_KEY, { updated_at: null, stations: {} });
}

export function setCheckIn(aidN: number, iso?: string) {
  const store = getCheckIns();
  const key = String(aidN);
  if (iso) store.stations[key] = iso;
  else delete store.stations[key];
  store.updated_at = new Date().toISOString();
  writeJson(CHECKINS_KEY, store);
  return store;
}

export function getPace(): PaceScenario {
  const p = localStorage.getItem(PACE_KEY);
  if (p === "optimistic" || p === "conservative") return p;
  return "baseline";
}

export function setPace(pace: PaceScenario) {
  localStorage.setItem(PACE_KEY, pace);
}

export function getDriveMinutes(): number {
  const n = Number(localStorage.getItem(DRIVE_KEY));
  return Number.isFinite(n) && n > 0 ? n : 45;
}

export function setDriveMinutes(min: number) {
  localStorage.setItem(DRIVE_KEY, String(Math.max(15, Math.min(180, min))));
}

function plannedIso(stop: CrewStopPayload, pace: PaceScenario): string {
  if (pace === "optimistic") return stop.optimistic_iso;
  if (pace === "conservative") return stop.conservative_iso;
  return stop.baseline_iso;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function nextCrewStop(stops: CrewStopPayload[]): CrewStopPayload | null {
  const checkins = getCheckIns();
  for (const stop of stops) {
    if (!checkins.stations[String(stop.aid_n)]) return stop;
  }
  return null;
}

export function initCommandCenter(stops: CrewStopPayload[], base: string) {
  const root = document.getElementById("command-center");
  if (!root) return;

  const paceSelect = document.getElementById("pace-select") as HTMLSelectElement | null;
  const driveInput = document.getElementById("drive-minutes") as HTMLInputElement | null;

  if (paceSelect) paceSelect.value = getPace();
  if (driveInput) driveInput.value = String(getDriveMinutes());

  function render() {
    const pace = getPace();
    const driveMin = getDriveMinutes();
    const stop = nextCrewStop(stops);
    const hero = root.querySelector("[data-cc-hero]");
    const actions = root.querySelector("[data-cc-actions]");
    if (!hero || !actions) return;

    if (!stop) {
      hero.innerHTML = `<p class="command-center__primary">All crew stops checked in</p><p class="command-center__secondary">Head to the finish, or open the race board if I'm still out there.</p>`;
      actions.innerHTML = `<a class="btn btn--primary" href="${base}board/">Open race board</a>`;
      return;
    }

    const arrival = new Date(plannedIso(stop, pace));
    const leaveBy = new Date(arrival.getTime() - driveMin * 60_000);
    const now = Date.now();
    const minsToLeave = Math.round((leaveBy.getTime() - now) / 60_000);
    const urgency =
      minsToLeave < 0
        ? "command-center--late"
        : minsToLeave < 30
          ? "command-center--soon"
          : "";

    root.className = `command-center ${urgency}`.trim();
    hero.innerHTML = `
      <p class="command-center__eyebrow">Next crew stop · Stop ${stop.crew_stop_n}</p>
      <h2 class="command-center__title">${stop.name}</h2>
      <p class="command-center__mile">Mile ${stop.mile} · Cutoff ${stop.cutoff}</p>
      <dl class="command-center__times">
        <div><dt>Plan arrival (${pace})</dt><dd>${formatWhen(plannedIso(stop, pace))}</dd></div>
        <div><dt>Leave by</dt><dd>${formatWhen(leaveBy.toISOString())}</dd></div>
        <div><dt>Drive buffer</dt><dd>${driveMin} min before arrival</dd></div>
      </dl>
      <p class="command-center__hint">${minsToLeave < 0 ? "Leave window passed — go now if not already there." : minsToLeave <= 30 ? `~${minsToLeave} min until leave-by` : `~${Math.floor(minsToLeave / 60)}h ${minsToLeave % 60}m until leave-by`}</p>
    `;

    const maps = stop.maps_href
      ? `<a class="btn btn--secondary" href="${stop.maps_href}" target="_blank" rel="noopener noreferrer">Open Maps</a>`
      : "";
    actions.innerHTML = `
      <button type="button" class="btn btn--primary" data-checkin-aid="${stop.aid_n}">Mark arrived</button>
      ${maps}
      <a class="btn btn--secondary" href="${base}crew/#playbook-${stop.crew_stop_n}">Open playbook</a>
      <a class="btn btn--secondary" href="${base}board/">Race board</a>
    `;
  }

  const actionsEl = root.querySelector("[data-cc-actions]");
  if (actionsEl && !(actionsEl as HTMLElement).dataset.bound) {
    (actionsEl as HTMLElement).dataset.bound = "1";
    actionsEl.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest("[data-checkin-aid]");
      if (!btn) return;
      const aidN = Number(btn.getAttribute("data-checkin-aid"));
      if (!Number.isFinite(aidN)) return;
      setCheckIn(aidN, new Date().toISOString());
      render();
      document.dispatchEvent(new CustomEvent("tahoe-checkin"));
    });
  }

  paceSelect?.addEventListener("change", () => {
    setPace(paceSelect.value as PaceScenario);
    render();
  });
  driveInput?.addEventListener("change", () => {
    setDriveMinutes(Number(driveInput.value));
    render();
  });
  document.addEventListener("tahoe-checkin", render);
  render();
}

export function initRaceBoard(rows: { aid_n: number; crew_access: boolean }[], base: string) {
  const tbody = document.querySelector<HTMLTableSectionElement>("[data-board-body]");
  if (!tbody) return;

  function statusFor(aidN: number, optimistic: string, conservative: string): string {
    const checkins = getCheckIns();
    const actual = checkins.stations[String(aidN)];
    if (!actual) return "pending";
    const t = new Date(actual).getTime();
    const opt = new Date(optimistic).getTime();
    const con = new Date(conservative).getTime();
    if (t <= opt) return "ahead";
    if (t <= con) return "on-pace";
    return "behind";
  }

  function render() {
    const checkins = getCheckIns();
    tbody.querySelectorAll("tr[data-aid]").forEach((row) => {
      const aidN = Number(row.getAttribute("data-aid"));
      const actualCell = row.querySelector("[data-actual]");
      const statusCell = row.querySelector("[data-status]");
      const actual = checkins.stations[String(aidN)];
      if (actualCell) actualCell.textContent = actual ? formatWhen(actual) : "—";
      if (statusCell) {
        const opt = row.getAttribute("data-opt") ?? "";
        const con = row.getAttribute("data-con") ?? "";
        const status = actual ? statusFor(aidN, opt, con) : "pending";
        statusCell.className = `board-status board-status--${status}`;
        statusCell.textContent =
          status === "ahead" ? "Ahead" : status === "on-pace" ? "On pace" : status === "behind" ? "Behind" : "—";
      }
    });
  }

  document.querySelectorAll("[data-board-checkin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const aidN = Number(btn.getAttribute("data-board-checkin"));
      if (!Number.isFinite(aidN)) return;
      const existing = getCheckIns().stations[String(aidN)];
      if (existing && !confirm("Clear check-in for this station?")) {
        setCheckIn(aidN);
      } else {
        setCheckIn(aidN, new Date().toISOString());
      }
      render();
      document.dispatchEvent(new CustomEvent("tahoe-checkin"));
    });
  });

  document.addEventListener("tahoe-checkin", render);
  render();
}

export function initPlaybooks() {
  const store = readJson<Record<string, string[]>>(PLAYBOOK_KEY, {});
  document.querySelectorAll("[data-playbook-task]").forEach((el) => {
    const input = el as HTMLInputElement;
    const stopN = input.getAttribute("data-stop");
    const taskId = input.getAttribute("data-playbook-task");
    if (!stopN || !taskId) return;
    const done = store[stopN]?.includes(taskId) ?? false;
    input.checked = done;
    input.addEventListener("change", () => {
      const list = new Set(store[stopN] ?? []);
      if (input.checked) list.add(taskId);
      else list.delete(taskId);
      store[stopN] = [...list];
      writeJson(PLAYBOOK_KEY, store);
    });
  });
}

export function initTrailheadMode() {
  const enabled = localStorage.getItem(GLOVE_KEY) === "1";
  document.documentElement.classList.toggle("trailhead-mode", enabled);
  const btn = document.getElementById("trailhead-toggle");
  if (!btn) return;
  const label = btn.querySelector("[data-trailhead-label]");
  btn.setAttribute("aria-pressed", enabled ? "true" : "false");
  if (label) label.textContent = enabled ? "Trailhead on" : "Trailhead mode";
  btn.addEventListener("click", () => {
    const next = !document.documentElement.classList.contains("trailhead-mode");
    document.documentElement.classList.toggle("trailhead-mode", next);
    localStorage.setItem(GLOVE_KEY, next ? "1" : "0");
    btn.setAttribute("aria-pressed", next ? "true" : "false");
    if (label) label.textContent = next ? "Trailhead on" : "Trailhead mode";
  });
}

export function registerServiceWorker(base: string) {
  if (!("serviceWorker" in navigator)) return;
  const swUrl = `${base}sw.js`;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(swUrl).catch(() => {});
  });
}
