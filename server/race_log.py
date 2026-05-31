"""Append-only race logs: questions.json and notes.json (for Harvey after the race)."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UTC = timezone.utc


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _append_json(path: Path, entry: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = []
    else:
        data = []
    if not isinstance(data, list):
        data = []
    data.append(entry)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def log_question(
    path: Path,
    *,
    visitor_name: str,
    relationship: str,
    harvey_mile_at_time: float | None,
    message: str,
    response_summary: str,
) -> None:
    _append_json(
        path,
        {
            "timestamp": _iso_now(),
            "visitor_name": visitor_name,
            "relationship": relationship,
            "harvey_mile_at_time": harvey_mile_at_time,
            "message": message,
            "response_summary": response_summary[:100],
        },
    )


def log_note(
    path: Path,
    *,
    visitor_name: str,
    relationship: str,
    note_text: str,
    harvey_mile_at_time: float | None,
) -> None:
    _append_json(
        path,
        {
            "timestamp": _iso_now(),
            "visitor_name": visitor_name,
            "relationship": relationship,
            "note_text": note_text.strip(),
            "harvey_mile_at_time": harvey_mile_at_time,
        },
    )
