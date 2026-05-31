#!/usr/bin/env python3
"""Restore real harvey_status.json after simulation."""

from __future__ import annotations

import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKUP = REPO_ROOT / "data" / "harvey_status_real.json"
STATUS = REPO_ROOT / "data" / "harvey_status.json"


def main() -> int:
    if BACKUP.is_file():
        shutil.copy(BACKUP, STATUS)
        BACKUP.unlink()
        print("Restored real status file.")
        return 0
    print("No backup found.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
