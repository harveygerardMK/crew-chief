# Tahoe 200 2026

Trip site for Harvey Schaefer’s [Tahoe 200 Endurance Run](https://www.destinationtrailrun.com/tahoe) — race plan, crew logistics, pacer info, and a simple follow-along page for family and friends.

**Live site:** after you push to GitHub and enable Pages, the URL will be:

`https://<your-github-username>.github.io/tahoe200-2026/`

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

## Local development

```bash
npm install
npm run dev
```

Open the URL printed in the terminal (usually `http://localhost:4321/tahoe200-2026/`).

```bash
npm run build    # output in dist/
npm run preview  # serve the production build locally
```

## Deploy (GitHub Pages)

1. Create a public repo named `tahoe200-2026` on GitHub.
2. Push this project to `main`.
3. In the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` runs on every push to `main`.

If your GitHub username is not `harveyschaefer`, update `site` in `astro.config.mjs` to match your Pages URL.

For a site at the root of `username.github.io`, set `base: '/'` in `astro.config.mjs`.

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
