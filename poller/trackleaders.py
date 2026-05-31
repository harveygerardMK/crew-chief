"""TrackLeaders fetch + parse — mirrors workers/broadcast/src/trackleaders.ts."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime, timezone

UTC = timezone.utc
from typing import Any, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

RaceStatus = Literal["active", "finished", "unknown"]

# Agent-facing stale threshold (2 hours), more forgiving than the Worker's 65 min.
STALE_SECONDS = 2 * 60 * 60
USER_AGENT = "crew-chief-poller/1.0"


@dataclass
class TrackerSnapshot:
    enabled: bool
    fetched_at: str
    race_status: RaceStatus
    last_update_at: str | None
    last_update_label: str | None
    route_mile: float | None
    elevation_gain_ft: int | None
    current_speed_mph: float | None
    stale: bool
    source_url: str
    error: str | None = None
    data_stale: bool = False
    last_successful_fetch: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class FetchError(Exception):
    """TrackLeaders fetch or parse failed."""


def fetch_tracker_snapshot(
    *,
    event_slug: str | None,
    runner_name: str | None,
    fallback_url: str | None = None,
) -> TrackerSnapshot:
    slug = (event_slug or "").strip()
    name = (runner_name or "").strip()
    fallback = (fallback_url or "").strip()

    if slug and name:
        runner_key = re.sub(r"\s+", "_", name)
        json_url = f"https://trackleaders.com/spot/{slug}/{runner_key}-status.json"
        html_url = f"https://trackleaders.com/{slug}i.php?name={_url_quote(name)}"
        primary = _fetch_json_status(json_url, html_url)
        if _snapshot_is_usable(primary):
            return primary
        if fallback:
            fallback_snap = _fetch_html_status(fallback, json_url)
            if _snapshot_is_usable(fallback_snap):
                return fallback_snap
        return primary

    if fallback:
        return _fetch_html_status(fallback, fallback)

    return _disabled_snapshot("TrackLeaders not configured (set slug/name or fallback URL).")


def _snapshot_is_usable(snapshot: TrackerSnapshot) -> bool:
    if not snapshot.enabled or snapshot.error:
        return False
    return snapshot.route_mile is not None or snapshot.last_update_at is not None


def _fetch_json_status(json_url: str, html_url: str) -> TrackerSnapshot:
    try:
        body = _http_get_json(json_url)
    except FetchError:
        return _fetch_html_status(html_url, json_url)

    rows = body.get("data") or []
    stats = {str(k).lower(): str(v) for k, v in rows}

    return _snapshot_from_stats(stats, source_url=json_url)


def _fetch_html_status(html_url: str, source_for_errors: str) -> TrackerSnapshot:
    try:
        html = _http_get_text(html_url)
    except FetchError as err:
        return _enabled_error_snapshot(str(err), source_for_errors)

    stats = _parse_html_stats_table(html)
    if not stats:
        return _enabled_error_snapshot(f"No stats table found at {html_url}", source_for_errors)

    return _snapshot_from_stats(stats, source_url=html_url)


def _snapshot_from_stats(stats: dict[str, str], *, source_url: str) -> TrackerSnapshot:
    last_update_label = stats.get("last update rec'd")
    last_update_at = parse_track_leaders_time(last_update_label)
    route_mile = _parse_miles(stats.get("route mile"))
    elevation_gain_ft = _parse_feet(stats.get("elevation gain"))
    current_speed_mph = _parse_mph(stats.get("current speed"))
    race_status = _parse_race_status(stats.get("race status"))

    stale = False
    if last_update_at is not None:
        age = (datetime.now(UTC) - last_update_at).total_seconds()
        stale = age > STALE_SECONDS

    now = _iso_now()
    last_update_iso = None
    if last_update_at is not None:
        last_update_iso = last_update_at.isoformat().replace("+00:00", "Z")
    return TrackerSnapshot(
        enabled=True,
        fetched_at=now,
        race_status=race_status,
        last_update_at=last_update_iso,
        last_update_label=last_update_label,
        route_mile=route_mile,
        elevation_gain_ft=elevation_gain_ft,
        current_speed_mph=current_speed_mph,
        stale=stale,
        source_url=source_url,
        data_stale=False,
        last_successful_fetch=now,
    )


def _disabled_snapshot(message: str) -> TrackerSnapshot:
    return TrackerSnapshot(
        enabled=False,
        fetched_at=_iso_now(),
        race_status="unknown",
        last_update_at=None,
        last_update_label=None,
        route_mile=None,
        elevation_gain_ft=None,
        current_speed_mph=None,
        stale=False,
        source_url="",
        error=message,
        data_stale=False,
        last_successful_fetch=None,
    )


def _enabled_error_snapshot(message: str, source_url: str) -> TrackerSnapshot:
    snap = _disabled_snapshot(message)
    snap.enabled = True
    snap.source_url = source_url
    return snap


def preserve_cached_snapshot(
    previous: dict[str, Any],
    *,
    error: str,
) -> TrackerSnapshot:
    """Keep last good race data when the fetch fails."""
    last_success = previous.get("last_successful_fetch") or previous.get("fetched_at")
    return TrackerSnapshot(
        enabled=bool(previous.get("enabled", True)),
        fetched_at=_iso_now(),
        race_status=previous.get("race_status", "unknown"),
        last_update_at=previous.get("last_update_at"),
        last_update_label=previous.get("last_update_label"),
        route_mile=previous.get("route_mile"),
        elevation_gain_ft=previous.get("elevation_gain_ft"),
        current_speed_mph=previous.get("current_speed_mph"),
        stale=bool(previous.get("stale", True)),
        source_url=previous.get("source_url", ""),
        error=error,
        data_stale=True,
        last_successful_fetch=last_success,
    )


def parse_track_leaders_time(label: str | None) -> datetime | None:
    """Best-effort parse of labels like '05:02:05 PM (AKST) 01/12/26'."""
    if not label:
        return None

    match = re.search(
        r"(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\s*\((\w+)\)\s*(\d{1,2})/(\d{1,2})/(\d{2,4})",
        label,
        re.IGNORECASE,
    )
    if not match:
        return None

    hour = int(match.group(1))
    minute = int(match.group(2))
    second = int(match.group(3))
    ampm = match.group(4).upper()
    month = int(match.group(6))
    day = int(match.group(7))
    year = int(match.group(8))
    if year < 100:
        year += 2000

    if ampm == "PM" and hour < 12:
        hour += 12
    if ampm == "AM" and hour == 12:
        hour = 0

    tz_offset = _timezone_offset_for_abbr(match.group(5))
    if tz_offset is None:
        return datetime(year, month, day, hour, minute, second, tzinfo=UTC)

    utc_ms = (
        datetime(year, month, day, hour, minute, second, tzinfo=UTC).timestamp()
        - tz_offset * 60
    )
    return datetime.fromtimestamp(utc_ms, tz=UTC)


def _parse_html_stats_table(html: str) -> dict[str, str]:
    stats: dict[str, str] = {}
    for key, value in re.findall(
        r"<tr><td>([^<]+)</td><td>([^<]+)</td></tr>",
        html,
        flags=re.IGNORECASE,
    ):
        stats[key.strip().lower()] = value.strip()
    return stats


def _parse_race_status(raw: str | None) -> RaceStatus:
    status = (raw or "").lower()
    if "finish" in status:
        return "finished"
    if "active" in status:
        return "active"
    return "unknown"


def _parse_miles(raw: str | None) -> float | None:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d.]", "", raw)
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return value if value == value else None  # NaN guard


def _parse_feet(raw: str | None) -> int | None:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d.]", "", raw)
    try:
        value = float(cleaned)
    except ValueError:
        return None
    if value != value:
        return None
    return round(value)


def _parse_mph(raw: str | None) -> float | None:
    return _parse_miles(raw)


def _timezone_offset_for_abbr(abbr: str) -> int | None:
    offsets = {
        "PDT": -420,
        "PST": -480,
        "MST": -420,
        "MDT": -360,
        "AKST": -540,
        "AKDT": -480,
        "HST": -600,
    }
    return offsets.get(abbr.upper())


def _http_get_json(url: str) -> dict[str, Any]:
    raw = _http_get_bytes(url)
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as err:
        raise FetchError(f"Invalid JSON from {url}: {err}") from err


def _http_get_text(url: str) -> str:
    return _http_get_bytes(url).decode("utf-8", errors="replace")


def _http_get_bytes(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urlopen(request, timeout=30) as response:
            if response.status >= 400:
                raise FetchError(f"HTTP {response.status} from {url}")
            return response.read()
    except HTTPError as err:
        raise FetchError(f"HTTP {err.code} from {url}") from err
    except URLError as err:
        raise FetchError(f"Request failed for {url}: {err.reason}") from err


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _url_quote(value: str) -> str:
    from urllib.parse import quote

    return quote(value)
