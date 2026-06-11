"""Tests for prompt assembly helpers."""

from __future__ import annotations

from config import load_settings
from prompt import (
    build_system_prompt,
    load_agent_context,
    load_course_content,
    load_crew_map_block,
    load_crew_ops_content,
)

# Stay under Anthropic org TPM (30k input/min) with headroom for user + history.
MAX_REMOTE_PRE_RACE_PROMPT_CHARS = 80_000


def test_load_course_content_returns_nonempty_string() -> None:
    text = load_course_content()
    assert isinstance(text, str)
    assert len(text) > 100


def test_load_course_content_remote_is_smaller_than_full() -> None:
    remote = load_course_content(audience="remote", race_is_live=False)
    full = load_course_content(audience="on_course", race_is_live=True)
    assert len(remote) < len(full)
    assert "course" in remote.lower()


def test_load_course_content_full_includes_pacer_and_rules() -> None:
    text = load_course_content(audience="on_course", race_is_live=True)
    assert "pacer" in text.lower()
    assert "rules" in text.lower()


def test_load_crew_ops_content_remote_pre_race_is_compact() -> None:
    text = load_crew_ops_content(audience="remote", race_is_live=False)
    assert len(text) > 500
    assert "crew schedule" in text.lower() or "june 12" in text.lower()
    assert "master supply list" not in text.lower()


def test_load_crew_ops_content_on_course_includes_drop_bags() -> None:
    text = load_crew_ops_content(audience="on_course", race_is_live=False)
    assert "drop bag" in text.lower()


def test_load_crew_ops_content_loads_heavy_docs_on_keyword() -> None:
    text = load_crew_ops_content(
        audience="on_course",
        race_is_live=False,
        message="What's on the master supply list?",
    )
    assert "master supply list" in text.lower()


def test_load_crew_map_block_includes_my_maps_url() -> None:
    text = load_crew_map_block()
    assert "1hDy3W90tn-FWzyzCNs5yWMKOBYy7pg4" in text
    assert "Loon Lake" in text
    assert "google.com/maps/search" in text


def test_load_crew_map_block_compact_omits_pin_table() -> None:
    full = load_crew_map_block(compact=False)
    compact = load_crew_map_block(compact=True)
    assert len(compact) < len(full)
    assert "google.com/maps/search" not in compact


def test_remote_pre_race_system_prompt_under_rate_limit_budget() -> None:
    settings = load_settings()
    status = {
        "enabled": False,
        "race_status": "anxious",
        "route_mile": 0,
        "simulation": False,
        "course_context": {"place_label": "on leg Start → Heavenly"},
    }
    visitor = {"name": "Dan", "audience": "remote", "checkin_count": 0}
    prompt = build_system_prompt(settings, status=status, visitor=visitor)
    assert len(prompt) < MAX_REMOTE_PRE_RACE_PROMPT_CHARS


def test_load_agent_context_returns_none_for_unknown() -> None:
    assert load_agent_context("Random Person") is None


def test_load_agent_context_matches_amanda() -> None:
    # Requires agent-context/amanda.md (created in Task 3)
    result = load_agent_context("Amanda")
    assert result is not None
    assert "amanda" in result.lower() or "crew" in result.lower()


def test_load_agent_context_matches_nickname_gangle() -> None:
    # Requires agent-context/brendan.md (created in Task 4)
    result = load_agent_context("Gangle")
    assert result is not None
    assert "brendan" in result.lower() or "barker" in result.lower()


def test_load_agent_context_matches_queen_z() -> None:
    # Requires agent-context/zuzy.md (created in Task 5)
    result = load_agent_context("Queen Z")
    assert result is not None
    assert "zuzy" in result.lower() or "tahoe city" in result.lower()
