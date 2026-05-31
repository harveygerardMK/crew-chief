"""Mile → place context, catch-up summaries, and signal-gap copy."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

from config import REPO_ROOT, Settings

UTC = timezone.utc
RACE_DISTANCE_MILES = 200.4


def _resolve_data_path(path: str) -> Path:
    p = Path(path)
    if p.is_absolute():
        return p
    return REPO_ROOT / path


@lru_cache(maxsize=1)
def _load_aid_stations(path: str) -> tuple[dict[str, Any], ...]:
    file_path = _resolve_data_path(path)
    if not file_path.is_file():
        return ()
    data = json.loads(file_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return ()
    return tuple(s for s in data if isinstance(s, dict))


@lru_cache(maxsize=1)
def _load_segments(path: str) -> tuple[dict[str, Any], ...]:
    file_path = _resolve_data_path(path)
    if not file_path.is_file():
        return ()
    data = json.loads(file_path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return ()
    return tuple(s for s in data if isinstance(s, dict))


def _stations(settings: Settings) -> list[dict[str, Any]]:
    return list(_load_aid_stations(str(settings.aid_stations_path)))


def _segments(settings: Settings) -> list[dict[str, Any]]:
    return list(_load_segments(str(settings.segments_path)))


def get_last_aid_station(mile: float, settings: Settings) -> dict[str, Any] | None:
    last = None
    for station in sorted(_stations(settings), key=lambda s: float(s.get("mile", 0))):
        if float(station.get("mile", 0)) <= mile + 0.05:
            last = station
        else:
            break
    if not last or float(last.get("mile", 0)) == 0:
        return None
    return last


def get_next_aid_station(mile: float, settings: Settings) -> dict[str, Any] | None:
    if mile >= RACE_DISTANCE_MILES - 0.5:
        return {"name": "Finish", "mile": RACE_DISTANCE_MILES, "crew_access": True}
    for station in sorted(_stations(settings), key=lambda s: float(s.get("mile", 0))):
        if float(station.get("mile", 0)) > mile + 0.05:
            return station
    return None


def get_current_segment(mile: float, settings: Settings) -> dict[str, Any] | None:
    for seg in _segments(settings):
        if mile <= float(seg.get("cumulative_miles", 0)) + 0.001:
            end = float(seg.get("cumulative_miles", 0))
            return {
                "name": seg.get("name", "Unknown segment"),
                "miles_to_end": max(0.0, end - mile),
            }
    return None


def aids_between(from_mile: float, to_mile: float, settings: Settings) -> list[dict[str, Any]]:
    lo, hi = min(from_mile, to_mile), max(from_mile, to_mile)
    passed: list[dict[str, Any]] = []
    for station in sorted(_stations(settings), key=lambda s: float(s.get("mile", 0))):
        sm = float(station.get("mile", 0))
        if lo < sm <= hi + 0.05:
            passed.append(station)
    return passed


def build_place_summary(mile: float, settings: Settings) -> dict[str, Any]:
    segment = get_current_segment(mile, settings)
    last_aid = get_last_aid_station(mile, settings)
    next_aid = get_next_aid_station(mile, settings)

    parts: list[str] = []
    if segment:
        parts.append(f"on leg {segment['name']}")
    if last_aid:
        parts.append(f"past {last_aid['name']} (mi {float(last_aid['mile']):.1f})")
    if next_aid:
        dist = max(0.0, float(next_aid["mile"]) - mile)
        parts.append(f"{dist:.1f} mi to {next_aid['name']}")

    place_label = " · ".join(parts) if parts else f"Mile {mile:.1f} on course"
    short = segment["name"] if segment else place_label

    return {
        "mile": round(mile, 1),
        "segment_name": segment["name"] if segment else None,
        "miles_to_segment_end": round(segment["miles_to_end"], 1) if segment else None,
        "last_aid_name": last_aid["name"] if last_aid else None,
        "last_aid_mile": float(last_aid["mile"]) if last_aid else None,
        "next_aid_name": next_aid["name"] if next_aid else None,
        "next_aid_mile": float(next_aid["mile"]) if next_aid else None,
        "miles_to_next_aid": round(max(0.0, float(next_aid["mile"]) - mile), 1) if next_aid else None,
        "next_aid_crew_access": bool(next_aid.get("crew_access")) if next_aid else None,
        "place_label": place_label,
        "place_short": short,
    }


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def build_signal_gap_context(status: dict[str, Any]) -> dict[str, Any] | None:
    if not status.get("enabled"):
        return None

    explicitly_stale = bool(status.get("data_stale") or status.get("stale"))
    at = status.get("last_update_at") or status.get("fetched_at")
    parsed = _parse_iso(at if isinstance(at, str) else None)
    hours: float | None = None
    if parsed:
        hours = round((datetime.now(UTC) - parsed).total_seconds() / 3600, 1)

    if not explicitly_stale and (hours is None or hours < 2):
        return None

    mile = status.get("route_mile")
    mile_line = f"Last known position: mile {float(mile):.1f}." if mile is not None else "Last known position is on file."

    if hours is not None and hours >= 6:
        timing = f"No fresh ping in about {hours:.0f} hours."
        reassurance = "On a 200-miler, long quiet stretches often mean sleep, a deep canyon, or a long aid stop — not necessarily trouble."
    elif hours is not None and hours >= 2:
        timing = f"No fresh ping in about {hours:.0f} hours."
        reassurance = "GPS drops in canyons and during naps are normal out here. This is last known position only."
    else:
        timing = "Tracker has not refreshed recently."
        reassurance = "Canyons and aid stops eat GPS. Showing last known position until the next ping."

    return {
        "active": True,
        "hours_since_ping": hours,
        "title": "Signal gap — normal in backcountry",
        "summary": timing,
        "detail": f"{mile_line} {reassurance}",
        "mile": mile,
    }


def build_catchup_summary(
    *,
    settings: Settings,
    last_mile: float | None,
    current_mile: float | None,
    last_seen: str | None = None,
) -> str | None:
    if last_mile is None or current_mile is None:
        return None
    if current_mile <= last_mile + 0.3:
        return (
            f"Still around mile {current_mile:.1f} since your last check-in "
            f"(was mile {last_mile:.1f}) — likely a stop, sleep, or slow section."
        )

    delta = current_mile - last_mile
    aids = aids_between(last_mile, current_mile, settings)
    aid_names = [str(a.get("name", "")) for a in aids if a.get("name")]
    aid_part = ""
    if aid_names:
        if len(aid_names) == 1:
            aid_part = f" Passed {aid_names[0]}."
        else:
            aid_part = f" Passed {', '.join(aid_names[:-1])}, and {aid_names[-1]}."

    since_part = ""
    parsed = _parse_iso(last_seen)
    if parsed:
        hours = (datetime.now(UTC) - parsed).total_seconds() / 3600
        if hours >= 1:
            since_part = f" Since you last checked in (~{hours:.0f}h ago),"

    ctx = build_place_summary(current_mile, settings)
    return (
        f"{since_part} I've covered about {delta:.1f} miles "
        f"(mile {last_mile:.1f} → {current_mile:.1f}).{aid_part} "
        f"Currently {ctx['place_label']}."
    ).strip()


def format_catchup_block(visitor: dict[str, Any], status: dict[str, Any], settings: Settings) -> str:
    summary = build_catchup_summary(
        settings=settings,
        last_mile=visitor.get("last_harvey_mile"),
        current_mile=status.get("route_mile"),
        last_seen=visitor.get("last_seen"),
    )
    if not summary:
        return ""
    return f"## Catch-up since last visit\n{summary}"


def enrich_status(settings: Settings, status: dict[str, Any]) -> dict[str, Any]:
    enriched = dict(status)
    mile = status.get("route_mile")
    if isinstance(mile, (int, float)):
        enriched["course_context"] = build_place_summary(float(mile), settings)
    gap = build_signal_gap_context(status)
    if gap:
        enriched["signal_gap"] = gap
    return enriched


def format_course_context_block(status: dict[str, Any]) -> str:
    ctx = status.get("course_context")
    if not ctx:
        return ""
    lines = [
        "## Course position (derived from mile)",
        f"- Place: {ctx.get('place_label')}",
    ]
    if ctx.get("next_aid_name"):
        lines.append(
            f"- Next aid: {ctx['next_aid_name']} (mi {ctx.get('next_aid_mile')}, "
            f"{ctx.get('miles_to_next_aid')} mi ahead)"
        )
    if ctx.get("last_aid_name"):
        lines.append(f"- Last aid passed: {ctx['last_aid_name']} (mi {ctx.get('last_aid_mile')})")
    return "\n".join(lines)


def format_signal_gap_block(status: dict[str, Any]) -> str:
    gap = status.get("signal_gap")
    if not gap:
        return ""
    return (
        "## Signal gap (show empathy — do not alarm)\n"
        f"- {gap.get('summary')}\n"
        f"- {gap.get('detail')}"
    )
