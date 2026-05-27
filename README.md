# Harvey's Tahoe 200 (2026)

Trip site for **Harvey Schaefer** running the [Tahoe 200 Endurance Run](https://www.destinationtrailrun.com/tahoe) — race plan, crew playbooks, pacer info, and a page for family. **Tahoe 200 only** (not Leadville or other events).

**Live site:** https://harveygerardMK.github.io/crew-chief/

**Repo:** https://github.com/harveygerardMK/crew-chief

## What's here

**Nav:** Home · **Crew** (Next stop, Board, Guide, Aid) · **Plan** (Course, Gear, Schedule) · **Pacers** · **Follow**

| Page | Category | Who it's for |
|------|----------|----------------|
| Home | — | Countdown + status + quick links by category |
| Next stop | Crew | Leave-by, Maps, mark Harvey arrived |
| Race board | Crew | Planned vs actual at every aid |
| Crew guide | Crew | Playbooks, parking, ETAs |
| Aid stations | Crew | All 13 stops, filterable |
| Course | Plan | Map, narrative, segments |
| Gear | Plan | Mandatory / recommended / drop bags |
| Schedule | Plan | Jun 7–18 race week |
| Pacers | Pacers | Six legs + mandatory gear |
| Follow | Follow | Family — see Harvey, tracker tips |

All race facts come from `/data/*.json` — edit JSON, rebuild, deploy. No duplicated numbers in the HTML.

Long-form copy lives in `src/content/pages/` (Astro content collections).

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

## Crew updates for family (race weekend)

Your wife can post **how you’re doing**, **last seen**, a **note**, and **photos** from:

**https://harveygerardmk.github.io/crew-chief/update/**

Homepage and Follow show updates after a normal deploy (~3–5 minutes).

**One-time setup (Harvey):** [docs/superpowers/runbooks/broadcast-worker-setup.md](docs/superpowers/runbooks/broadcast-worker-setup.md)

Harvey can still edit `data/status.json` for phase (`pre-race` / `on-course` / `finished`) and tracker URL.

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

The official Tahoe 200 tracker goes live closer to race day at [destinationtrailrun.com/tahoe](https://www.destinationtrailrun.com/tahoe). Set `live_tracking_url` in `status.json` when the link is active.

## License

MIT — see [LICENSE](LICENSE).
