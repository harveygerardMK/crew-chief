# Race broadcast admin — design spec

**Status:** Approved (brainstorm 2026-05-26)  
**Author:** Harvey + agent  
**Goal:** Let Harvey’s wife post race updates (text + optional photos) from her phone with one shared password; show updates on the site homepage (and Follow) within a few minutes.

---

## Context

- **Site:** Static Astro site on GitHub Pages (`/crew-chief/`).
- **Today:** `data/status.json` drives `StatusBlock`; updates require editing JSON, commit, push, deploy (~3–5 min).
- **Crew check-ins:** Browser `localStorage` only — not shared, not on homepage.
- **Constraints from Harvey:**
  - Wife technical comfort: **very low** (one page, big fields, one Save).
  - Update cadence: **~aid-station frequency**; a few minutes’ delay is fine.
  - Fields: how he’s doing, last seen station/time, longer family note, optional photos (1–2).
  - Security: **shared password** (not secret-link-only).
  - Harvey: prefers **simplest overall path** (recommended: small backend helper).

---

## Requirements

### Public (family / homepage)

| ID | Requirement |
|----|-------------|
| P1 | Homepage `StatusBlock` (and Follow page) show broadcast content alongside existing status/plan info. |
| P2 | **How he’s doing** — one short line (≤ ~200 chars). |
| P3 | **Last seen** — aid station name + human-readable time (PDT). |
| P4 | **Family note** — optional paragraph (≤ ~500 chars). |
| P5 | **Photos** — 0–2 images; thumbnails on homepage; link or lightbox to full size. |
| P6 | If no broadcast yet, UI unchanged from today (no empty boxes). |
| P7 | Race **phase** (`pre-race` / `on-course` / `finished`) is **not** edited by wife; derived from dates and/or existing `status.json` rules. |

### Admin (wife)

| ID | Requirement |
|----|-------------|
| A1 | Single URL bookmarked on phone (e.g. `/crew-chief/update/`). |
| A2 | First visit: enter **family password** → Continue. |
| A3 | Session cookie remembers auth for the weekend (e.g. 7 days, `HttpOnly`, `Secure`, `SameSite=Lax`). |
| A4 | Form fields map 1:1 to P2–P5; large labels; mobile-first. |
| A5 | Last seen station: dropdown of official aid station names (+ optional “Other” free text if needed). |
| A6 | Time last seen: defaults to “now”; editable. |
| A7 | Photos: optional, max 2 per save, reasonable size limit (e.g. 5 MB each); JPEG/PNG/WebP. |
| A8 | One primary button: **Save update**; clear success message (“Saved — site refreshes in a few minutes”). |
| A9 | Clear error message on wrong password or network failure (plain language). |

### Security (proportionate)

| ID | Requirement |
|----|-------------|
| S1 | Password verified **server-side** only (Cloudflare Worker). |
| S2 | Admin URL not linked from public nav. |
| S3 | GitHub PAT and password stored as Worker secrets, never in repo or client bundle. |
| S4 | Rate-limit POSTs per IP (basic abuse deterrence). |
| S5 | Acknowledged threat model: deters casual abuse, not targeted attack. |

---

## Recommended architecture

**Option 2: Cloudflare Worker + GitHub Contents API** (primary).  
**Fallback:** Google Apps Script + Sheet + Drive if Worker setup is blocked.

```
[Wife phone]  POST multipart   [Cloudflare Worker]
       ↑                              |
       |         session cookie       | validate password
       |                              v
       |                    GitHub API: PUT data/race-broadcast.json
       |                    GitHub API: PUT public/race-updates/*.jpg
       |                              |
       |                              v
       |                    push to main → existing GHA deploy
       v                              |
[Family browser]  GET static site  ←──┘  (~3–5 min)
       reads race-broadcast.json + images at build time
```

### Data model — `data/race-broadcast.json`

```json
{
  "updated_at": "2026-06-14T18:30:00-07:00",
  "updated_by": "crew",
  "doing": "Tired but moving; stomach settled.",
  "last_seen": {
    "station": "Tahoe City",
    "time_label": "Sun 2:15 PM PDT"
  },
  "note": "Sleeping 20 min at Brockway next. Family: no need to drive up until Sunday PM.",
  "photos": [
    {
      "url": "/crew-chief/race-updates/2026-06-14-tahoe-city-1.jpg",
      "alt": "Harvey at Tahoe City aid station"
    }
  ]
}
```

- Separate from `status.json` to avoid wife editing phase/tracker URLs.
- `StatusBlock` merges broadcast into display when `doing` or `last_seen` present.

### Admin UI

- Static Astro page at `src/pages/update/index.astro` (form + client JS).
- Form `POST` targets Worker URL (env var `PUBLIC_BROADCAST_API_URL` at build time).
- Login: `POST /auth` with password → `Set-Cookie` session token (signed, short-lived secret in Worker).
- Save: `POST /broadcast` with cookie + fields + files.

### Worker responsibilities

1. `POST /auth` — check `FAMILY_PASSWORD`, issue signed session cookie.
2. `POST /broadcast` — verify cookie; validate inputs; resize/compress images if needed (optional v1: reject oversized); commit JSON + images via GitHub API; return 200 + `{ ok: true }`.
3. `GET /health` — optional for monitoring.

### GitHub token

- Fine-grained PAT, repository `crew-chief` only, **Contents: Read and write**.
- Stored as Worker secret `GITHUB_TOKEN`.

### Deploy / latency

- Each save creates one commit on `main` (or a dedicated branch merged to main — prefer direct to `main` for simplicity).
- Existing `.github/workflows/deploy.yml` rebuilds site; **target latency 3–5 minutes** (acceptable per Harvey).

### Out of scope (v1)

- Real-time updates without rebuild.
- Multiple user accounts / OAuth.
- Editing playbooks, pacers, course JSON.
- Comments, analytics, email notifications.
- Client-side-only password gate.

---

## UI integration

### `StatusBlock.astro`

- Import `race-broadcast.json` when present.
- On-course: prioritize `doing` as secondary line; `last_seen` overrides or supplements `status.last_seen_*` when broadcast is newer (compare `updated_at` if both exist).
- Show `note` below in a subdued “From crew” box.
- Render `photos` as a horizontal strip (max 2), `loading="lazy"`.

### Pages

- **Home:** extended `StatusBlock` (primary).
- **Follow:** same block (already uses `StatusBlock`).
- **Update:** admin form only; `noindex` meta.

---

## One-time setup (Harvey)

1. Cloudflare account; create Worker `crew-chief-broadcast` (name TBD).
2. Set secrets: `FAMILY_PASSWORD`, `GITHUB_TOKEN`, `SESSION_SIGNING_KEY` (random 32 bytes).
3. Configure Worker route or use `*.workers.dev` URL in Astro env.
4. Add `PUBLIC_BROADCAST_API_URL` to repo / GitHub Actions vars for build.
5. Test: submit dummy update + photo; verify commit; verify homepage after deploy.
6. Wife: bookmark `/crew-chief/update/`; share password verbally.

**Estimated setup time:** 1–2 hours first time with a written runbook.

---

## Fallback: Google Apps Script

Use only if Cloudflare is unacceptable:

- Apps Script web app: password in Script Properties, form UI, writes Sheet row + Drive folder for images.
- Homepage: client-side `fetch` to Script `doGet` JSON endpoint during race week.
- Tradeoffs: less integrated styling, Google dependency, weaker photo story, no commit trail in repo.

---

## Testing

| Test | Expected |
|------|----------|
| Wrong password | 401, friendly message |
| Valid save, text only | Commit updates `race-broadcast.json`; deploy; homepage shows text |
| Valid save with 2 photos | Images in `public/race-updates/`; URLs in JSON |
| Save without auth cookie | 401 |
| Oversized image | 413 with clear message |
| No broadcast file | Homepage unchanged |

---

## Open decisions (defaults chosen)

| Topic | Decision |
|-------|----------|
| Image storage | In-repo under `public/race-updates/` via GitHub API |
| Commit message | `broadcast: update from crew` (automated) |
| Image processing | v1: reject >5 MB; v2 optional resize in Worker |
| Branch | Commit directly to `main` |

---

## Success criteria

- Wife can post an update in **under 2 minutes** on LTE without instructions beyond bookmark + password.
- Family on homepage sees new text/photos after **one refresh post-deploy** (~5 min).
- No secrets in git history or public HTML.
- Existing site pages and JSON-driven plan data unchanged unless broadcast present.
