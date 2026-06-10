#!/usr/bin/env python3
"""Local smoke test: crew broadcast JSON → Harvey chat prompt → optional live reply.

Usage (from repo root):
  python3 scripts/test-broadcast-chat.py
  python3 scripts/test-broadcast-chat.py --live   # also POST /chat (needs server + API key)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

UTC = timezone.utc

REPO_ROOT = Path(__file__).resolve().parent.parent
SERVER_DIR = REPO_ROOT / "server"
BROADCAST_PATH = REPO_ROOT / "data" / "race-broadcast.json"
TEST_PHRASE = "TEST BROADCAST: Harvey is eating grilled cheese at Sierra at Tahoe"
TEST_PHOTO_URL = "/race-updates/2026-05-27T21-08-57-484Z-tahoe-city-1.jpg"
TEST_PHOTO_ALT = "Harvey at Tahoe City (test photo)"

TEST_BROADCAST = {
    "updates": [
        {
            "updated_at": "2026-06-10T18:00:00.000Z",
            "updated_by": "crew",
            "doing": TEST_PHRASE,
            "last_seen": {
                "station": "Sierra at Tahoe",
                "time_label": "Wed, 6:00 PM PDT (test)",
            },
            "note": "This is a test post — safe to ignore.",
            "photos": [
                {
                    "url": TEST_PHOTO_URL,
                    "alt": TEST_PHOTO_ALT,
                }
            ],
        }
    ]
}


def _stamp_broadcast_now() -> dict:
    payload = json.loads(json.dumps(TEST_BROADCAST))
    payload["updates"][0]["updated_at"] = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    return payload


def seed_broadcast(backup_path: Path) -> None:
    if BROADCAST_PATH.is_file():
        backup_path.write_text(BROADCAST_PATH.read_text(encoding="utf-8"), encoding="utf-8")
    BROADCAST_PATH.write_text(json.dumps(_stamp_broadcast_now(), indent=2) + "\n", encoding="utf-8")
    print(f"✓ Seeded test broadcast → {BROADCAST_PATH}")


def _read_visitor_last_seen(visitor_id: str) -> str | None:
    visitors_path = REPO_ROOT / "data" / "visitors.json"
    try:
        data = json.loads(visitors_path.read_text(encoding="utf-8"))
        row = next((v for v in data.get("visitors", []) if v.get("id") == visitor_id), None)
        return str(row.get("last_seen") or "") or None
    except (OSError, json.JSONDecodeError, KeyError):
        return None


def bump_broadcast_timestamp(after_iso: str | None = None) -> None:
    """Ensure the test post is newer than the visitor's last check-in."""
    from datetime import timedelta

    payload = _stamp_broadcast_now()
    if after_iso:
        after = datetime.fromisoformat(after_iso.replace("Z", "+00:00"))
        posted = max(datetime.now(UTC), after + timedelta(seconds=2))
        payload["updates"][0]["updated_at"] = posted.isoformat().replace("+00:00", "Z")
    BROADCAST_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def restore_broadcast(backup_path: Path) -> None:
    if backup_path.is_file():
        BROADCAST_PATH.write_text(backup_path.read_text(encoding="utf-8"), encoding="utf-8")
        backup_path.unlink()
        print("✓ Restored original race-broadcast.json")
    else:
        BROADCAST_PATH.write_text('{\n  "updates": []\n}\n', encoding="utf-8")
        print("✓ Reset race-broadcast.json to empty")


def check_prompt_block() -> None:
    sys.path.insert(0, str(SERVER_DIR))
    os.environ["BROADCAST_FORCE_LOCAL"] = "1"

    from broadcast import get_broadcast_block, reset_broadcast_cache
    from config import load_settings

    reset_broadcast_cache()
    block = get_broadcast_block(load_settings())
    if not block or TEST_PHRASE not in block:
        print("✗ Broadcast block missing from prompt context")
        if block:
            print(block[:500])
        sys.exit(1)
    if TEST_PHOTO_ALT not in block or TEST_PHOTO_URL not in block:
        print("✗ Photo metadata missing from broadcast block")
        if block:
            print(block)
        sys.exit(1)
    print("✓ Broadcast block loaded into agent context (with photo)")
    print(f"  Snippet: …{TEST_PHRASE[:60]}…")
    print(f"  Photo: {TEST_PHOTO_ALT}")


def run_live_chat(port: int) -> None:
    base = f"http://127.0.0.1:{port}"

    def post(path: str, body: dict) -> dict:
        req = urllib.request.Request(
            f"{base}{path}",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read().decode("utf-8"))

    try:
        urllib.request.urlopen(f"{base}/health", timeout=5)
    except urllib.error.URLError as exc:
        print(f"✗ API not reachable at {base} — {exc}")
        sys.exit(1)

    visitor = post("/visitors", {"name": "BroadcastTest", "audience": "remote"})
    vid = visitor["visitor_id"]
    # Simulate a prior visit so missed crew updates are pushed on greeting.
    post("/chat", {"visitor_id": vid, "message": "ping"})
    bump_broadcast_timestamp(_read_visitor_last_seen(vid))
    greeting = post("/chat", {"visitor_id": vid})
    crew_updates = greeting.get("crew_updates") or []
    if not crew_updates:
        print("✗ crew_updates missing from /chat response (return-visit inline cards)")
        sys.exit(1)
    photos = crew_updates[0].get("photos") or []
    if not photos or not str(photos[0].get("url", "")).startswith("https://"):
        print("✗ crew_updates photo URL missing or not absolute")
        sys.exit(1)
    print(f"✓ crew_updates returned ({len(crew_updates)} card(s), {len(photos)} photo(s))")

    reply = str(greeting.get("reply") or "")
    fallback = bool(greeting.get("fallback"))
    print(f"✓ POST /chat greeting (fallback={fallback})")
    print(f"  Reply: {reply[:500]}{'…' if len(reply) > 500 else ''}")

    if fallback:
        print("  (fallback greeting — inline crew cards are the photo proof)")
    else:
        markers = ("grilled cheese", "sierra", "amanda", "crew", "test broadcast")
        if not any(m in reply.lower() for m in markers):
            print("✗ Greeting did not reference the test crew update — check API key / prompt")
            sys.exit(1)
        photo_markers = ("photo", "picture", "image", "tahoe city", "crew-site", "wheresharvey")
        if not any(m in reply.lower() for m in photo_markers):
            print("✗ Greeting did not mention the crew photo — check prompt photo URLs")
            sys.exit(1)
        print("✓ Greeting references crew broadcast and photo")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--live",
        action="store_true",
        help="Start local API and POST /chat (needs ANTHROPIC_API_KEY in server/.env)",
    )
    parser.add_argument("--port", type=int, default=8098)
    args = parser.parse_args()

    backup = REPO_ROOT / "data" / ".race-broadcast.backup.json"
    proc: subprocess.Popen[bytes] | None = None

    try:
        seed_broadcast(backup)
        check_prompt_block()

        if not args.live:
            print("\nPrompt test passed. Run with --live to test a real chat reply:")
            print("  python3 scripts/test-broadcast-chat.py --live")
            return

        env = os.environ.copy()
        env["BROADCAST_FORCE_LOCAL"] = "1"
        proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app:app", "--port", str(args.port)],
            cwd=SERVER_DIR,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        time.sleep(2)
        if proc.poll() is not None:
            err = (proc.stderr.read() if proc.stderr else b"").decode("utf-8", errors="replace")
            print(f"✗ API failed to start:\n{err}")
            sys.exit(1)

        run_live_chat(args.port)
        print("\nAll broadcast → chat tests passed.")
    finally:
        if proc and proc.poll() is None:
            proc.terminate()
            proc.wait(timeout=5)
        restore_broadcast(backup)


if __name__ == "__main__":
    main()
