"""Build auditable early-day to final-day examples from CarbonMind activity logs.

The input is an exported JSON array of daily-ledger documents. This script does
not convert missing days to zero. It creates the 14-feature contract required by
the future partial-day GBDT/LightGBM experiment.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path

import pandas as pd

CATEGORIES = ("transport", "electricity", "food", "devices", "other")
FEATURES = [
    *(f"early_{category}_kg" for category in CATEGORIES),
    "early_total_kg",
    "early_event_count",
    "early_verified_count",
    "early_manual_count",
    "active_hours",
    "cutoff_hour",
    "day_of_week",
    "prior_7d_mean_kg",
    "prior_7d_std_kg",
]
TARGET = "final_daily_kg"


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def build_examples(logs: list[dict], cutoff_hour: int) -> pd.DataFrame:
    rows: list[dict] = []
    histories: dict[str, list[tuple[datetime.date, float]]] = {}
    prepared: list[tuple[str, datetime.date, dict]] = []
    for log in logs:
        user_id, day = log.get("user_id"), log.get("day")
        if not isinstance(user_id, str) or not isinstance(day, str):
            raise ValueError("Every daily log needs string user_id and YYYY-MM-DD day fields.")
        try:
            prepared.append((user_id, datetime.strptime(day, "%Y-%m-%d").date(), log))
        except ValueError as exc:
            raise ValueError(f"Invalid day {day!r}; expected YYYY-MM-DD.") from exc

    seen: set[tuple[str, datetime.date]] = set()
    for user_id, day, log in sorted(prepared, key=lambda item: (item[0], item[1])):
        key = (user_id, day)
        if key in seen:
            raise ValueError(f"Duplicate daily log for user={user_id!r}, day={day.isoformat()!r}.")
        seen.add(key)
        history = histories.setdefault(user_id, [])
        if history and (day - history[-1][0]).days != 1:
            history.clear()

        activities = log.get("activities")
        if not isinstance(activities, list):
            raise ValueError(f"Daily log for {user_id!r} on {day} has no activities array.")
        final_total = sum(float(item.get("kg", 0)) for item in activities)
        if final_total < 0:
            raise ValueError("Activity impacts cannot be negative.")

        # We require seven preceding observed days. This makes the historical
        # aggregates honest and prevents a gap from being disguised as zero.
        if len(history) >= 7:
            totals = {category: 0.0 for category in CATEGORIES}
            early_events = []
            for activity in activities:
                occurred_at = _parse_time(activity.get("occurred_at"))
                if occurred_at is None:
                    raise ValueError("Every activity must have occurred_at before building prediction data.")
                if occurred_at.hour < cutoff_hour:
                    category = activity.get("type") if activity.get("type") in totals else "other"
                    totals[category] += float(activity.get("kg", 0))
                    early_events.append(activity)
            prior = [total for _, total in history[-7:]]
            early_hours = [event_time.hour + event_time.minute / 60 for event_time in (_parse_time(a.get("occurred_at")) for a in early_events) if event_time]
            rows.append({
                "user_id": user_id,
                "date": day.isoformat(),
                **{f"early_{category}_kg": round(totals[category], 5) for category in CATEGORIES},
                "early_total_kg": round(sum(totals.values()), 5),
                "early_event_count": len(early_events),
                "early_verified_count": sum(a.get("verification_status") in {"food_scan_confirmed", "sensor_verified"} for a in early_events),
                "early_manual_count": sum(a.get("verification_status", "user_entered") == "user_entered" for a in early_events),
                "active_hours": round((max(early_hours) - min(early_hours)) if len(early_hours) > 1 else 0.0, 5),
                "cutoff_hour": cutoff_hour,
                "day_of_week": day.weekday(),
                "prior_7d_mean_kg": round(sum(prior) / len(prior), 5),
                "prior_7d_std_kg": round(float(pd.Series(prior).std(ddof=0)), 5),
                TARGET: round(final_total, 5),
            })
        history.append((day, final_total))
    return pd.DataFrame(rows, columns=["user_id", "date", *FEATURES, TARGET])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="JSON export of daily activity logs")
    parser.add_argument("--output", type=Path, required=True, help="CSV file for chronological model training")
    parser.add_argument("--cutoff-hour", type=int, default=14, choices=range(1, 24))
    args = parser.parse_args()

    payload = json.loads(args.input.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise SystemExit("Input must be a JSON array of daily activity logs.")
    examples = build_examples(payload, args.cutoff_hour)
    if examples.empty:
        raise SystemExit("No examples produced. Each user needs eight consecutive observed daily logs for the first 14:00 example.")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    examples.to_csv(args.output, index=False)
    print(json.dumps({"rows": len(examples), "features": FEATURES, "target": TARGET, "output": str(args.output)}, indent=2))


if __name__ == "__main__":
    main()
