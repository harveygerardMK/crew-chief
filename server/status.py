"""Load Harvey's current race status from JSON."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_STATUS: dict[str, Any] = {
    "enabled": False,
    "fetched_at": None,
    "race_status": "unknown",
    "last_update_at": None,
    "last_update_label": None,
    "route_mile": None,
    "elevation_gain_ft": None,
    "current_speed_mph": None,
    "stale": False,
    "source_url": "",
    "error": "Status file not found",
    "data_stale": False,
    "last_successful_fetch": None,
}


def load_status(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return dict(DEFAULT_STATUS)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {**DEFAULT_STATUS, "error": "Invalid status JSON"}
    if not isinstance(data, dict):
        return dict(DEFAULT_STATUS)
    return data


def format_status_block(status: dict[str, Any]) -> str:
    lines = [
        "## Current Harvey status (from TrackLeaders poller)",
        f"- Race status: {status.get('race_status', 'unknown')}",
        f"- Route mile: {status.get('route_mile')}",
        f"- Current speed (mph): {status.get('current_speed_mph')}",
        f"- Elevation gain (ft): {status.get('elevation_gain_ft')}",
        f"- Last tracker update: {status.get('last_update_label') or status.get('last_update_at')}",
        f"- GPS stale (>2h since last ping): {status.get('stale', False)}",
        f"- Fetch stale (poller could not refresh): {status.get('data_stale', False)}",
        f"- Last successful fetch: {status.get('last_successful_fetch') or status.get('fetched_at')}",
    ]
    if status.get("error"):
        lines.append(f"- Status note: {status['error']}")
    return "\n".join(lines)
