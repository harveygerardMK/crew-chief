import { appendBroadcastUpdate, type RaceBroadcastEntry } from "./broadcast-store";
import { getFileJson, getFileSha, putFile, toBase64, type GitHubEnv } from "./github";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, prepareBroadcastFields, validateBroadcastFields } from "./validate";
import { UPDATE_PAGE_HTML } from "./update-page";
import { getTrackerSnapshot, type TrackLeadersEnv } from "./trackleaders";

export interface Env extends GitHubEnv, TrackLeadersEnv {}

const ALLOWED_ORIGINS = [
  "https://wheresharvey.com",
  "https://www.wheresharvey.com",
  "https://harveygerardmk.github.io",
  "http://localhost:4321",
];

const HOMEPAGE_URL = "https://wheresharvey.com/";
const UPDATE_PAGE_URL = "https://crew-chief-broadcast.harvey-schaefer.workers.dev/update";
const RATE_LIMIT_MS = 30_000;
const lastPostByIp = new Map<string, number>();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin);
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true }, 200, cors);
      }

      const path = url.pathname.replace(/\/$/, "") || "/";

      if (request.method === "GET" && path === "/") {
        return Response.redirect(`${url.origin}/update`, 302);
      }

      if (request.method === "GET" && path === "/update") {
        return new Response(UPDATE_PAGE_HTML, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }

      if (request.method === "POST" && path === "/broadcast") {
        return await handleBroadcast(request, env, cors);
      }

      if (request.method === "GET" && path === "/tracker") {
        const snapshot = await getTrackerSnapshot(env);
        return json(snapshot, 200, {
          ...cors,
          "Cache-Control": "public, max-age=30",
        });
      }

      return json({ ok: false, message: "Not found." }, 404, cors);
    } catch (err) {
      console.error(err);
      const detail = err instanceof Error ? err.message : "unknown error";
      const message = detail.includes("timeout") || detail.includes("Timeout")
        ? "Save timed out. Try again on Wi‑Fi or with a shorter note."
        : detail.includes("GitHub")
          ? "Could not save to the site repo. Harvey may need to check the GitHub token."
          : "Something went wrong. Try again in a moment.";
      return json({ ok: false, message }, 500, cors);
    }
  },
};

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function json(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleBroadcast(request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const htmlNav = isFormNavigation(request);
  try {
    return await handleBroadcastInner(request, env, cors, htmlNav);
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : "unknown error";
    const message = detail.includes("401")
      ? "Could not save — GitHub token expired or wrong. Harvey needs to update GITHUB_TOKEN on the Worker."
      : detail.includes("timeout") || detail.includes("Timeout")
        ? "Save timed out. Try again on Wi‑Fi or with a shorter note."
        : detail.includes("GitHub")
          ? "Could not save to the site repo. Harvey may need to check the GitHub token."
          : "Something went wrong. Try again in a moment.";
    return respond({ ok: false, message }, 500, cors, htmlNav);
  }
}

async function handleBroadcastInner(
  request: Request,
  env: Env,
  cors: HeadersInit,
  htmlNav: boolean,
): Promise<Response> {
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const last = lastPostByIp.get(ip) ?? 0;
  if (Date.now() - last < RATE_LIMIT_MS) {
    return respond(
      { ok: false, message: "Please wait a moment before saving again." },
      429,
      cors,
      htmlNav,
    );
  }

  const form = await request.formData();
  const fields = prepareBroadcastFields({
    doing: String(form.get("doing") ?? ""),
    station: String(form.get("station") ?? ""),
    timeLabel: String(form.get("time_label") ?? ""),
    note: String(form.get("note") ?? ""),
  });

  const validation = validateBroadcastFields(fields);
  if (!validation.ok) {
    return respond({ ok: false, message: validation.message }, 400, cors, htmlNav);
  }

  const { doing, station, timeLabel, note } = fields;

  const photos: { url: string; alt: string }[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const stationSlug = slugify(station || "update");

  for (let i = 0; i < MAX_PHOTOS; i++) {
    const file = form.get(`photo${i}`);
    if (!file || typeof file === "string" || file.size === 0) continue;
    if (file.size > MAX_PHOTO_BYTES) {
      return respond({ ok: false, message: "Photo is too large (max 5 MB)." }, 413, cors, htmlNav);
    }
    const ext = extensionForMime(file.type);
    if (!ext) {
      return respond({ ok: false, message: "Use a JPEG, PNG, or WebP photo." }, 400, cors, htmlNav);
    }
    const filename = `${stamp}-${stationSlug}-${i + 1}.${ext}`;
    const path = `public/race-updates/${filename}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha = await getFileSha(env, path);
    await putFile(env, path, toBase64(bytes), "broadcast: update from crew", sha);
    photos.push({
      url: `/race-updates/${filename}`,
      alt: station ? `Harvey at ${station}` : "Harvey on course",
    });
  }

  const newEntry: RaceBroadcastEntry = {
    updated_at: new Date().toISOString(),
    updated_by: "crew",
    doing: doing.trim() || null,
    last_seen: station.trim()
      ? { station: station.trim(), time_label: timeLabel.trim() }
      : null,
    note: note.trim() || null,
    photos,
  };

  const jsonPath = "data/race-broadcast.json";
  const { sha: jsonSha, content: existing } = await getFileJson(env, jsonPath);
  const file = appendBroadcastUpdate(existing, newEntry);
  const jsonBytes = new TextEncoder().encode(`${JSON.stringify(file, null, 2)}\n`);
  await putFile(
    env,
    jsonPath,
    toBase64(jsonBytes),
    "broadcast: update from crew",
    jsonSha,
  );

  lastPostByIp.set(ip, Date.now());
  return respond({ ok: true }, 200, cors, htmlNav);
}

/** Browser form POST (full page navigation) vs fetch() from the update page script. */
function isFormNavigation(request: Request): boolean {
  return request.headers.get("Sec-Fetch-Mode") === "navigate";
}

type ApiBody = { ok: boolean; message?: string };

function respond(body: ApiBody, status: number, cors: HeadersInit, htmlNav: boolean): Response {
  if (htmlNav) {
    return body.ok ? htmlSuccessPage() : htmlErrorPage(body.message ?? "Save failed.", status);
  }
  return json(body, status, cors);
}

function htmlSuccessPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="8;url=${HOMEPAGE_URL}" />
  <title>Saved · Tahoe 200</title>
  <style>
    body { font-family: "IBM Plex Sans", system-ui, sans-serif; max-width: 28rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; color: #1b2a2e; background: #f2ede3; }
    h1 { font-family: Fraunces, Georgia, serif; color: #4a6b3a; }
    a { color: #1b2a2e; font-weight: 600; }
    a:hover { color: #b5451f; }
  </style>
</head>
<body>
  <h1>Update saved</h1>
  <p>Your note is on its way to the race site. It usually shows on the homepage in <strong>3–5 minutes</strong> after the site rebuilds.</p>
  <p><a href="${HOMEPAGE_URL}">Go to the homepage</a> · <a href="${UPDATE_PAGE_URL}">Post another update</a></p>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function htmlErrorPage(message: string, status: number): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Could not save</title>
  <style>
    body { font-family: "IBM Plex Sans", system-ui, sans-serif; max-width: 28rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; color: #1b2a2e; background: #f2ede3; }
    h1 { font-family: Fraunces, Georgia, serif; color: #b5451f; }
    a { color: #1b2a2e; font-weight: 600; }
    a:hover { color: #b5451f; }
  </style>
</head>
<body>
  <h1>Could not save</h1>
  <p>${escapeHtml(message)}</p>
  <p><a href="${UPDATE_PAGE_URL}">Back to the update form</a></p>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "update"
  );
}

function extensionForMime(mime: string): string | null {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
}
