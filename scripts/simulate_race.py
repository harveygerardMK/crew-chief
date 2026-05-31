#!/usr/bin/env python3
"""
Simulate Harvey's Tahoe 200 using Cody's Cocodona ping history.
Replays pings in real time (or compressed) starting from now.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import shutil
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACK_FILE = REPO_ROOT / "data" / "simulation_track.json"
STATUS_FILE = REPO_ROOT / "data" / "harvey_status.json"
BACKUP_FILE = REPO_ROOT / "data" / "harvey_status_real.json"

STALE_SIMULATED_MINUTES = 120  # match poller: 2 hours since last ping
TICK_SECONDS = 60


def iso_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def build_status(ping: dict, *, stale: bool = False, data_stale: bool = False, race_status: str = "active") -> dict:
    now = iso_now()
    return {
        "enabled": True,
        "fetched_at": now,
        "race_status": race_status,
        "last_update_at": now,
        "last_update_label": ping["original_timestamp"],
        "route_mile": ping["route_mile"],
        "elevation_gain_ft": None,
        "current_speed_mph": ping["speed_mph"],
        "stale": stale,
        "source_url": "simulation://cocodona250/cody-delorenzo",
        "data_stale": data_stale,
        "last_successful_fetch": now,
        "simulation": True,
        "simulation_ping": ping["point"],
        "simulation_flag": ping.get("flag"),
        "original_event": "Cocodona 250 2026 - Cody Delorenzo",
    }


def write_status(path: Path, status: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")


def wait_with_stale_updates(
    *,
    wait_seconds: float,
    ping: dict,
    status_path: Path,
    race_status: str,
    dry_run: bool,
    gap_minutes: float,
) -> None:
    if wait_seconds <= 0 or dry_run:
        return

    stale_after_seconds = (STALE_SIMULATED_MINUTES / max(gap_minutes, 1)) * wait_seconds if gap_minutes >= STALE_SIMULATED_MINUTES else None
    deadline = time.time() + wait_seconds
    ping_written_at = time.time()

    while True:
        remaining = deadline - time.time()
        if remaining <= 0:
            break

        sleep_for = min(TICK_SECONDS, remaining)
        time.sleep(sleep_for)

        elapsed = time.time() - ping_written_at
        stale = False
        if stale_after_seconds is not None and elapsed >= stale_after_seconds:
            stale = True
        elif gap_minutes >= STALE_SIMULATED_MINUTES and elapsed >= STALE_SIMULATED_MINUTES * 60:
            stale = True

        if stale:
            write_status(status_path, build_status(ping, stale=True, race_status=race_status))


def run(*, speed: float, dry_run: bool, track_file: Path, status_file: Path) -> None:
    if not track_file.is_file():
        raise SystemExit(
            f"Track file not found: {track_file}\n"
            "Run: python scripts/parse_simulation_track.py"
        )

    with track_file.open(encoding="utf-8") as handle:
        pings = json.load(handle)

    if os.path.exists(status_file) and not os.path.exists(BACKUP_FILE):
        shutil.copy(status_file, BACKUP_FILE)
        print(f"Backed up real status to {BACKUP_FILE}")

    race_start = datetime.datetime.now()
    baseline = pings[0]["minutes_since_start"]
    total_sim_hours = (pings[-1]["minutes_since_start"] - baseline) / 60
    print(f"Simulation start: {race_start.isoformat()}")
    print(f"Speed: {speed}x | {len(pings)} pings | ~{total_sim_hours:.1f} simulated hours")
    print(f"Estimated real duration: {total_sim_hours / speed:.1f} hours")
    print("---")

    prev_minutes = pings[0]["minutes_since_start"]

    for index, ping in enumerate(pings):
        gap_minutes = ping["minutes_since_start"] - prev_minutes
        wait_minutes = gap_minutes / speed
        wait_seconds = wait_minutes * 60

        is_final = index == len(pings) - 1
        race_status = "DNF" if ping.get("flag") == "dnf_zone" and is_final else "active"

        if not dry_run:
            write_status(status_file, build_status(ping, race_status=race_status))

        flag = ping.get("flag", "")
        marker = f" [{flag.upper()}]" if flag else ""
        print(
            f"Ping #{ping['point']:3d} | Mile {ping['route_mile']:6.1f} | "
            f"{ping['speed_mph']:4.1f} mph | +{wait_minutes:.1f}min wait{marker}"
        )

        if wait_seconds > 0 and not is_final:
            wait_with_stale_updates(
                wait_seconds=wait_seconds,
                ping=ping,
                status_path=status_file,
                race_status=race_status,
                dry_run=dry_run,
                gap_minutes=gap_minutes,
            )

        prev_minutes = ping["minutes_since_start"]

        if ping.get("flag") == "dnf_zone" and is_final:
            print("\n=== SIMULATION: DNF ZONE - last ping received ===")
            print("Tracker will now go stale. Testing agent's stale data handling.")
            print("Ctrl+C to stop simulation.")
            if not dry_run:
                status = build_status(ping, stale=True, race_status="DNF")
                while True:
                    status["data_stale"] = True
                    status["last_successful_fetch"] = status["last_update_at"]
                    status["last_update_at"] = iso_now()
                    status["fetched_at"] = iso_now()
                    write_status(status_file, status)
                    time.sleep(300)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--speed",
        type=float,
        default=1.0,
        help="Playback speed multiplier (e.g. 10 = 10x faster)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print ping sequence without writing files or sleeping",
    )
    parser.add_argument("--track", type=Path, default=TRACK_FILE)
    parser.add_argument("--status", type=Path, default=STATUS_FILE)
    args = parser.parse_args(argv)

    if args.speed <= 0:
        print("Speed must be > 0", file=sys.stderr)
        return 1

    run(speed=args.speed, dry_run=args.dry_run, track_file=args.track, status_file=args.status)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
