/** Crew update form — posts to the broadcast Worker (no password for now). */
export function initBroadcastAdmin(apiUrl?: string): void {
  const formEl = document.querySelector<HTMLElement>("#form");
  const statusEl = document.querySelector<HTMLElement>("#status");
  const saveBtn = document.querySelector<HTMLButtonElement>("#save-btn");
  const timeInput = document.querySelector<HTMLInputElement>("#time_seen");
  const stationSelect = document.querySelector<HTMLSelectElement>("#station");
  const stationOther = document.querySelector<HTMLInputElement>("#station_other");

  if (!formEl || !statusEl || !saveBtn) {
    console.error("[crew update] Missing required DOM elements; form not initialized.");
    return;
  }

  const root = document.getElementById("update-app");
  const baseUrl = (apiUrl ?? root?.dataset.apiUrl ?? "").replace(/\/$/, "");

  function setStatus(message: string, kind: "info" | "error" | "success") {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !message;
    statusEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  // Wire Save first so a later init step cannot leave the button dead.
  saveBtn.addEventListener("click", async () => {
    if (!baseUrl) {
      setStatus(
        "Update server is not configured on this build. Use the direct update link below, or ask Harvey to redeploy the site.",
        "error",
      );
      return;
    }
    setStatus("Saving…", "info");
    saveBtn.disabled = true;
    try {
      const station = resolveStation(stationSelect, stationOther);
      const formData = new FormData();
      formData.set("doing", getValue("doing"));
      formData.set("station", station);
      formData.set("time_label", formatTimeLabel(timeInput?.value ?? ""));
      formData.set("note", getValue("note"));

      const photos = document.querySelectorAll<HTMLInputElement>('input[type="file"][name^="photo"]');
      photos.forEach((input, index) => {
        const file = input.files?.[0];
        if (file) formData.set(`photo${index}`, file);
      });

      const res = await fetchWithTimeout(
        `${baseUrl}/broadcast`,
        { method: "POST", body: formData, mode: "cors" },
        45_000,
      );
      const data = await readJson<{ ok?: boolean; message?: string }>(res);
      if (!res.ok || !data.ok) {
        setStatus(data.message ?? `Save failed (${res.status}). Try again.`, "error");
        return;
      }
      setStatus("Saved — should show on the homepage in a few minutes.", "success");
      photos.forEach((input) => {
        input.value = "";
      });
    } catch (err) {
      setStatus(networkErrorMessage(err, baseUrl), "error");
    } finally {
      saveBtn.disabled = false;
    }
  });

  try {
    if (timeInput) {
      timeInput.value = defaultDatetimeLocal();
    }
  } catch (err) {
    console.warn("[crew update] Could not set default time:", err);
  }

  stationSelect?.addEventListener("change", () => {
    if (!stationOther) return;
    const show = stationSelect.value === "__other__";
    stationOther.hidden = !show;
    stationOther.required = show;
  });

  if (baseUrl) {
    void probeServer(baseUrl, setStatus);
  } else {
    setStatus(
      "Update server URL missing on this page. Use the direct update link below after Harvey redeploys.",
      "error",
    );
  }

  function getValue(id: string): string {
    const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`);
    return el?.value?.trim() ?? "";
  }

  function resolveStation(
    select: HTMLSelectElement | null,
    other: HTMLInputElement | null,
  ): string {
    if (!select) return "";
    if (select.value === "__other__") return other?.value?.trim() ?? "";
    if (select.value === "") return "";
    return select.value;
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
