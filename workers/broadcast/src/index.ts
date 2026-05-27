import { getFileSha, putFile, toBase64, type GitHubEnv } from "./github";
import {
  SESSION_MAX_AGE,
  sessionCookieHeader,
  sessionCookieName,
  signSession,
  verifySession,
} from "./session";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, validateBroadcastFields } from "./validate";

export interface Env extends GitHubEnv {
  FAMILY_PASSWORD: string;
  SESSION_SIGNING_KEY: string;
}

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

      if (request.method === "POST" && url.pathname === "/auth") {
        return handleAuth(request, env, cors);
      }

      if (request.method === "POST" && url.pathname === "/broadcast") {
        return handleBroadcast(request, env, cors);
      }

      return json({ ok: false, message: "Not found." }, 404, cors);
    } catch (err) {
      console.error(err);
      return json({ ok: false, message: "Something went wrong. Try again in a moment." }, 500, cors);
    }
  },
};

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(body: unknown, status: number, cors: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function handleAuth(request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const { password } = (await request.json()) as { password?: string };
  if (!password || password !== env.FAMILY_PASSWORD) {
    return json({ ok: false, message: "That password didn't work." }, 401, cors);
  }

  const token = await signSession(env.SESSION_SIGNING_KEY, SESSION_MAX_AGE);
  const headers = new Headers(cors);
  headers.set("Content-Type", "application/json");
  headers.append("Set-Cookie", sessionCookieHeader(token, SESSION_MAX_AGE));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

async function handleBroadcast(request: Request, env: Env, cors: HeadersInit): Promise<Response> {
  const token = getCookie(request, sessionCookieName());
  if (!(await verifySession(env.SESSION_SIGNING_KEY, token))) {
    return json({ ok: false, message: "Please sign in again." }, 401, cors);
  }

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
    if (!file || !(file instanceof File) || file.size === 0) continue;
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

function getCookie(request: Request, name: string): string | null {
  const header = request.headers.get("Cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
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
