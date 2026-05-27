const SESSION_COOKIE = "cc_broadcast_session";
const SESSION_DAYS = 7;

export function sessionCookieName(): string {
  return SESSION_COOKIE;
}

export async function signSession(secret: string, ttlSeconds: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const body = JSON.stringify({ exp });
  const bodyB64 = btoa(body);
  const sig = await hmac(secret, bodyB64);
  return `${bodyB64}.${sig}`;
}

export async function verifySession(
  secret: string,
  token: string | null,
): Promise<{ exp: number } | null> {
  if (!token) return null;
  const [bodyB64, sig] = token.split(".");
  if (!bodyB64 || !sig) return null;
  const expected = await hmac(secret, bodyB64);
  if (sig !== expected) return null;
  const payload = JSON.parse(atob(bodyB64)) as { exp: number };
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export function sessionCookieHeader(token: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSeconds}`;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
