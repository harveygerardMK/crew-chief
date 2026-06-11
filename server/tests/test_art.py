"""Art pairing tests."""

from __future__ import annotations

import json
from pathlib import Path

from art import derive_status_tags, lookup_nga_image
from config import Settings


def test_derive_status_tags_pre_race() -> None:
    tags = derive_status_tags({"route_mile": None, "race_status": "unknown"}, race_started=False)
    assert "early" in tags


def test_derive_status_tags_deep_mile() -> None:
    tags = derive_status_tags({"route_mile": 145.0, "current_speed_mph": 2.1}, race_started=True)
    assert "deep" in tags
    assert "shuffle" in tags


def test_lookup_nga_image(tmp_path: Path) -> None:
    pairings = tmp_path / "art-pairings.json"
    pairings.write_text(
        json.dumps(
            [
                {
                    "title": "Test Painting",
                    "artist": "Test Artist",
                    "image_url": "https://example.com/art.jpg",
                    "tags": ["early", "shuffle"],
                }
            ]
        ),
        encoding="utf-8",
    )
    settings = Settings(
        anthropic_api_key=None,
        claude_model="claude-sonnet-4-20250514",
        claude_max_tokens=1000,
        voice_path=tmp_path / "voice.md",
        fallback_path=tmp_path / "fallback.md",
        status_path=tmp_path / "status.json",
        visitors_path=tmp_path / "visitors.json",
        cors_origins=["*"],
        github_token=None,
        github_owner="test",
        github_repo="test",
        github_branch="main",
        visitors_export_path="data/visitors.json",
        art_pairings_path=pairings,
        aid_stations_path=Path(__file__).resolve().parents[2] / "data" / "aid-stations.json",
        segments_path=Path(__file__).resolve().parents[2] / "data" / "segments.json",
        questions_path=tmp_path / "questions.json",
        notes_path=tmp_path / "notes.json",
    )
    url = lookup_nga_image(settings, {"route_mile": None})
    assert url == "https://example.com/art.jpg"
