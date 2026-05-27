import { getFileSha, putFile, toBase64, type GitHubEnv } from "./github";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, validateBroadcastFields } from "./validate";
import { UPDATE_PAGE_HTML } from "./update-page";

export interface Env extends GitHubEnv {}

const ALLOWED_ORIGINS = ["https://harveygerardmk.github.io", "http://localhost:4321"];

const SITE_BASE = "/crew-chief";
const RATE_LIMIT_MS = 30_000;
const lastPostByIp = new Map<string, number>();

type RaceBroadcastPayload = {
  updated_at: string;
  updated_by: string;
  doing: string | null;
  last_seen: { station: string; time_label: string } | null;
  note: string | null;
  photos: { url: string; alt: string }[];
};

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
        return handleBroadcast(request, env, cors);
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
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const last = lastPostByIp.get(ip) ?? 0;
  if (Date.now() - last < RATE_LIMIT_MS) {
    return json({ ok: false, message: "Please wait a moment before saving again." }, 429, cors);
  }

  const form = await request.formData();
  const doing = String(form.get("doing") ?? "");
  const station = String(form.get("station") ?? "");
  const timeLabel = String(form.get("time_label") ?? "");
  const note = String(form.get("note") ?? "");

  const validation = validateBroadcastFields({ doing, station, timeLabel, note });
  if (!validation.ok) {
    return json({ ok: false, message: validation.message }, 400, cors);
  }

  const photos: { url: string; alt: string }[] = [];
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const stationSlug = slugify(station || "update");

  for (let i = 0; i < MAX_PHOTOS; i++) {
    const file = form.get(`photo${i}`);
    if (!file || typeof file === "string" || file.size === 0) continue;
    if (file.size > MAX_PHOTO_BYTES) {
      return json({ ok: false, message: "Photo is too large (max 5 MB)." }, 413, cors);
    }
    const ext = extensionForMime(file.type);
    if (!ext) {
      return json({ ok: false, message: "Use a JPEG, PNG, or WebP photo." }, 400, cors);
    }
    const filename = `${stamp}-${stationSlug}-${i + 1}.${ext}`;
    const path = `public/race-updates/${filename}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const sha = await getFileSha(env, path);
    await putFile(env, path, toBase64(bytes), "broadcast: update from crew", sha);
    photos.push({
      url: `${SITE_BASE}/race-updates/${filename}`,
      alt: station ? `Harvey at ${station}` : "Harvey on course",
    });
  }

  const payload: RaceBroadcastPayload = {
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
  const jsonBytes = new TextEncoder().encode(`${JSON.stringify(payload, null, 2)}\n`);
  const jsonSha = await getFileSha(env, jsonPath);
  await putFile(
    env,
    jsonPath,
    toBase64(jsonBytes),
    "broadcast: update from crew",
    jsonSha,
  );

  lastPostByIp.set(ip, Date.now());
  return json({ ok: true }, 200, cors);
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
