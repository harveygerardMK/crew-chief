"""Claude API integration."""

from __future__ import annotations

import json
import re
from typing import Any

from anthropic import Anthropic
from anthropic import APIError

from config import Settings
from course_context import build_catchup_summary
from prompt import load_fallback


class ClaudeError(Exception):
    pass


def chat_completion(
    settings: Settings,
    *,
    system: str,
    user_message: str,
    history: list[dict[str, str]] | None = None,
    require_art: bool = False,
) -> dict[str, str]:
    if not settings.claude_configured:
        raise ClaudeError("ANTHROPIC_API_KEY not configured")

    from chat_history import build_claude_messages

    messages = build_claude_messages(history or [], user_message)

    client = Anthropic(api_key=settings.anthropic_api_key)
    try:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=settings.claude_max_tokens,
            system=system,
            messages=messages,
        )
    except APIError as err:
        raise ClaudeError(str(err)) from err

    text = _extract_text(response.content)
    return _parse_model_json(text, require_art=require_art)


def _build_contextual_fallback_reply(
    status: dict[str, Any],
    *,
    settings: Settings | None = None,
    visitor: dict[str, Any] | None = None,
    is_greeting: bool = False,
) -> str:
    """Plain-language update from tracker JSON — used when Claude is unavailable."""
    mile = status.get("route_mile")
    speed = status.get("current_speed_mph")
    race = str(status.get("race_status") or "unknown").lower()
    stale = bool(status.get("data_stale") or status.get("stale"))
    parts: list[str] = []

    if (
        is_greeting
        and visitor
        and settings
        and int(visitor.get("checkin_count", 0)) > 0
    ):
        catchup = build_catchup_summary(
            settings=settings,
            last_mile=visitor.get("last_harvey_mile"),
            current_mile=mile if isinstance(mile, (int, float)) else None,
            last_seen=visitor.get("last_seen"),
        )
        if catchup:
            name = visitor.get("name", "friend")
            parts.append(f"Hey {name} — good to see you again.")
            parts.append(catchup)

    ctx = status.get("course_context")
    if ctx and ctx.get("place_label"):
        parts.append(f"On course: {ctx['place_label']}.")
    elif mile is not None:
        m = float(mile)
        parts.append(f"Harvey is around mile {m:.1f} of 200 — about {m / 200 * 100:.0f}% along the course.")
    else:
        parts.append("Harvey is on course. The last ping did not include a mile marker.")

    gap = status.get("signal_gap")
    if gap:
        parts.append(f"{gap.get('summary')} {gap.get('detail')}")
    elif stale:
        parts.append(
            "The tracker has not refreshed in a while, so this is last known position only. "
            "On a race this long that usually means a canyon, a nap, or an aid station."
        )
    elif speed is not None:
        s = float(speed)
        if s <= 0.5:
            parts.append(
                "Speed is basically zero on the last ping — likely stopped at aid, sleeping, or in a dead zone."
            )
        elif s < 3:
            parts.append(
                f"Last ping had him at about {s:.1f} mph — slow miles, climbing, or being careful at night."
            )
        else:
            parts.append(f"Last ping had him moving at about {s:.1f} mph.")

    if race == "dnf":
        parts.append(
            "Race status on the tracker shows DNF. The crew site will have the official word."
        )
    elif race == "finished":
        parts.append("Race status shows finished on the tracker.")
    elif race not in {"active", "unknown", ""}:
        parts.append(f"Race status on the tracker: {status.get('race_status')}.")

    parts.append("The mile and place at the top of this page update when new pings come in.")
    return "\n\n".join(parts)


def fallback_response(
    settings: Settings,
    *,
    include_art: bool = False,
    status: dict[str, Any] | None = None,
    visitor: dict[str, Any] | None = None,
    is_greeting: bool = False,
) -> dict[str, str]:
    if status and status.get("enabled"):
        body = _build_contextual_fallback_reply(
            status,
            settings=settings,
            visitor=visitor,
            is_greeting=is_greeting,
        )
    else:
        body = load_fallback(settings)
    out: dict[str, str] = {"reply": body}
    if include_art:
        out["art_prompt"] = "Wanderer Above the Sea of Fog, Friedrich — waiting for a clear signal."
    return out


def _extract_text(content: Any) -> str:
    chunks: list[str] = []
    for block in content:
        if getattr(block, "type", None) == "text":
            chunks.append(block.text)
    return "\n".join(chunks).strip()


def _parse_model_json(text: str, *, require_art: bool) -> dict[str, str]:
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)```\s*$", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fence:
        cleaned = fence.group(1).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as err:
        raise ClaudeError(f"Model returned non-JSON: {text[:200]}") from err

    reply = str(data.get("reply", "")).strip()
    if not reply:
        raise ClaudeError("Model JSON missing reply")

    out: dict[str, str] = {"reply": reply}
    art_prompt = str(data.get("art_prompt", "")).strip()
    if require_art:
        if not art_prompt:
            art_prompt = "The Persistence of Memory, Dalí — time is doing something weird out here."
        out["art_prompt"] = art_prompt
    elif art_prompt:
        out["art_prompt"] = art_prompt
    return out
