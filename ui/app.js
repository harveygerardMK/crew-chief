/**
 * Crew Chief Agent — Ask Harvey chat UI
 */

const STORAGE = {
  visitorId: "cc_visitor_id",
  visitorName: "cc_visitor_name",
  cachedStatus: "cc_cached_status",
};

const STATUS_POLL_MS = 60_000;
const RACE_START_MS = Date.parse("2026-06-12T16:00:00.000Z"); // Fri 9 AM PDT
const STALE_MS = 2 * 60 * 60 * 1000;

const $ = (id) => document.getElementById(id);

const onboardingPanel = $("onboarding-panel");
const chatPanel = $("chat-panel");
const composerWrap = $("composer-wrap");
const messagesEl = $("messages");
const onboardingForm = $("onboarding-form");
const onboardingError = $("onboarding-error");
const composerForm = $("composer-form");
const composerInput = $("composer-input");
const composerSend = $("composer-send");
const statusHeader = $("status-header");
const statusBanner = $("status-banner");
const noteBtn = $("note-btn");
const noteOverlay = $("note-overlay");

let busy = false;
let greetingDone = false;
let exchangeCount = 0;

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
    /* quota */
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
  return Number(mile).toFixed(1);
}

function formatSpeed(mph) {
  if (mph == null || Number.isNaN(Number(mph))) return "—";
  return `${Number(mph).toFixed(1)}`;
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

function isPreRace(status) {
  return (
    !status?.enabled &&
    (status?.race_status === "unknown" || !status?.race_status) &&
    Date.now() < RACE_START_MS
  );
}

function formatCountdown() {
  const diff = RACE_START_MS - Date.now();
  if (diff <= 0) return "soon";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function pingAgeMs(status) {
  const at = status?.last_update_at || status?.fetched_at;
  if (!at) return null;
  const t = Date.parse(at);
  return Number.isNaN(t) ? null : Date.now() - t;
}

function renderStatus(status) {
  statusHeader.classList.remove("status-header--stale", "status-header--prerace");
  statusBanner.classList.add("hidden");

  if (isPreRace(status)) {
    statusHeader.classList.add("status-header--prerace");
    $("stat-mile").textContent = "—";
    $("stat-speed").textContent = "—";
    $("stat-update").textContent = "—";
    $("stat-race").textContent = `Starts in ${formatCountdown()}`;
    statusBanner.textContent = "RACE STARTS JUN 12 · 9:00 AM PDT";
    statusBanner.classList.remove("hidden");
    return;
  }

  $("stat-mile").textContent = formatMile(status.route_mile);
  $("stat-speed").textContent = formatSpeed(status.current_speed_mph);
  $("stat-update").textContent = formatUpdate(status);
  const raceLabel =
    !status.enabled && (status.race_status === "unknown" || !status.race_status)
      ? "pre-race"
      : status.race_status || "—";
  $("stat-race").textContent = raceLabel;

  const age = pingAgeMs(status);
  const signalGap =
    status.data_stale ||
    status.stale ||
    (age != null && age > STALE_MS && status.enabled);

  if (signalGap) {
    statusHeader.classList.add("status-header--stale");
    statusBanner.textContent = "SIGNAL GAP — NORMAL IN BACKCOUNTRY";
    statusBanner.classList.remove("hidden");
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
    if (cached) renderStatus(cached);
    return cached;
  }
}

function scrollMessagesToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function parseArtPrompt(artPrompt) {
  const raw = String(artPrompt || "").trim();
  const parts = raw.split(/[—–-]/);
  const titleArtist = (parts[0] || raw).trim();
  const condition = parts.slice(1).join("—").trim();
  const comma = titleArtist.lastIndexOf(",");
  let title = titleArtist;
  let artist = "";
  if (comma > 0) {
    title = titleArtist.slice(0, comma).trim();
    artist = titleArtist.slice(comma + 1).trim();
  }
  return { title, artist, condition: condition || raw };
}

function appendThinkingMessage() {
  const wrap = document.createElement("article");
  wrap.className = "msg msg--harvey msg--loading";
  wrap.innerHTML = `
    <div class="msg__label">Harvey</div>
    <div class="msg__bubble">
      <span class="thinking-dots" aria-label="Harvey is typing">
        <span></span><span></span><span></span>
      </span>
    </div>
  `;
  messagesEl.appendChild(wrap);
  scrollMessagesToBottom();
  return wrap;
}

function appendMessage({ role, text, artPrompt = null, artImageUrl = null }) {
  const wrap = document.createElement("article");
  wrap.className = `msg msg--${role}`;

  const label = document.createElement("div");
  label.className = "msg__label";
  label.textContent = role === "user" ? "You" : role === "harvey" ? "Harvey" : "Note";

  const bubble = document.createElement("div");
  bubble.className = "msg__bubble";
  bubble.textContent = text;

  wrap.append(label, bubble);

  if (artPrompt && role === "harvey") {
    const parsed = parseArtPrompt(artPrompt);
    const card = document.createElement("div");
    card.className = "art-card";
    const meta =
      parsed.artist && parsed.title
        ? `${escapeHtml(parsed.title)} · ${escapeHtml(parsed.artist)}`
        : escapeHtml(parsed.title || artPrompt);
    card.innerHTML = `
      <div class="art-card__img-wrap" aria-hidden="true"></div>
      <p class="art-card__meta">${meta}</p>
      <p class="art-card__note">${escapeHtml(parsed.condition)}</p>
    `;
    wrap.appendChild(card);
    loadArtImage(card.querySelector(".art-card__img-wrap"), artPrompt, artImageUrl);
  }

  messagesEl.appendChild(wrap);
  scrollMessagesToBottom();
  return wrap;
}

async function loadArtImage(container, artPrompt, artImageUrl = null) {
  if (!container) return;

  if (artImageUrl) {
    const img = document.createElement("img");
    img.src = artImageUrl;
    img.alt = artPrompt.split("—")[0].trim() || "Art";
    img.loading = "lazy";
    container.appendChild(img);
    return;
  }

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
    /* text-only art card */
  }
}

function showChat() {
  onboardingPanel.classList.add("hidden");
  chatPanel.classList.remove("hidden");
  composerWrap.classList.remove("hidden");
}

function updateNoteButton() {
  if (exchangeCount >= 1) {
    noteBtn.classList.remove("hidden");
  }
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

function showFallbackNotice() {
  statusBanner.textContent =
    "BACKUP LINE — Harvey's voice is on a short delay. Tracker stats above stay live when available.";
  statusBanner.classList.remove("hidden");
}

function handleChatResponse(data) {
  if (data.fallback) showFallbackNotice();
  if (data.harvey_status_snapshot) {
    cacheStatus(data.harvey_status_snapshot);
    renderStatus(data.harvey_status_snapshot);
  }
}

async function loadGreeting() {
  if (greetingDone) return;
  const loading = appendThinkingMessage();
  try {
    const data = await requestChat();
    loading.remove();
    appendMessage({
      role: "harvey",
      text: data.reply,
      artPrompt: data.art_prompt || null,
      artImageUrl: data.art_image_url || null,
    });
    handleChatResponse(data);
    greetingDone = true;
    exchangeCount += 1;
    updateNoteButton();
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
  exchangeCount += 1;
  updateNoteButton();

  const loading = appendThinkingMessage();
  try {
    const data = await requestChat(text);
    loading.remove();
    appendMessage({
      role: "harvey",
      text: data.reply,
      artPrompt: data.art_prompt || null,
      artImageUrl: data.art_image_url || null,
    });
    handleChatResponse(data);
    exchangeCount += 1;
    updateNoteButton();
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
    link.href = "https://harveygerardmk.github.io/crew-chief/";
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

noteBtn.addEventListener("click", () => {
  noteOverlay.classList.remove("hidden");
  $("note-input").value = "";
  $("note-error").classList.add("hidden");
  $("note-input").focus();
});

$("note-cancel").addEventListener("click", () => {
  noteOverlay.classList.add("hidden");
});

noteOverlay.addEventListener("click", (event) => {
  if (event.target === noteOverlay) noteOverlay.classList.add("hidden");
});

$("note-submit").addEventListener("click", async () => {
  const text = $("note-input").value.trim();
  const errEl = $("note-error");
  if (!text) {
    errEl.textContent = "Write something first.";
    errEl.classList.remove("hidden");
    return;
  }
  errEl.classList.add("hidden");
  $("note-submit").disabled = true;
  try {
    await api("/notes", {
      method: "POST",
      body: JSON.stringify({ visitor_id: getVisitorId(), note_text: text }),
    });
    noteOverlay.classList.add("hidden");
    appendMessage({
      role: "system",
      text: "Note saved — Harvey will see it after the race.",
    });
  } catch (err) {
    errEl.textContent = err.message || "Could not save note.";
    errEl.classList.remove("hidden");
  } finally {
    $("note-submit").disabled = false;
  }
});

async function init() {
  fixCrewSiteLink();

  try {
    apiBase();
  } catch {
    statusBanner.textContent =
      "Chat API not configured in this build — crew site updates still work.";
    statusBanner.classList.remove("hidden");
    return;
  }

  const cached = loadCachedStatus();
  if (cached) renderStatus(cached);

  try {
    await refreshStatus();
  } catch {
    /* cached */
  }

  setInterval(refreshStatus, STATUS_POLL_MS);

  const visitorId = getVisitorId();
  if (visitorId) {
    showChat();
    await loadGreeting();
  }
}

init();
