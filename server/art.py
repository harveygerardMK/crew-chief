"""NGA art pairings — optional image URL enrichment for chat art cards."""

from __future__ import annotations

import json
import random
from functools import lru_cache
from pathlib import Path
from typing import Any

from config import REPO_ROOT, Settings


def derive_status_tags(status: dict[str, Any], *, race_started: bool) -> list[str]:
    tags: list[str] = []
    mile = status.get("route_mile")
    if mile is None or not race_started:
        tags.append("early")
    else:
        mile_f = float(mile)
        if mile_f < 50:
            tags.append("early")
        elif mile_f < 120:
            tags.append("mid")
        elif mile_f < 190:
            tags.append("deep")
        else:
            tags.append("finish")

    speed = status.get("current_speed_mph")
    if speed is not None:
        speed_f = float(speed)
        if speed_f < 1:
            tags.append("stopped")
        elif speed_f < 3:
            tags.append("shuffle")
        elif speed_f < 5:
            tags.append("cruising")
        else:
            tags.append("flying")

    if status.get("data_stale") or status.get("stale"):
        tags.append("cloudy")

    return tags


@lru_cache(maxsize=1)
def _load_pairings(path: str) -> tuple[dict[str, Any], ...]:
    file_path = Path(path)
    if not file_path.is_file():
        return ()
    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return ()
    if not isinstance(data, list):
        return ()
    return tuple(item for item in data if isinstance(item, dict) and item.get("image_url"))


def lookup_nga_image(settings: Settings, status: dict[str, Any]) -> str | None:
    path = settings.art_pairings_path
    pairings = _load_pairings(str(path))
    if not pairings:
        return None

    tags = derive_status_tags(status, race_started=settings.race_started)
    candidates = [
        item
        for item in pairings
        if tags and any(tag in item.get("tags", []) for tag in tags)
    ]
    pool = candidates or list(pairings)
    pick = random.choice(pool)
    url = pick.get("image_url")
    return str(url) if url else None
