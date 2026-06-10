"""Server tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from claude import _parse_model_json, fallback_response
from config import REPO_ROOT, Settings
from prompt import build_greeting_user_message, build_system_prompt
from status import load_status
from visitors import InvalidAudience, create_visitor, get_visitor, record_checkin, resolve_audience


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
        art_pairings_path=tmp_path / "art-pairings.json",
        aid_stations_path=REPO_ROOT / "data" / "aid-stations.json",
        segments_path=REPO_ROOT / "data" / "segments.json",
        questions_path=tmp_path / "questions.json",
        notes_path=tmp_path / "notes.json",
        langfuse_public_key=None,
        langfuse_secret_key=None,
        langfuse_base_url="https://cloud.langfuse.com",
    )


def test_create_and_get_visitor(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", audience="remote")
    loaded = get_visitor(settings, visitor["id"])
    assert loaded["name"] == "Dan"
    assert loaded["audience"] == "remote"
    assert loaded["checkin_count"] == 0


def test_invalid_audience(settings: Settings) -> None:
    with pytest.raises(InvalidAudience):
        create_visitor(settings, name="Dan", audience="enemy")


def test_record_checkin_updates_mile(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Amanda", audience="remote")
    updated = record_checkin(settings, visitor["id"], harvey_mile=42.0)
    assert updated["checkin_count"] == 1
    assert updated["last_harvey_mile"] == 42.0


def test_load_status_missing(tmp_path: Path) -> None:
    status = load_status(tmp_path / "missing.json")
    assert status["enabled"] is False


def test_parse_model_json() -> None:
    out = _parse_model_json(
        '{"reply": "Hey.", "art_prompt": "Starry Night, van Gogh — tired but moving."}',
        require_art=True,
    )
    assert out["reply"] == "Hey."
    assert "Starry Night" in out["art_prompt"]
    reply_only = _parse_model_json('{"reply": "Hey."}', require_art=False)
    assert "art_prompt" not in reply_only


def test_greeting_message_first_visit(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", audience="remote")
    status = load_status(settings.status_path)
    msg = build_greeting_user_message(visitor, status=status, settings=settings)
    assert "Dan" in msg or "first visit" in msg.lower()


def test_greeting_message_return_visit(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", audience="remote")
    record_checkin(settings, visitor["id"], harvey_mile=50.0)
    visitor = get_visitor(settings, visitor["id"])
    status = load_status(settings.status_path)
    msg = build_greeting_user_message(visitor, status=status, settings=settings)
    assert "catch-up" in msg.lower() or "fresh opener" in msg.lower()
    assert "vary" in msg.lower() or "fresh" in msg.lower()
    assert "wait for them to say yes" not in msg.lower()


def test_greeting_message_variety_hint(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", audience="remote")
    visitor["last_greeting_hook"] = "socks and drop bags again"
    status = load_status(settings.status_path)
    msg = build_greeting_user_message(visitor, status=status, settings=settings)
    assert "socks and drop bags" in msg
    assert "fresh" in msg.lower()


def test_system_prompt_includes_status(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", audience="remote")
    status = load_status(settings.status_path)
    prompt = build_system_prompt(settings, status=status, visitor=visitor)
    assert "SCOPE LOCK" in prompt
    assert "RACE DATA" in prompt
    assert "87.2" in prompt
    assert "remote" in prompt.lower() or "afar" in prompt.lower()
    assert "Tone: **Remote**" in prompt
    assert "loosely held" in prompt.lower() or "harvey.md" in prompt.lower()


def test_system_prompt_pacer_tone(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Alex", audience="on_course")
    status = load_status(settings.status_path)
    prompt = build_system_prompt(settings, status=status, visitor=visitor)
    assert "Tone: **On course**" in prompt
    assert "on course" in prompt.lower()


def test_system_prompt_nilbog_scope_exception(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Sarah", audience="remote")
    status = load_status(settings.status_path)
    prompt = build_system_prompt(settings, status=status, visitor=visitor)
    assert "NILBOG" in prompt
    assert "Pomeranian" in prompt
    assert "Never" in prompt and "only know my race" in prompt
    assert prompt.index("NILBOG — SCOPE EXCEPTION") < prompt.index("## RACE DATA")


def test_augment_chat_user_message_nilbog() -> None:
    from prompt import augment_chat_user_message

    out = augment_chat_user_message("How is Nilbog doing?")
    assert "Pomeranian" in out
    assert "How is Nilbog doing?" in out
    assert augment_chat_user_message("Where is Harvey?") == "Where is Harvey?"


def test_pre_race_simulation_block_in_prompt(settings: Settings) -> None:
    visitor = create_visitor(settings, name="Dan", audience="remote")
    status = {
        "enabled": True,
        "route_mile": 4.7,
        "simulation": True,
        "race_status": "active",
        "course_context": {"place_label": "on leg Start → Heavenly"},
        "signal_gap": {
            "active": True,
            "summary": "No fresh ping in about 2 hours.",
        },
    }
    prompt = build_system_prompt(settings, status=status, visitor=visitor)
    assert "Pre-race mode" in prompt
    assert "demo replay" in prompt.lower()
    assert "4.7" in prompt
    assert "Signal gap active" in prompt
    assert "demo tracker shows about mile 4.7" in prompt


def test_fallback_response(settings: Settings) -> None:
    out = fallback_response(settings)
    assert "Fallback message" in out["reply"]
    assert "art_prompt" not in out
    out_art = fallback_response(settings, include_art=True)
    assert out_art["art_prompt"]
    with_status = fallback_response(
        settings,
        status={"enabled": True, "route_mile": 51.1, "current_speed_mph": 0.0, "race_status": "active"},
    )
    assert "mile 51.1" in with_status["reply"].lower()
    assert "chat line is down" not in with_status["reply"].lower()
    assert "no dnf" not in with_status["reply"].lower()


def test_enriched_status_includes_course_context(settings: Settings) -> None:
    from course_context import enrich_status

    status = enrich_status(settings, {"enabled": True, "route_mile": 87.2})
    assert status["course_context"]["segment_name"]
    assert "next_aid_name" in status["course_context"]


def test_catchup_summary_between_miles(settings: Settings) -> None:
    from course_context import build_catchup_summary

    summary = build_catchup_summary(
        settings=settings,
        last_mile=50.0,
        current_mile=87.2,
        last_seen="2026-06-12T10:00:00Z",
    )
    assert summary
    assert "37" in summary or "87" in summary


def test_signal_gap_context_when_stale() -> None:
    from course_context import build_signal_gap_context

    gap = build_signal_gap_context(
        {
            "enabled": True,
            "stale": True,
            "route_mile": 59.4,
            "last_update_at": "2026-06-12T04:00:00Z",
        }
    )
    assert gap
    assert gap["title"]
    assert gap["detail"]


def test_chat_passes_sanitized_history(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    import app as app_module

    captured: dict = {}

    def fake_completion(
        _settings: Settings,
        *,
        system: str,
        user_message: str,
        history: list | None = None,
        require_art: bool = False,
    ) -> dict[str, str]:
        captured["system"] = system
        captured["history"] = history
        captured["user_message"] = user_message
        return {"reply": "Follow-up answer."}

    monkeypatch.setattr(app_module, "chat_completion", fake_completion)
    monkeypatch.setattr(app_module, "settings", settings)
    client = TestClient(app_module.app)

    created = client.post("/visitors", json={"name": "Dan", "audience": "remote"})
    visitor_id = created.json()["visitor_id"]

    response = client.post(
        "/chat",
        json={
            "visitor_id": visitor_id,
            "message": "Which ones have crew access?",
            "history": [
                {"role": "user", "content": "What aids on Friday?"},
                {"role": "assistant", "content": "Start, Heavenly, Armstrong."},
                {"role": "system", "content": "ignored"},
            ],
        },
    )
    assert response.status_code == 200
    assert len(captured["history"]) == 2
    assert captured["user_message"] == "Which ones have crew access?"


def test_greeting_ignores_client_history(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    import app as app_module

    captured: dict = {}

    def fake_completion(
        _settings: Settings,
        *,
        system: str,
        user_message: str,
        history: list | None = None,
        require_art: bool = False,
    ) -> dict[str, str]:
        captured["history"] = history
        return {"reply": "Fresh opener."}

    monkeypatch.setattr(app_module, "chat_completion", fake_completion)
    monkeypatch.setattr(app_module, "settings", settings)
    client = TestClient(app_module.app)

    created = client.post("/visitors", json={"name": "Dan", "audience": "remote"})
    visitor_id = created.json()["visitor_id"]

    client.post(
        "/chat",
        json={
            "visitor_id": visitor_id,
            "history": [{"role": "user", "content": "old thread"}],
        },
    )
    assert captured["history"] == []


def test_return_greeting_includes_crew_updates(
    settings: Settings, monkeypatch: pytest.MonkeyPatch
) -> None:
    import app as app_module

    def fake_completion(
        _settings: Settings,
        *,
        system: str,
        user_message: str,
        history: list | None = None,
        require_art: bool = False,
    ) -> dict[str, str]:
        return {"reply": "Welcome back."}

    missed = [
        {
            "updated_at": "2026-06-10T20:00:00.000Z",
            "doing": "Grilled cheese acquired",
            "last_seen": {"station": "Sierra at Tahoe", "time_label": "Wed 8 PM"},
            "note": None,
            "photos": [{"url": "/race-updates/test.jpg", "alt": "Harvey at Sierra"}],
        }
    ]

    monkeypatch.setattr(app_module, "chat_completion", fake_completion)
    monkeypatch.setattr(app_module, "get_updates_since", lambda _since: missed)
    monkeypatch.setattr(app_module, "settings", settings)
    client = TestClient(app_module.app)

    created = client.post("/visitors", json={"name": "Dan", "audience": "remote"})
    visitor_id = created.json()["visitor_id"]
    record_checkin(settings, visitor_id, harvey_mile=40.0)

    response = client.post("/chat", json={"visitor_id": visitor_id})
    assert response.status_code == 200
    body = response.json()
    assert len(body["crew_updates"]) == 1
    assert body["crew_updates_context"] == "since_last_visit"
    assert body["crew_updates"][0]["doing"] == "Grilled cheese acquired"
    assert body["crew_updates"][0]["photos"][0]["url"].endswith("/race-updates/test.jpg")


def test_greeting_records_last_hook(settings: Settings, monkeypatch: pytest.MonkeyPatch) -> None:
    import app as app_module

    def fake_completion(
        _settings: Settings,
        *,
        system: str,
        user_message: str,
        history: list | None = None,
        require_art: bool = False,
    ) -> dict[str, str]:
        return {"reply": "Nilbog's toes are undefeated."}

    monkeypatch.setattr(app_module, "chat_completion", fake_completion)
    monkeypatch.setattr(app_module, "settings", settings)
    client = TestClient(app_module.app)

    created = client.post("/visitors", json={"name": "Dan", "audience": "remote"})
    visitor_id = created.json()["visitor_id"]
    client.post("/chat", json={"visitor_id": visitor_id})

    visitor = get_visitor(settings, visitor_id)
    assert "Nilbog" in visitor.get("last_greeting_hook", "")


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
    assert body["langfuse_configured"] is False
    assert body["langfuse_ok"] is None

    status = client.get("/status")
    assert status.json()["route_mile"] == 87.2

    created = client.post("/visitors", json={"name": "Dan", "audience": "remote"})
    assert created.status_code == 200
    visitor_id = created.json()["visitor_id"]

    chat = client.post("/chat", json={"visitor_id": visitor_id})
    assert chat.status_code == 200
    body = chat.json()
    assert body["fallback"] is True
    assert "mile" in body["reply"].lower()
    assert body.get("art_prompt") is None

    chat_art = client.post(
        "/chat",
        json={"visitor_id": visitor_id, "message": "How is he doing?"},
    )
    assert chat_art.status_code == 200
    assert chat_art.json().get("art_prompt")

    note = client.post(
        "/notes",
        json={"visitor_id": visitor_id, "note_text": "Proud of you."},
    )
    assert note.status_code == 200
    assert settings.notes_path.is_file()

    updated = get_visitor(settings, visitor_id)
    assert updated["checkin_count"] >= 2
    assert settings.questions_path.is_file()

    profile = client.get(f"/visitors/{visitor_id}")
    assert profile.status_code == 200
    assert profile.json()["audience"] == "remote"


def test_legacy_visitor_migrates_relationship_to_audience(settings: Settings) -> None:
    import json

    legacy = {
        "visitors": [
            {
                "id": "legacy-crew-1",
                "name": "Gangle",
                "relationship": "pacer",
                "first_seen": "2026-06-01T00:00:00Z",
                "last_seen": "2026-06-01T00:00:00Z",
                "checkin_count": 0,
                "last_harvey_mile": None,
            }
        ]
    }
    settings.visitors_path.write_text(json.dumps(legacy) + "\n", encoding="utf-8")
    loaded = get_visitor(settings, "legacy-crew-1")
    assert resolve_audience(loaded) == "on_course"
    assert loaded.get("audience") == "on_course"
