"""Build Claude system prompts from voice.md and live context."""

from __future__ import annotations

from config import REPO_ROOT, Settings
from course_context import format_catchup_block
from race_data import SCOPE_LOCK, get_race_data_block
from status import format_status_block
from visitors import format_visitor_block

RELATIONSHIP_TONE: dict[str, str] = {
    "family": "Tone: **Family** — gentle, protective, reassuring. Shield from brutal detail without lying.",
    "friend": "Tone: **Friend** — honest about suffering, dry humor, shorter sentences. The shitheads who've seen you at your worst.",
    "crew": "Tone: **Crew** — operational, brief, clear. They know the plan; give status and needs.",
    "pacer": "Tone: **Pacer** — practical about upcoming legs, pacing windows, and what you need from them on course.",
    "stranger": "Tone: **Stranger** — warm, curious, enough context without condescension. Make them feel part of the adventure.",
}


RESPONSE_FORMAT_REPLY_ONLY = """
## Response format (required)

Reply with a single JSON object only — no markdown fences, no preamble:

{"reply": "your message in Harvey's voice"}

- `reply`: what the visitor reads in chat. Do not sign off with "This is an adventure, Harvey." — that is for emails, not chat.
"""

RESPONSE_FORMAT_WITH_ART = """
## Response format (required)

Reply with a single JSON object only — no markdown fences, no preamble:

{"reply": "your message in Harvey's voice", "art_prompt": "Artist, Title — brief vibe match to current status"}

- `reply`: what the visitor reads in chat. Do not sign off with "This is an adventure, Harvey."
- `art_prompt`: one line for the art card (see voice.md). Use a real painting.
"""


def load_voice(settings: Settings) -> str:
    if settings.voice_path.is_file():
        return settings.voice_path.read_text(encoding="utf-8")
    return "You are Harvey Schaefer, running the Tahoe 200. (voice.md missing — use a warm, direct tone.)"


def load_harvey_profile() -> str:
    path = REPO_ROOT / "harvey.md"
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return ""


def load_fallback(settings: Settings) -> str:
    if settings.fallback_path.is_file():
        return settings.fallback_path.read_text(encoding="utf-8").strip()
    return "Harvey here — chat is temporarily down. He's still out there."


def format_pre_race_mode_block(status: dict) -> str:
    """Pre-race instructions with simulation and signal-gap transparency."""
    lines = [
        "## Pre-race mode",
        "The race has not started yet (starts June 12, 2026, 9:00 AM PDT). "
        "Harvey is training, planning, and probably overthinking drop bags. "
        "Answer questions about the upcoming race, why he's doing this, and how preparation is going.",
        "",
        "When someone asks where Harvey is now before the start:",
        "- Lead with civilization / prep (race starts June 12, 9 AM from Heavenly Stagecoach).",
        "- Do **not** invent live Tahoe 200 progress or pretend the race is underway.",
    ]

    if status.get("simulation"):
        mile = status.get("route_mile")
        ctx = status.get("course_context") or {}
        place = ctx.get("place_label") or ctx.get("place_short")
        lines.extend(
            [
                "",
                "**Simulation / test tracker active** (`simulation: true`):",
                "Say plainly that mile data is from a **demo replay**, not Harvey on course at Tahoe.",
            ]
        )
        if isinstance(mile, (int, float)):
            place_bit = f" ({place})" if place else ""
            lines.append(
                f"Include one concrete line: demo tracker shows about mile {float(mile):.1f}{place_bit}."
            )
        else:
            lines.append("If mile is missing, say the test feed is empty or stale.")
    else:
        lines.append(
            "If tracker data is absent or stale, say so — do not invent miles."
        )

    gap = status.get("signal_gap") or {}
    if gap.get("active"):
        summary = gap.get("summary") or "No fresh ping recently."
        lines.extend(
            [
                "",
                f"**Signal gap active:** {summary}",
                "Mention this briefly when answering location questions — even pre-race — "
                "so visitors know the last ping is stale.",
            ]
        )

    return "\n".join(lines)


def build_system_prompt(
    settings: Settings,
    *,
    status: dict,
    visitor: dict,
    include_art: bool = False,
) -> str:
    parts = [
        SCOPE_LOCK,
        get_race_data_block(settings),
        load_voice(settings),
    ]
    profile = load_harvey_profile()
    if profile:
        parts.append(profile)
    parts.extend(
        [
            format_status_block(status),
            format_visitor_block(visitor),
        ]
    )

    catchup = format_catchup_block(visitor, status, settings)
    if catchup:
        parts.append(catchup)

    relationship = str(visitor.get("relationship", "")).lower()
    tone = RELATIONSHIP_TONE.get(relationship)
    if tone:
        parts.append(f"## Relationship tone for this chat\n{tone}")

    if not settings.race_started:
        parts.append(format_pre_race_mode_block(status))
    else:
        parts.append(
            "## On-course mode\n"
            "The race is underway or finished. Ground every answer in the status block above. "
            "If data is stale or missing, say so clearly — do not invent miles or pace."
        )

    count = int(visitor.get("checkin_count", 0))
    if count > 0:
        parts.append(
            "## Return visitor catch-up\n"
            "This person has checked in before. On session start, lead with the catch-up block above "
            "(miles covered, aids passed, current place). Do not ask permission — give the summary first, "
            "then invite questions. Never speculate about DNF unless race_status explicitly says DNF."
        )

    parts.append(RESPONSE_FORMAT_WITH_ART if include_art else RESPONSE_FORMAT_REPLY_ONLY)
    return "\n\n".join(parts)


def build_greeting_user_message(visitor: dict, *, status: dict, settings: Settings) -> str:
    name = visitor.get("name", "friend")
    count = int(visitor.get("checkin_count", 0))
    if count == 0:
        return (
            f"[Session start — first visit. Greet {name} warmly by name. "
            "Introduce yourself briefly as Harvey on the Tahoe 200 journey. "
            "Mention where you are on course using the course position block if mile data exists. "
            "Invite them to ask how you're doing. Keep it short.]"
        )

    catchup = format_catchup_block(visitor, status, settings)
    catchup_hint = catchup.split("\n", 1)[1] if catchup else "Summarize progress since their last visit."

    return (
        f"[Session start — return visit. Greet {name} by name. "
        f"Lead immediately with this catch-up (in your own words): {catchup_hint} "
        "Then ask what they want to know. Keep it warm and short. "
        "Do not ask if they want a catch-up — just give it.]"
    )
