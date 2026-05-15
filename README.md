# Tahoe 200 2026

Trip site for Harvey Schaefer’s [Tahoe 200 Endurance Run](https://www.destinationtrailrun.com/tahoe) — race plan, crew logistics, pacer info, and a simple follow-along page for family and friends.

**Live site:** https://harveygerardMK.github.io/crew-chief/

**Repo:** https://github.com/harveygerardMK/crew-chief

## What’s here

| Page | Who it’s for |
|------|----------------|
| Home | Countdown + status + quick links |
| Course | Map, narrative, segment table |
| Aid stations | All 13 stops, filterable |
| Crew | Parking, ETAs, restock lists |
| Pacers | Six legs + mandatory gear |
| Gear | Mandatory / recommended / drop bags |
| Schedule | Jun 7–18 race week |
| Follow | Plain-language guide + tracking |

All race facts come from `/data/*.json` — edit JSON, rebuild, deploy. No duplicated numbers in the HTML.

Long-form copy lives in `src/content/pages/` (Astro content collections).

Visual system follows [Mintlify](https://getdesign.md/mintlify/design-md) via root `DESIGN.md` (clean docs UI, mint accent `#00d4a4`, Inter + Geist Mono).

## Local development

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (usually `http://localhost:4321/crew-chief/`).

```bash
npm run build    # output in dist/
npm run preview  # serve the production build locally
```

## Deploy (GitHub Pages)

1. Push this project to `main` on https://github.com/harveygerardMK/crew-chief
2. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**
3. The workflow in `.github/workflows/deploy.yml` runs on every push to `main`

## Updating status during race week

Edit `data/status.json`:

```json
{
  "phase": "on-course",
  "message": "Moving well through the night.",
  "last_seen_station": "Tahoe City",
  "last_seen_time": "Mon 3:15 AM PDT",
  "live_tracking_url": "https://www.destinationtrailrun.com/tahoe"
}
```

- `phase`: `"pre-race"` | `"on-course"` | `"finished"`
- Commit and push — the site redeploys in a few minutes.

Before race week, the home page also shows an automatic countdown to the start (June 12, 2026, 9:00 AM PDT).

## Live tracking

The official tracker goes live closer to race day at [destinationtrailrun.com/tahoe](https://www.destinationtrailrun.com/tahoe). Set `live_tracking_url` in `status.json` when the link is active.

## License

MIT — see [LICENSE](LICENSE).
