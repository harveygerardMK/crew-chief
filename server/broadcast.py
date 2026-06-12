"""Crew broadcast updates — fetched from wheresharvey.com/data for chat context."""

from __future__ import annotations

import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

UTC = timezone.utc
from urllib.error import URLError
from urllib.request import Request, urlopen

from config import REPO_ROOT, Settings

SITE_BASE = "https://wheresharvey.com"
CHAT_URL = f"{SITE_BASE}/"
RELOAD_SECONDS = 5 * 60
MAX_UPDATES_IN_PROMPT = 5
# Cloudflare 403s the default Python-urllib User-Agent, which silently dropped
# fresh crew posts and served the stale local checkout. A normal UA is allowed.
FETCH_USER_AGENT = "crew-chief-agent/1.0 (+https://wheresharvey.com)"

_lock = threading.Lock()
_cached_block: str | None = None
_cached_at: float = 0.0


def _entry_has_content(entry: dict[str, Any]) -> bool:
    doing = str(entry.get("doing") or "").strip()
    note = str(entry.get("note") or "").strip()
    photos = entry.get("photos")
    last_seen = entry.get("last_seen")
    station = ""
    if isinstance(last_seen, dict):
        station = str(last_seen.get("station") or "").strip()
    return bool(doing or note or station or (isinstance(photos, list) and photos))


def _parse_updates(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        entries = [e for e in raw if isinstance(e, dict) and _entry_has_content(e)]
    elif isinstance(raw, dict):
        if isinstance(raw.get("updates"), list):
            entries = [
                e
                for e in raw["updates"]
                if isinstance(e, dict) and _entry_has_content(e)
            ]
        elif isinstance(raw.get("updated_at"), str):
            entries = [raw] if _entry_has_content(raw) else []
        else:
            entries = []
    else:
        entries = []

    return sorted(
        entries,
        key=lambda e: str(e.get("updated_at") or ""),
        reverse=True,
    )


def _load_local_broadcast() -> list[dict[str, Any]]:
    path = REPO_ROOT / "data" / "race-broadcast.json"
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return _parse_updates(raw)


def _fetch_remote_broadcast() -> list[dict[str, Any]] | None:
    url = "https://wheresharvey.com/data/race-broadcast.json"
    try:
        req = Request(url, headers={"User-Agent": FETCH_USER_AGENT})
        with urlopen(req, timeout=15) as resp:
            raw = json.loads(resp.read().decode("utf-8"))
    except (URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    updates = _parse_updates(raw)
    return updates


def _format_time_label(entry: dict[str, Any]) -> str:
    last_seen = entry.get("last_seen")
    if isinstance(last_seen, dict):
        label = str(last_seen.get("time_label") or "").strip()
        if label:
            return label
    updated = str(entry.get("updated_at") or "").strip()
    return updated or "time unknown"


def _format_entry(entry: dict[str, Any], index: int) -> str:
    lines = [f"### Update #{index}"]
    when = _format_time_label(entry)
    if when:
        lines.append(f"- Posted: {when}")

    doing = str(entry.get("doing") or "").strip()
    if doing:
        lines.append(f"- How he's doing (crew): {doing}")

    last_seen = entry.get("last_seen")
    if isinstance(last_seen, dict):
        station = str(last_seen.get("station") or "").strip()
        if station:
            time_label = str(last_seen.get("time_label") or "").strip()
            seen_bit = f"{station}"
            if time_label:
                seen_bit += f" at {time_label}"
            lines.append(f"- Last seen (crew): {seen_bit}")

    note = str(entry.get("note") or "").strip()
    if note:
        lines.append(f"- Note for family: {note}")

    photos = entry.get("photos")
    if isinstance(photos, list) and photos:
        lines.append(f"- Photos ({len(photos)}) — inline in {CHAT_URL}:")
        for photo in photos:
            if not isinstance(photo, dict):
                continue
            url = _absolute_photo_url(str(photo.get("url") or "").strip())
            alt = str(photo.get("alt") or "Crew photo").strip()
            if not url:
                continue
            if url:
                lines.append(f"  - {alt}: {url}")

    return "\n".join(lines)


def _build_broadcast_block(updates: list[dict[str, Any]]) -> str | None:
    if not updates:
        return None

    lines = [
        "## Crew updates from Amanda (official)",
        "",
        "Posts from Amanda's crew update form. Shown inline in Ask Harvey chat (wheresharvey.com). "
        "**Authoritative** when visitors ask what crew or family were told or how Harvey looked at an aid station. "
        "If tracker GPS and a fresh crew update disagree, say both — crew eyes-on-trail wins for "
        "condition and last-seen station when she just posted.",
        "",
    ]

    shown = updates[:MAX_UPDATES_IN_PROMPT]
    for i, entry in enumerate(shown, start=1):
        lines.append(_format_entry(entry, i))
        lines.append("")

    if len(updates) > MAX_UPDATES_IN_PROMPT:
        extra = len(updates) - MAX_UPDATES_IN_PROMPT
        lines.append(
            f"({extra} older update{'s' if extra != 1 else ''} — ask in {CHAT_URL})"
        )

    return "\n".join(lines).strip()


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _normalize_photo_path(url: str) -> str:
    """Legacy Worker JSON used /crew-chief/race-updates/ before wheresharvey.com root."""
    path = url.strip()
    if path.startswith("/crew-chief/"):
        return path.replace("/crew-chief/", "/", 1)
    return path


def _absolute_photo_url(url: str) -> str:
    path = _normalize_photo_path(url)
    if path.startswith("/"):
        return f"{SITE_BASE}{path}"
    return path


def get_latest_updates(limit: int = 1) -> list[dict[str, Any]]:
    """Most recent crew posts for first-time chat visitors."""
    return load_broadcast_updates()[:limit]


def load_broadcast_updates() -> list[dict[str, Any]]:
    """Latest crew updates (newest first), bypassing the formatted prompt cache."""
    if os.environ.get("BROADCAST_FORCE_LOCAL") == "1":
        return _load_local_broadcast()
    remote = _fetch_remote_broadcast()
    if remote is not None:
        return remote
    return _load_local_broadcast()


def get_updates_since(since_iso: str | None) -> list[dict[str, Any]]:
    """Updates posted after the visitor's last check-in."""
    since = _parse_iso(since_iso)
    if since is None:
        return []
    missed: list[dict[str, Any]] = []
    for entry in load_broadcast_updates():
        posted = _parse_iso(str(entry.get("updated_at") or ""))
        if posted and posted > since:
            missed.append(entry)
    return missed


def to_crew_update_card(entry: dict[str, Any]) -> dict[str, Any]:
    """Shape for ChatResponse — absolute photo URLs for inline UI."""
    last_seen = entry.get("last_seen") if isinstance(entry.get("last_seen"), dict) else {}
    photos: list[dict[str, str]] = []
    for photo in entry.get("photos") or []:
        if not isinstance(photo, dict):
            continue
        url = str(photo.get("url") or "").strip()
        if not url:
            continue
        photos.append(
            {
                "url": _absolute_photo_url(url),
                "alt": str(photo.get("alt") or "Crew photo").strip(),
            }
        )
    return {
        "updated_at": str(entry.get("updated_at") or ""),
        "doing": str(entry.get("doing") or "").strip() or None,
        "station": str(last_seen.get("station") or "").strip() or None,
        "time_label": str(last_seen.get("time_label") or "").strip() or None,
        "note": str(entry.get("note") or "").strip() or None,
        "photos": photos,
    }


def format_missed_updates_block(updates: list[dict[str, Any]]) -> str:
    if not updates:
        return ""
    lines = [
        "## Crew updates since this visitor's last check-in",
        "",
        "Amanda posted these while they were away. Summarize them in the greeting; "
        "the app also shows these as inline cards with photos.",
        "",
    ]
    for i, entry in enumerate(updates, start=1):
        lines.append(_format_entry(entry, i))
        lines.append("")
    return "\n".join(lines).strip()


def _load_fresh_block() -> str | None:
    if os.environ.get("BROADCAST_FORCE_LOCAL") == "1":
        updates = _load_local_broadcast()
    else:
        updates = _fetch_remote_broadcast()
        if updates is None:
            updates = _load_local_broadcast()
    return _build_broadcast_block(updates)


def get_broadcast_block(_settings: Settings | None = None) -> str | None:
    """Return cached crew broadcast block; reload every 5 minutes."""
    global _cached_block, _cached_at
    now = time.monotonic()
    with _lock:
        if _cached_block is None or (now - _cached_at) >= RELOAD_SECONDS:
            _cached_block = _load_fresh_block()
            _cached_at = now
        return _cached_block


def warm_broadcast_cache(settings: Settings | None = None) -> None:
    get_broadcast_block(settings)


def reset_broadcast_cache() -> None:
    """For tests."""
    global _cached_block, _cached_at
    with _lock:
        _cached_block = None
        _cached_at = 0.0
