"""Tests for TrackLeaders parsing — mirrors workers/broadcast/src/trackleaders.test.ts."""

from __future__ import annotations

import json
from datetime import timezone

UTC = timezone.utc
from unittest.mock import patch

import pytest

from trackleaders import (
    FetchError,
    fetch_tracker_snapshot,
    parse_track_leaders_time,
    preserve_cached_snapshot,
)


def test_parse_track_leaders_time_akst() -> None:
    parsed = parse_track_leaders_time("05:02:05 PM (AKST) 01/12/26")
    assert parsed is not None
    assert parsed.year == 2026


def test_parse_track_leaders_time_garbage() -> None:
    assert parse_track_leaders_time("soon") is None


def test_fetch_disabled_when_env_empty() -> None:
    snapshot = fetch_tracker_snapshot(event_slug=None, runner_name=None, fallback_url=None)
    assert snapshot.enabled is False


def test_parses_trackleaders_status_json() -> None:
    payload = {
        "data": [
            ["Race Status", "Active"],
            ["Last Update Rec'd", "05:02:05 PM (AKST) 01/12/26"],
            ["Route mile", "281.7 mi"],
            ["Elevation Gain", "10840 ft"],
            ["Current speed", "0.0 mph"],
        ]
    }

    def fake_http_get_json(url: str) -> dict:
        return payload

    with patch("trackleaders._http_get_json", side_effect=fake_http_get_json):
        snapshot = fetch_tracker_snapshot(
            event_slug="copper26",
            runner_name="Trailbreaker_1",
        )

    assert snapshot.enabled is True
    assert snapshot.route_mile == 281.7
    assert snapshot.elevation_gain_ft == 10840
    assert snapshot.current_speed_mph == 0.0
    assert snapshot.race_status == "active"
    assert snapshot.data_stale is False
    assert snapshot.last_successful_fetch is not None


def test_preserve_cached_snapshot_on_failure() -> None:
    previous = {
        "enabled": True,
        "fetched_at": "2026-06-12T10:00:00Z",
        "race_status": "active",
        "last_update_at": "2026-06-12T09:55:00Z",
        "last_update_label": "05:02:05 PM (AKST) 01/12/26",
        "route_mile": 87.2,
        "elevation_gain_ft": 12000,
        "current_speed_mph": 3.1,
        "stale": False,
        "source_url": "https://trackleaders.com/spot/tahoe20026/Harvey_Schaefer-status.json",
        "last_successful_fetch": "2026-06-12T10:00:00Z",
    }

    snapshot = preserve_cached_snapshot(previous, error="HTTP 503 from TrackLeaders")
    assert snapshot.data_stale is True
    assert snapshot.route_mile == 87.2
    assert snapshot.last_successful_fetch == "2026-06-12T10:00:00Z"
    assert snapshot.error == "HTTP 503 from TrackLeaders"


def test_html_fallback_when_json_missing() -> None:
    html = """
    <table>
      <tr><td>Race Status</td><td>Active</td></tr>
      <tr><td>Last Update Rec'd</td><td>05:02:05 PM (AKST) 01/12/26</td></tr>
      <tr><td>Route mile</td><td>42.0 mi</td></tr>
      <tr><td>Elevation Gain</td><td>5000 ft</td></tr>
      <tr><td>Current speed</td><td>2.5 mph</td></tr>
    </table>
    """

    def fake_http_get_json(url: str) -> dict:
        raise FetchError("HTTP 404")

    def fake_http_get_text(url: str) -> str:
        return html

    with patch("trackleaders._http_get_json", side_effect=fake_http_get_json):
        with patch("trackleaders._http_get_text", side_effect=fake_http_get_text):
            snapshot = fetch_tracker_snapshot(
                event_slug="tahoe20026",
                runner_name="Harvey Schaefer",
            )

    assert snapshot.enabled is True
    assert snapshot.route_mile == 42.0
    assert "tahoe20026" in snapshot.source_url
