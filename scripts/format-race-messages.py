#!/usr/bin/env python3
"""Pretty-print notes.json and questions.json from the race agent."""

from __future__ import annotations

import json
import sys
from pathlib import Path


def load_list(path: Path) -> list[dict]:
    if not path.is_file():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def main() -> int:
    notes_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("notes.json")
    questions_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("questions.json")

    notes = load_list(notes_path)
    questions = load_list(questions_path)

    print(f"# Race messages ({len(notes)} notes, {len(questions)} chat messages)\n")

    if notes:
        print("## Notes for Harvey (left via “Leave Harvey a note”)\n")
        for i, entry in enumerate(notes, 1):
            name = entry.get("visitor_name") or "Anonymous"
            ts = entry.get("timestamp") or "unknown time"
            mile = entry.get("harvey_mile_at_time")
            mile_label = f" (Harvey at mile {mile:.1f})" if isinstance(mile, (int, float)) else ""
            text = (entry.get("note_text") or "").strip()
            print(f"{i}. **{name}** — {ts}{mile_label}")
            print(f"   {text}\n")
    else:
        print("## Notes for Harvey\n")
        print("_No notes yet._\n")

    if questions:
        print("## Chat messages (Ask Harvey)\n")
        for i, entry in enumerate(questions, 1):
            name = entry.get("visitor_name") or "Anonymous"
            ts = entry.get("timestamp") or "unknown time"
            mile = entry.get("harvey_mile_at_time")
            mile_label = f" (Harvey at mile {mile:.1f})" if isinstance(mile, (int, float)) else ""
            message = (entry.get("message") or "").strip()
            summary = (entry.get("response_summary") or "").strip()
            print(f"{i}. **{name}** — {ts}{mile_label}")
            print(f"   Q: {message}")
            if summary:
                print(f"   A: {summary}")
            print()
    else:
        print("## Chat messages\n")
        print("_No chat messages logged yet._\n")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
