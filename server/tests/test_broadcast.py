"""Crew broadcast block tests."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from broadcast import (
    FETCH_USER_AGENT,
    _build_broadcast_block,
    _fetch_remote_broadcast,
    _parse_updates,
    get_broadcast_block,
    get_updates_since,
    reset_broadcast_cache,
    to_crew_update_card,
)


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    reset_broadcast_cache()
    yield
    reset_broadcast_cache()


def test_parse_updates_sorts_newest_first() -> None:
    raw = {
        "updates": [
            {
                "updated_at": "2026-06-12T10:00:00.000Z",
                "doing": "Older",
                "last_seen": None,
                "note": None,
                "photos": [],
            },
            {
                "updated_at": "2026-06-12T12:00:00.000Z",
                "doing": "Newer",
                "last_seen": None,
                "note": None,
                "photos": [],
            },
        ]
    }
    updates = _parse_updates(raw)
    assert updates[0]["doing"] == "Newer"


def test_build_broadcast_block_formats_crew_fields() -> None:
    block = _build_broadcast_block(
        [
            {
                "updated_at": "2026-06-12T12:00:00.000Z",
                "doing": "Moving well",
                "last_seen": {
                    "station": "Sierra at Tahoe",
                    "time_label": "Sat 11:00 PM PDT",
                },
                "note": "Grilled cheese acquired",
                "photos": [{"url": "/race-updates/x.jpg", "alt": "Harvey"}],
            }
        ]
    )
    assert block is not None
    assert "Crew updates from Amanda" in block
    assert "Moving well" in block
    assert "Sierra at Tahoe" in block
    assert "Grilled cheese acquired" in block
    assert "Authoritative" in block
    assert "https://wheresharvey.com/race-updates/x.jpg" in block
    assert "Harvey" in block


def test_build_broadcast_block_empty_returns_none() -> None:
    assert _build_broadcast_block([]) is None


def test_get_updates_since_filters_by_last_seen(monkeypatch: pytest.MonkeyPatch) -> None:
    import broadcast as broadcast_mod

    monkeypatch.setattr(
        broadcast_mod,
        "load_broadcast_updates",
        lambda: _parse_updates(
            {
                "updates": [
                    {
                        "updated_at": "2026-06-10T10:00:00.000Z",
                        "doing": "Old",
                        "photos": [],
                    },
                    {
                        "updated_at": "2026-06-10T20:00:00.000Z",
                        "doing": "New",
                        "photos": [],
                    },
                ]
            }
        ),
    )
    missed = get_updates_since("2026-06-10T18:00:00.000Z")
    assert len(missed) == 1
    assert missed[0]["doing"] == "New"


def test_to_crew_update_card_absolute_photo_url() -> None:
    card = to_crew_update_card(
        {
            "updated_at": "2026-06-10T20:00:00.000Z",
            "doing": "Smiling",
            "last_seen": {"station": "Tahoe City", "time_label": "Wed 8 PM"},
            "note": None,
            "photos": [{"url": "/race-updates/test.jpg", "alt": "Harvey"}],
        }
    )
    assert card["photos"][0]["url"] == "https://wheresharvey.com/race-updates/test.jpg"


def test_to_crew_update_card_rewrites_legacy_crew_chief_photo_path() -> None:
    card = to_crew_update_card(
        {
            "updated_at": "2026-06-10T20:00:00.000Z",
            "doing": "Smiling",
            "photos": [
                {
                    "url": "/crew-chief/race-updates/2026-06-10T16-29-29-877Z-update-1.png",
                    "alt": "Harvey",
                }
            ],
        }
    )
    assert (
        card["photos"][0]["url"]
        == "https://wheresharvey.com/race-updates/2026-06-10T16-29-29-877Z-update-1.png"
    )


def test_fetch_remote_broadcast_sends_browser_user_agent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Cloudflare 403s the default Python-urllib UA; a real UA must be sent so
    fresh crew posts reach the chat instead of silently falling back to local."""
    import broadcast as broadcast_mod

    captured: dict[str, object] = {}

    class _FakeResp:
        def __enter__(self) -> "_FakeResp":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def read(self) -> bytes:
            return json.dumps(
                {
                    "updates": [
                        {
                            "updated_at": "2026-06-12T12:06:05.087Z",
                            "doing": "Remote update",
                            "photos": [],
                        }
                    ]
                }
            ).encode("utf-8")

    def _fake_urlopen(req: object, timeout: float = 0) -> _FakeResp:  # noqa: ARG001
        captured["user_agent"] = req.get_header("User-agent")  # type: ignore[attr-defined]
        return _FakeResp()

    monkeypatch.setattr(broadcast_mod, "urlopen", _fake_urlopen)

    updates = _fetch_remote_broadcast()
    assert updates is not None
    assert updates[0]["doing"] == "Remote update"
    assert captured["user_agent"] == FETCH_USER_AGENT
    assert "python-urllib" not in str(captured["user_agent"]).lower()


def test_get_broadcast_block_uses_local_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "race-broadcast.json").write_text(
        json.dumps(
            {
                "updates": [
                    {
                        "updated_at": "2026-06-12T12:00:00.000Z",
                        "doing": "Local test update",
                        "last_seen": None,
                        "note": None,
                        "photos": [],
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    import broadcast as broadcast_mod

    monkeypatch.setattr(broadcast_mod, "_fetch_remote_broadcast", lambda: None)
    monkeypatch.setattr(broadcast_mod, "REPO_ROOT", tmp_path)

    block = get_broadcast_block()
    assert block is not None
    assert "Local test update" in block
