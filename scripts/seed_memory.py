"""
Seed Memory script for Recur.
Loads the 30 generated incidents from backend/data/incidents.json in chronological order
and retains each into Hindsight Cloud, capturing symptoms, logs, root cause, fix steps,
failed attempts, and metrics.
"""

import json
import os
import sys
import time
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.memory import retain_incident, get_retained_entries, get_activity_log

DATA_FILE = backend_dir / "data" / "incidents.json"


def seed():
    print("=" * 65)
    print("Recur Memory Seeder (Hindsight Cloud)")
    print("=" * 65)

    if not DATA_FILE.exists():
        print(f"Error: {DATA_FILE} not found. Please run scripts/generate_incidents.py first.")
        sys.exit(1)

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        incidents = json.load(f)

    # Sort strictly chronologically
    incidents = sorted(incidents, key=lambda x: x["date"])
    total = len(incidents)
    print(f"Loaded {total} incidents sorted chronologically from {incidents[0]['date']} to {incidents[-1]['date']}.")
    print("Beginning retention into Hindsight Cloud...\n")

    successful = 0
    total_time_ms = 0

    for idx, inc in enumerate(incidents, 1):
        inc_id = inc["id"]
        service = inc["service"]
        fam = inc.get("root_cause_family", "General")
        dur = inc.get("minutes_to_resolve", 0)

        print(f"[{idx:02d}/{total}] Retaining {inc_id} ({service} | {fam} | {dur}m)...", end="", flush=True)

        try:
            res = retain_incident(inc)
            lat = res["latency_ms"]
            total_time_ms += lat
            successful += 1
            print(f" [OK] {lat}ms")
        except Exception as e:
            print(f" [FAILED]: {e}")

        # Short pause between API calls to avoid server congestion
        time.sleep(1.0)

    print("\n" + "=" * 65)
    print(f"Seeding Complete: {successful}/{total} incidents retained in Hindsight Cloud.")
    avg_latency = round(total_time_ms / max(1, successful))
    print(f"Average retention latency: {avg_latency}ms per incident.")
    print("=" * 65)


if __name__ == "__main__":
    seed()
