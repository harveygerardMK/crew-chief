#!/usr/bin/env bash
# Re-download the Google Sheet (first tab) and remind you to update JSON.
# The site reads data/plan-stations.json, crew-roster.json, shot-list.json — edit those after reviewing the CSV.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SHEET_ID="1VKq9klLVbZCDoN_xQmgvETcO5nqvnesHAH-d4BFYdpc"
OUT="$ROOT/data/_sheet-export.csv"

curl -fsSL "https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0" -o "$OUT"
echo "Exported to $OUT"
echo "Review the CSV and update JSON in data/ (or ask Cursor to parse it into plan-stations.json)."
