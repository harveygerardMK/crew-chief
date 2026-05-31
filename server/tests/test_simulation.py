"""Regression tests for simulation track milestones."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from simulate_race import CHAPTERS, should_inject_stale, slice_pings  # noqa: E402

TRACK = REPO_ROOT / "data" / "simulation_track.json"


@pytest.fixture
def pings() -> list[dict]:
    if not TRACK.is_file():
        pytest.skip("simulation_track.json not generated")
    return json.loads(TRACK.read_text(encoding="utf-8"))


def test_track_has_623_pings(pings: list[dict]) -> None:
    assert len(pings) == 623
    assert pings[0]["point"] == 1
    assert pings[-1]["point"] == 623


@pytest.mark.parametrize(
    ("chapter", "point", "flag"),
    [
        ("aid-station", 197, "aid_station"),
        ("signal-gap", 241, "signal_gap"),
        ("sleep", 333, "sleep_station"),
        ("dnf", 568, "dnf_zone"),
    ],
)
def test_chapter_milestones(pings: list[dict], chapter: str, point: int, flag: str) -> None:
    assert CHAPTERS[chapter] == point
    row = next(p for p in pings if p["point"] == point)
    assert row.get("flag") == flag


def test_slice_from_chapter(pings: list[dict]) -> None:
    sliced = slice_pings(pings, chapter="dnf")
    assert sliced[0]["point"] == 568
    assert len(sliced) == 623 - 568 + 1


def test_signal_gap_is_65_minutes(pings: list[dict]) -> None:
    p240 = next(p for p in pings if p["point"] == 240)
    p241 = next(p for p in pings if p["point"] == 241)
    assert p241["minutes_since_start"] - p240["minutes_since_start"] == 65


def test_stale_injection_for_signal_gap(pings: list[dict]) -> None:
    p241 = next(p for p in pings if p["point"] == 241)
    assert should_inject_stale(gap_minutes=65, next_ping=p241, inject_stale=True)


def test_stale_injection_off(pings: list[dict]) -> None:
    p241 = next(p for p in pings if p["point"] == 241)
    assert not should_inject_stale(gap_minutes=65, next_ping=p241, inject_stale=False)
