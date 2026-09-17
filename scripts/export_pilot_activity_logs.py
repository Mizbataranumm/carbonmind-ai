"""Export pseudonymous CarbonMind daily activity logs for the team pilot.

The script does not export names, emails, raw food photos, passwords, tokens,
or phone numbers. It retains only the fields required to build an auditable
time-series dataset for the pilot experiment.
"""

from __future__ import annotations

import argparse
import json
import os
from datetime import date
from pathlib import Path

from pymongo import MongoClient


SAFE_ACTIVITY_FIELDS = ("type", "kg", "occurred_at", "source", "verification_status", "event_id")


def pseudonym(user_id: str) -> str:
    # Stable local study ID; no original account identifier leaves the export.
    import hashlib
    return "pilot-" + hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:12]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", required=True, help="Inclusive YYYY-MM-DD")
    parser.add_argument("--end", required=True, help="Inclusive YYYY-MM-DD")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--mongo-url", default=os.environ.get("MONGO_URL"))
    parser.add_argument("--db-name", default=os.environ.get("DB_NAME", "carbonmind"))
    args = parser.parse_args()
    try:
        start, end = date.fromisoformat(args.start), date.fromisoformat(args.end)
    except ValueError as exc:
        raise SystemExit("--start and --end must use YYYY-MM-DD.") from exc
    if start > end:
        raise SystemExit("--start must be on or before --end.")
    if not args.mongo_url:
        raise SystemExit("Set MONGO_URL or pass --mongo-url. Do not put database credentials in the output file.")

    client = MongoClient(args.mongo_url, serverSelectionTimeoutMS=10_000)
    documents = client[args.db_name].daily_activity_logs.find(
        {"day": {"$gte": start.isoformat(), "$lte": end.isoformat()}},
        {"_id": 0, "user_id": 1, "day": 1, "activities": 1},
    ).sort([("user_id", 1), ("day", 1)])
    safe_logs = []
    for document in documents:
        raw_user_id = document.get("user_id")
        if not isinstance(raw_user_id, str):
            continue
        activities = []
        for activity in document.get("activities", []):
            activities.append({field: activity.get(field) for field in SAFE_ACTIVITY_FIELDS if field in activity})
        safe_logs.append({"user_id": pseudonym(raw_user_id), "day": document.get("day"), "activities": activities})

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(safe_logs, indent=2) + "\n", encoding="utf-8")
    participant_count = len({row["user_id"] for row in safe_logs})
    print(json.dumps({"daily_logs": len(safe_logs), "participants": participant_count, "start": args.start, "end": args.end, "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
