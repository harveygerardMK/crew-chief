# Cursor Prompt — Race Simulation Mode

## What this is

Build a simulation mode for the Ask Harvey agent that replays Cody Delorenzo's real Cocodona 250 ping history as if Harvey's Tahoe 200 were starting right now. This lets us stress-test the full system — agent responses, stale data banners, art cards, return visit catch-ups — before June 12.

The simulation uses real SPOT tracker data: 623 pings over ~65 hours, ending in a DNF at mile 124.5. Every gap, every rest stop, every canyon blackout is real.

---

## The data

Parse the ping history below into `data/simulation_track.json`. Each entry should have:

```json
{
  "point": 1,
  "original_timestamp": "06:02:20 AM (MST) 05/04/26",
  "minutes_since_start": 62,
  "lat": 34.050310,
  "lng": -112.185500,
  "route_mile": 4.7,
  "speed_mph": 0.0,
  "distance_ft": 0
}
```

**Race start:** Point #1 = 06:02:20 AM MST 05/04/26 = minute 0 (approximately — use `0d01h02m since start` to calculate: start was ~05:00 AM MST 05/04/26)

**Key events to flag in the JSON:**

| Point range | Miles | What's happening |
|-------------|-------|-----------------|
| 1-16 | 4.7–10.7 | Moving well, early miles |
| 197-207 | ~51.1 | Long stop, ~60 min — likely aid station |
| 241 | 59.4 | 65-min gap (points 240→241) — signal blackout |
| 248-249 | 61.6 | 70-min gap — sleep/rest |
| 269-270 | 67.7 | 75-min gap — sleep (1h 15m) |
| 299-307 | 75.8 | Extended stop, ~40 min |
| 333-366 | 83.0 | Long stop, ~90 min — sleep station |
| 348 | 83.8 | Last moving ping before sleep |
| 372 | 84.7 | 25-min gap — resuming after sleep |
| 411-426 | 96.9 | Very long stop, ~75 min |
| 456 | 100.9 | Last ping before 65-min gap |
| 480 | 102.8 | Resumes — gap was 65 min |
| 492-527 | 107.5 | Longest stop, ~100 min — likely sleep station |
| 568-623 | 124.5–126.2 | DNF zone — stopped at ~124.5 for hours, last ping at 126.2 |

Add a `"flag"` field to notable points: `"sleep_station"`, `"signal_gap"`, `"dnf_zone"`, `"aid_station"`.

---

## The simulation runner

Create `scripts/simulate_race.py`:

```python
#!/usr/bin/env python3
"""
Simulate Harvey's Tahoe 200 using Cody's Cocodona ping history.
Replays pings in real time (or compressed) starting from now.
"""
import json, time, argparse, datetime, shutil, os

TRACK_FILE = "data/simulation_track.json"
STATUS_FILE = "data/harvey_status.json"
BACKUP_FILE = "data/harvey_status_real.json"

def run(speed=1.0, dry_run=False):
    with open(TRACK_FILE) as f:
        pings = json.load(f)
    
    # Back up real status file if it exists
    if os.path.exists(STATUS_FILE) and not os.path.exists(BACKUP_FILE):
        shutil.copy(STATUS_FILE, BACKUP_FILE)
        print(f"Backed up real status to {BACKUP_FILE}")
    
    race_start = datetime.datetime.now()
    print(f"Simulation start: {race_start.isoformat()}")
    print(f"Speed: {speed}x | {len(pings)} pings | ~{pings[-1]['minutes_since_start']/60:.1f} simulated hours")
    print(f"Estimated real duration: {pings[-1]['minutes_since_start']/speed/60:.1f} hours")
    print("---")
    
    prev_minutes = 0
    
    for i, ping in enumerate(pings):
        # How long to wait before emitting this ping
        wait_minutes = (ping['minutes_since_start'] - prev_minutes) / speed
        wait_seconds = wait_minutes * 60
        
        if wait_seconds > 0 and not dry_run:
            time.sleep(wait_seconds)
        
        # Build harvey_status.json from this ping
        elapsed_hours = ping['minutes_since_start'] / 60
        status = {
            "runner": "Harvey Schaefer",
            "race": "Tahoe 200 Endurance Run 2026",
            "race_status": "DNF" if ping.get('flag') == 'dnf_zone' and i == len(pings)-1 else "active",
            "last_update": datetime.datetime.now().isoformat(),
            "route_mile": ping['route_mile'],
            "current_speed": ping['speed_mph'],
            "elevation_gain": None,  # not in Cody's data
            "current_elevation": None,
            "moving_average_speed": round(ping['route_mile'] / elapsed_hours, 1) if elapsed_hours > 0 else 0,
            "elapsed_hours": round(elapsed_hours, 2),
            "data_stale": False,
            "simulation": True,
            "simulation_ping": ping['point'],
            "simulation_flag": ping.get('flag'),
            "original_event": "Cocodona 250 2026 - Cody Delorenzo"
        }
        
        if not dry_run:
            with open(STATUS_FILE, 'w') as f:
                json.dump(status, f, indent=2)
        
        # Log notable moments
        flag = ping.get('flag', '')
        marker = f" [{flag.upper()}]" if flag else ""
        print(f"Ping #{ping['point']:3d} | Mile {ping['route_mile']:6.1f} | {ping['speed_mph']:4.1f} mph | +{wait_minutes:.1f}min wait{marker}")
        
        prev_minutes = ping['minutes_since_start']
        
        # DNF: after last ping, write stale data and stop
        if ping.get('flag') == 'dnf_zone' and i == len(pings) - 1:
            print("\n=== SIMULATION: DNF ZONE - last ping received ===")
            print("Tracker will now go stale. Testing agent's stale data handling.")
            print("Ctrl+C to stop simulation.")
            if not dry_run:
                while True:
                    # Keep file but mark stale
                    status['data_stale'] = True
                    status['last_successful_fetch'] = status['last_update']
                    status['last_update'] = datetime.datetime.now().isoformat()
                    with open(STATUS_FILE, 'w') as f:
                        json.dump(status, f, indent=2)
                    time.sleep(300)  # update timestamp every 5 min

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--speed', type=float, default=1.0, help='Playback speed multiplier (e.g. 10 = 10x faster)')
    parser.add_argument('--dry-run', action='store_true', help='Print ping sequence without writing files or sleeping')
    args = parser.parse_args()
    run(speed=args.speed, dry_run=args.dry_run)
```

---

## Simulation badge in the UI

When `harvey_status.simulation === true`, show a dismissible banner below the status strip:

```
SIMULATION MODE — Replaying Cocodona 250 data · Not Harvey's real location
```

Style it amber, smaller than the signal gap banner. Dismissible with an X. Don't show it in production (when `simulation` is absent or false).

---

## Restore script

Create `scripts/restore_real_status.py`:

```python
#!/usr/bin/env python3
"""Restore real harvey_status.json after simulation."""
import os, shutil

BACKUP = "data/harvey_status_real.json"
STATUS = "data/harvey_status.json"

if os.path.exists(BACKUP):
    shutil.copy(BACKUP, STATUS)
    os.remove(BACKUP)
    print("Restored real status file.")
else:
    print("No backup found.")
```

---

## How to run

```bash
# Dry run — see the full ping sequence and timing without writing files
python scripts/simulate_race.py --dry-run

# Real-time simulation (65 hours of actual pings)
python scripts/simulate_race.py

# 10x compressed (6.5 hours to run through the whole race)
python scripts/simulate_race.py --speed 10

# 60x compressed (~65 minutes to run through everything)
python scripts/simulate_race.py --speed 60

# Restore real data after simulation
python scripts/restore_real_status.py
```

---

## What to test during simulation

| What to watch | When |
|--------------|------|
| Status strip updates live | All pings |
| Speed shows 0.0 at rest stops | Points 197-207, 299-307, 411-426, 492-527 |
| Stale data banner fires | When gap between pings > 2 hours (points 241, 480) |
| Agent says "last known position" language | During stale gaps |
| Art card triggers on "how is he doing" | Throughout |
| Return visit catch-up math | Check in at mile 50, come back at mile 80 |
| DNF handling | After point 623 |
| Agent never says "DNF" until status says so | During the long DNF-zone stop at 124.5 |

---

## Ping data to parse

The full 623-ping dataset is in the conversation context — it was scraped from `Cody_Delorenzo.js` at TrackLeaders. Parse from the `imarker` popup HTML strings. Each popup contains:

- `Point #N received at: [timestamp]`
- `(Xd YhZm since start)`  
- `[distance] traveled at [speed] mph`
- `Route mile [X] mi`
- Lat/lng from `L.marker([lat, lng]`

Write a one-time parse script (`scripts/parse_simulation_track.py`) that extracts all 623 pings from the raw JS and writes `data/simulation_track.json`. The JS is available as the `addHistoryPoints()` function in the scraped file.

---

## Notes

- The simulation writes to `data/harvey_status.json` — same file the real poller writes to. The backend reads this file and serves it unchanged.
- No changes to the backend API, voice.md, or UI needed beyond the simulation banner.
- Run on the droplet or locally — wherever the backend is running.
- The `simulation: true` flag in the JSON tells the UI to show the banner. The agent itself doesn't need to know it's a simulation — let it respond naturally to the data it sees.

---

*Built for pre-race testing · June 2026 · Don't forget to run restore_real_status.py when done*
