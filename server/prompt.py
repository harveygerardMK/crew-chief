"""Build Claude system prompts from voice.md and live context."""

from __future__ import annotations

from config import REPO_ROOT, Settings
from course_context import format_catchup_block
from race_data import SCOPE_LOCK, get_race_data_block
from status import format_status_block
from visitors import format_visitor_block, resolve_audience

NILBOG_SCOPE = """NILBOG — SCOPE EXCEPTION (read with SCOPE LOCK above):
Nilbog is Harvey and Amanda's **Pomeranian**. He lights their life — smelly toes and all. Household, not another race.
Questions about Nilbog, the dog, how he's doing at home, smelly toes, or Amanda watching him are **in scope**.
Answer warmly per voice.md (Amanda's got him, he's fine, Harvey misses those toes). Then race status if they also asked.
**Never** use scope-lock deflection ("I only know my race…") for Nilbog or dog questions.
Nilbog is not a trail name, aid station, town on course, or DNF signal.
If the visitor's display name contains "Nilbog", still answer the **dog** question normally."""

GREETING_OPENER_THEMES: tuple[str, ...] = (
    "Nilbog at home — smelly toes, Amanda has him, you miss him",
    "drop bags or gear second-guessing (fresh angle, not the same joke twice)",
    "crew nerves or how much you trust Amanda and the crew plan",
    "why you're doing 200 miles — short, honest, not a speech",
    "height joke or self-deprecating line if it fits naturally",
    "night-two / sleep-station dread in general terms (pre-race: anticipation only)",
    "something you're looking forward to on course (view, sunrise leg, grilled cheese)",
)

AUDIENCE_TONE: dict[str, str] = {
    "on_course": (
        "Tone: **On course** — operational, brief, clear. They know the plan; "
        "give status, next crew-access aids, cutoffs, and what the crew should prep."
    ),
    "remote": (
        "Tone: **Remote** — warm, reassuring, less jargon. Pulse-check: moving vs resting, "
        "where on course, don't invent detail. Shield from gratuitous suffering without lying."
    ),
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


_CONTENT_PAGES_DIR = REPO_ROOT / "src" / "content" / "pages"
_CONTENT_PAGE_ORDER = [
    "about-the-race.md",
    "course-overview.md",
    "pacer-onboarding.md",
    "rules-summary.md",
]


def load_course_content() -> str:
    parts = []
    for filename in _CONTENT_PAGE_ORDER:
        path = _CONTENT_PAGES_DIR / filename
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8").strip())
    return "\n\n---\n\n".join(parts)


_AGENT_CONTEXT_DIR = REPO_ROOT / "agent-context"


def _build_context_filename_map() -> dict[str, str]:
    from known_people import _load_known_people, _normalize_name
    mapping: dict[str, str] = {}
    for person in _load_known_people():
        aliases = person.get("match_names") or []
        if not aliases:
            continue
        canonical = _normalize_name(str(aliases[0])).replace(" ", "-")
        for alias in aliases:
            mapping[_normalize_name(str(alias))] = canonical
    return mapping


_CONTEXT_FILENAME_MAP: dict[str, str] = {}


def _get_context_filename_map() -> dict[str, str]:
    global _CONTEXT_FILENAME_MAP
    if not _CONTEXT_FILENAME_MAP:
        _CONTEXT_FILENAME_MAP = _build_context_filename_map()
    return _CONTEXT_FILENAME_MAP


def load_agent_context(visitor_name: str) -> str | None:
    from known_people import _normalize_name
    normalized = _normalize_name(visitor_name)
    if not normalized:
        return None
    filename_stem = _get_context_filename_map().get(normalized)
    if not filename_stem:
        return None
    path = _AGENT_CONTEXT_DIR / f"{filename_stem}.md"
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8").strip()


def load_fallback(settings: Settings) -> str:
    if settings.fallback_path.is_file():
        return settings.fallback_path.read_text(encoding="utf-8").strip()
    return "Harvey here — chat is temporarily down. He's still out there."


def format_pre_race_mode_block(status: dict) -> str:
    """Pre-race instructions with simulation and signal-gap transparency."""
    lines = [
        "## Pre-race mode",
        "Harvey **has not started** the Tahoe 200 yet (starts June 12, 2026, 9:00 AM PDT). "
        "Say that plainly. He is training, planning, and probably overthinking drop bags. "
        "Answer questions about the upcoming race, why he's doing this, and how preparation is going.",
        "",
        "When someone is new or asks what this site does, briefly explain what will be here "
        "once the race is live (keep it short, then back to prep in Harvey's voice):",
        "- Live mile/speed/last ping in the header when the tracker is on",
        "- Ask-Harvey chat grounded in real tracker data",
        "- Art cards on 'how is he doing?' during the race",
        "- Clear signal-gap messaging when GPS goes quiet (normal on a 200)",
        "- Crew site for official family/crew updates (wheresharvey.com)",
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


def message_mentions_nilbog(text: str) -> bool:
    return "nilbog" in text.lower()


def augment_chat_user_message(message: str) -> str:
    """Reinforce Nilbog=dog when the visitor asks, so scope lock does not misfire."""
    if not message_mentions_nilbog(message):
        return message
    return (
        f"{message}\n\n"
        "[System note: Nilbog is Harvey and Amanda's Pomeranian at home — "
        "answer about the dog per voice.md; do not scope-lock deflect.]"
    )


def build_system_prompt(
    settings: Settings,
    *,
    status: dict,
    visitor: dict,
    include_art: bool = False,
) -> str:
    parts = [
        SCOPE_LOCK,
        NILBOG_SCOPE,
        get_race_data_block(settings),
        load_voice(settings),
    ]
    profile = load_harvey_profile()
    if profile:
        parts.append(profile)
    course_content = load_course_content()
    if course_content:
        parts.append(f"## Course & race context\n\n{course_content}")
    parts.extend(
        [
            format_status_block(status),
            format_visitor_block(visitor),
        ]
    )

    agent_context = load_agent_context(str(visitor.get("name") or ""))
    if agent_context:
        parts.append(f"## Personal context for this visitor\n\n{agent_context}")

    catchup = format_catchup_block(visitor, status, settings)
    if catchup:
        parts.append(catchup)

    audience = resolve_audience(visitor)
    tone = AUDIENCE_TONE.get(audience)
    if tone:
        parts.append(f"## Audience tone for this chat\n{tone}")

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


def _greeting_variety_hint(visitor: dict) -> str:
    count = int(visitor.get("checkin_count", 0))
    theme = GREETING_OPENER_THEMES[count % len(GREETING_OPENER_THEMES)]
    lines = [
        "Open with a **fresh** moment in Harvey's voice — not the same prep script every time.",
        f"Suggested angle for this opener (use or riff): {theme}.",
        "See voice.md — Session openers (vary every time).",
    ]
    last_hook = str(visitor.get("last_greeting_hook") or "").strip()
    if last_hook:
        lines.append(f"Do **not** repeat this previous opener: {last_hook}")
    return "\n".join(lines)


def build_greeting_user_message(visitor: dict, *, status: dict, settings: Settings) -> str:
    name = visitor.get("name", "friend")
    count = int(visitor.get("checkin_count", 0))
    variety = _greeting_variety_hint(visitor)

    if count == 0:
        return (
            f"[Session start — first visit. Greet {name} warmly by name. "
            "Introduce yourself briefly as Harvey on the Tahoe 200 journey. "
            "Mention where you are on course using the course position block if mile data exists. "
            "Invite them to ask how you're doing. Keep it short.\n\n"
            f"{variety}]"
        )

    catchup = format_catchup_block(visitor, status, settings)
    catchup_hint = catchup.split("\n", 1)[1] if catchup else "Summarize progress since their last visit."

    return (
        f"[Session start — return visit. Greet {name} by name. "
        "Start with a fresh opener (one or two sentences), then catch-up — do not open with the same "
        "socks/prep/site-tour bit you used last time.\n\n"
        f"{variety}\n\n"
        f"Catch-up to weave in (your own words): {catchup_hint} "
        "Then ask what they want to know. Keep it warm and short. "
        "Do not ask if they want a catch-up — just give it.]"
    )
