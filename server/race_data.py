"""Race scope lock and RACE DATA block — loaded at startup, refreshed every 30 minutes."""

from __future__ import annotations

import json
import threading
import time
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import urlopen

from config import Settings

SCOPE_LOCK = """SCOPE LOCK — READ FIRST:
You are Harvey Schaefer. You know exactly one race: the Tahoe 200 Endurance Run, June 12–17, 2026.
You do not know Western States, Leadville, Cocodona, Bighorn, UTMB, or any other event.
If asked about another race: deflect in Harvey's voice and redirect to his race. Example: "I only know my race right now. 200 miles is enough to think about."
Never improvise race logistics from memory. All cutoffs, mileages, and crew access details must come from the RACE DATA block below — if it's not in that block, say you're not sure and tell them to check with crew."""

AID_CITATION_RULE = """
When citing any aid station cutoff, mileage, or crew access detail, add: "(per race plan — confirm with crew before moving)". Never add cutoffs or access details that aren't in the table above."""

PLAN_ETAS = [
    (0, "Start", "Fri 9:00 AM"),
    (52.2, "Sierra at Tahoe", "Sat 12:00 AM (midnight)"),
    (130, "Tahoe City", "Sun 12:36 PM"),
    (148.6, "Brockway Summit", "Sun 9:00 PM"),
    (163.6, "Village Green", "Mon 3:37 AM"),
    (200.4, "Finish", "Mon 6:00 PM"),
]

RACE_FACTS = """- 200.4 miles, one loop around Lake Tahoe, mostly Tahoe Rim Trail
- 32,093 ft gain, 32,093 ft descent
- 105-hour cutoff (starts Fri 9 AM, cutoff Tue 6 PM)
- 3 sleep stations: Wrights Lake (mi 70.7), Barker Pass (mi 103.1), Brockway Summit (mi 148.6)
- Altitude: mostly 6,500–9,000 ft
- Tracker: destinationtrailrun.com/tahoe"""

RELOAD_SECONDS = 30 * 60
CREW_SITE_DATA_BASE = "https://harveygerardmk.github.io/crew-chief/data"

_lock = threading.Lock()
_cached_block: str | None = None
_cached_at: float = 0.0


def _yes_no(value: bool | None) -> str:
    if value is True:
        return "Yes"
    if value is False:
        return "No"
    return "—"


def _format_aid_table(aid_stations: list[dict[str, Any]]) -> str:
    lines = [
        "| Mile | Name | Cutoff | Crew access | Notes |",
        "|------|------|--------|-------------|-------|",
    ]
    for station in sorted(aid_stations, key=lambda s: float(s.get("mile", 0))):
        mile = station.get("mile", "—")
        name = station.get("name", "—")
        cutoff = station.get("cutoff") or "No cutoff"
        crew = _yes_no(station.get("crew_access"))
        notes = (station.get("notes") or "—").replace("|", "/")
        lines.append(f"| {mile} | {name} | {cutoff} | {crew} | {notes} |")
    return "\n".join(lines)


def _format_plan_etas() -> str:
    lines = ["**Harvey's plan ETAs:**", ""]
    for mile, name, eta in PLAN_ETAS:
        lines.append(f"- Mile {mile} ({name}): {eta}")
    return "\n".join(lines)


def _load_local_aid_stations(settings: Settings) -> list[dict[str, Any]]:
    path = settings.aid_stations_path
    if not path.is_file():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return [s for s in data if isinstance(s, dict)]
    return []


def _fetch_remote_aid_stations() -> list[dict[str, Any]] | None:
    url = f"{CREW_SITE_DATA_BASE}/aid-stations.json"
    try:
        with urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    if isinstance(data, list) and data:
        return [s for s in data if isinstance(s, dict)]
    return None


def _build_race_data_block(aid_stations: list[dict[str, Any]]) -> str:
    table = _format_aid_table(aid_stations) if aid_stations else "(aid station table unavailable)"
    parts = [
        "## RACE DATA",
        "",
        "**Aid stations**",
        "",
        table,
        "",
        _format_plan_etas(),
        "",
        "**Race facts:**",
        "",
        RACE_FACTS,
        "",
        AID_CITATION_RULE.strip(),
    ]
    return "\n".join(parts)


def _load_fresh_block(settings: Settings) -> str:
    stations = _fetch_remote_aid_stations() or _load_local_aid_stations(settings)
    if not stations:
        stations = _load_local_aid_stations(settings)
    return _build_race_data_block(stations)


def get_race_data_block(settings: Settings) -> str:
    """Return cached RACE DATA block; reload if older than 30 minutes."""
    global _cached_block, _cached_at
    now = time.monotonic()
    with _lock:
        if _cached_block is None or (now - _cached_at) >= RELOAD_SECONDS:
            _cached_block = _load_fresh_block(settings)
            _cached_at = now
        return _cached_block


def warm_race_data_cache(settings: Settings) -> None:
    """Load race data at process startup."""
    get_race_data_block(settings)


def reset_race_data_cache() -> None:
    """For tests."""
    global _cached_block, _cached_at
    with _lock:
        _cached_block = None
        _cached_at = 0.0
