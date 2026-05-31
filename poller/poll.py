#!/usr/bin/env python3
"""Poll TrackLeaders and write data/harvey_status.json."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from trackleaders import FetchError, TrackerSnapshot, fetch_tracker_snapshot, preserve_cached_snapshot

DEFAULT_OUTPUT = Path(__file__).resolve().parent.parent / "data" / "harvey_status.json"


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def read_existing(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def simulation_active(path: Path) -> bool:
    existing = read_existing(path)
    return bool(existing and existing.get("simulation") is True)


def status_pinned(path: Path) -> bool:
    """When data/.pin-status exists, cron must not overwrite a hand-set preview file."""
    return (path.parent / ".pin-status").is_file()


def write_snapshot(path: Path, snapshot: TrackerSnapshot) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = snapshot.to_dict()
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def run_poll(*, output_path: Path, dry_run: bool = False, force: bool = False) -> TrackerSnapshot:
    load_env_file(Path(__file__).resolve().parent / ".env")

    if not force and status_pinned(output_path):
        print(
            "Skipping poll: status is pinned (data/.pin-status present). "
            "Remove that file or use --force before race week.",
            file=sys.stderr,
        )
        existing = read_existing(output_path) or {}
        return TrackerSnapshot(
            enabled=bool(existing.get("enabled", False)),
            fetched_at=existing.get("fetched_at") or "",
            race_status=existing.get("race_status", "unknown"),
            last_update_at=existing.get("last_update_at"),
            last_update_label=existing.get("last_update_label"),
            route_mile=existing.get("route_mile"),
            elevation_gain_ft=existing.get("elevation_gain_ft"),
            current_speed_mph=existing.get("current_speed_mph"),
            stale=bool(existing.get("stale", False)),
            source_url=existing.get("source_url", ""),
            error=existing.get("error"),
            data_stale=bool(existing.get("data_stale", False)),
            last_successful_fetch=existing.get("last_successful_fetch"),
        )

    if not force and simulation_active(output_path):
        print(
            "Skipping poll: simulation is active in harvey_status.json "
            "(set POLLER_FORCE=1 or pass --force to override).",
            file=sys.stderr,
        )
        existing = read_existing(output_path) or {}
        return TrackerSnapshot(
            enabled=bool(existing.get("enabled", True)),
            fetched_at=existing.get("fetched_at", ""),
            race_status=existing.get("race_status", "unknown"),
            last_update_at=existing.get("last_update_at"),
            last_update_label=existing.get("last_update_label"),
            route_mile=existing.get("route_mile"),
            elevation_gain_ft=existing.get("elevation_gain_ft"),
            current_speed_mph=existing.get("current_speed_mph"),
            stale=bool(existing.get("stale", False)),
            source_url=existing.get("source_url", ""),
            error=existing.get("error"),
            data_stale=bool(existing.get("data_stale", False)),
            last_successful_fetch=existing.get("last_successful_fetch"),
        )

    event_slug = os.environ.get("TRACKLEADERS_EVENT_SLUG")
    runner_name = os.environ.get("TRACKLEADERS_RUNNER_NAME")
    fallback_url = os.environ.get("TRACKLEADERS_FALLBACK_URL")
    previous = read_existing(output_path)

    snapshot = fetch_tracker_snapshot(
        event_slug=event_slug,
        runner_name=runner_name,
        fallback_url=fallback_url,
    )

    if not snapshot.enabled or snapshot.error:
        if previous and (
            previous.get("last_successful_fetch")
            or (previous.get("enabled") and previous.get("route_mile") is not None)
        ):
            snapshot = preserve_cached_snapshot(
                previous,
                error=snapshot.error or "TrackLeaders fetch failed",
            )
        elif previous:
            snapshot = preserve_cached_snapshot(previous, error=snapshot.error or "TrackLeaders fetch failed")
            snapshot.enabled = False

    if not dry_run:
        write_snapshot(output_path, snapshot)

    return snapshot


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(os.environ.get("HARVEY_STATUS_PATH", DEFAULT_OUTPUT)),
        help="Path to harvey_status.json (default: data/harvey_status.json)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and print result without writing the file",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Poll even when harvey_status.json has simulation: true",
    )
    args = parser.parse_args(argv)

    force = args.force or os.environ.get("POLLER_FORCE", "").strip() in {"1", "true", "yes"}
    snapshot = run_poll(output_path=args.output, dry_run=args.dry_run, force=force)
    if args.dry_run:
        print(json.dumps(snapshot.to_dict(), indent=2))

    if snapshot.data_stale:
        print(f"WARNING: serving cached data ({snapshot.error})", file=sys.stderr)
        return 1

    if snapshot.error and not snapshot.enabled:
        print(f"ERROR: {snapshot.error}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
