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
