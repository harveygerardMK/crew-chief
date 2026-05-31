"""Detect when chat should include an art card."""

from __future__ import annotations

import re

# "how are you doing" / "how is he doing" / "how's Harvey" / "is he okay" / "how's he feeling"
_ART_PATTERNS = [
    re.compile(r"\bhow\s+are\s+you\s+doing\b", re.I),
    re.compile(r"\bhow\s+is\s+he\s+doing\b", re.I),
    re.compile(r"\bhow\s+is\s+harvey\s+doing\b", re.I),
    re.compile(r"\bhow(?:'s|s|\s+is)\s+harvey\b", re.I),
    re.compile(r"\bhow(?:'s|s|\s+is)\s+he\s+feeling\b", re.I),
    re.compile(r"\bhow(?:'s|s|\s+is)\s+he\s+doing\b", re.I),
    re.compile(r"\bis\s+he\s+okay\b", re.I),
    re.compile(r"\bis\s+he\s+ok\b", re.I),
    re.compile(r"\bis\s+harvey\s+okay\b", re.I),
    re.compile(r"\bis\s+harvey\s+ok\b", re.I),
]


def should_include_art_card(message: str | None) -> bool:
    if not message or not message.strip():
        return False
    text = message.strip()
    return any(p.search(text) for p in _ART_PATTERNS)
