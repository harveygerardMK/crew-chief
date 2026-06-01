"""Tests for prompt assembly helpers."""

from __future__ import annotations

from config import REPO_ROOT
from prompt import load_course_content


def test_load_course_content_returns_nonempty_string() -> None:
    text = load_course_content()
    assert isinstance(text, str)
    assert len(text) > 100


def test_load_course_content_includes_all_pages() -> None:
    text = load_course_content()
    assert "course" in text.lower()
    assert "pacer" in text.lower()
    assert "rules" in text.lower()


from prompt import load_agent_context


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
