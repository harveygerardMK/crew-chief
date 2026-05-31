"""Server tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from claude import _parse_model_json, fallback_response
from config import Settings
from prompt import build_greeting_user_message, build_system_prompt
from status import load_status
from visitors import InvalidRelationship, create_visitor, get_visitor, record_checkin


@pytest.fixture
def settings(tmp_path: Path) -> Settings:
    voice = tmp_path / "voice.md"
    voice.write_text("# Harvey\nTalk like Harvey.", encoding="utf-8")
    fallback = tmp_path / "fallback.md"
    fallback.write_text("Fallback message.", encoding="utf-8")
    status = tmp_path / "harvey_status.json"
    status.write_text(
        json.dumps(
            {
                "enabled": True,
                "fetched_at": "2026-06-12T12:00:00Z",
                "race_status": "active",
                "route_mile": 87.2,
                "stale": False,
                "data_stale": False,
            }
        ),
        encoding="utf-8",
    )
    visitors = tmp_path / "visitors.json"
    visitors.write_text('{"visitors": []}\n', encoding="utf-8")
    return Settings(
        anthropic_api_key=None,
        claude_model="claude-sonnet-4-20250514",
        claude_max_tokens=1000,
        voice_path=voice,
        fallback_path=fallback,
        status_path=status,
        visitors_path=visitors,
        cors_origins=["*"],
        github_token=None,
        github_owner="test",
        github_repo="test",
        github_branch="main",
        visitors_export_path="data/visitors.json",
    )


def test_create_and_get_visitor(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", relationship="friend")
    loaded = get_visitor(settings, visitor["id"])
    assert loaded["name"] == "Dan"
    assert loaded["checkin_count"] == 0


def test_invalid_relationship(settings: Settings) -> None:
    with pytest.raises(InvalidRelationship):
        create_visitor(settings, name="Dan", relationship="enemy")


def test_record_checkin_updates_mile(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Amanda", relationship="family")
    updated = record_checkin(settings, visitor["id"], harvey_mile=42.0)
    assert updated["checkin_count"] == 1
    assert updated["last_harvey_mile"] == 42.0


def test_load_status_missing(tmp_path: Path) -> None:
    status = load_status(tmp_path / "missing.json")
    assert status["enabled"] is False


def test_parse_model_json() -> None:
    out = _parse_model_json('{"reply": "Hey.", "art_prompt": "Starry Night, van Gogh — tired but moving."}')
    assert out["reply"] == "Hey."
    assert "Starry Night" in out["art_prompt"]


def test_greeting_message_first_visit(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", relationship="friend")
    msg = build_greeting_user_message(visitor)
    assert "Dan" in msg or "first visit" in msg.lower()


def test_greeting_message_return_visit(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", relationship="friend")
    record_checkin(settings, visitor["id"], harvey_mile=50.0)
    visitor = get_visitor(settings, visitor["id"])
    msg = build_greeting_user_message(visitor)
    assert "50" in msg


def test_system_prompt_includes_status(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", relationship="friend")
    status = load_status(settings.status_path)
    prompt = build_system_prompt(settings, status=status, visitor=visitor)
    assert "87.2" in prompt
    assert "friend" in prompt.lower()
    assert "Tone: **Friend**" in prompt


def test_system_prompt_pacer_tone(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Alex", relationship="pacer")
    status = load_status(settings.status_path)
    prompt = build_system_prompt(settings, status=status, visitor=visitor)
    assert "Tone: **Pacer**" in prompt
    assert "pacer" in prompt.lower()


def test_fallback_response(settings: Settings) -> None:
    out = fallback_response(settings)
    assert "Fallback message" in out["reply"]
    assert out["art_prompt"]


def test_api_endpoints(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    import app as app_module

    monkeypatch.setattr(app_module, "settings", settings)
    client = TestClient(app_module.app)

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["ok"] is True

    ready = client.get("/ready")
    assert ready.status_code == 200
    body = ready.json()
    assert body["ok"] is True
    assert body["claude_configured"] is False
    assert body["status_file_readable"] is True
    assert body["race_status"] == "active"

    status = client.get("/status")
    assert status.json()["route_mile"] == 87.2

    created = client.post("/visitors", json={"name": "Dan", "relationship": "friend"})
    assert created.status_code == 200
    visitor_id = created.json()["visitor_id"]

    chat = client.post("/chat", json={"visitor_id": visitor_id})
    assert chat.status_code == 200
    body = chat.json()
    assert body["fallback"] is True
    assert "Fallback message" in body["reply"]
    assert body["art_prompt"]

    updated = get_visitor(settings, visitor_id)
    assert updated["checkin_count"] == 1
