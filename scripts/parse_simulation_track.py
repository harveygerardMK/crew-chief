#!/usr/bin/env python3
"""One-time parse of Cody Delorenzo Cocodona 250 ping history from TrackLeaders JS."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_JS_URL = "https://trackleaders.com/spot/cocodona26/Cody_Delorenzo.js"
DEFAULT_RAW = REPO_ROOT / "data" / "Cody_Delorenzo.js"
DEFAULT_OUT = REPO_ROOT / "data" / "simulation_track.json"

MARKER_RE = re.compile(
    r"imarker\d+ = L\.marker\(\[([-\d.]+),([-\d.]+)\].*?"
    r"bindPopup\('(.+?)'\);",
    re.DOTALL,
)

POINT_RE = re.compile(
    r"Point #(\d+) received at: ([^<]+)<.*?"
    r"\((\d+)d(\d+)h(\d+)m since start\).*?"
    r"(?:([\d.]+) ft|([\d.]+) mi) traveled at ([\d.]+) mph.*?"
    r"Route mile ([\d.]+) mi",
    re.DOTALL,
)

# Notable points / ranges from the simulation spec.
FLAG_RULES: list[tuple[str, set[int] | range]] = [
    ("aid_station", set(range(197, 208))),
    ("signal_gap", {241, 480}),
    ("sleep_station", set(range(248, 250)) | set(range(269, 271)) | set(range(333, 367)) | set(range(492, 528))),
    ("aid_station", set(range(299, 308)) | set(range(411, 427))),
    ("dnf_zone", set(range(568, 624))),
]

# Extra markers on specific points.
EXTRA_FLAGS: dict[int, str] = {
    348: "sleep_station",
    372: "sleep_station",
    456: "signal_gap",
}


def fetch_js(url: str) -> str:
    request = Request(url, headers={"User-Agent": "crew-chief-simulation/1.0"})
    try:
        with urlopen(request, timeout=60) as response:
            return response.read().decode("utf-8", errors="replace")
    except URLError as err:
        raise SystemExit(f"Failed to fetch {url}: {err}") from err


def since_start_minutes(days: int, hours: int, minutes: int) -> int:
    return days * 24 * 60 + hours * 60 + minutes


def parse_distance_ft(distance_ft: str | None, distance_mi: str | None) -> float:
    if distance_ft is not None:
        return float(distance_ft)
    if distance_mi is not None:
        return float(distance_mi) * 5280
    return 0.0


def flag_for_point(point: int) -> str | None:
    if point in EXTRA_FLAGS:
        return EXTRA_FLAGS[point]
    for flag, targets in FLAG_RULES:
        if isinstance(targets, set) and point in targets:
            return flag
        if isinstance(targets, range) and point in targets:
            return flag
    return None


def parse_track(js: str) -> list[dict]:
    pings: list[dict] = []
    for lat, lng, popup in MARKER_RE.findall(js):
        match = POINT_RE.search(popup)
        if not match:
            continue

        point = int(match.group(1))
        timestamp = match.group(2).strip()
        minutes = since_start_minutes(int(match.group(3)), int(match.group(4)), int(match.group(5)))
        distance_ft = parse_distance_ft(match.group(6), match.group(7))
        speed_mph = float(match.group(8))
        route_mile = float(match.group(9))

        entry: dict = {
            "point": point,
            "original_timestamp": timestamp,
            "minutes_since_start": minutes,
            "lat": float(lat),
            "lng": float(lng),
            "route_mile": route_mile,
            "speed_mph": speed_mph,
            "distance_ft": round(distance_ft, 1),
        }
        flag = flag_for_point(point)
        if flag:
            entry["flag"] = flag
        pings.append(entry)

    pings.sort(key=lambda row: row["point"])
    return pings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--input",
        type=Path,
        help=f"Local Cody_Delorenzo.js (default: fetch from {DEFAULT_JS_URL})",
    )
    parser.add_argument(
        "--url",
        default=DEFAULT_JS_URL,
        help="TrackLeaders JS URL when --input is not set",
    )
    parser.add_argument(
        "--save-raw",
        type=Path,
        default=DEFAULT_RAW,
        help="Save fetched JS here (default: data/Cody_Delorenzo.js)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUT,
        help="Output JSON path (default: data/simulation_track.json)",
    )
    args = parser.parse_args(argv)

    if args.input:
        js = args.input.read_text(encoding="utf-8")
    elif args.save_raw.is_file():
        js = args.save_raw.read_text(encoding="utf-8")
        print(f"Using cached {args.save_raw}", file=sys.stderr)
    else:
        print(f"Fetching {args.url} …", file=sys.stderr)
        js = fetch_js(args.url)
        args.save_raw.parent.mkdir(parents=True, exist_ok=True)
        args.save_raw.write_text(js, encoding="utf-8")
        print(f"Saved raw JS to {args.save_raw}", file=sys.stderr)

    pings = parse_track(js)
    if len(pings) != 623:
        print(f"WARNING: expected 623 pings, parsed {len(pings)}", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(pings, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(pings)} pings to {args.output}")

    flagged = sum(1 for p in pings if p.get("flag"))
    print(f"Flagged {flagged} notable points", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
