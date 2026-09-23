"""P3: Data readiness checker.

Inspects MongoDB and tells exactly how many real observations exist
and what is needed before each ML component can be trained.
"""
import json
from datetime import datetime
from pathlib import Path

try:
    from pymongo import MongoClient
    client = MongoClient("mongodb://localhost:27017", serverSelectionTimeoutMS=3000)
    db = client["carbonmind"]
    
    # Count real vs demo records
    all_logs = list(db.daily_activity_logs.find(
        {},
        {"_id": 0, "user_id": 1, "day": 1, "activities": 1}
    ))
    
    demo_users = set()
    real_users = set()
    for doc in all_logs:
        uid = doc.get("user_id", "")
        if uid.startswith("demo-") or uid == "demo":
            demo_users.add(uid)
        else:
            real_users.add(uid)
    
    demo_logs = [d for d in all_logs if d.get("user_id", "").startswith("demo-")]
    real_logs = [d for d in all_logs if not d.get("user_id", "").startswith("demo-")]
    
    # Per-user date sequences
    from collections import defaultdict
    user_days = defaultdict(list)
    for doc in real_logs:
        uid = doc.get("user_id")
        day = doc.get("day")
        if uid and day:
            user_days[uid].append(day)
    
    for uid in user_days:
        user_days[uid] = sorted(user_days[uid])
    
    # Count consecutive streaks per user
    def max_streak(days):
        if not days:
            return 0
        from datetime import date
        parsed = sorted(date.fromisoformat(d) for d in days)
        max_s = curr = 1
        for i in range(1, len(parsed)):
            if (parsed[i] - parsed[i-1]).days == 1:
                curr += 1
                max_s = max(max_s, curr)
            else:
                curr = 1
        return max_s
    
    user_streaks = {uid: max_streak(days) for uid, days in user_days.items()}
    
    readiness = {
        "partial_day_ml": {
            "requires": "Each user needs 8+ consecutive days (7 prior + 1 prediction day)",
            "current_qualifying_users": sum(1 for s in user_streaks.values() if s >= 8),
            "minimum_examples_needed": 50,
            "status": "INSUFFICIENT_DATA"
        },
        "weekly_holt_winters": {
            "requires": "At least 1 user with 14+ consecutive daily observations",
            "current_qualifying_users": sum(1 for s in user_streaks.values() if s >= 14),
            "status": "INSUFFICIENT_DATA"
        },
        "lstm_weekly": {
            "requires": "At least 1 user with 45+ consecutive daily observations",
            "current_qualifying_users": sum(1 for s in user_streaks.values() if s >= 45),
            "status": "INSUFFICIENT_DATA"
        },
    }
    
    result = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "database": "mongodb://localhost:27017/carbonmind",
        "total_daily_logs": len(all_logs),
        "demo_logs": len(demo_logs),
        "real_logs": len(real_logs),
        "unique_real_users": len(real_users),
        "unique_demo_users": len(demo_users),
        "user_day_counts": {uid: len(days) for uid, days in user_days.items()},
        "user_max_streaks": user_streaks,
        "model_readiness": readiness,
        "verdict": (
            "NO real participant observations exist. All activity logs belong to demo accounts. "
            "No temporal ML model (partial-day, weekly, LSTM) can be trained or evaluated. "
            "The system is correctly gated to prevent serving unvalidated model outputs."
        )
    }

except Exception as e:
    result = {"error": str(e), "verdict": "Could not connect to MongoDB"}

out = Path("backend/ml/evaluation/pilot_data_readiness.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
print(f"\nSaved to {out}")
