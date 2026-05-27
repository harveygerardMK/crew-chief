const SESSION_KEY = "cc_broadcast_token";

/** Reads API URL from argument or `#update-app` data attribute. Always wires up buttons. */
export function initBroadcastAdmin(apiUrl?: string): void {
  const loginEl = document.querySelector<HTMLElement>("#login");
  const formEl = document.querySelector<HTMLElement>("#form");
  const statusEl = document.querySelector<HTMLElement>("#status");
  const loginBtn = document.querySelector<HTMLButtonElement>("#login-btn");
  const passwordInput = document.querySelector<HTMLInputElement>("#password");
  const saveBtn = document.querySelector<HTMLButtonElement>("#save-btn");
  const timeInput = document.querySelector<HTMLInputElement>("#time_seen");
  const stationSelect = document.querySelector<HTMLSelectElement>("#station");
  const stationOther = document.querySelector<HTMLInputElement>("#station_other");

  if (!loginEl || !formEl || !statusEl || !loginBtn || !passwordInput || !saveBtn) {
    console.error("[crew update] Missing required DOM elements; form not initialized.");
    return;
  }

  const root = document.getElementById("update-app");
  const baseUrl = (apiUrl ?? root?.dataset.apiUrl ?? "").replace(/\/$/, "");

  function setStatus(message: string, kind: "info" | "error" | "success") {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !message;
  }

  if (timeInput) {
    timeInput.value = defaultDatetimeLocal();
  }

  if (baseUrl) {
    void probeServer(baseUrl, setStatus);
  }

  stationSelect?.addEventListener("change", () => {
    if (!stationOther) return;
    const show = stationSelect.value === "__other__";
    stationOther.hidden = !show;
    stationOther.required = show;
  });

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      loginBtn.click();
    }
  });

  loginBtn.addEventListener("click", async () => {
    if (!baseUrl) {
      setStatus(
        "Update server is not configured on this build. Use the direct update link below, or ask Harvey to redeploy the site.",
        "error",
      );
      return;
    }
    setStatus("Checking password…", "info");
    loginBtn.disabled = true;
    try {
      const res = await fetchWithTimeout(
        `${baseUrl}/auth`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: passwordInput.value }),
        },
        15_000,
      );
      const data = await readJson<{ ok?: boolean; message?: string; token?: string }>(res);
      if (!res.ok || !data.ok) {
        setStatus(data.message ?? "That password didn't work.", "error");
        return;
      }
      if (data.token) {
        sessionStorage.setItem(SESSION_KEY, data.token);
      }
      loginEl.hidden = true;
      formEl.hidden = false;
      setStatus("", "info");
      passwordInput.value = "";
    } catch (err) {
      setStatus(networkErrorMessage(err, baseUrl), "error");
    } finally {
      loginBtn.disabled = false;
    }
  });

  saveBtn.addEventListener("click", async () => {
    if (!baseUrl) {
      setStatus("Update server is not configured. Use the direct update link below.", "error");
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
        {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        },
        45_000,
      );
      const data = await readJson<{ ok?: boolean; message?: string }>(res);
      if (!res.ok || !data.ok) {
        setStatus(data.message ?? "Save failed. Try again.", "error");
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

  function authHeaders(): HeadersInit {
    const token = sessionStorage.getItem(SESSION_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
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
    const res = await fetchWithTimeout(`${baseUrl}/health`, {}, 8_000);
    if (!res.ok) throw new Error("unhealthy");
  } catch {
    setStatus(
      `Having trouble reaching the server from this network. Try the direct link: ${baseUrl}/update`,
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
    if (err.message.includes("AbortSignal")) {
      return direct
        ? `This browser needs the direct update link: ${direct}`
        : "Your browser could not start the request. Try updating Safari or use Chrome.";
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
