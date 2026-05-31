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
import signal
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TRACK_FILE = REPO_ROOT / "data" / "simulation_track.json"
STATUS_FILE = REPO_ROOT / "data" / "harvey_status.json"
BACKUP_FILE = REPO_ROOT / "data" / "harvey_status_real.json"

STALE_SIMULATED_MINUTES = 120  # match poller: 2 hours since last ping
STALE_INJECT_GAP_MINUTES = 45  # inject stale during shorter gaps at high speed
STALE_INJECT_AFTER_SECONDS = 15  # real seconds into a gap before marking stale
TICK_SECONDS = 15

CHAPTERS: dict[str, int] = {
    "early": 1,
    "aid-station": 197,
    "signal-gap": 241,
    "sleep": 333,
    "dnf": 568,
}


def iso_now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def build_status(
    ping: dict,
    *,
    stale: bool = False,
    data_stale: bool = False,
    race_status: str = "active",
) -> dict:
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


def slice_pings(
    pings: list[dict],
    *,
    from_ping: int | None = None,
    from_mile: float | None = None,
    chapter: str | None = None,
) -> list[dict]:
    start_point = from_ping
    if chapter:
        if chapter not in CHAPTERS:
            raise SystemExit(f"Unknown chapter {chapter!r}. Choose from: {', '.join(CHAPTERS)}")
        start_point = CHAPTERS[chapter]
    if from_mile is not None:
        for row in pings:
            if row["route_mile"] >= from_mile:
                start_point = row["point"]
                break
        else:
            raise SystemExit(f"No ping at or after mile {from_mile}")
    if start_point is None:
        return pings
    return [p for p in pings if p["point"] >= start_point]


def should_inject_stale(*, gap_minutes: float, next_ping: dict | None, inject_stale: bool) -> bool:
    if not inject_stale or gap_minutes <= 0:
        return False
    if gap_minutes >= STALE_SIMULATED_MINUTES:
        return True
    if gap_minutes >= STALE_INJECT_GAP_MINUTES:
        return True
    if next_ping and next_ping.get("flag") == "signal_gap":
        return True
    return False


def wait_with_stale_updates(
    *,
    wait_seconds: float,
    ping: dict,
    next_ping: dict | None,
    status_path: Path,
    race_status: str,
    dry_run: bool,
    gap_minutes: float,
    inject_stale: bool,
) -> None:
    if wait_seconds <= 0 or dry_run:
        return

    inject = should_inject_stale(gap_minutes=gap_minutes, next_ping=next_ping, inject_stale=inject_stale)
    stale_after_seconds = STALE_SIMULATED_MINUTES * 60 if gap_minutes >= STALE_SIMULATED_MINUTES else None
    if inject and stale_after_seconds is None:
        stale_after_seconds = min(STALE_INJECT_AFTER_SECONDS, max(1.0, wait_seconds * 0.2))

    deadline = time.time() + wait_seconds
    ping_written_at = time.time()
    stale_marked = False

    while True:
        remaining = deadline - time.time()
        if remaining <= 0:
            break

        sleep_for = min(TICK_SECONDS, remaining)
        time.sleep(sleep_for)

        elapsed = time.time() - ping_written_at
        if stale_marked:
            continue

        mark_stale = False
        if stale_after_seconds is not None and elapsed >= stale_after_seconds:
            mark_stale = True
        elif gap_minutes >= STALE_SIMULATED_MINUTES and elapsed >= STALE_SIMULATED_MINUTES * 60:
            mark_stale = True

        if mark_stale:
            write_status(status_path, build_status(ping, stale=True, race_status=race_status))
            stale_marked = True


def backup_status(status_file: Path) -> None:
    if status_file.is_file() and not BACKUP_FILE.is_file():
        shutil.copy(status_file, BACKUP_FILE)
        print(f"Backed up real status to {BACKUP_FILE}")


def restore_status(status_file: Path = STATUS_FILE) -> bool:
    if not BACKUP_FILE.is_file():
        return False
    shutil.copy(BACKUP_FILE, status_file)
    BACKUP_FILE.unlink()
    print(f"Restored real status to {status_file}")
    return True


def run(
    *,
    speed: float,
    dry_run: bool,
    track_file: Path,
    status_file: Path,
    from_ping: int | None,
    from_mile: float | None,
    chapter: str | None,
    inject_stale: bool,
    auto_restore: bool,
) -> None:
    if not track_file.is_file():
        raise SystemExit(
            f"Track file not found: {track_file}\n"
            "Run: python scripts/parse_simulation_track.py"
        )

    with track_file.open(encoding="utf-8") as handle:
        all_pings = json.load(handle)

    pings = slice_pings(
        all_pings,
        from_ping=from_ping,
        from_mile=from_mile,
        chapter=chapter,
    )
    if not pings:
        raise SystemExit("No pings matched the start filter.")

    if not dry_run:
        backup_status(status_file)

    race_start = datetime.datetime.now()
    baseline = pings[0]["minutes_since_start"]
    end_baseline = all_pings[0]["minutes_since_start"]
    total_sim_hours = (all_pings[-1]["minutes_since_start"] - end_baseline) / 60
    slice_sim_hours = (pings[-1]["minutes_since_start"] - baseline) / 60

    print(f"Simulation start: {race_start.isoformat()}")
    print(f"Speed: {speed}x | {len(pings)} pings (of {len(all_pings)} total)")
    if chapter or from_ping or from_mile:
        label = chapter or from_ping or from_mile
        print(f"Chapter: starting at ping #{pings[0]['point']} (mile {pings[0]['route_mile']:.1f}) — filter {label}")
    print(f"Slice duration: ~{slice_sim_hours:.1f} sim hours | full track ~{total_sim_hours:.1f} sim hours")
    print(f"Estimated real duration: {slice_sim_hours / speed:.1f} hours")
    print(f"Stale injection: {'on' if inject_stale else 'off'}")
    print("---")

    prev_minutes = pings[0]["minutes_since_start"]

    try:
        for index, ping in enumerate(pings):
            gap_minutes = ping["minutes_since_start"] - prev_minutes
            wait_minutes = gap_minutes / speed
            wait_seconds = wait_minutes * 60

            is_final = index == len(pings) - 1
            race_status = "DNF" if ping.get("flag") == "dnf_zone" and is_final else "active"
            next_ping = pings[index + 1] if not is_final else None

            if not dry_run:
                write_status(status_file, build_status(ping, race_status=race_status))

            flag = ping.get("flag", "")
            marker = f" [{flag.upper()}]" if flag else ""
            print(
                f"Ping #{ping['point']:3d} | Mile {ping['route_mile']:6.1f} | "
                f"{ping['speed_mph']:4.1f} mph | +{wait_minutes:.1f}min wait{marker}",
                flush=True,
            )

            if wait_seconds > 0 and not is_final:
                wait_with_stale_updates(
                    wait_seconds=wait_seconds,
                    ping=ping,
                    next_ping=next_ping,
                    status_path=status_file,
                    race_status=race_status,
                    dry_run=dry_run,
                    gap_minutes=gap_minutes,
                    inject_stale=inject_stale,
                )

            prev_minutes = ping["minutes_since_start"]

            if ping.get("flag") == "dnf_zone" and is_final:
                print("\n=== SIMULATION: DNF ZONE - last ping received ===")
                print("Tracker will now go stale. Testing agent stale data handling.")
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
    except KeyboardInterrupt:
        print("\nSimulation interrupted.")
        if auto_restore and not dry_run:
            restore_status(status_file)
        raise SystemExit(0)

    print("\nSimulation complete.")
    if auto_restore and not dry_run:
        restore_status(status_file)
    else:
        print(f"Run: python scripts/restore_real_status.py")


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
    parser.add_argument("--from-ping", type=int, help="Start at this point number")
    parser.add_argument("--from-mile", type=float, help="Start at first ping at or after this mile")
    parser.add_argument(
        "--chapter",
        choices=sorted(CHAPTERS.keys()),
        help=f"Jump to a named chapter ({', '.join(f'{k}=#{v}' for k, v in CHAPTERS.items())})",
    )
    parser.add_argument(
        "--no-inject-stale",
        action="store_true",
        help="Do not mark stale during long gaps (for raw replay only)",
    )
    parser.add_argument(
        "--no-auto-restore",
        action="store_true",
        help="Keep simulation status file after exit (default: restore backup on finish/Ctrl+C)",
    )
    args = parser.parse_args(argv)

    if args.speed <= 0:
        print("Speed must be > 0", file=sys.stderr)
        return 1

    if sum(x is not None for x in (args.from_ping, args.from_mile, args.chapter)) > 1:
        print("Use only one of --from-ping, --from-mile, --chapter", file=sys.stderr)
        return 1

    def handle_signal(signum: int, _frame: object) -> None:
        print("\nSimulation stopped.")
        if not args.dry_run and not args.no_auto_restore:
            restore_status(args.status)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    run(
        speed=args.speed,
        dry_run=args.dry_run,
        track_file=args.track,
        status_file=args.status,
        from_ping=args.from_ping,
        from_mile=args.from_mile,
        chapter=args.chapter,
        inject_stale=not args.no_inject_stale,
        auto_restore=not args.no_auto_restore,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
