"""Poller skips writes while simulation is active."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import poll


def test_poll_skips_when_simulation_active(tmp_path: Path) -> None:
    output = tmp_path / "harvey_status.json"
    output.write_text(
        json.dumps(
            {
                "enabled": True,
                "simulation": True,
                "route_mile": 51.1,
                "race_status": "active",
                "fetched_at": "2026-06-12T12:00:00Z",
            }
        ),
        encoding="utf-8",
    )

    with patch.object(poll, "fetch_tracker_snapshot") as fetch:
        snap = poll.run_poll(output_path=output, dry_run=False, force=False)
        fetch.assert_not_called()

    assert snap.route_mile == 51.1
    assert json.loads(output.read_text())["simulation"] is True


def test_poll_skips_when_status_pinned(tmp_path: Path) -> None:
    output = tmp_path / "harvey_status.json"
    (tmp_path / ".pin-status").write_text("", encoding="utf-8")
    output.write_text(
        json.dumps(
            {
                "enabled": False,
                "route_mile": 0,
                "race_status": "anxious",
                "last_update_label": "none",
            }
        ),
        encoding="utf-8",
    )

    with patch.object(poll, "fetch_tracker_snapshot") as fetch:
        snap = poll.run_poll(output_path=output, dry_run=False, force=False)
        fetch.assert_not_called()

    assert snap.route_mile == 0
    assert snap.race_status == "anxious"


def test_poll_force_overrides_simulation(tmp_path: Path) -> None:
    output = tmp_path / "harvey_status.json"
    output.write_text(json.dumps({"simulation": True, "route_mile": 1.0}), encoding="utf-8")

    fake = poll.TrackerSnapshot(
        enabled=True,
        fetched_at="2026-06-12T12:00:00Z",
        race_status="active",
        last_update_at=None,
        last_update_label=None,
        route_mile=99.0,
        elevation_gain_ft=None,
        current_speed_mph=3.0,
        stale=False,
        source_url="https://example.com",
    )

    with patch.object(poll, "fetch_tracker_snapshot", return_value=fake):
        snap = poll.run_poll(output_path=output, dry_run=True, force=True)

    assert snap.route_mile == 99.0
