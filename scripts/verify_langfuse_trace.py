#!/usr/bin/env python3
"""Verify a /chat trace in Langfuse and run accuracy heuristics."""

from __future__ import annotations

import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        print(f"✗ Missing env: {name}", file=sys.stderr)
        sys.exit(1)
    return value


def _base_url() -> str:
    return os.environ.get("LANGFUSE_BASE_URL", "https://us.cloud.langfuse.com").rstrip("/")


def _auth_header() -> dict[str, str]:
    public_key = _require_env("LANGFUSE_PUBLIC_KEY")
    secret_key = _require_env("LANGFUSE_SECRET_KEY")
    token = base64.b64encode(f"{public_key}:{secret_key}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Accept": "application/json"}


def _get_json(path: str, *, params: dict[str, str] | None = None) -> dict:
    query = f"?{urllib.parse.urlencode(params)}" if params else ""
    url = f"{_base_url()}{path}{query}"
    req = urllib.request.Request(url, headers=_auth_header())
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        print(f"✗ Langfuse HTTP {err.code} for {path}: {body[:500]}", file=sys.stderr)
        sys.exit(1)


def wait_for_chat_span(trace_id: str, *, attempts: int = 8, delay_s: float = 2.0) -> dict:
    for attempt in range(attempts):
        payload = _get_json(
            "/api/public/observations",
            params={"traceId": trace_id, "limit": "20"},
        )
        for obs in payload.get("data", []):
            if obs.get("name") == "chat-response":
                return obs
        if attempt < attempts - 1:
            time.sleep(delay_s)
    print(f"✗ No chat-response observation for trace {trace_id}", file=sys.stderr)
    sys.exit(1)


def parse_chat_response(chat_json: dict) -> tuple[str | None, dict, str]:
    trace_id = chat_json.get("trace_id")
    if not trace_id:
        print("✗ /chat response missing trace_id — is Langfuse configured on the server?", file=sys.stderr)
        sys.exit(1)
    snapshot = chat_json.get("harvey_status_snapshot") or {}
    reply = str(chat_json.get("reply") or "")
    return trace_id, snapshot, reply


def check_reply_heuristics(reply: str, snapshot: dict) -> list[str]:
    warnings: list[str] = []
    lowered = reply.lower()

    if snapshot.get("simulation"):
        if not any(word in lowered for word in ("demo", "test", "simulation", "replay")):
            warnings.append("simulation=true but reply does not mention demo/test/simulation")
        mile = snapshot.get("route_mile")
        if isinstance(mile, (int, float)) and str(int(mile)) not in reply and f"{mile:.1f}" not in reply:
            warnings.append(f"simulation mile {mile} not reflected in reply")

    gap = snapshot.get("signal_gap") or {}
    if gap.get("active"):
        if not any(
            phrase in lowered
            for phrase in ("ping", "signal", "stale", "gap", "last known", "hours")
        ):
            warnings.append("signal_gap active but reply does not mention stale ping")

    return warnings


def check_recent_error_traces(*, hours: int = 24) -> list[dict]:
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    payload = _get_json(
        "/api/public/observations",
        params={
            "name": "chat-response",
            "fromStartTime": since.isoformat().replace("+00:00", "Z"),
            "limit": "50",
        },
    )
    errors = [
        obs
        for obs in payload.get("data", [])
        if str(obs.get("level", "")).upper() == "ERROR"
    ]
    return errors


def main() -> None:
    chat_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/agent-langfuse-chat.json"
    with open(chat_path, encoding="utf-8") as handle:
        chat = json.load(handle)

    if chat.get("fallback"):
        print("✗ /chat returned fallback=true — fix Claude/key before Langfuse accuracy checks", file=sys.stderr)
        sys.exit(1)

    trace_id, snapshot, reply = parse_chat_response(chat)
    print(f"✓ trace_id={trace_id}")

    warnings = check_reply_heuristics(reply, snapshot)
    for warning in warnings:
        print(f"! accuracy heuristic: {warning}")

    strict = os.environ.get("VERIFY_LANGFUSE_STRICT", "1") == "1"
    if strict and warnings:
        print("✗ accuracy heuristics failed (set VERIFY_LANGFUSE_STRICT=0 to warn only)", file=sys.stderr)
        sys.exit(1)

    span = wait_for_chat_span(trace_id)
    level = str(span.get("level", "DEFAULT")).upper()
    if level == "ERROR":
        msg = span.get("statusMessage") or span.get("status_message") or "unknown error"
        print(f"✗ chat-response span is ERROR: {msg}", file=sys.stderr)
        sys.exit(1)

    print(f"✓ Langfuse chat-response span OK (level={level})")

    if os.environ.get("VERIFY_LANGFUSE_CHECK_RECENT_ERRORS", "1") == "1":
        errors = check_recent_error_traces()
        if errors:
            print(f"! {len(errors)} ERROR chat-response trace(s) in last 24h (infra, not accuracy)")
            for obs in errors[:5]:
                print(f"  - {obs.get('traceId')} @ {obs.get('startTime')}")
        else:
            print("✓ no ERROR chat-response traces in last 24h")

    print("Langfuse trace verification passed.")


if __name__ == "__main__":
    main()
