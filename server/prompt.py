"""Build Claude system prompts from voice.md and live context."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from pathlib import Path

from broadcast import format_missed_updates_block, get_broadcast_block
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
_CONTENT_PAGE_REMOTE = [
    "about-the-race.md",
    "course-overview.md",
]


_CREW_OPS_DIR = REPO_ROOT / "docs"
_CREW_OPS_REMOTE = ["crew-schedule.md", "race-comms.md"]
_CREW_OPS_ON_COURSE_CORE = [
    "crew-schedule.md",
    "race-comms.md",
    "drop-bags.md",
]
_CREW_OPS_HEAVY = [
    "aid-station-crew-lists.md",
    "master-supply-list.md",
    "contingency-plan.md",
]
_LOGISTICS_KEYWORDS = (
    "drop bag",
    "drop-bag",
    "gear",
    "pack",
    "packing",
    "supply",
    "supplies",
    "contingency",
    "backup",
    "plan b",
    "crew list",
    "what to bring",
    "master list",
    "vehicle stock",
)
_PACER_KEYWORDS = ("pacer", "pickup", "pick up", "barker pass")
_TAHOE200_CREW_MAP_URL = (
    "https://www.google.com/maps/d/viewer?mid=1hDy3W90tn-FWzyzCNs5yWMKOBYy7pg4&usp=sharing"
)
_KML_NS = "http://www.opengis.net/kml/2.2"


def load_course_content(*, audience: str = "remote", race_is_live: bool = False) -> str:
    pages = _CONTENT_PAGE_ORDER if audience == "on_course" or race_is_live else _CONTENT_PAGE_REMOTE
    parts = []
    for filename in pages:
        path = _CONTENT_PAGES_DIR / filename
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8").strip())
    return "\n\n---\n\n".join(parts)


def _message_matches_keywords(message: str | None, keywords: tuple[str, ...]) -> bool:
    if not message:
        return False
    lower = message.lower()
    return any(keyword in lower for keyword in keywords)


def _crew_ops_filenames(
    *,
    audience: str,
    race_is_live: bool,
    message: str | None,
) -> list[str]:
    if audience == "remote":
        docs = list(_CREW_OPS_REMOTE)
        if race_is_live and _message_matches_keywords(message, _LOGISTICS_KEYWORDS):
            docs.append("drop-bags.md")
        return docs

    docs = list(_CREW_OPS_ON_COURSE_CORE)
    if race_is_live or _message_matches_keywords(message, _PACER_KEYWORDS):
        docs.append("pacer-logistics.md")
    if race_is_live or _message_matches_keywords(message, _LOGISTICS_KEYWORDS):
        docs.extend(_CREW_OPS_HEAVY)
    return docs


def _load_crew_ops_docs(filenames: list[str]) -> str:
    parts = []
    for filename in filenames:
        path = _CREW_OPS_DIR / filename
        if path.is_file():
            parts.append(path.read_text(encoding="utf-8").strip())
    return "\n\n---\n\n".join(parts)


def load_crew_ops_content(
    *,
    audience: str = "remote",
    race_is_live: bool = False,
    message: str | None = None,
) -> str:
    """Race-week crew logistics — tiered to keep Claude prompts under rate limits."""
    filenames = _crew_ops_filenames(
        audience=audience,
        race_is_live=race_is_live,
        message=message,
    )
    return _load_crew_ops_docs(filenames)


def _maps_search_url(lat: float, lng: float) -> str:
    return f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"


def _parse_kml_placemarks(path: Path) -> list[tuple[str, float, float]]:
    if not path.is_file():
        return []
    root = ET.parse(path).getroot()
    tag = f"{{{_KML_NS}}}"
    rows: list[tuple[str, float, float]] = []
    for placemark in root.iter(f"{tag}Placemark"):
        name_el = placemark.find(f"{tag}name")
        coord_el = placemark.find(f".//{tag}coordinates")
        if name_el is None or coord_el is None or not (coord_el.text or "").strip():
            continue
        name = (name_el.text or "").strip()
        bits = coord_el.text.strip().split(",")
        if len(bits) < 2:
            continue
        lng, lat = float(bits[0]), float(bits[1])
        rows.append((name, lat, lng))
    return rows


def load_crew_map_block(*, compact: bool = False) -> str:
    """Interactive crew map URL plus compact pin list from tahoe200-locations.kml."""
    kml_path = _CREW_OPS_DIR / "tahoe200-locations.kml"
    lines = [
        "## Crew / pacer map",
        f"Interactive Google My Map (all aids, crew stops, parking, pacer pickups): {_TAHOE200_CREW_MAP_URL}",
        "Color key: green = crew vehicle access; blue = drop bag only (no crew); "
        "red = sleep station; yellow = pacer pickup; purple = crew parking (walk to aid).",
        "",
        "For driving directions, share the map link or a pin below — do not invent roads or parking.",
    ]
    if compact:
        return "\n".join(lines)
    placemarks = _parse_kml_placemarks(kml_path)
    if placemarks:
        lines.append("")
        lines.append("| Location | Maps |")
        lines.append("|----------|------|")
        for name, lat, lng in placemarks:
            safe_name = name.replace("|", "/")
            lines.append(f"| {safe_name} | {_maps_search_url(lat, lng)} |")
    return "\n".join(lines)


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
    missed_updates: list[dict] | None = None,
    message: str | None = None,
) -> str:
    audience = resolve_audience(visitor)
    status_race_status = str(status.get("race_status") or "").lower()
    race_is_live = settings.race_started or status_race_status in {
        "racing",
        "sleeping",
        "finished",
        "active",
    }
    map_is_compact = audience == "remote" and not race_is_live

    parts = [
        SCOPE_LOCK,
        NILBOG_SCOPE,
        get_race_data_block(settings),
        load_voice(settings),
    ]
    profile = load_harvey_profile()
    if profile:
        parts.append(profile)
    course_content = load_course_content(audience=audience, race_is_live=race_is_live)
    if course_content:
        parts.append(f"## Course & race context\n\n{course_content}")
    crew_ops = load_crew_ops_content(
        audience=audience,
        race_is_live=race_is_live,
        message=message,
    )
    if crew_ops:
        parts.append(
            "## Crew operations & logistics (authoritative)\n\n"
            "Use for drop bags, crew packing, schedule, pacer legs, comms, and contingencies. "
            "Harvey defers live dispatch to Amanda, but may answer from these plans in his voice.\n\n"
            f"{crew_ops}"
        )
    crew_map = load_crew_map_block(compact=map_is_compact)
    if crew_map:
        parts.append(crew_map)
    broadcast = get_broadcast_block(settings)
    if broadcast:
        parts.append(broadcast)

    if missed_updates:
        missed_block = format_missed_updates_block(missed_updates)
        if missed_block:
            parts.append(missed_block)

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

    tone = AUDIENCE_TONE.get(audience)
    if tone:
        parts.append(f"## Audience tone for this chat\n{tone}")

    # Treat as on-course if the clock says so OR if the injected/live status says racing/sleeping/finished.
    # The status-based check lets the eval suite test mid-race scenarios before June 12.
    if not race_is_live:
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


def build_greeting_user_message(
    visitor: dict,
    *,
    status: dict,
    settings: Settings,
    missed_updates: list[dict] | None = None,
) -> str:
    name = visitor.get("name", "friend")
    count = int(visitor.get("checkin_count", 0))
    variety = _greeting_variety_hint(visitor)
    crew_hint = ""
    if missed_updates:
        if count == 0:
            crew_hint = (
                f"\n\nAmanda's latest crew update is shown above your message with photos. "
                "Mention the headline (how you're doing, last aid, any note) in your greeting. "
                "Do not repeat every field verbatim."
            )
        else:
            crew_hint = (
                f"\n\nAmanda posted {len(missed_updates)} crew update(s) since their last visit — "
                "the app is showing those above your message with photos. "
                "Weave the key lines into your greeting (how you're doing, last aid, any note). "
                "Do not repeat every field verbatim."
            )

    if count == 0:
        return (
            f"[Session start — first visit. Greet {name} warmly by name. "
            "Introduce yourself briefly as Harvey on the Tahoe 200 journey. "
            "Mention where you are on course using the course position block if mile data exists. "
            "If Amanda posted a crew update, weave it in briefly. "
            "Invite them to ask how you're doing. Keep it short.\n\n"
            f"{variety}{crew_hint}]"
        )

    catchup = format_catchup_block(visitor, status, settings)
    catchup_hint = catchup.split("\n", 1)[1] if catchup else "Summarize progress since their last visit."

    return (
        f"[Session start — return visit. Greet {name} by name. "
        "Start with a fresh opener (one or two sentences), then catch-up — do not open with the same "
        "socks/prep/site-tour bit you used last time.\n\n"
        f"{variety}\n\n"
        f"Catch-up to weave in (your own words): {catchup_hint} "
        "Cover miles/progress first, then any new crew posts."
        f"{crew_hint} "
        "Then ask what they want to know. Keep it warm and short. "
        "Do not ask if they want a catch-up — just give it.]"
    )
