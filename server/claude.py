"""Claude API integration."""

from __future__ import annotations

import json
import re
from typing import Any

from anthropic import Anthropic
from anthropic import APIError

from config import Settings
from prompt import load_fallback


class ClaudeError(Exception):
    pass


def chat_completion(
    settings: Settings,
    *,
    system: str,
    user_message: str,
) -> dict[str, str]:
    if not settings.claude_configured:
        raise ClaudeError("ANTHROPIC_API_KEY not configured")

    client = Anthropic(api_key=settings.anthropic_api_key)
    try:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=settings.claude_max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_message}],
        )
    except APIError as err:
        raise ClaudeError(str(err)) from err

    text = _extract_text(response.content)
    return _parse_model_json(text)


def fallback_response(settings: Settings) -> dict[str, str]:
    body = load_fallback(settings)
    return {
        "reply": body,
        "art_prompt": "Wanderer Above the Sea of Fog, Friedrich — waiting for a clear signal.",
    }


def _extract_text(content: Any) -> str:
    chunks: list[str] = []
    for block in content:
        if getattr(block, "type", None) == "text":
            chunks.append(block.text)
    return "\n".join(chunks).strip()


def _parse_model_json(text: str) -> dict[str, str]:
    cleaned = text.strip()
    fence = re.match(r"^```(?:json)?\s*(.*?)```\s*$", cleaned, flags=re.DOTALL | re.IGNORECASE)
    if fence:
        cleaned = fence.group(1).strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as err:
        raise ClaudeError(f"Model returned non-JSON: {text[:200]}") from err

    reply = str(data.get("reply", "")).strip()
    art_prompt = str(data.get("art_prompt", "")).strip()
    if not reply:
        raise ClaudeError("Model JSON missing reply")
    if not art_prompt:
        art_prompt = "The Persistence of Memory, Dalí — time is doing something weird out here."
    return {"reply": reply, "art_prompt": art_prompt}
