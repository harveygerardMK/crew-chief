"""Race data block tests."""

from pathlib import Path

import pytest

from config import REPO_ROOT, Settings
from race_data import (
    SCOPE_LOCK,
    _build_race_data_block,
    _load_local_aid_stations,
    get_race_data_block,
    reset_race_data_cache,
    warm_race_data_cache,
)


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    reset_race_data_cache()
    yield
    reset_race_data_cache()


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    aid = tmp_path / "aid-stations.json"
    aid.write_text(
        '[{"name": "Start", "mile": 0, "cutoff": "Fri 9:00 AM", "crew_access": true, "notes": "Go"}]',
        encoding="utf-8",
    )
    return Settings(
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
        art_pairings_path=tmp_path / "art-pairings.json",
        aid_stations_path=aid,
        segments_path=REPO_ROOT / "data" / "segments.json",
        questions_path=tmp_path / "questions.json",
        notes_path=tmp_path / "notes.json",
        langfuse_public_key=None,
        langfuse_secret_key=None,
        langfuse_base_url="https://cloud.langfuse.com",
    )


def test_scope_lock_present() -> None:
    assert "Western States" in SCOPE_LOCK


def test_race_data_block_includes_aid_table(settings: Settings) -> None:
    warm_race_data_cache(settings)
    block = get_race_data_block(settings)
    assert "RACE DATA" in block
    assert "Start" in block
    assert "confirm with crew before moving" in block
    assert "Sierra at Tahoe" in block or "52.2" in block


def test_first_day_aids_lists_all_friday_stations(settings: Settings) -> None:
    stations = _load_local_aid_stations(
        Settings(
            **{
                **settings.__dict__,
                "aid_stations_path": REPO_ROOT / "data" / "aid-stations.json",
            }
        )
    )
    block = _build_race_data_block(stations)
    assert "First race day (Friday)" in block
    assert "Housewife Hill" in block
    assert "Armstrong Pass" in block
    assert "Heavenly" in block
    assert "Sat 11:30 AM" in block
    assert "do not omit stations" in block.lower()
