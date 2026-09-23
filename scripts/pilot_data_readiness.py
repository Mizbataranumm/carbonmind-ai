import asyncio
import os
import sys
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

# Load env
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / 'backend' / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/carbonmind')
db_name = os.environ.get('DB_NAME', 'carbonmind')

async def check_indexes(db):
    print("--- Index Check ---")
    expected_indexes = {
        "users": ["id_1", "email_1"],
        "daily_activity_logs": ["user_id_1_day_1"],
        "food_scan_feedback": ["user_id_1_created_at_-1"],
        "food_scan_predictions": ["created_at_-1"]
    }
    
    all_healthy = True
    for coll, expected in expected_indexes.items():
        try:
            indexes = await db[coll].index_information()
            missing = [idx for idx in expected if idx not in indexes]
            if missing:
                print(f"[WARN] Collection '{coll}' missing indexes: {missing}")
                all_healthy = False
            else:
                print(f"[OK] Collection '{coll}' has all required indexes.")
        except Exception as e:
            print(f"[ERROR] Failed to check indexes for '{coll}': {e}")
            all_healthy = False
            
    return all_healthy

async def check_data_quality(db):
    print("\n--- Data Quality Check ---")
    users_count = await db.users.count_documents({})
    logs_count = await db.daily_activity_logs.count_documents({})
    print(f"Total Users: {users_count}")
    print(f"Total Daily Logs: {logs_count}")

    # Check for logs without users
    pipeline = [
        {
            "$lookup": {
                "from": "users",
                "localField": "user_id",
                "foreignField": "id",
                "as": "user"
            }
        },
        {
            "$match": {
                "user": {"$size": 0}
            }
        },
        {
            "$count": "orphan_logs"
        }
    ]
    orphan_res = await db.daily_activity_logs.aggregate(pipeline).to_list(1)
    orphans = orphan_res[0]["orphan_logs"] if orphan_res else 0
    if orphans > 0:
        print(f"[WARN] Found {orphans} orphaned daily logs (no matching user).")
    else:
        print(f"[OK] No orphaned daily logs found.")
        
async def generate_pilot_user(db):
    print("\n--- Pilot User Generation ---")
    pilot_id = "pilot-user-001"
    existing = await db.users.find_one({"id": pilot_id})
    if existing:
        print("[OK] Pilot user already exists.")
        return
        
    print("Creating pilot user with 30 days of continuous activity data...")
    user_doc = {
        "id": pilot_id,
        "name": "Pilot Tester",
        "email": "pilot@carbonmind.ai",
        "password": "scrypt$16384$8$1$dummy$dummy",
        "avatar": "/avatars/profile_avatar_1.png",
        "carbon_aura": "#00FFB2",
        "streak": 30,
        "xp": 5000,
        "grade": "A+",
        "is_demo": False,
        "onboarding_completed": True,
        "onboarding_step": 4,
        "privacy_consent_at": datetime.now(timezone.utc).isoformat(),
        "lifestyle_profile": {
            "diet": "mixed",
            "transport": "car",
            "home_size": 2,
            "renewable_energy": False
        }
    }
    await db.users.insert_one(user_doc)
    
    today = datetime.now(timezone.utc).date()
    logs = []
    for i in range(30):
        day = today - timedelta(days=i)
        activities = [
            {"id": f"pilot-t-{i}", "type": "transport", "label": "Commute", "kg": 2.5, "occurred_at": datetime.combine(day, datetime.min.time()).isoformat(), "source": "manual_entry"},
            {"id": f"pilot-f-{i}", "type": "food", "label": "Lunch", "kg": 1.2, "occurred_at": datetime.combine(day, datetime.min.time()).isoformat(), "source": "food_scanner", "verification_status": "food_scan_confirmed"},
            {"id": f"pilot-e-{i}", "type": "electricity", "label": "Home", "kg": 1.8, "occurred_at": datetime.combine(day, datetime.min.time()).isoformat(), "source": "manual_entry"}
        ]
        logs.append({
            "user_id": pilot_id,
            "day": day.isoformat(),
            "activities": activities,
            "total_kg": sum(a["kg"] for a in activities),
            "updated_at": datetime.now(timezone.utc).isoformat()
        })
    await db.daily_activity_logs.insert_many(logs)
    print(f"[OK] Pilot user '{pilot_id}' created with 30 days of data.")

async def main():
    print(f"Connecting to MongoDB: {mongo_url}")
    try:
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
        await client.admin.command('ping')
        db = client[db_name]
        print(f"[OK] Connected to database: {db_name}\n")
    except Exception as e:
        print(f"[ERROR] Could not connect to MongoDB: {e}")
        sys.exit(1)
        
    await check_indexes(db)
    await check_data_quality(db)
    await generate_pilot_user(db)
    
    print("\n--- Readiness Check Complete ---")

if __name__ == "__main__":
    asyncio.run(main())
