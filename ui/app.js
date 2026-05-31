/**
 * Crew Chief Agent — minimal chat UI (vanilla JS, no build step).
 */

const STORAGE = {
  visitorId: "cc_visitor_id",
  visitorName: "cc_visitor_name",
  cachedStatus: "cc_cached_status",
};

const STATUS_POLL_MS = 60_000;

const $ = (id) => document.getElementById(id);

/** @type {HTMLElement} */
const onboardingPanel = $("onboarding-panel");
const chatPanel = $("chat-panel");
const composerWrap = $("composer-wrap");
const messagesEl = $("messages");
const onboardingForm = $("onboarding-form");
const onboardingError = $("onboarding-error");
const composerForm = $("composer-form");
const composerInput = $("composer-input");
const composerSend = $("composer-send");
const statusBadge = $("status-badge");

let busy = false;
let greetingDone = false;

function apiBase() {
  const base = (window.CREW_CHIEF_API || "").replace(/\/$/, "");
  if (!base) {
    throw new Error(
      "Chat API is not configured yet. Set window.CREW_CHIEF_API in config.local.js or at deploy time.",
    );
  }
  return base;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getVisitorId() {
  return localStorage.getItem(STORAGE.visitorId);
}

function setVisitor(id, name) {
  localStorage.setItem(STORAGE.visitorId, id);
  localStorage.setItem(STORAGE.visitorName, name);
}

function cacheStatus(status) {
  try {
    localStorage.setItem(STORAGE.cachedStatus, JSON.stringify(status));
  } catch {
    /* quota — ignore */
  }
}

function loadCachedStatus() {
  try {
    const raw = localStorage.getItem(STORAGE.cachedStatus);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  let body = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { detail: text };
    }
  }
  if (!res.ok) {
    const detail = body?.detail || res.statusText || "Request failed";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return body;
}

function formatMile(mile) {
  if (mile == null || Number.isNaN(Number(mile))) return "—";
  return `${Number(mile).toFixed(1)} / 200`;
}

function formatSpeed(mph) {
  if (mph == null || Number.isNaN(Number(mph))) return "—";
  return `${Number(mph).toFixed(1)} mph`;
}

function formatUpdate(status) {
  if (status.last_update_label) return status.last_update_label;
  if (status.last_update_at) {
    try {
      return new Date(status.last_update_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return status.last_update_at;
    }
  }
  return "—";
}

function renderStatus(status) {
  $("stat-mile").textContent = formatMile(status.route_mile);
  $("stat-speed").textContent = formatSpeed(status.current_speed_mph);
  $("stat-update").textContent = formatUpdate(status);
  $("stat-race").textContent = status.race_status || "unknown";

  statusBadge.classList.add("hidden");
  if (status.data_stale) {
    statusBadge.textContent =
      "Tracker fetch stale — showing last known position. Canyons eat GPS; this is normal.";
    statusBadge.dataset.tone = "stale";
    statusBadge.classList.remove("hidden");
  } else if (status.stale) {
    statusBadge.textContent = "No fresh GPS ping in a while — probably a canyon or a nap.";
    statusBadge.dataset.tone = "stale";
    statusBadge.classList.remove("hidden");
  } else if (status.error && !status.enabled) {
    statusBadge.textContent = status.error;
    statusBadge.dataset.tone = "error";
    statusBadge.classList.remove("hidden");
  }
}

async function refreshStatus() {
  try {
    const status = await api("/status");
    cacheStatus(status);
    renderStatus(status);
    return status;
  } catch {
    const cached = loadCachedStatus();
    if (cached) {
      renderStatus(cached);
      statusBadge.textContent = "Offline — showing last saved stats from this device.";
      statusBadge.dataset.tone = "error";
      statusBadge.classList.remove("hidden");
    }
    return cached;
  }
}

function scrollMessagesToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage({ role, text, artPrompt = null, loading = false }) {
  const wrap = document.createElement("article");
  wrap.className = `msg msg--${role}${loading ? " msg--loading" : ""}`;

  const label = document.createElement("div");
  label.className = "msg__label";
  if (role === "user") label.textContent = "You";
  else if (role === "harvey") label.textContent = "Harvey";
  else label.textContent = "Note";

  const bubble = document.createElement("div");
  bubble.className = "msg__bubble";
  bubble.textContent = text;

  wrap.append(label, bubble);

  if (artPrompt && role === "harvey") {
    const card = document.createElement("div");
    card.className = "art-card";
    card.innerHTML = `
      <div class="art-card__img-wrap" aria-hidden="true"></div>
      <p class="art-card__caption">${escapeHtml(artPrompt)}</p>
    `;
    wrap.appendChild(card);
    loadArtImage(card.querySelector(".art-card__img-wrap"), artPrompt);
  }

  messagesEl.appendChild(wrap);
  scrollMessagesToBottom();
  return wrap;
}

async function loadArtImage(container, artPrompt) {
  if (!container) return;
  const query = artPrompt.split("—")[0].split("-")[0].trim();
  if (!query) return;

  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "1");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "480");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const res = await fetch(url);
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return;
    const page = Object.values(pages)[0];
    const thumb = page?.thumbnail?.source;
    if (!thumb) return;
    const img = document.createElement("img");
    img.src = thumb;
    img.alt = query;
    img.loading = "lazy";
    container.appendChild(img);
  } catch {
    /* text-only art card is fine */
  }
}


function showFallbackNotice() {
  statusBadge.textContent =
    "Backup line — Harvey's real chat AI isn't connected yet. Replies are a canned message until the server key is fixed.";
  statusBadge.dataset.tone = "error";
  statusBadge.classList.remove("hidden");
}

function showChat() {
  onboardingPanel.classList.add("hidden");
  chatPanel.classList.remove("hidden");
  composerWrap.classList.remove("hidden");
}

function setBusy(next) {
  busy = next;
  composerSend.disabled = next;
  $("onboarding-submit").disabled = next;
}

async function requestChat(message = null) {
  const visitorId = getVisitorId();
  if (!visitorId) throw new Error("Not registered");

  const body = { visitor_id: visitorId };
  if (message) body.message = message;

  return api("/chat", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

async function loadGreeting() {
  if (greetingDone) return;
  const loading = appendMessage({ role: "harvey", text: "…", loading: true });
  try {
    const data = await requestChat();
    loading.remove();
    appendMessage({
      role: "harvey",
      text: data.reply,
      artPrompt: data.art_prompt,
    });
    if (data.fallback) showFallbackNotice();
    if (data.harvey_status_snapshot) {
      cacheStatus(data.harvey_status_snapshot);
      renderStatus(data.harvey_status_snapshot);
    }
    greetingDone = true;
  } catch (err) {
    loading.remove();
    appendMessage({
      role: "system",
      text:
        err.message ||
        "Could not reach Harvey right now. The crew site still has the latest public updates.",
    });
  }
}

async function sendUserMessage(text) {
  appendMessage({ role: "user", text });
  const loading = appendMessage({ role: "harvey", text: "…", loading: true });
  try {
    const data = await requestChat(text);
    loading.remove();
    appendMessage({
      role: "harvey",
      text: data.reply,
      artPrompt: data.art_prompt,
    });
    if (data.fallback) showFallbackNotice();
    if (data.harvey_status_snapshot) {
      cacheStatus(data.harvey_status_snapshot);
      renderStatus(data.harvey_status_snapshot);
    }
  } catch (err) {
    loading.remove();
    appendMessage({
      role: "system",
      text: err.message || "Message failed — try again when you have signal.",
    });
  }
}

function fixCrewSiteLink() {
  const link = $("crew-site-link");
  const path = window.location.pathname;
  if (path.includes("/agent")) {
    link.href = path.replace(/\/agent\/?.*$/, "/") || "../";
  } else {
    link.href = "https://harveygerardMK.github.io/crew-chief/";
  }
}

onboardingForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  onboardingError.classList.add("hidden");

  const form = new FormData(onboardingForm);
  const name = String(form.get("name") || "").trim();
  const relationship = String(form.get("relationship") || "");

  if (!name || !relationship) return;

  setBusy(true);
  try {
    const data = await api("/visitors", {
      method: "POST",
      body: JSON.stringify({ name, relationship }),
    });
    setVisitor(data.visitor_id, data.name);
    showChat();
    await refreshStatus();
    await loadGreeting();
  } catch (err) {
    onboardingError.textContent = err.message || "Could not register — try again.";
    onboardingError.classList.remove("hidden");
  } finally {
    setBusy(false);
  }
});

composerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;

  const text = composerInput.value.trim();
  if (!text) return;

  composerInput.value = "";
  composerInput.style.height = "auto";
  setBusy(true);
  await sendUserMessage(text);
  setBusy(false);
  composerInput.focus();
});

composerInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composerForm.requestSubmit();
  }
});

composerInput.addEventListener("input", () => {
  composerInput.style.height = "auto";
  composerInput.style.height = `${Math.min(composerInput.scrollHeight, 128)}px`;
});

async function init() {
  fixCrewSiteLink();

  const cached = loadCachedStatus();
  if (cached) renderStatus(cached);

  try {
    await refreshStatus();
  } catch {
    /* cached already shown */
  }

  setInterval(refreshStatus, STATUS_POLL_MS);

  const visitorId = getVisitorId();
  if (visitorId) {
    showChat();
    await loadGreeting();
  }
}

init();
