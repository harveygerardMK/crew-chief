"""Sanitize client-provided chat history for Claude multi-turn requests."""

from __future__ import annotations

from typing import Any, Literal

Role = Literal["user", "assistant"]

MAX_HISTORY_MESSAGES = 10
MAX_MESSAGE_CHARS = 2000


def sanitize_history(raw: list[Any] | None) -> list[dict[str, str]]:
    """Keep last N user/assistant turns with non-empty content."""
    if not raw:
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role", "")).strip().lower()
        if role not in ("user", "assistant"):
            continue
        content = str(item.get("content", "")).strip()
        if not content:
            continue
        if len(content) > MAX_MESSAGE_CHARS:
            content = content[:MAX_MESSAGE_CHARS] + "…"
        out.append({"role": role, "content": content})
    if len(out) > MAX_HISTORY_MESSAGES:
        out = out[-MAX_HISTORY_MESSAGES:]
    return out


def build_claude_messages(
    history: list[dict[str, str]],
    user_message: str,
) -> list[dict[str, str]]:
    """Prior turns plus the current user message."""
    messages = list(history)
    messages.append({"role": "user", "content": user_message})
    return messages
