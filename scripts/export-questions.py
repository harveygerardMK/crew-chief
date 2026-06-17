#!/usr/bin/env python3
"""Print all logged Ask Harvey questions from questions.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "data/questions.json")
    if not path.is_file():
        print(f"No questions file at {path}", file=sys.stderr)
        return 1

    try:
        entries = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as err:
        print(f"Invalid JSON in {path}: {err}", file=sys.stderr)
        return 1

    if not isinstance(entries, list):
        print(f"Expected a JSON array in {path}", file=sys.stderr)
        return 1

    real = [e for e in entries if isinstance(e, dict) and e.get("message") != "[session greeting]"]
    greetings = len(entries) - len(real)

    print(f"# Ask Harvey questions ({len(real)} messages, {greetings} session greetings skipped)\n")
    for i, entry in enumerate(real, start=1):
        ts = entry.get("timestamp", "—")
        name = entry.get("visitor_name", "—")
        audience = entry.get("audience", "—")
        mile = entry.get("harvey_mile_at_time")
        mile_label = f"mile {mile:.1f}" if isinstance(mile, (int, float)) else "pre-race"
        message = str(entry.get("message", "")).strip()
        print(f"{i}. [{ts}] {name} ({audience}, {mile_label})")
        print(f"   Q: {message}")
        summary = entry.get("response_summary")
        if summary:
            print(f"   A: {summary}")
        print()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
