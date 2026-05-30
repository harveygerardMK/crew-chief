# TrackLeaders poller

Python cron job that fetches Harvey's TrackLeaders stats and writes `data/harvey_status.json`. Uses the same **TrackerSnapshot** shape as `workers/broadcast/src/trackleaders.ts` (plus `data_stale` and `last_successful_fetch` for fetch failures).

## Setup

```bash
cd poller
cp .env.example .env
# Edit .env when the Tahoe 200 TrackLeaders page goes live
pip install -r requirements-dev.txt   # pytest only; runtime uses stdlib
```

## Run once

```bash
python poll.py
```

Dry run (print JSON, do not write file):

```bash
python poll.py --dry-run
```

## Cron (every 5 minutes on the droplet)

```cron
*/5 * * * * cd /path/to/crew-chief/poller && python3 poll.py >> /var/log/harvey-poller.log 2>&1
```

## Configuration

| Variable | Purpose |
|----------|---------|
| `TRACKLEADERS_EVENT_SLUG` | Event slug, e.g. `tahoe20026` |
| `TRACKLEADERS_RUNNER_NAME` | Sidebar name, e.g. `Harvey Schaefer` |
| `TRACKLEADERS_FALLBACK_URL` | Full runner page URL if slug is not yet known |
| `HARVEY_STATUS_PATH` | Output file (default: `data/harvey_status.json`) |

**TrackLeaders-first:** tries JSON (`/spot/{slug}/{Runner}-status.json`), then HTML (`/{slug}i.php?name=...`), then optional fallback URL.

## Failure behavior

- If TrackLeaders is unreachable, the poller **keeps the last good snapshot** and sets `data_stale: true` with `last_successful_fetch`.
- Never deletes valid cached race data.
- Exit code `1` when serving stale cache (useful for log monitoring); `0` on fresh fetch.

## Stale threshold

GPS staleness (`stale: true`) uses a **2-hour** window — more forgiving than the broadcast Worker's 65 minutes, appropriate for the chat agent.

## Tests

```bash
cd poller
python -m pytest -q
```

## Pre-race testing

Before Tahoe goes live, point at a known event (same as the broadcast Worker runbook):

```bash
TRACKLEADERS_EVENT_SLUG=copper26 TRACKLEADERS_RUNNER_NAME=Trailbreaker_1 python poll.py --dry-run
```
