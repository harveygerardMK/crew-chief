"""Tests for known-people lookup."""

from __future__ import annotations

from known_people import format_known_person_block, lookup_known_person
from visitors import format_visitor_block


def test_lookup_gangle_aliases() -> None:
    assert lookup_known_person("Gangle") is not None
    assert lookup_known_person("brendan") is not None
    assert lookup_known_person("Gangl") is not None


def test_lookup_queen_z() -> None:
    person = lookup_known_person("Queen Z")
    assert person is not None
    assert "Zuzy" in person["label"]


def test_lookup_amanda() -> None:
    person = lookup_known_person("Amanda")
    assert person is not None
    assert "wife" in person["label"].lower()


def test_unknown_name_returns_none() -> None:
    assert lookup_known_person("Random Person") is None


def test_format_visitor_block_includes_known_person() -> None:
    block = format_visitor_block(
        {
            "name": "Gangle",
            "relationship": "pacer",
            "checkin_count": 0,
            "last_seen": "2026-06-12T12:00:00Z",
        }
    )
    assert "Known person" in block
    assert "leg B" in block
    assert "Gangle" in block


def test_format_known_person_block_includes_notes() -> None:
    person = lookup_known_person("Amanda")
    assert person is not None
    block = format_known_person_block(person)
    assert "Amanda" in block
    assert "rock" in block.lower()
