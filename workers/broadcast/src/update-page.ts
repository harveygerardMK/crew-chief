/** Same-origin crew update UI — use when GitHub Pages cannot reach the Worker (CORS / firewall). */
const STATIONS = [
  "Start (Heavenly Stagecoach)",
  "Heavenly",
  "Armstrong Pass",
  "Housewife Hill",
  "Sierra at Tahoe",
  "Wrights Lake",
  "Loon Lake",
  "Barker Pass",
  "Stephen Jones Memorial",
  "Tahoe City",
  "Brockway Summit",
  "Village Green",
  "Spooner Summit",
  "Finish (Heavenly Stagecoach)",
];

const stationOptions = STATIONS.map(
  (name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`,
).join("");

export const UPDATE_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Crew update · Tahoe 200</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
    rel="stylesheet"
  />
  <style>
    :root {
      --surface-base: #f2ede3;
      --surface-raised: #e8e1d3;
      --ink-primary: #1b2a2e;
      --ink-secondary: #4a5a5f;
      --ink-divider: #c9c0ae;
      --accent-primary: #b5451f;
      --accent-success: #4a6b3a;
      --mint-deep: #8f3819;
      --font-display: "Fraunces", Georgia, serif;
      --font-body: "IBM Plex Sans", system-ui, sans-serif;
      --text-body-sm: 0.875rem;
      --text-body: 1rem;
      --text-lead: 1.125rem;
      --text-h4: 1.25rem;
      --text-h1: 2.5rem;
      --space-2: 0.5rem;
      --space-3: 0.75rem;
      --space-4: 1rem;
      --space-5: 1.5rem;
      --radius-sm: 2px;
      --border-hairline: 1px solid var(--ink-divider);
      --canvas: var(--surface-base);
      --focus-ring: 0 0 0 2px var(--accent-primary);
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0 auto;
      max-width: 28rem;
      padding: var(--space-5) var(--space-4);
      font-family: var(--font-body);
      font-size: var(--text-body);
      line-height: 1.55;
      color: var(--ink-primary);
      background: var(--surface-base);
    }
    h1 {
      font-family: var(--font-display);
      font-size: var(--text-h1);
      font-weight: 600;
      line-height: 1.1;
      margin: 0 0 var(--space-3);
    }
    .lead {
      font-size: var(--text-lead);
      line-height: 1.55;
      color: var(--ink-secondary);
      margin: 0 0 var(--space-4);
    }
    .update-panel {
      margin: var(--space-5) 0;
      padding: var(--space-5);
      background: var(--surface-raised);
      border: var(--border-hairline);
      border-radius: var(--radius-sm);
    }
    .update-panel h2 {
      font-family: var(--font-display);
      font-size: var(--text-h4);
      font-weight: 600;
      margin: 0 0 var(--space-4);
    }
    .update-field {
      display: block;
      margin-bottom: var(--space-4);
    }
    .update-field__label {
      display: block;
      font-size: var(--text-body-sm);
      font-weight: 600;
      margin-bottom: var(--space-2);
    }
    .update-input {
      display: block;
      width: 100%;
      font: inherit;
      font-size: var(--text-body);
      padding: var(--space-3);
      border: var(--border-hairline);
      border-radius: var(--radius-sm);
      background: var(--canvas);
      min-height: 2.75rem;
    }
    textarea.update-input {
      resize: vertical;
      min-height: 4.5rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 2.75rem;
      padding: var(--space-3) var(--space-5);
      font: inherit;
      font-size: var(--text-body-sm);
      font-weight: 600;
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }
    .btn--primary {
      background: var(--accent-primary);
      color: var(--surface-base);
    }
    .btn--primary:hover { background: var(--mint-deep); }
    .btn:disabled { opacity: 0.6; cursor: wait; }
    .btn:focus-visible, .update-input:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }
    .update-status {
      margin: var(--space-4) 0;
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-sm);
      font-size: var(--text-body-sm);
    }
    .update-status[data-kind="error"] {
      background: color-mix(in srgb, var(--accent-primary) 12%, transparent);
      border: 1px solid var(--accent-primary);
    }
    .update-status[data-kind="success"] {
      background: color-mix(in srgb, var(--accent-success) 15%, transparent);
      border: 1px solid var(--accent-success);
    }
    .update-status[data-kind="info"] {
      background: var(--surface-raised);
      border: var(--border-hairline);
    }
    a { color: var(--ink-primary); }
    a:hover { color: var(--accent-primary); }
    .home { font-size: var(--text-body-sm); margin-top: var(--space-5); color: var(--ink-secondary); }
  </style>
</head>
<body>
  <h1>Crew update</h1>
  <p class="lead">Short note for family in <strong>Ask Harvey</strong> (wheresharvey.com chat). Takes a few minutes after you save.</p>
  <p id="status" class="update-status" role="status" aria-live="polite" hidden></p>

  <form id="broadcast-form" class="update-panel" method="post" action="/broadcast" enctype="multipart/form-data">
    <h2>Update for family</h2>
    <label class="update-field">
      <span class="update-field__label">How's Harvey doing?</span>
      <textarea id="doing" name="doing" class="update-input" rows="2" maxlength="200" placeholder="e.g. Tired but moving — just left Sierra"></textarea>
    </label>
    <label class="update-field">
      <span class="update-field__label">Last seen aid station</span>
      <select id="station" name="station" class="update-input">
        <option value="">— Skip if you're only posting a quick line —</option>
        ${stationOptions}
        <option value="__other__">Other…</option>
      </select>
    </label>
    <label class="update-field">
      <span class="update-field__label">Other station name</span>
      <input id="station_other" type="text" class="update-input" hidden maxlength="80" />
    </label>
    <label class="update-field">
      <span class="update-field__label">Time last seen</span>
      <input id="time_seen" type="datetime-local" class="update-input" />
    </label>
    <input type="hidden" name="time_label" id="time_label" value="" />
    <label class="update-field">
      <span class="update-field__label">Note for family (optional)</span>
      <textarea id="note" name="note" class="update-input" rows="4" maxlength="500" placeholder="Sleeping at Wrights — see you at Tahoe City Monday AM"></textarea>
    </label>
    <label class="update-field">
      <span class="update-field__label">Photo 1 (optional)</span>
      <input name="photo0" type="file" accept="image/jpeg,image/png,image/webp" class="update-input" />
    </label>
    <label class="update-field">
      <span class="update-field__label">Photo 2 (optional)</span>
      <input name="photo1" type="file" accept="image/jpeg,image/png,image/webp" class="update-input" />
    </label>
    <button id="save-btn" type="submit" class="btn btn--primary">Save update</button>
  </form>

  <p class="home"><a href="https://wheresharvey.com/">← Back to race site</a></p>

  <script>
${UPDATE_PAGE_SCRIPT}
  </script>
</body>
</html>`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

const UPDATE_PAGE_SCRIPT = `
(function () {
  var form = document.getElementById("broadcast-form");
  var statusEl = document.getElementById("status");
  var saveBtn = document.getElementById("save-btn");
  var timeInput = document.getElementById("time_seen");
  var timeLabelInput = document.getElementById("time_label");
  var stationSelect = document.getElementById("station");
  var stationOther = document.getElementById("station_other");

  if (!form || !statusEl || !saveBtn) return;

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !message;
    try { statusEl.scrollIntoView({ block: "nearest" }); } catch (e) {}
  }

  function syncTimeLabel() {
    if (timeLabelInput) timeLabelInput.value = formatTimeLabel(timeInput ? timeInput.value : "");
  }

  function syncStationField() {
    if (!stationSelect) return;
    if (stationSelect.value === "__other__" && stationOther && stationOther.value.trim()) {
      stationSelect.removeAttribute("name");
      stationOther.setAttribute("name", "station");
    } else {
      stationSelect.setAttribute("name", "station");
      if (stationOther) stationOther.removeAttribute("name");
    }
  }

  try {
    if (timeInput) timeInput.value = defaultDatetimeLocal();
    syncTimeLabel();
  } catch (e) {}

  if (stationSelect) {
    stationSelect.addEventListener("change", function () {
      if (!stationOther) return;
      var show = stationSelect.value === "__other__";
      stationOther.hidden = !show;
      stationOther.required = show;
      syncStationField();
      if (stationSelect.value && stationSelect.value !== "__other__") syncTimeLabel();
    });
  }
  if (timeInput) {
    timeInput.addEventListener("change", syncTimeLabel);
    timeInput.addEventListener("input", syncTimeLabel);
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    syncTimeLabel();
    syncStationField();
    setStatus("Saving…", "info");
    saveBtn.disabled = true;
    fetch("/broadcast", { method: "POST", body: new FormData(form) })
      .then(function (res) {
        return readJson(res).then(function (data) {
          if (!res.ok || !data.ok) {
            setStatus(data.message || "Save failed. Try again.", "error");
            return;
          }
          setStatus("Saved — family will see this in Ask Harvey chat in a few minutes.", "success");
          form.reset();
          if (timeInput) timeInput.value = defaultDatetimeLocal();
          syncTimeLabel();
          if (stationOther) stationOther.hidden = true;
        });
      })
      .catch(function () {
        setStatus("Could not reach the server. Check signal and try again.", "error");
      })
      .finally(function () { saveBtn.disabled = false; });
  });

  function readJson(res) {
    return res.text().then(function (text) {
      if (!text) return {};
      try { return JSON.parse(text); } catch (e) { throw new Error("bad json"); }
    });
  }
  function defaultDatetimeLocal() {
    var parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false
    }).formatToParts(new Date());
    function get(type) {
      var p = parts.find(function (x) { return x.type === type; });
      return p ? p.value : "";
    }
    return get("year") + "-" + get("month") + "-" + get("day") + "T" + get("hour") + ":" + get("minute");
  }
  function formatTimeLabel(datetimeLocal) {
    if (!datetimeLocal) {
      return new Date().toLocaleString("en-US", {
        timeZone: "America/Los_Angeles", weekday: "short",
        hour: "numeric", minute: "2-digit", timeZoneName: "short"
      });
    }
    return new Date(datetimeLocal).toLocaleString("en-US", {
      timeZone: "America/Los_Angeles", weekday: "short",
      hour: "numeric", minute: "2-digit", timeZoneName: "short"
    });
  }
})();
`.trim();
