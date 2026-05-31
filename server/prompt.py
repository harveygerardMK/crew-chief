"""Build Claude system prompts from voice.md and live context."""

from __future__ import annotations

from config import Settings
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


def load_fallback(settings: Settings) -> str:
    if settings.fallback_path.is_file():
        return settings.fallback_path.read_text(encoding="utf-8").strip()
    return "Harvey here — chat is temporarily down. He's still out there."


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
        format_status_block(status),
        format_visitor_block(visitor),
    ]

    relationship = str(visitor.get("relationship", "")).lower()
    tone = RELATIONSHIP_TONE.get(relationship)
    if tone:
        parts.append(f"## Relationship tone for this chat\n{tone}")

    if not settings.race_started:
        parts.append(
            "## Pre-race mode\n"
            "The race has not started yet (starts June 12, 2026, 9:00 AM PDT). "
            "Harvey is training, planning, and probably overthinking drop bags. "
            "Answer questions about the upcoming race, why he's doing this, and how preparation is going. "
            "Be honest that live tracker data may be absent or from test events."
        )
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
            "If they ask for a catch-up (yes to your offer), summarize miles covered and aid stations "
            "passed since their last check-in using last_harvey_mile vs current mile in the status block. "
            "Mention notable time gaps only when data supports it."
        )

    parts.append(RESPONSE_FORMAT_WITH_ART if include_art else RESPONSE_FORMAT_REPLY_ONLY)
    return "\n\n".join(parts)


def build_greeting_user_message(visitor: dict, *, status: dict) -> str:
    name = visitor.get("name", "friend")
    count = int(visitor.get("checkin_count", 0))
    if count == 0:
        return (
            f"[Session start — first visit. Greet {name} warmly by name. "
            "Introduce yourself briefly as Harvey on the Tahoe 200 journey. "
            "Invite them to ask how you're doing. Keep it short.]"
        )

    mile = status.get("route_mile")
    status_bits = []
    if mile is not None:
        status_bits.append(f"you are around mile {mile}")
    race_status = status.get("race_status")
    if race_status and race_status != "unknown":
        status_bits.append(f"race status: {race_status}")
    status_line = f" State briefly that {', '.join(status_bits)}." if status_bits else ""

    last_mile = visitor.get("last_harvey_mile")
    mile_note = f" They last saw you around mile {last_mile}." if last_mile is not None else ""

    return (
        f"[Session start — return visit. Greet {name} by name.{status_line}{mile_note} "
        "Ask: \"Want a quick catch-up since you last checked in?\" "
        "Do not give the full catch-up yet — wait for them to say yes. "
        "Keep it short and warm.]"
    )
