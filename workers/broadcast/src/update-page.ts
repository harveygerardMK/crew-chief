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
  <style>
    :root { font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; background: #f6f3ee; }
    body { max-width: 32rem; margin: 0 auto; padding: 1.25rem; }
    h1 { font-family: Georgia, serif; font-size: 1.75rem; margin: 0 0 0.5rem; }
    .lead { color: #555; margin: 0 0 1rem; font-size: 0.95rem; }
    .panel { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.75rem; }
    .label { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.25rem; }
    input, select, textarea { width: 100%; box-sizing: border-box; padding: 0.5rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 4px; }
    button { width: 100%; padding: 0.75rem; font-size: 1rem; font-weight: 600; background: #1e4d6b; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: wait; }
    #status { padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; font-size: 0.9rem; }
    #status[data-kind="error"] { background: #f5e6e0; border: 1px solid #c45a28; }
    #status[data-kind="success"] { background: #e8f0e6; border: 1px solid #3d6b40; }
    #status[data-kind="info"] { background: #eef3f7; border: 1px solid #1e4d6b; }
    a { color: #1e4d6b; }
    .home { font-size: 0.85rem; margin-top: 1.5rem; }
  </style>
</head>
<body>
  <h1>Crew update</h1>
  <p class="lead">Short note for family on the homepage. Takes a few minutes to show up after you save.</p>
  <p id="status" role="status" aria-live="polite" hidden></p>

  <section id="form" class="panel">
    <h2>Update for family</h2>
    <label>
      <span class="label">How's Harvey doing?</span>
      <textarea id="doing" rows="2" maxlength="200" placeholder="e.g. Tired but moving — just left Sierra"></textarea>
    </label>
    <label>
      <span class="label">Last seen aid station</span>
      <select id="station">
        <option value="">— Skip if you're only posting a quick line —</option>
        ${stationOptions}
        <option value="__other__">Other…</option>
      </select>
    </label>
    <label>
      <span class="label">Other station name</span>
      <input id="station_other" type="text" hidden maxlength="80" />
    </label>
    <label>
      <span class="label">Time last seen</span>
      <input id="time_seen" type="datetime-local" />
    </label>
    <label>
      <span class="label">Note for family (optional)</span>
      <textarea id="note" rows="4" maxlength="500" placeholder="Sleeping at Wrights — see you at Tahoe City Monday AM"></textarea>
    </label>
    <label>
      <span class="label">Photo 1 (optional)</span>
      <input name="photo0" type="file" accept="image/jpeg,image/png,image/webp" />
    </label>
    <label>
      <span class="label">Photo 2 (optional)</span>
      <input name="photo1" type="file" accept="image/jpeg,image/png,image/webp" />
    </label>
    <button id="save-btn" type="button">Save update</button>
  </section>

  <p class="home"><a href="https://harveygerardmk.github.io/crew-chief/">← Back to race site</a></p>

  <script>
${UPDATE_PAGE_SCRIPT}
  </script>
</body>
</html>`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/** Inline script — no modules; runs same-origin on the Worker. */
const UPDATE_PAGE_SCRIPT = `
(function () {
  var statusEl = document.getElementById("status");
  var saveBtn = document.getElementById("save-btn");
  var timeInput = document.getElementById("time_seen");
  var stationSelect = document.getElementById("station");
  var stationOther = document.getElementById("station_other");

  if (!statusEl || !saveBtn) {
    console.error("[crew update] Form elements missing");
    return;
  }

  saveBtn.addEventListener("click", function () {
    setStatus("Saving…", "info");
    saveBtn.disabled = true;
    var station = resolveStation();
    var formData = new FormData();
    formData.set("doing", getValue("doing"));
    formData.set("station", station);
    formData.set("time_label", formatTimeLabel(timeInput ? timeInput.value : ""));
    formData.set("note", getValue("note"));
    document.querySelectorAll('input[type="file"][name^="photo"]').forEach(function (input, index) {
      if (input.files && input.files[0]) formData.set("photo" + index, input.files[0]);
    });
    fetchWithTimeout("/broadcast", {
      method: "POST",
      credentials: "same-origin",
      body: formData
    }, 45000).then(function (res) {
      return readJson(res).then(function (data) {
        if (!res.ok || !data.ok) {
          setStatus(data.message || "Save failed. Try again.", "error");
          return;
        }
        setStatus("Saved — should show on the homepage in a few minutes.", "success");
        document.querySelectorAll('input[type="file"][name^="photo"]').forEach(function (input) {
          input.value = "";
        });
      });
    }).catch(function (err) {
      setStatus(networkErrorMessage(err), "error");
    }).finally(function () { saveBtn.disabled = false; });
  });

  try {
    if (timeInput) timeInput.value = defaultDatetimeLocal();
  } catch (e) { console.warn("[crew update] default time:", e); }

  if (stationSelect) {
    stationSelect.addEventListener("change", function () {
      if (!stationOther) return;
      var show = stationSelect.value === "__other__";
      stationOther.hidden = !show;
      stationOther.required = show;
    });
  }

  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.dataset.kind = kind;
    statusEl.hidden = !message;
    statusEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function getValue(id) {
    var el = document.getElementById(id);
    return (el && el.value ? el.value.trim() : "");
  }
  function resolveStation() {
    if (!stationSelect) return "";
    if (stationSelect.value === "__other__") return stationOther ? stationOther.value.trim() : "";
    if (!stationSelect.value) return "";
    return stationSelect.value;
  }
  function networkErrorMessage(err) {
    if (err && err.name === "AbortError") return "Timed out. Try again on Wi‑Fi or with a shorter note.";
    return "Could not reach the server. Check signal and try again.";
  }
  function readJson(res) {
    return res.text().then(function (text) {
      if (!text) return {};
      try { return JSON.parse(text); } catch (e) {
        throw new Error("Server returned " + res.status);
      }
    });
  }
  function fetchWithTimeout(url, init, ms) {
    if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
      return fetch(url, Object.assign({}, init, { signal: AbortSignal.timeout(ms) }));
    }
    var controller = new AbortController();
    var id = setTimeout(function () { controller.abort(); }, ms);
    return fetch(url, Object.assign({}, init, { signal: controller.signal }))
      .finally(function () { clearTimeout(id); });
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
