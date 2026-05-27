/** Crew update form — POSTs to the broadcast Worker. Works with or without JS (native form fallback). */
export function initBroadcastAdmin(apiUrl?: string): void {
  void clearStaleServiceWorkers();

  const form = document.querySelector<HTMLFormElement>("#broadcast-form");
  const statusEl = document.querySelector<HTMLElement>("#status");
  const saveBtn = document.querySelector<HTMLButtonElement>("#save-btn");
  const timeInput = document.querySelector<HTMLInputElement>("#time_seen");
  const timeLabelInput = document.querySelector<HTMLInputElement>("#time_label");
  const stationSelect = document.querySelector<HTMLSelectElement>("#station");
  const stationOther = document.querySelector<HTMLInputElement>("#station_other");

  if (!form || !statusEl || !saveBtn) {
    console.error("[crew update] Missing required DOM elements; form not initialized.");
    return;
  }

  const root = document.getElementById("update-app");
  const baseUrl = (apiUrl ?? root?.dataset.apiUrl ?? form.action ?? "").replace(/\/$/, "");

  function setStatus(message: string, kind: "info" | "error" | "success") {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !message;
    try {
      statusEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch {
      /* ignore scroll errors on older browsers */
    }
  }

  function syncTimeLabel(): void {
    if (timeLabelInput) {
      timeLabelInput.value = formatTimeLabel(timeInput?.value ?? "");
    }
  }

  function syncStationField(): void {
    if (!stationSelect || stationSelect.name !== "station") return;
    if (stationSelect.value === "__other__" && stationOther?.value.trim()) {
      stationSelect.name = "";
      stationOther.name = "station";
    } else {
      stationSelect.name = "station";
      if (stationOther) stationOther.name = "";
    }
  }

  try {
    if (timeInput) timeInput.value = defaultDatetimeLocal();
    syncTimeLabel();
  } catch (err) {
    console.warn("[crew update] Could not set default time:", err);
  }

  stationSelect?.addEventListener("change", () => {
    if (!stationOther) return;
    const show = stationSelect.value === "__other__";
    stationOther.hidden = !show;
    stationOther.required = show;
    syncStationField();
    if (stationSelect.value && stationSelect.value !== "__other__") {
      syncTimeLabel();
    }
  });

  timeInput?.addEventListener("change", syncTimeLabel);

  form.addEventListener("submit", async (event) => {
    if (!baseUrl) {
      event.preventDefault();
      setStatus(
        "Update server is not configured. Use the direct update link below.",
        "error",
      );
      return;
    }

    event.preventDefault();
    syncTimeLabel();
    syncStationField();

    setStatus("Saving…", "info");
    saveBtn.disabled = true;

    try {
      const res = await fetchWithTimeout(
        `${baseUrl}/broadcast`,
        { method: "POST", body: new FormData(form), mode: "cors" },
        45_000,
      );
      const data = await readJson<{ ok?: boolean; message?: string }>(res);
      if (!res.ok || !data.ok) {
        setStatus(data.message ?? `Save failed (${res.status}). Try again.`, "error");
        return;
      }
      setStatus("Saved — should show on the homepage in a few minutes.", "success");
      form.reset();
      if (timeInput) timeInput.value = defaultDatetimeLocal();
      syncTimeLabel();
      if (stationOther) stationOther.hidden = true;
    } catch (err) {
      setStatus(networkErrorMessage(err, baseUrl), "error");
    } finally {
      saveBtn.disabled = false;
    }
  });

  if (baseUrl) {
    void probeServer(baseUrl, setStatus);
  } else {
    setStatus("Update server URL missing. Use the direct update link below.", "error");
  }
}

async function clearStaleServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  } catch {
    /* ignore */
  }
}

async function probeServer(
  baseUrl: string,
  setStatus: (message: string, kind: "info" | "error" | "success") => void,
): Promise<void> {
  try {
    const res = await fetchWithTimeout(`${baseUrl}/health`, { mode: "cors" }, 8_000);
    if (!res.ok) throw new Error("unhealthy");
  } catch {
    setStatus(
      `Cannot reach the update server from this network. Use the direct link: ${baseUrl}/update`,
      "error",
    );
  }
}

function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  if (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
  }
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(id));
}

function networkErrorMessage(err: unknown, baseUrl: string): string {
  const direct = baseUrl ? `${baseUrl}/update` : "";
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError" || err.message.includes("timed out")) {
      return "Timed out. Try again on Wi‑Fi or with a shorter note.";
    }
    if (err.message.includes("Failed to fetch") || err.message.includes("Load failed")) {
      return direct
        ? `Could not reach the server. Open the direct link: ${direct}`
        : "Could not reach the server. Check signal and try again.";
    }
    if (err.message) return err.message;
  }
  return direct
    ? `Could not reach the server. Open the direct link: ${direct}`
    : "Could not reach the server. Check signal and try again.";
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Server returned ${res.status} (not JSON).`);
  }
}

function defaultDatetimeLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function formatTimeLabel(datetimeLocal: string): string {
  if (!datetimeLocal) {
    return new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  }
  const d = new Date(datetimeLocal);
  return d.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}
