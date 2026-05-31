"""Visitor registry persisted to data/visitors.json."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

UTC = timezone.utc
from pathlib import Path
from typing import Any

from config import Settings, VALID_RELATIONSHIPS


class VisitorError(Exception):
    pass


class VisitorNotFound(VisitorError):
    pass


class InvalidRelationship(VisitorError):
    pass


def _iso_now() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _load_raw(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"visitors": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return {"visitors": []}
    data.setdefault("visitors", [])
    return data


def _save_raw(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def create_visitor(settings: Settings, *, name: str, relationship: str) -> dict[str, Any]:
    name = name.strip()
    relationship = relationship.strip().lower()
    if not name:
        raise VisitorError("Name is required")
    if relationship not in VALID_RELATIONSHIPS:
        raise InvalidRelationship(
            f"relationship must be one of: {', '.join(sorted(VALID_RELATIONSHIPS))}"
        )

    now = _iso_now()
    visitor = {
        "id": str(uuid.uuid4()),
        "name": name,
        "relationship": relationship,
        "first_seen": now,
        "last_seen": now,
        "checkin_count": 0,
        "last_harvey_mile": None,
    }

    data = _load_raw(settings.visitors_path)
    data["visitors"].append(visitor)
    _save_raw(settings.visitors_path, data)
    maybe_export_visitors(settings, data)
    return visitor


def get_visitor(settings: Settings, visitor_id: str) -> dict[str, Any]:
    data = _load_raw(settings.visitors_path)
    for visitor in data["visitors"]:
        if visitor.get("id") == visitor_id:
            return visitor
    raise VisitorNotFound(f"Unknown visitor_id: {visitor_id}")


def record_checkin(settings: Settings, visitor_id: str, *, harvey_mile: float | None) -> dict[str, Any]:
    data = _load_raw(settings.visitors_path)
    now = _iso_now()
    for visitor in data["visitors"]:
        if visitor.get("id") != visitor_id:
            continue
        visitor["last_seen"] = now
        visitor["checkin_count"] = int(visitor.get("checkin_count", 0)) + 1
        if harvey_mile is not None:
            visitor["last_harvey_mile"] = harvey_mile
        _save_raw(settings.visitors_path, data)
        maybe_export_visitors(settings, data)
        return visitor
    raise VisitorNotFound(f"Unknown visitor_id: {visitor_id}")


def format_visitor_block(visitor: dict[str, Any]) -> str:
    lines = [
        "## Visitor context",
        f"- Name: {visitor.get('name')}",
        f"- Relationship to Harvey: {visitor.get('relationship')}",
        f"- Check-ins this race: {visitor.get('checkin_count', 0)}",
        f"- Last seen: {visitor.get('last_seen')}",
    ]
    if visitor.get("last_harvey_mile") is not None:
        lines.append(f"- Last time they checked in, Harvey was around mile {visitor['last_harvey_mile']}")
    lines.append(
        "Use the tone guidance for this relationship in voice.md. "
        "Address them by name when natural."
    )
    return "\n".join(lines)


def maybe_export_visitors(settings: Settings, data: dict[str, Any] | None = None) -> None:
    """Optional GitHub backup — ~10 lines, no-op without GITHUB_TOKEN."""
    if not settings.github_token:
        return
    payload = data if data is not None else _load_raw(settings.visitors_path)
    content = json.dumps(payload, indent=2) + "\n"
    _github_put_file(settings, content)


def _github_put_file(settings: Settings, content: str) -> None:
    import base64
    from urllib.error import HTTPError
    from urllib.request import Request, urlopen

    api_base = f"https://api.github.com/repos/{settings.github_owner}/{settings.github_repo}"
    path = settings.visitors_export_path
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "crew-chief-agent-server",
    }

    get_url = f"{api_base}/contents/{path}?ref={settings.github_branch}"
    sha = None
    try:
        req = Request(get_url, headers=headers)
        with urlopen(req, timeout=30) as resp:
            existing = json.loads(resp.read().decode("utf-8"))
            sha = existing.get("sha")
    except HTTPError as err:
        if err.code != 404:
            return

    body: dict[str, Any] = {
        "message": "chore: backup visitors.json from race agent",
        "content": base64.b64encode(content.encode("utf-8")).decode("ascii"),
        "branch": settings.github_branch,
    }
    if sha:
        body["sha"] = sha

    put_req = Request(
        f"{api_base}/contents/{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={**headers, "Content-Type": "application/json"},
        method="PUT",
    )
    try:
        with urlopen(put_req, timeout=30):
            pass
    except HTTPError:
        return
