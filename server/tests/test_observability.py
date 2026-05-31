"""Langfuse observability tests."""

from __future__ import annotations

from observability import ChatTrace, _status_metadata, auth_check, chat_trace
from config import Settings


def _settings(*, langfuse: bool = False) -> Settings:
    return Settings(
        anthropic_api_key="sk-ant-test",
        claude_model="claude-sonnet-4-20250514",
        claude_max_tokens=1000,
        voice_path=__file__,
        fallback_path=__file__,
        status_path=__file__,
        visitors_path=__file__,
        cors_origins=["*"],
        github_token=None,
        github_owner="test",
        github_repo="test",
        github_branch="main",
        visitors_export_path="data/visitors.json",
        art_pairings_path=__file__,
        aid_stations_path=__file__,
        segments_path=__file__,
        questions_path=__file__,
        notes_path=__file__,
        langfuse_public_key="pk-lf-test" if langfuse else None,
        langfuse_secret_key="sk-lf-test" if langfuse else None,
        langfuse_base_url="https://cloud.langfuse.com",
    )


def test_status_metadata_extracts_accuracy_fields() -> None:
    status = {
        "enabled": True,
        "simulation": True,
        "race_status": "active",
        "route_mile": 42.5,
        "stale": False,
        "data_stale": True,
        "last_update_at": "2026-06-12T10:00:00Z",
        "course_context": {"place_label": "mile 42 — near Robinson Flat"},
        "signal_gap": {"active": True, "summary": "No ping for 90 min"},
    }
    meta = _status_metadata(status)
    assert meta["route_mile"] == 42.5
    assert meta["data_stale"] is True
    assert meta["place_label"] == "mile 42 — near Robinson Flat"
    assert meta["signal_gap_active"] is True


def test_chat_trace_disabled_is_noop() -> None:
    settings = _settings(langfuse=False)
    visitor = {"id": "v1", "name": "Dan", "relationship": "friend"}
    status = {"route_mile": 10.0, "race_status": "active"}
    with chat_trace(
        settings,
        visitor=visitor,
        status=status,
        user_message="hello",
        is_greeting=True,
    ) as trace:
        assert trace is None


def test_chat_trace_record_methods_noop_when_disabled() -> None:
    settings = _settings(langfuse=False)
    trace = ChatTrace(
        settings,
        visitor={"id": "v1", "name": "Dan", "relationship": "friend"},
        status={"route_mile": 10.0},
        user_message="hello",
        is_greeting=False,
    )
    with trace:
        trace.record_fallback(reason="test", output={"reply": "fallback"})
        trace.record_result(reply="hi", fallback=False, art_prompt=None)


def test_auth_check_none_when_unconfigured() -> None:
    assert auth_check(_settings(langfuse=False)) is None
