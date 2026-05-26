# Race Broadcast Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wife posts race updates (text + optional photos) via a password-protected `/update/` page; a Cloudflare Worker commits `data/race-broadcast.json` and images to GitHub; homepage/Follow show updates after the normal Pages deploy (~3–5 min).

**Architecture:** Static Astro site unchanged for public reads. A small Worker (`workers/broadcast`) validates a shared password, signs a session token (cookie on Worker origin), and uses the GitHub Contents API to commit JSON + binary files to `main`. Admin UI on GitHub Pages calls the Worker with `credentials: 'include'` (cross-origin cookie `SameSite=None; Secure`).

**Tech Stack:** Astro 5, Cloudflare Workers (Wrangler), GitHub REST API, Vitest (Worker unit tests only), existing GitHub Actions Pages deploy.

**Spec:** `docs/superpowers/specs/2026-05-26-race-broadcast-admin-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `data/race-broadcast.json` | Source of truth for crew-facing broadcast (built into site) |
| `public/race-updates/` | Committed race photos (served as static assets) |
| `src/lib/broadcast.ts` | Types + `hasBroadcast()` helper |
| `src/lib/data.ts` | Re-export `raceBroadcast` |
| `src/components/StatusBlock.astro` | Merge broadcast into status UI |
| `src/components/BroadcastStrip.astro` | Note + photo thumbnails |
| `src/pages/update/index.astro` | Admin page (`noindex`) |
| `src/scripts/broadcast-admin.ts` | Auth + multipart POST client |
| `workers/broadcast/src/index.ts` | Worker routes: `/auth`, `/broadcast`, `/health` |
| `workers/broadcast/src/validate.ts` | Pure validation (tested) |
| `workers/broadcast/src/session.ts` | HMAC session token sign/verify (tested) |
| `workers/broadcast/src/github.ts` | GitHub Contents API commit helper |
| `workers/broadcast/wrangler.toml` | Worker config |
| `docs/superpowers/runbooks/broadcast-worker-setup.md` | Harvey’s one-time Cloudflare + PAT setup |
| `.github/workflows/deploy.yml` | Pass `PUBLIC_BROADCAST_API_URL` at build |
| `.env.example` | Document local dev Worker URL |

---

## Task 1: Broadcast data model (site)

**Files:**
- Create: `data/race-broadcast.json`
- Create: `public/race-updates/.gitkeep`
- Create: `src/lib/broadcast.ts`
- Modify: `src/lib/data.ts`

- [ ] **Step 1: Add empty broadcast JSON**

Create `data/race-broadcast.json`:

```json
{
  "updated_at": null,
  "updated_by": null,
  "doing": null,
  "last_seen": null,
  "note": null,
  "photos": []
}
```

- [ ] **Step 2: Add broadcast types**

Create `src/lib/broadcast.ts`:

```ts
export type RaceBroadcastPhoto = {
  url: string;
  alt: string;
};

export type RaceBroadcastLastSeen = {
  station: string;
  time_label: string;
};

export type RaceBroadcast = {
  updated_at: string | null;
  updated_by: string | null;
  doing: string | null;
  last_seen: RaceBroadcastLastSeen | null;
  note: string | null;
  photos: RaceBroadcastPhoto[];
};

export function hasBroadcast(b: RaceBroadcast): boolean {
  return Boolean(
    b.updated_at &&
      (b.doing?.trim() || b.last_seen?.station?.trim() || b.note?.trim() || b.photos.length > 0),
  );
}
```

- [ ] **Step 3: Export from data.ts**

Add to `src/lib/data.ts`:

```ts
import raceBroadcast from "../../data/race-broadcast.json";
// in export block:
export { raceBroadcast };
export type { RaceBroadcast, RaceBroadcastPhoto } from "./broadcast";
```

- [ ] **Step 4: Verify build**

Run: `npm run build`  
Expected: PASS (no UI changes yet)

- [ ] **Step 5: Commit**

```bash
git add data/race-broadcast.json public/race-updates/.gitkeep src/lib/broadcast.ts src/lib/data.ts
git commit -m "feat: add race broadcast data model"
```

---

## Task 2: Cloudflare Worker package scaffold

**Files:**
- Create: `workers/broadcast/package.json`
- Create: `workers/broadcast/wrangler.toml`
- Create: `workers/broadcast/tsconfig.json`
- Modify: root `.gitignore` (add `workers/broadcast/.wrangler`)

- [ ] **Step 1: Create Worker package.json**

```json
{
  "name": "crew-chief-broadcast",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20250525.0",
    "typescript": "^5.8.3",
    "vitest": "^3.1.3",
    "wrangler": "^4.14.0"
  }
}
```

- [ ] **Step 2: Create wrangler.toml**

```toml
name = "crew-chief-broadcast"
main = "src/index.ts"
compatibility_date = "2025-04-01"

[vars]
GITHUB_OWNER = "harveygerardMK"
GITHUB_REPO = "crew-chief"
GITHUB_BRANCH = "main"
```

Secrets (set via CLI, not in file): `FAMILY_PASSWORD`, `GITHUB_TOKEN`, `SESSION_SIGNING_KEY`

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types"],
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Install and verify wrangler**

```bash
cd workers/broadcast && npm install && npx wrangler --version
```

Expected: wrangler version prints without error

- [ ] **Step 5: Commit**

```bash
git add workers/broadcast/package.json workers/broadcast/wrangler.toml workers/broadcast/tsconfig.json .gitignore
git commit -m "chore: scaffold Cloudflare broadcast worker"
```

---

## Task 3: Session + validation (tested)

**Files:**
- Create: `workers/broadcast/src/session.ts`
- Create: `workers/broadcast/src/validate.ts`
- Create: `workers/broadcast/src/session.test.ts`
- Create: `workers/broadcast/src/validate.test.ts`
- Create: `workers/broadcast/vitest.config.ts`

- [ ] **Step 1: Write failing validation test**

Create `workers/broadcast/src/validate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateBroadcastFields } from "./validate";

describe("validateBroadcastFields", () => {
  it("rejects empty doing and station", () => {
    const r = validateBroadcastFields({ doing: "", station: "", timeLabel: "Now", note: "" });
    expect(r.ok).toBe(false);
  });

  it("accepts doing only", () => {
    const r = validateBroadcastFields({ doing: "Moving well", station: "", timeLabel: "Sat 1 PM PDT", note: "" });
    expect(r.ok).toBe(true);
  });

  it("rejects doing over 200 chars", () => {
    const r = validateBroadcastFields({ doing: "x".repeat(201), station: "Tahoe City", timeLabel: "Now", note: "" });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd workers/broadcast && npm test
```

Expected: FAIL — `validateBroadcastFields` not found

- [ ] **Step 3: Implement validate.ts**

```ts
const MAX_DOING = 200;
const MAX_NOTE = 500;
const MAX_STATION = 80;
const MAX_TIME = 60;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_PHOTOS = 2;

export type BroadcastFields = {
  doing: string;
  station: string;
  timeLabel: string;
  note: string;
};

export function validateBroadcastFields(fields: BroadcastFields): { ok: true } | { ok: false; message: string } {
  const doing = fields.doing.trim();
  const station = fields.station.trim();
  const timeLabel = fields.timeLabel.trim();
  const note = fields.note.trim();

  if (!doing && !station) {
    return { ok: false, message: "Add how Harvey is doing or pick a last-seen station." };
  }
  if (doing.length > MAX_DOING) return { ok: false, message: `“How he's doing” must be ${MAX_DOING} characters or less.` };
  if (note.length > MAX_NOTE) return { ok: false, message: `Note must be ${MAX_NOTE} characters or less.` };
  if (station.length > MAX_STATION) return { ok: false, message: "Station name is too long." };
  if (timeLabel.length > MAX_TIME) return { ok: false, message: "Time field is too long." };
  if (station && !timeLabel) return { ok: false, message: "Add a time for last seen." };
  return { ok: true };
}
```

- [ ] **Step 4: Write failing session test**

Create `workers/broadcast/src/session.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";

describe("session", () => {
  it("round-trips a valid token", async () => {
    const secret = "test-secret-at-least-32-chars-long!!";
    const token = await signSession(secret, 60);
    const payload = await verifySession(secret, token);
    expect(payload).not.toBeNull();
  });

  it("rejects tampered token", async () => {
    const secret = "test-secret-at-least-32-chars-long!!";
    const token = (await signSession(secret, 60)) + "x";
    expect(await verifySession(secret, token)).toBeNull();
  });
});
```

- [ ] **Step 5: Implement session.ts**

```ts
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

export async function verifySession(secret: string, token: string | null): Promise<{ exp: number } | null> {
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
```

- [ ] **Step 6: Add vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
});
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
cd workers/broadcast && npm test
```

- [ ] **Step 8: Commit**

```bash
git add workers/broadcast/src/session.ts workers/broadcast/src/validate.ts workers/broadcast/src/*.test.ts workers/broadcast/vitest.config.ts
git commit -m "feat(worker): add session signing and broadcast validation"
```

---

## Task 4: GitHub Contents API helper

**Files:**
- Create: `workers/broadcast/src/github.ts`

- [ ] **Step 1: Implement github.ts**

```ts
type Env = {
  GITHUB_TOKEN: string;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
};

export async function getFileSha(env: Env, path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}?ref=${env.GITHUB_BRANCH}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub get ${path}: ${res.status}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

export async function putFile(
  env: Env,
  path: string,
  contentBase64: string,
  message: string,
  sha: string | null,
): Promise<void> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const body: Record<string, string> = {
    message,
    content: contentBase64,
    branch: env.GITHUB_BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub put ${path}: ${res.status} ${text}`);
  }
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
```

- [ ] **Step 2: Commit**

```bash
git add workers/broadcast/src/github.ts
git commit -m "feat(worker): GitHub Contents API helper"
```

---

## Task 5: Worker HTTP handler

**Files:**
- Create: `workers/broadcast/src/index.ts`

- [ ] **Step 1: Implement index.ts**

Implement `fetch` handler with:

- `OPTIONS` → CORS preflight for `https://harveygerardmk.github.io` (and `http://localhost:4321` for dev)
- `GET /health` → `{ ok: true }`
- `POST /auth` → JSON `{ password }` → verify `env.FAMILY_PASSWORD` → `Set-Cookie` session + `{ ok: true }`
- `POST /broadcast` → require session cookie → `multipart/form-data` fields: `doing`, `station`, `time_label`, `note`, files `photo0`, `photo1` → validate → build `RaceBroadcast` JSON → `putFile` for `data/race-broadcast.json` → for each photo `putFile` under `public/race-updates/{iso}-{slug}-{n}.jpg` (derive extension from mime) → return `{ ok: true }`

CORS headers on all responses:

```ts
const ALLOWED_ORIGINS = [
  "https://harveygerardmk.github.io",
  "http://localhost:4321",
];

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
```

Rate limit: simple in-memory `Map` IP → last post timestamp; reject if &lt; 30s apart (Worker isolate resets on cold start — acceptable for v1).

Commit message for GitHub: `broadcast: update from crew`

Photo paths in JSON must use site base: `/crew-chief/race-updates/filename.jpg`

- [ ] **Step 2: Local smoke test (after secrets set in Task 7)**

```bash
cd workers/broadcast && npm run dev
# separate terminal:
curl -s -X POST http://127.0.0.1:8787/auth -H 'Content-Type: application/json' -d '{"password":"test"}' -c cookies.txt
```

Expected: `{"ok":true}` with `Set-Cookie`

- [ ] **Step 3: Commit**

```bash
git add workers/broadcast/src/index.ts
git commit -m "feat(worker): auth and broadcast POST handlers"
```

---

## Task 6: Public UI — StatusBlock + photos

**Files:**
- Create: `src/components/BroadcastStrip.astro`
- Modify: `src/components/StatusBlock.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Create BroadcastStrip.astro**

Props: `broadcast: RaceBroadcast`. Render only if `hasBroadcast(broadcast)`:

- `note` in `.broadcast-note` with label “From crew”
- `photos` as `.broadcast-photos` flex row; each `<a href={url}><img src={url} alt={alt} loading="lazy" /></a>`

Use `import.meta.env.BASE_URL` prefix if photo URLs are stored without base (prefer storing full path `/crew-chief/race-updates/...` in JSON).

- [ ] **Step 2: Merge into StatusBlock.astro**

```astro
import { raceBroadcast, status } from "../lib/data";
import { hasBroadcast } from "../lib/broadcast";
import BroadcastStrip from "./BroadcastStrip.astro";

const broadcast = hasBroadcast(raceBroadcast) ? raceBroadcast : null;
```

On-course block logic:

- If `broadcast?.doing` → use as `status-block__secondary` (or primary detail)
- Last seen: if `broadcast?.last_seen` → show `Last seen: {station}` and `time_label`; else fall back to `status.last_seen_*`
- After actions, `{broadcast && <BroadcastStrip broadcast={broadcast} />}`

Pre-race: optionally show `broadcast.note` only if present (unlikely).

- [ ] **Step 3: Add CSS** (append to `global.css`)

```css
.broadcast-note {
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  font-size: var(--text-body-sm);
}
.broadcast-note__label {
  font-size: var(--text-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.85;
  margin: 0 0 var(--space-2);
}
.broadcast-photos {
  display: flex;
  gap: var(--space-3);
  margin-top: var(--space-4);
}
.broadcast-photos img {
  width: 7rem;
  height: 7rem;
  object-fit: cover;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(255, 255, 255, 0.25);
}
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/BroadcastStrip.astro src/components/StatusBlock.astro src/styles/global.css
git commit -m "feat: show crew broadcast on status block"
```

---

## Task 7: Admin page (`/update/`)

**Files:**
- Create: `src/pages/update/index.astro`
- Create: `src/scripts/broadcast-admin.ts`
- Modify: `src/layouts/BaseLayout.astro` (optional `noindex` prop)

- [ ] **Step 1: Add `noindex` prop to BaseLayout**

```astro
interface Props {
  title: string;
  description?: string;
  noindex?: boolean;
}
// in <head>:
{noindex && <meta name="robots" content="noindex, nofollow" />}
```

- [ ] **Step 2: Create update page**

`src/pages/update/index.astro`:

- `noindex` layout
- Title: “Crew update”
- Not linked from `SiteNav` (spec S2)
- Section `#login` with password input + Continue
- Section `#form` hidden until authed
- Fields: doing (textarea 2 rows), station (`<select>` from `aidStations` names + “Other” with text input), time (`<input type="datetime-local">` + helper to format PDT label on submit), note (textarea), two file inputs `accept="image/jpeg,image/png,image/webp"`
- `#status` aria-live region
- Script: `import { initBroadcastAdmin } from "../../scripts/broadcast-admin.ts"` with `define:vars={{ apiUrl: import.meta.env.PUBLIC_BROADCAST_API_URL }}`

- [ ] **Step 3: Create broadcast-admin.ts**

```ts
export function initBroadcastAdmin(apiUrl: string): void {
  const loginEl = document.querySelector<HTMLElement>("#login");
  const formEl = document.querySelector<HTMLElement>("#form");
  const statusEl = document.querySelector<HTMLElement>("#status");

  async function postJson(path: string, body: unknown): Promise<Response> {
    return fetch(`${apiUrl}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  // login button → POST /auth → show form
  // save → FormData → POST /broadcast (credentials include)
  // format time_label in America/Los_Angeles for wife-readable string
  // success message: "Saved! The homepage updates in a few minutes."
  // errors: plain English
}
```

- [ ] **Step 4: Add `.env.example` at repo root**

```
PUBLIC_BROADCAST_API_URL=http://127.0.0.1:8787
```

- [ ] **Step 5: Build with env**

```bash
PUBLIC_BROADCAST_API_URL=http://127.0.0.1:8787 npm run build
```

Expected: PASS; `/crew-chief/update/` in `dist/`

- [ ] **Step 6: Commit**

```bash
git add src/pages/update/index.astro src/scripts/broadcast-admin.ts src/layouts/BaseLayout.astro .env.example
git commit -m "feat: crew broadcast admin page"
```

---

## Task 8: CI + README + runbook

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Modify: `README.md`
- Create: `docs/superpowers/runbooks/broadcast-worker-setup.md`

- [ ] **Step 1: Pass env in deploy workflow**

Before `npm run build`:

```yaml
      - name: Build site
        env:
          PUBLIC_BROADCAST_API_URL: ${{ vars.PUBLIC_BROADCAST_API_URL }}
        run: npm run build
```

Document: Harvey adds repo variable `PUBLIC_BROADCAST_API_URL` = `https://crew-chief-broadcast.<account>.workers.dev` in GitHub → Settings → Secrets and variables → Actions → Variables.

- [ ] **Step 2: Write runbook** (`docs/superpowers/runbooks/broadcast-worker-setup.md`)

Sections (novice-friendly, step-by-step with screenshots described):

1. Create Cloudflare account
2. `cd workers/broadcast && npm install`
3. `npx wrangler login`
4. Generate `SESSION_SIGNING_KEY`: `openssl rand -hex 32`
5. Create GitHub fine-grained PAT (contents write, repo only)
6. `npx wrangler secret put FAMILY_PASSWORD` (and other secrets)
7. `npm run deploy` → copy `*.workers.dev` URL
8. Set GitHub Actions variable `PUBLIC_BROADCAST_API_URL`
9. Push → verify `/crew-chief/update/` loads
10. Test save → check repo for commit → wait for Pages → check homepage
11. Wife bookmark + password

- [ ] **Step 3: Update README** — add “Crew updates (race weekend)” section linking runbook and `/update/`

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml README.md docs/superpowers/runbooks/broadcast-worker-setup.md
git commit -m "docs: broadcast worker setup runbook and CI env"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Deploy Worker to production** (Harvey or agent with credentials)

```bash
cd workers/broadcast && npm run deploy
```

- [ ] **Step 2: Post test update with one small JPEG**

Use `/crew-chief/update/` on phone or browser.

- [ ] **Step 3: Verify GitHub commit** contains `data/race-broadcast.json` + `public/race-updates/*`

- [ ] **Step 4: Wait for Pages deploy** (~3–5 min)

- [ ] **Step 5: Verify homepage + /follow/** show doing, last seen, note, photo

- [ ] **Step 6: Negative tests**

| Action | Expected |
|--------|----------|
| Wrong password | “That password didn’t work.” |
| Save without login | Redirect to login / 401 |
| 6 MB image | “Photo is too large (max 5 MB).” |

- [ ] **Step 7: Final commit** (if any test fixes)

```bash
git commit -m "fix: broadcast e2e polish"  # only if needed
```

---

## Spec coverage checklist

| Req | Task |
|-----|------|
| P1–P5 | Task 6 |
| P6 | `hasBroadcast()` guard |
| P7 | No wife control of phase |
| A1–A9 | Task 7 |
| S1–S5 | Task 5 (server auth), Task 7 (no nav link), Task 8 (secrets) |

---

## Plan self-review (completed)

- No TBD steps; code samples included for core modules.
- Cross-origin cookie documented (`SameSite=None; Secure`).
- GitHub Pages base path `/crew-chief/` reflected in photo URLs.
- Tests scoped to Worker pure functions (project has no Astro test runner).
