"""Match visitor names to Harvey's notes about specific people."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from config import REPO_ROOT

KNOWN_PEOPLE_PATH = REPO_ROOT / "data" / "known-people.json"


def _normalize_name(name: str) -> str:
    return " ".join(name.strip().lower().split())


@lru_cache(maxsize=1)
def _load_known_people() -> tuple[dict[str, Any], ...]:
    if not KNOWN_PEOPLE_PATH.is_file():
        return ()
    data = json.loads(KNOWN_PEOPLE_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        return ()
    return tuple(entry for entry in data if isinstance(entry, dict))


def default_audience_for_name(name: str) -> str | None:
    person = lookup_known_person(name)
    if not person:
        return None
    aud = str(person.get("default_audience") or "").strip().lower()
    if aud in ("on_course", "remote"):
        return aud
    return None


def lookup_known_person(name: str) -> dict[str, Any] | None:
    normalized = _normalize_name(name)
    if not normalized:
        return None
    first_token = normalized.split()[0] if normalized else ""
    for person in _load_known_people():
        aliases = person.get("match_names") or []
        if not isinstance(aliases, list):
            continue
        for alias in aliases:
            norm_alias = _normalize_name(str(alias))
            if norm_alias == normalized or (first_token and norm_alias == first_token):
                return person
    return None


def format_known_person_block(person: dict[str, Any]) -> str:
    lines = [
        "## Known person (Harvey's notes)",
        f"- Who: {person.get('label', 'Someone Harvey knows')}",
    ]
    notes = person.get("notes") or []
    if isinstance(notes, list):
        for note in notes:
            text = str(note).strip()
            if text:
                lines.append(f"- {text}")
    lines.append(
        "- Use their nickname when natural. Ground pacing answers in the leg notes above "
        "(per race plan — confirm with crew before moving)."
    )
    return "\n".join(lines)
