"""Chat history sanitization tests."""

from chat_history import build_claude_messages, sanitize_history


def test_sanitize_empty() -> None:
    assert sanitize_history(None) == []
    assert sanitize_history([]) == []


def test_sanitize_filters_invalid_roles() -> None:
    raw = [
        {"role": "user", "content": "Hi"},
        {"role": "system", "content": "ignored"},
        {"role": "assistant", "content": "Hey"},
    ]
    assert len(sanitize_history(raw)) == 2


def test_sanitize_truncates_count() -> None:
    raw = [{"role": "user", "content": f"m{i}"} for i in range(15)]
    assert len(sanitize_history(raw)) == 10
    assert sanitize_history(raw)[0]["content"] == "m5"


def test_build_claude_messages_appends_user() -> None:
    history = [{"role": "user", "content": "First"}, {"role": "assistant", "content": "Reply"}]
    msgs = build_claude_messages(history, "Second?")
    assert len(msgs) == 3
    assert msgs[-1] == {"role": "user", "content": "Second?"}
