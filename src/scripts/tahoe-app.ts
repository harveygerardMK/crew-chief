export const CHECKINS_KEY = "tahoe200-checkins";
export const PACE_KEY = "tahoe200-pace";
export const DRIVE_KEY = "tahoe200-drive-min";
export const PLAYBOOK_KEY = "tahoe200-playbook";
export const GLOVE_KEY = "tahoe200-trailhead";
import {
  hasHeroRunnerCheckIn,
  heroMarkerLeftPercent,
  readHeroProgressFromStorage,
} from "../lib/hero-progress";
import { fetchTrackerSnapshot, formatRelativeAge, type TrackerSnapshot } from "../lib/tracker-client";
import {
  aidStationNearMile,
  elevationAtMile,
  formatPaceBucket,
  getCurrentSegment,
  getLastAidStation,
  getNextAidStation,
  isNextAidCrew,
  milesRemaining,
  pickArtPairing,
  racePhaseBand,
  weatherBucketFromCode,
  weatherBucketFromTemp,
  type WeatherBucket,
} from "../lib/wheres-harvey";

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

    root.className = `command-center critical-now ${urgency}`.trim();
    hero.innerHTML = `
      <p class="command-center__eyebrow card-surface__eyebrow">Crew move / Stop ${stop.crew_stop_n}</p>
      <h2 class="command-center__title card-surface__title">${stop.name}</h2>
      <p class="command-center__mile">Mile ${stop.mile} / Cutoff ${stop.cutoff}</p>
      <dl class="command-center__times">
        <div><dt>Arrival window (${pace})</dt><dd>${formatWhen(plannedIso(stop, pace))}</dd></div>
        <div><dt>Leave by</dt><dd>${formatWhen(leaveBy.toISOString())}</dd></div>
        <div><dt>Drive buffer</dt><dd>${driveMin} min before arrival</dd></div>
      </dl>
      <p class="command-center__hint">${minsToLeave < 0 ? "Move now if not already there." : minsToLeave <= 30 ? `Crew move in ~${minsToLeave} min` : `Crew move in ~${Math.floor(minsToLeave / 60)}h ${minsToLeave % 60}m`}</p>
    `;

    const maps = stop.maps_href
      ? `<a class="btn btn--secondary" href="${stop.maps_href}" target="_blank" rel="noopener noreferrer">Open Maps</a>`
      : "";
    actions.innerHTML = `
      <button type="button" class="btn btn--critical" data-checkin-aid="${stop.aid_n}">Mark arrived</button>
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
    document.querySelectorAll<HTMLElement>("[data-board-item][data-aid]").forEach((row) => {
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
      if (existing) {
        if (!confirm("Clear check-in for this station?")) return;
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

export function initHeroProgress() {
  const nodes = [...document.querySelectorAll<HTMLElement>("[data-hero-progress]")];
  if (nodes.length === 0) return;

  const labelFor = (mile: number, stationName: string | null) =>
    stationName ? `${stationName} · mi ${mile}` : `Start · mi ${mile}`;

  function render() {
    const progress = readHeroProgressFromStorage();
    const checkedIn = hasHeroRunnerCheckIn(progress);
    const label = labelFor(progress.mile, progress.stationName);

    nodes.forEach((node) => {
      if (checkedIn) {
        node.removeAttribute("data-hero-preview");
        node.style.left = `${heroMarkerLeftPercent(progress.mile)}%`;
        node.style.bottom = "20%";
      } else {
        node.setAttribute("data-hero-preview", "");
        node.style.left = "";
        node.style.bottom = "";
      }
      node.setAttribute("aria-label", `Runner progress at ${label}`);
      const labelNode = node.querySelector<HTMLElement>("[data-hero-progress-label]");
      if (labelNode) labelNode.textContent = label;
    });
  }

  document.addEventListener("tahoe-checkin", render);
  render();
}

interface WeatherState {
  bucket: WeatherBucket;
  tempF: number | null;
}

let cachedWeather: WeatherState = { bucket: "unknown", tempF: null };
let lastWeatherMile: number | null = null;
let lastArtKey = "";
const shownArtIds = new Set<string>();

export function initWheresHarvey() {
  const root = document.querySelector<HTMLElement>("[data-wheres-harvey]");
  if (!root) return;

  const apiUrl = root.dataset.trackerApi;
  const pollSeconds = Number(root.dataset.pollSeconds) || 60;
  const raceStartIso = root.dataset.raceStart;
  const useMock = root.dataset.whMock === "1";
  if (!raceStartIso) return;
  if (!useMock && !apiUrl) return;

  const els = {
    status: root.querySelector<HTMLElement>("[data-wh-status]"),
    notice: root.querySelector<HTMLElement>("[data-wh-notice]"),
    warn: root.querySelector<HTMLElement>("[data-wh-warn]"),
    beacon: root.querySelector<HTMLElement>("[data-wh-beacon]"),
    milesRun: root.querySelector<HTMLElement>("[data-wh-miles-run]"),
    milesLeft: root.querySelector<HTMLElement>("[data-wh-miles-left]"),
    nextAid: root.querySelector<HTMLElement>("[data-wh-next-aid]"),
    elevation: root.querySelector<HTMLElement>("[data-wh-elevation]"),
    song: root.querySelector<HTMLElement>("[data-wh-art-moment]"),
    artCaption: root.querySelector<HTMLElement>("[data-wh-art-caption]"),
    artImg: root.querySelector<HTMLImageElement>("[data-wh-art-img]"),
    artLink: root.querySelector<HTMLAnchorElement>("[data-wh-art-link]"),
  };

  let lastSnapshot: TrackerSnapshot | null = null;

  function setHidden(el: HTMLElement | null, hidden: boolean) {
    if (!el) return;
    if (hidden) el.setAttribute("hidden", "");
    else el.removeAttribute("hidden");
  }

  function formatMile(n: number): string {
    return n.toFixed(1);
  }

  async function fetchWeather(mile: number) {
    const mileBucket = Math.floor(mile / 10);
    if (lastWeatherMile === mileBucket) return cachedWeather;

    const coords = aidStationNearMile(mile);
    if (!coords) return cachedWeather;

    try {
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(coords.lat));
      url.searchParams.set("longitude", String(coords.lng));
      url.searchParams.set("current", "temperature_2m,weather_code");
      url.searchParams.set("temperature_unit", "fahrenheit");
      url.searchParams.set("timezone", "America/Los_Angeles");
      url.searchParams.set("forecast_days", "1");

      const res = await fetch(url.toString());
      if (!res.ok) return cachedWeather;
      const data = (await res.json()) as {
        current?: { temperature_2m?: number; weather_code?: number };
      };
      const tempF = data.current?.temperature_2m ?? null;
      const codeBucket = weatherBucketFromCode(data.current?.weather_code);
      const tempBucket = weatherBucketFromTemp(tempF);
      cachedWeather = {
        bucket: tempBucket ?? codeBucket,
        tempF,
      };
      lastWeatherMile = mileBucket;
    } catch {
      /* keep last weather */
    }
    return cachedWeather;
  }

  function syncHeroFromTracker(mile: number) {
    const progress = readHeroProgressFromStorage();
    if (hasHeroRunnerCheckIn(progress) && progress.mile > mile) return;

    const nodes = [...document.querySelectorAll<HTMLElement>("[data-hero-progress]")];
    const left = heroMarkerLeftPercent(mile);
    const label = mile > 0.5 ? `Tracker · mi ${mile.toFixed(1)}` : `Start · mi 0`;

    nodes.forEach((node) => {
      node.removeAttribute("data-hero-preview");
      node.style.left = `${left}%`;
      node.style.bottom = "20%";
      node.setAttribute("aria-label", `Runner progress at ${label}`);
      const labelNode = node.querySelector<HTMLElement>("[data-hero-progress-label]");
      if (labelNode) labelNode.textContent = label;
    });
  }

  async function renderFromSnapshot(snapshot: TrackerSnapshot | null) {
    const now = Date.now();
    const raceStart = new Date(raceStartIso).getTime();
    const elapsedHours = Number.isFinite(raceStart)
      ? Math.max(0, (now - raceStart) / 3_600_000)
      : 0;
    const hour = new Date().getHours();

    if (!snapshot?.enabled) {
      setHidden(els.notice, false);
      if (els.notice) els.notice.textContent = "Tracker not configured yet — check the full tracker link.";
      if (snapshot?.error && els.warn) {
        setHidden(els.warn, false);
        els.warn.textContent = snapshot.error;
      }
      return;
    }

    const mile = snapshot.route_mile;
    if (mile == null) {
      setHidden(els.notice, false);
      return;
    }

    setHidden(els.notice, true);

    if (snapshot.stale) {
      root.classList.add("wheres-harvey--stale");
      setHidden(els.warn, false);
      if (els.warn) {
        els.warn.textContent =
          "Beacon is quiet — gaps are normal in the backcountry. Don't panic; keep checking.";
      }
    } else {
      root.classList.remove("wheres-harvey--stale");
      setHidden(els.warn, true);
    }

    if (els.status) {
      els.status.textContent =
        snapshot.race_status === "finished" ? "FINISHED" : snapshot.stale ? "ON COURSE · STALE" : "ON COURSE";
    }

    const age = formatRelativeAge(snapshot.last_update_at, now);
    if (els.beacon) {
      els.beacon.textContent = age
        ? `${age}${snapshot.last_update_label ? ` · ${snapshot.last_update_label}` : ""}`
        : snapshot.last_update_label ?? "—";
    }
    if (els.milesRun) els.milesRun.textContent = formatMile(mile);
    if (els.milesLeft) els.milesLeft.textContent = formatMile(milesRemaining(mile));

    const nextAid = getNextAidStation(mile);
    if (els.nextAid) {
      els.nextAid.textContent = nextAid ? `${nextAid.name} · mi ${nextAid.mile}` : "Finish line";
    }

    const elev = snapshot.elevation_gain_ft ?? elevationAtMile(mile);
    if (els.elevation) els.elevation.textContent = `${elev.toLocaleString()} ft`;

    const weather = await fetchWeather(mile);
    const paceBucket = formatPaceBucket(snapshot.current_speed_mph);
    const lastAid = getLastAidStation(mile);
    const segment = getCurrentSegment(mile);
    const artKey = `${Math.floor(mile / 5)}|${Math.floor(hour)}|${paceBucket}|${weather.bucket}|${nextAid?.name ?? "done"}`;
    if (artKey !== lastArtKey) {
      const art = pickArtPairing(
        {
          hour,
          elapsedHours,
          weather: weather.bucket,
          paceBucket,
          mile,
          lastAid,
          nextAid,
          nextAidIsCrew: isNextAidCrew(mile),
          segmentName: segment?.name ?? null,
          phaseBand: racePhaseBand(mile),
        },
        { excludeObjectIds: shownArtIds },
      );
      if (art.objectId) shownArtIds.add(art.objectId);
      if (els.song) els.song.textContent = art.sportsMoment;
      if (els.artLink) {
        els.artLink.href = art.sourceUrl;
        els.artLink.textContent = `${art.title} · ${art.artist} (${art.year})`;
      }
      if (els.artCaption) els.artCaption.textContent = art.caption;
      if (els.artImg) {
        els.artImg.alt = art.title;
        els.artImg.classList.remove("is-loaded", "is-error");
        els.artImg.onload = () => {
          els.artImg!.classList.add("is-loaded");
          els.artImg!.classList.remove("is-error");
        };
        els.artImg.onerror = () => {
          els.artImg!.classList.remove("is-loaded");
          els.artImg!.classList.add("is-error");
        };
        if (els.artImg.getAttribute("src") !== art.imageUrl) {
          els.artImg.src = art.imageUrl;
        } else if (els.artImg.complete && els.artImg.naturalWidth > 0) {
          els.artImg.classList.add("is-loaded");
        }
      }
      lastArtKey = artKey;
    }

    syncHeroFromTracker(mile);
  }

  function mockSnapshot(): TrackerSnapshot {
    const now = Date.now();
    const lastPing = new Date(now - 12 * 60_000);
    return {
      enabled: true,
      fetched_at: new Date().toISOString(),
      race_status: "active",
      last_update_at: lastPing.toISOString(),
      last_update_label: "12 min ago · Demo beacon",
      route_mile: 62.4,
      elevation_gain_ft: 18_420,
      current_speed_mph: 4.2,
      stale: false,
      source_url: "",
    };
  }

  async function poll() {
    const snapshot = useMock ? mockSnapshot() : apiUrl ? await fetchTrackerSnapshot(apiUrl) : null;
    if (snapshot) {
      lastSnapshot = snapshot;
      await renderFromSnapshot(snapshot);
    } else if (lastSnapshot) {
      setHidden(els.warn, false);
      if (els.warn) els.warn.textContent = "Tracker unreachable — check the full tracker link.";
      await renderFromSnapshot(lastSnapshot);
    } else {
      setHidden(els.notice, false);
    }
  }

  poll();
  window.setInterval(poll, pollSeconds * 1000);
}
