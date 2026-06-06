# Crew updates in Ask Harvey chat — design spec

**Status:** Approved (2026-06-06, option A)  
**Goal:** Family visiting Ask Harvey at `/` sees Amanda’s crew broadcast updates (text + photos) in the chat message feed. Amanda keeps using the existing `/update/` form — no new posting UI.

---

## Context

- **Broadcast pipeline:** Amanda → Worker `POST /broadcast` → GitHub `data/race-broadcast.json` + `public/race-updates/*` → site rebuild (~3–5 min).
- **Chat:** Static UI at site root; polls FastAPI for tracker status only. No broadcast integration today.
- **Crew site:** `LiveRaceUpdates.astro` already displays the same JSON at build time.

---

## Requirements

| ID | Requirement |
|----|-------------|
| C1 | Chat polls `/data/race-broadcast.json` (static copy at build). |
| C2 | Each unseen update renders as a **crew message** labeled **Amanda** with doing, last seen, note, and photo thumbnails. |
| C3 | On first visit in a tab session, show up to **5** most recent updates (oldest-first in thread). |
| C4 | On poll (~60s), append new updates without duplicating (track `updated_at` in `sessionStorage` + DOM). |
| C5 | Crew updates appear **before** Harvey’s greeting on chat open. |
| C6 | Amanda’s posting flow unchanged (`/update/` + Worker). |

**Out of scope:** Injecting broadcast into Claude prompts; Amanda posting from inside chat; real-time before Pages rebuild.

---

## Architecture

```
Amanda → /update/ → Worker → GitHub (race-broadcast.json)
                                    ↓
                         copy-data.mjs → public/data/race-broadcast.json
                                    ↓
                         ui/app.js polls JSON → msg--crew in #messages
```

---

## UI

- New message role: `.msg--crew`, label **Amanda**, left-aligned (like Harvey).
- Accent bubble color distinct from Harvey/user.
- Photo row: `.crew-photos` with lazy-loaded thumbnails linking to full image.
- Timestamp in `.msg__meta` below bubble.

---

## Files

| File | Change |
|------|--------|
| `scripts/copy-data.mjs` | Copy `race-broadcast.json` |
| `ui/app.js` | Fetch, dedupe, render crew updates; poll interval |
| `ui/styles.css` | `.msg--crew`, `.crew-photos` |
| `ui/index.html` | Bump styles cache-bust query |

---

## Testing

- `npm run build` succeeds; `public/data/race-broadcast.json` present.
- Manual: open chat UI, confirm Amanda test updates render with photos.
