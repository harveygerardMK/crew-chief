"""Tests for Langfuse trace verification heuristics."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "verify_langfuse_trace",
    Path(__file__).resolve().parents[2] / "scripts" / "verify_langfuse_trace.py",
)
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)
check_reply_heuristics = _mod.check_reply_heuristics


def test_heuristics_pass_when_sim_and_gap_mentioned() -> None:
    snapshot = {
        "simulation": True,
        "route_mile": 4.7,
        "signal_gap": {"active": True, "summary": "No fresh ping in about 2 hours."},
    }
    reply = (
        "Still in civilization. Demo replay shows mile 4.7 on a test course. "
        "Last ping was a couple hours ago — stale test data."
    )
    assert check_reply_heuristics(reply, snapshot) == []


def test_heuristics_warn_on_missing_sim_disclosure() -> None:
    snapshot = {"simulation": True, "route_mile": 4.7, "signal_gap": {"active": False}}
    warnings = check_reply_heuristics("Race starts June 12.", snapshot)
    assert any("simulation" in w for w in warnings)
