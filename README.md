# Harvey's Tahoe 200 (2026)

Trip site for **Harvey Schaefer** running the [Tahoe 200 Endurance Run](https://www.destinationtrailrun.com/tahoe) — race plan, crew playbooks, pacer info, and a page for family. **Tahoe 200 only** (not Leadville or other events).

**Live site:** https://wheresharvey.com/

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
| Schedule | Plan | Jun 11–17 check-in through bag pickup |
| Pacers | Pacers | Four legs + mandatory gear |
| Follow | Follow | Family — see Harvey, tracker tips |

All race facts come from `/data/*.json` — edit JSON, rebuild, deploy. No duplicated numbers in the HTML.

Long-form copy lives in `src/content/pages/` (Astro content collections).


## Ask Harvey (chat agent)

Friends and family can talk to a conversational agent during race week:

**https://wheresharvey.com/** (after deploy; `/agent/` still works)

Setup and ops: [docs/superpowers/runbooks/crew-chief-agent-deploy.md](docs/superpowers/runbooks/crew-chief-agent-deploy.md) · [project status](docs/crew-chief-agent-status.md) · [race week](docs/superpowers/runbooks/crew-chief-agent-race-week.md)

```bash
npm run agent:verify   # smoke test live API (needs PUBLIC_AGENT_API_URL)
```

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

Amanda posts **how you’re doing**, **last seen**, a **note**, and **photos** from one bookmark:

**https://crew-chief-broadcast.harvey-schaefer.workers.dev/update**

(`https://wheresharvey.com/update/` redirects there.) Family sees updates in **Ask Harvey chat** after a normal deploy (~3–5 minutes).

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

### Where's Harvey? (on-course module)

When the race is on-course, the home page and Follow page show a **Where's Harvey?** panel instead of the T-minus countdown. It polls TrackLeaders every ~60 seconds via the broadcast Worker and shows:

- Last beacon ping, miles run / remaining, next aid station, elevation climbed
- An **Art but make it sports** pairing ([ArtButMakeItSports](https://www.artbutmakeitsports.com/) riff): thumbnail + caption from time, weather, pace, and aid context

**Race-week setup:**

1. Find Harvey's TrackLeaders event slug and SPOT display name on the live map sidebar (same system as [Cocodona tracking](https://trackleaders.com/cocodona26f.php)).
2. Set Worker vars and redeploy:
   ```bash
   cd workers/broadcast
   npx wrangler secret put TRACKLEADERS_EVENT_SLUG   # e.g. tahoe200-26
   npx wrangler secret put TRACKLEADERS_RUNNER_NAME  # exact sidebar name, spaces → underscores in URL
   npx wrangler deploy
   ```
3. Verify: `curl https://crew-chief-broadcast.harvey-schaefer.workers.dev/tracker`
4. Set `status.json` → `"phase": "on-course"` and `live_tracking_url` to the public map URL.

Optional site env var `PUBLIC_TRACKER_API_URL` overrides the default Worker `/tracker` URL (for local dev).

**Preview (unlisted):** [Where's Harvey preview](https://harveygerardMK.github.io/crew-chief/preview/wheres-harvey/) — `noindex`, not in nav. Default **Demo stats** needs no TrackLeaders setup; switch to **Live worker** to test `/tracker` before race day.

To test the parser before Tahoe goes live, point the Worker at a known event (e.g. `copper26` / `Trailbreaker_1`).

## License

MIT — see [LICENSE](LICENSE).
