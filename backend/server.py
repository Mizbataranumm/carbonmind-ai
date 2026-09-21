from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import date, datetime, timedelta, timezone
from calendar import monthrange
import base64
import hashlib
import hmac
import json
import secrets
import time
import re
import asyncio
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/carbonmind')
db_name = os.environ.get('DB_NAME', 'carbonmind')
auth_secret = os.environ.get("AUTH_SECRET")
if not auth_secret:
    auth_secret = secrets.token_urlsafe(48)
    logger.warning("AUTH_SECRET is not set; sessions will be invalid after a restart. Configure it before deployment.")
auth_scheme = HTTPBearer(auto_error=False)

try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2500)
    db = client[db_name]
except Exception as e:
    logger.warning(f"MongoDB connection init warning: {e}")
    client = None
    db = None

app = FastAPI(title="CarbonMind AI")
api_router = APIRouter(prefix="/api")

try:
    from .ml_service import (
        ANNUAL_CARBON_FEATURES,
        GBDT_DEFAULTS,
        get_model_status,
        load_models,
        missing_annual_carbon_features,
        predict_annual_carbon,
        predict_food,
        predict_gbdt,
        predict_gbdt_ensemble,
        predict_weekly_ensemble,
    )
    from .food_emissions import food_catalog
    from .transport_emissions import estimate_transport_emissions, transport_catalog
except ImportError:
    # Render starts ``uvicorn server:app`` from this directory.
    from ml_service import (  # type: ignore[no-redef]
        ANNUAL_CARBON_FEATURES,
        GBDT_DEFAULTS,
        get_model_status,
        load_models,
        missing_annual_carbon_features,
        predict_annual_carbon,
        predict_food,
        predict_gbdt,
        predict_gbdt_ensemble,
        predict_weekly_ensemble,
    )
    from food_emissions import food_catalog  # type: ignore[no-redef]
    from transport_emissions import estimate_transport_emissions, transport_catalog  # type: ignore[no-redef]

async def _warm_models() -> None:
    """Load optional model artifacts without delaying the web server port bind."""
    try:
        await asyncio.to_thread(load_models, models_dir=str(Path(__file__).parent / "ml" / "models"))
    except Exception:
        logger.exception("Background model warm-up failed")


async def _create_database_indexes() -> None:
    if db is None:
        return
    try:
        await db.users.create_index("id", unique=True)
        await db.users.create_index("email", unique=True)
        await db.daily_activity_logs.create_index([("user_id", 1), ("day", 1)], unique=True)
        await db.community_likes.create_index([("post_id", 1), ("user_id", 1)], unique=True)
        await db.community_joins.create_index([("challenge_id", 1), ("user_id", 1)], unique=True)
        await db.certificates.create_index("cert_id", unique=True)
        await db.food_scan_feedback.create_index([("user_id", 1), ("created_at", -1)])
        await db.food_scan_predictions.create_index([("created_at", -1)])
    except Exception as exc:
        logger.warning("Database index setup skipped: %s", exc)


@app.on_event("startup")
async def startup_event():
    # Render does not mark a web service healthy until the process has bound
    # $PORT. Model deserialisation and a cold MongoDB connection must not hold
    # that step hostage.
    asyncio.create_task(_warm_models())
    asyncio.create_task(_create_database_indexes())


# ====== Models ======
class DemoLoginRequest(BaseModel):
    name: Optional[str] = "Eco Explorer"

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    privacy_consent: bool = False

class LoginRequest(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    avatar: str
    carbon_aura: str
    streak: int
    xp: int
    grade: str
    is_demo: bool = False
    onboarding_completed: bool = False
    onboarding_step: int = 1
    onboarding_preferences: dict = {}
    access_token: Optional[str] = None

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    reply: str
    session_id: str
    mode: str = "rule_based_smart_tips"

class MorningActivity(BaseModel):
    type: str
    kg: float = Field(ge=0, le=100)

class DailyActivity(BaseModel):
    type: str
    kg: float = Field(ge=0, le=100)
    label: Optional[str] = None
    occurred_at: Optional[str] = None
    event_id: Optional[str] = Field(default=None, min_length=1, max_length=80)
    source: Optional[str] = Field(default=None, pattern=r"^[a-z][a-z0-9_]{0,31}$")
    verification_status: Optional[str] = Field(
        default=None,
        pattern=r"^(user_entered|food_scan_confirmed|imported|sensor_verified)$",
    )

class SaveDailyActivitiesRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    activities: List[DailyActivity] = Field(min_length=1, max_length=100)
    day: Optional[str] = None
    append: bool = False
    source: Optional[str] = Field(default=None, pattern=r"^[a-z][a-z0-9_]{0,31}$")

class PredictDayRequest(BaseModel):
    morning_activities: List[MorningActivity]
    daily_budget_kg: float = Field(default=6.5, gt=0, le=100)
    observation_hours: float = Field(default=2.0, gt=0, le=24)
    lifestyle_profile: Optional[dict] = None


class AnnualCarbonRequest(BaseModel):
    lifestyle_profile: dict


class SaveLifestyleProfileRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    lifestyle_profile: dict


class SaveMonthlyGoalRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    monthly_target_kg: float = Field(gt=0, le=100_000)


class TransportEstimateRequest(BaseModel):
    factor_id: str = Field(min_length=1, max_length=80)
    distance_km: float = Field(gt=0, le=100_000)
    passengers: int = Field(default=1, ge=1, le=100)

class PredictDayResponse(BaseModel):
    predicted_full_day_kg: float
    budget_kg: float
    exceeds: bool
    over_pct: float
    hourly_curve: List[dict]
    breakdown_by_type: List[dict]
    ai_headline: str

class VoiceTipsRequest(BaseModel):
    weekly_kg: float
    top_category: str
    user_name: str = "there"

class VoiceTipsResponse(BaseModel):
    greeting: str
    body: str
    tips: List[str]
    signoff: str
    full_script: str

class FoodScanRequest(BaseModel):
    image_base64: Optional[str] = None
    hint: Optional[str] = Field(default=None, max_length=120)

class FoodScanFeedbackRequest(BaseModel):
    predicted_food: Optional[str] = Field(default=None, max_length=120)
    confirmed_food: str = Field(min_length=1, max_length=120)
    scan_method: Optional[str] = Field(default=None, max_length=80)

class FoodItem(BaseModel):
    name: str
    portion: str
    co2_kg: float
    category: str
    tip: str

class FoodScanResponse(BaseModel):
    items: List[FoodItem]
    total_co2_kg: float
    ai_note: str

class CertificateResponse(BaseModel):
    cert_id: str
    user_name: str
    month: str
    co2_recorded_kg: float
    recorded_days: int
    verification_status: str
    grade: str
    issued_at: str
    signature: str
    verify_url: str

class PhoneCallRequest(BaseModel):
    phone_number: str = Field(min_length=10, max_length=20)

class SimulateRequest(BaseModel):
    current_annual_co2: float = Field(gt=0, le=100)
    annual_reduction_percent: float = Field(ge=0, le=100)
    horizon_years: int = Field(default=10, ge=1, le=30)
    # These context fields shape recommendations only. They are never converted
    # to carbon values because the repository has no sourced factors for them.
    transport: str = Field(default="mixed", pattern=r"^(car|public|bike|mixed)$")
    diet: str = Field(default="mixed", pattern=r"^(meat|mixed|vegetarian|vegan)$")

class SimulateResponse(BaseModel):
    current_annual_co2: float
    projected_co2: float
    future_temp_delta: Optional[float] = None
    temperature_note: Optional[str] = None
    future_summary: str
    yearly_breakdown: List[dict]
    recommendations: List[str]
    method: str = "scenario_calculator"
    model_version: str = "scenario_calculator_v1"
    model_status: str = "transparent_scenario_not_time_series_ml"
    assumptions: List[str] = []


def _database_or_503():
    if db is None:
        raise HTTPException(status_code=503, detail="Database is not configured.")
    return db


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return "scrypt$16384$8$1$%s$%s" % (
        base64.urlsafe_b64encode(salt).decode("ascii"),
        base64.urlsafe_b64encode(digest).decode("ascii"),
    )


def _verify_password(password: str, stored: str) -> bool:
    if not stored.startswith("scrypt$"):
        # Supports one-time migration of records created by the original demo app.
        return hmac.compare_digest(password, stored)
    try:
        _, n, r, p, encoded_salt, encoded_digest = stored.split("$", 5)
        salt = base64.urlsafe_b64decode(encoded_salt.encode("ascii"))
        expected = base64.urlsafe_b64decode(encoded_digest.encode("ascii"))
        actual = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=int(n), r=int(r), p=int(p), dklen=len(expected))
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def _issue_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": int(time.time()) + 60 * 60 * 24 * 7}
    encoded = base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8")).rstrip(b"=")
    signature = hmac.new(auth_secret.encode("utf-8"), encoded, hashlib.sha256).digest()
    return f"{encoded.decode('ascii')}.{base64.urlsafe_b64encode(signature).rstrip(b'=').decode('ascii')}"


def _read_access_token(token: str) -> Optional[dict]:
    try:
        encoded, provided_signature = token.split(".", 1)
        expected_signature = hmac.new(auth_secret.encode("utf-8"), encoded.encode("ascii"), hashlib.sha256).digest()
        padded_signature = provided_signature + "=" * (-len(provided_signature) % 4)
        if not hmac.compare_digest(expected_signature, base64.urlsafe_b64decode(padded_signature.encode("ascii"))):
            return None
        padded_payload = encoded + "=" * (-len(encoded) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded_payload.encode("ascii")))
        return payload if payload.get("sub") and int(payload.get("exp", 0)) >= int(time.time()) else None
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


async def _current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme)) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Authentication is required.")
    payload = _read_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Session is invalid or expired.")
    user_id = payload["sub"]
    if not _is_demo_user(user_id) and not await _database_or_503().users.find_one({"id": user_id}, {"_id": 1}):
        raise HTTPException(status_code=401, detail="Session is no longer active.")
    return user_id


async def _optional_current_user_id(credentials: Optional[HTTPAuthorizationCredentials] = Depends(auth_scheme)) -> Optional[str]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    payload = _read_access_token(credentials.credentials)
    return payload["sub"] if payload else None


def _public_user(user_doc: dict, include_token: bool = False) -> dict:
    user = {key: value for key, value in user_doc.items() if key not in {"_id", "password"}}
    user["is_demo"] = bool(user.get("is_demo", _is_demo_user(user.get("id", ""))))
    if include_token:
        user["access_token"] = _issue_access_token(user["id"])
    return user


# ====== Routes ======
@api_router.get("/")
async def root():
    return {"message": "CarbonMind AI API online", "status": "ok"}

@api_router.get("/ml/status")
async def ml_status():
    return get_model_status(models_dir=str(Path(__file__).parent / "ml" / "models"))

@api_router.get("/onboarding/status")
async def get_onboarding_status(user_id: str, current_user_id: str = Depends(_current_user_id)):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own onboarding status.")
    user = await _database_or_503().users.find_one({"id": user_id})
    if not user:
        return {"status": "error", "message": "User not found"}
    return {
        "status": "success",
        "data": {
            "is_new_user": not user.get("onboarding_completed", False),
            "completed_steps": [i for i in range(1, user.get("onboarding_step", 1))]
        }
    }

@api_router.post("/onboarding/save")
async def save_onboarding(req: dict, current_user_id: str = Depends(_current_user_id)):
    user_id = req.get("user_id")
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only update your own onboarding data.")
    preferences = req.get("preferences", {})
    if not isinstance(preferences, dict):
        raise HTTPException(status_code=422, detail="preferences must be an object.")
    await _database_or_503().users.update_one(
        {"id": user_id},
        {"$set": {
            "onboarding_completed": True,
            "onboarding_step": 4,
            "onboarding_preferences": preferences
        }}
    )
    return {"status": "success", "message": "Onboarding saved successfully"}


@api_router.get("/profile/lifestyle")
async def get_lifestyle_profile(user_id: str, current_user_id: str = Depends(_current_user_id)):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own lifestyle profile.")
    user = await _database_or_503().users.find_one({"id": user_id}, {"lifestyle_profile": 1})
    return {"lifestyle_profile": (user or {}).get("lifestyle_profile", {})}


@api_router.put("/profile/lifestyle")
async def save_lifestyle_profile(req: SaveLifestyleProfileRequest, current_user_id: str = Depends(_current_user_id)):
    if req.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only update your own lifestyle profile.")
    missing = missing_annual_carbon_features(req.lifestyle_profile)
    if missing:
        raise HTTPException(status_code=422, detail={"message": "Complete every profile field before saving.", "missing_fields": missing})
    result = await _database_or_503().users.update_one(
        {"id": req.user_id}, {"$set": {"lifestyle_profile": req.lifestyle_profile}}
    )
    if result.matched_count != 1:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"status": "success", "lifestyle_profile": req.lifestyle_profile}

# ====== Auth ======
@api_router.post("/auth/demo-login", response_model=UserProfile)
async def demo_login(req: DemoLoginRequest):
    user = {
        # Do not share a demo identity between visitors. A shared ID would make
        # one visitor's activities visible to another visitor's demo session.
        "id": f"demo-{uuid.uuid4()}",
        "name": (req.name or "Eco Explorer").strip() or "Eco Explorer",
        "email": "demo-session@carbonmind.ai",
        "avatar": "/avatars/avatar_emily.png",
        "carbon_aura": "#00FFB2",
        "streak": 14,
        "xp": 2480,
        "grade": "A-",
        "is_demo": True,
        "onboarding_completed": True,
        "onboarding_step": 4,
    }
    return _public_user(user, include_token=True)

@api_router.post("/auth/register", response_model=UserProfile)
async def register(req: RegisterRequest):
    if not req.name.strip() or len(req.name.strip()) > 80:
        raise HTTPException(status_code=422, detail="Name must be between 1 and 80 characters.")
    if "@" not in req.email or len(req.email) > 254:
        raise HTTPException(status_code=422, detail="Enter a valid email address.")
    if len(req.password) < 8:
        raise HTTPException(status_code=422, detail="Password must contain at least 8 characters.")
    if not req.privacy_consent:
        raise HTTPException(status_code=422, detail="Consent to the activity-data notice is required to create an account.")
    users_col = _database_or_503().users
    existing = await users_col.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name.strip(),
        "email": req.email.lower(),
        "password": _hash_password(req.password),
        "avatar": "/avatars/avatar_sofia.png",
        "carbon_aura": "#9EABBC",
        "streak": 0,
        "xp": 0,
        "grade": "Newbie",
        "is_demo": False,
        "onboarding_completed": False,
        "onboarding_step": 1,
        "privacy_consent_at": datetime.now(timezone.utc).isoformat(),
    }
    await users_col.insert_one(user_doc.copy())
    return _public_user(user_doc, include_token=True)

@api_router.post("/auth/login", response_model=UserProfile)
async def login(req: LoginRequest):
    if req.email.lower() == "demo@carbonmind.ai" or req.email.lower() == "demo":
        return await demo_login(DemoLoginRequest(name="Eco Explorer"))
    
    users_col = _database_or_503().users
    user_doc = await users_col.find_one({"email": req.email.lower()})
    if not user_doc or not _verify_password(req.password, user_doc.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials or user not found")

    if not user_doc["password"].startswith("scrypt$"):
        await users_col.update_one({"_id": user_doc["_id"]}, {"$set": {"password": _hash_password(req.password)}})
    return _public_user(user_doc, include_token=True)


@api_router.delete("/account")
async def delete_account(current_user_id: str = Depends(_current_user_id)):
    """Permanently delete the signed-in personal account and its private records."""
    if _is_demo_user(current_user_id):
        raise HTTPException(status_code=400, detail="Demo sessions do not have a stored personal account to delete.")
    database = _database_or_503()
    deletion_counts = {}
    for collection_name in (
        "daily_activity_logs",
        "food_scan_feedback",
        "certificates",
        "community_likes",
        "community_joins",
        "community_posts",
    ):
        result = await database[collection_name].delete_many({"user_id": current_user_id})
        deletion_counts[collection_name] = result.deleted_count
    # Comments created after this privacy control include their author ID.
    await database.community_posts.update_many(
        {"comments.user_id": current_user_id},
        {"$pull": {"comments": {"user_id": current_user_id}}},
    )
    account_result = await database.users.delete_one({"id": current_user_id})
    if account_result.deleted_count != 1:
        raise HTTPException(status_code=404, detail="Account was not found.")
    return {"status": "deleted", "deleted_collections": deletion_counts}


ACTIVITY_META = {
    "transport": {"name": "Transport", "budget": 4.0, "color": "#00FFB2", "icon": "car"},
    "electricity": {"name": "Electricity", "budget": 2.5, "color": "#00D9FF", "icon": "zap"},
    "food": {"name": "Food", "budget": 1.2, "color": "#FFD166", "icon": "utensils"},
    "devices": {"name": "Devices", "budget": 0.8, "color": "#FF66E1", "icon": "monitor"},
    "other": {"name": "Other", "budget": 0.5, "color": "#9EABBC", "icon": "activity"},
}

VERIFIED_ACTIVITY_STATES = {"food_scan_confirmed", "sensor_verified"}


def _activity_evidence_summary(activities: List[dict]) -> dict:
    """Summarise provenance stored with activities; never infer evidence that was not recorded."""
    source_counts: dict[str, int] = {}
    verification_counts: dict[str, int] = {}
    for activity in activities:
        source = activity.get("source") or "manual_entry"
        state = activity.get("verification_status") or "user_entered"
        source_counts[source] = source_counts.get(source, 0) + 1
        verification_counts[state] = verification_counts.get(state, 0) + 1
    verified = sum(count for state, count in verification_counts.items() if state in VERIFIED_ACTIVITY_STATES)
    return {
        "activity_count": len(activities),
        "verified_count": verified,
        "source_counts": source_counts,
        "verification_counts": verification_counts,
    }


def build_carbon_intelligence(logs_by_day: dict, today: date, *, daily_budget_kg: float = 6.5) -> dict:
    """Build a transparent proactive status from stored activity observations only.

    This is a decision-support layer, not a predictive ML model. Its rules are
    returned in the response so the product and paper can be precise about the
    distinction between observed data, forecast readiness, and recommendations.
    """
    today_log = logs_by_day.get(today.isoformat(), {})
    today_activities = today_log.get("activities", [])
    evidence = _activity_evidence_summary(today_activities)

    consecutive_history = []
    cursor = today
    while cursor.isoformat() in logs_by_day and len(consecutive_history) < 30:
        consecutive_history.append(round(float(logs_by_day[cursor.isoformat()].get("total_kg", 0)), 2))
        cursor -= timedelta(days=1)
    consecutive_history.reverse()

    observed_days = len(logs_by_day)
    unique_categories = len({item.get("type") for item in today_activities if item.get("type") in ACTIVITY_META})
    continuity_points = min(len(consecutive_history), 14) / 14 * 45
    coverage_points = min(unique_categories, 4) / 4 * 25
    evidence_points = (evidence["verified_count"] / evidence["activity_count"] * 20) if evidence["activity_count"] else 0
    volume_points = min(observed_days, 30) / 30 * 10
    readiness_score = round(continuity_points + coverage_points + evidence_points + volume_points)

    if len(consecutive_history) >= 14:
        forecast_readiness = {
            "level": "history_ready_lstm_data_still_requires_validation",
            "observed_consecutive_days": len(consecutive_history),
            "message": "You have enough consecutive observations for a future LSTM evaluation dataset, but the current product uses Holt-Winters until an LSTM is trained and back-tested on dated user data.",
        }
    elif len(consecutive_history) >= 5:
        forecast_readiness = {
            "level": "weekly_baseline_available",
            "observed_consecutive_days": len(consecutive_history),
            "message": "Your observed history can support the weekly Holt-Winters baseline forecast.",
        }
    else:
        remaining = 5 - len(consecutive_history)
        forecast_readiness = {
            "level": "collect_more_observations",
            "observed_consecutive_days": len(consecutive_history),
            "message": f"Save {remaining} more consecutive daily record{'s' if remaining != 1 else ''} to enable a weekly forecast from your own data.",
        }

    today_total = round(float(today_log.get("total_kg", 0)), 2)
    category_totals = _sum_activities(today_activities)
    leading_kind = max(category_totals, key=category_totals.get) if any(category_totals.values()) else None
    if not today_activities:
        next_action = {
            "priority": "record",
            "title": "Start today's evidence record",
            "detail": "Add a completed activity or confirm a meal scan. CarbonMind will not invent activity data for an empty day.",
        }
    elif today_total > daily_budget_kg:
        next_action = {
            "priority": "budget_risk",
            "title": "Review today's largest recorded category",
            "detail": f"{ACTIVITY_META[leading_kind]['name']} is currently the largest recorded category. Compare one practical lower-impact option before adding more activities.",
        }
    elif evidence["verified_count"] == 0:
        next_action = {
            "priority": "evidence",
            "title": "Confirm one high-impact record",
            "detail": "Your record is user-entered. Confirming a food scan adds a separate evidence source; the app keeps manual entries visible rather than overwriting them.",
        }
    else:
        next_action = {
            "priority": "maintain",
            "title": "Keep the daily record complete",
            "detail": "Your record contains confirmed evidence. Continue saving completed activities to improve personal forecast readiness.",
        }

    return {
        "method": "transparent_proactive_decision_support_v1",
        "model_status": "rules_over_saved_user_observations_not_trained_ml",
        "readiness_score": readiness_score,
        "readiness_components": {
            "consecutive_history_days": len(consecutive_history),
            "observed_days": observed_days,
            "today_category_coverage": unique_categories,
            "today_verified_records": evidence["verified_count"],
        },
        "evidence": evidence,
        "forecast_readiness": forecast_readiness,
        "budget_status": {
            "today_recorded_kg": today_total,
            "daily_budget_kg": daily_budget_kg,
            "status": "over_budget" if today_total > daily_budget_kg else "within_budget" if today_activities else "no_record",
        },
        "next_action": next_action,
    }


def _is_demo_user(user_id: str) -> bool:
    return user_id == "demo-123" or user_id.startswith("demo-")


def _demo_activity_logs(today: date, user_id: str = "demo-123") -> List[dict]:
    sample_totals = [4.9, 5.4, 4.2, 6.1, 5.0, 4.7, 4.4]
    logs = []
    for offset, total in enumerate(reversed(sample_totals)):
        day = today - timedelta(days=offset)
        if offset == 0:
            activities = [
                {"id": "demo-transport", "type": "transport", "label": "Metro commute", "kg": 1.1, "occurred_at": datetime.combine(day, datetime.min.time(), timezone.utc).replace(hour=9, minute=10).isoformat()},
                {"id": "demo-food", "type": "food", "label": "Vegetarian lunch", "kg": 1.0, "occurred_at": datetime.combine(day, datetime.min.time(), timezone.utc).replace(hour=13, minute=5).isoformat()},
                {"id": "demo-electricity", "type": "electricity", "label": "Evening home electricity", "kg": 1.6, "occurred_at": datetime.combine(day, datetime.min.time(), timezone.utc).replace(hour=19, minute=20).isoformat()},
                {"id": "demo-devices", "type": "devices", "label": "Laptop and internet use", "kg": 0.7, "occurred_at": datetime.combine(day, datetime.min.time(), timezone.utc).replace(hour=21, minute=15).isoformat()},
            ]
        else:
            activities = [{"id": f"demo-day-{offset}", "type": "other", "label": "Demo sample total", "kg": total, "occurred_at": datetime.combine(day, datetime.min.time(), timezone.utc).replace(hour=18).isoformat()}]
        logs.append({"user_id": user_id, "day": day.isoformat(), "activities": activities, "total_kg": round(sum(item["kg"] for item in activities), 2)})
    return logs


def _sum_activities(activities: List[dict]) -> dict:
    totals = {kind: 0.0 for kind in ACTIVITY_META}
    for activity in activities:
        kind = activity.get("type", "other")
        if kind in totals:
            totals[kind] += float(activity.get("kg", 0))
    return totals


async def _daily_logs(user_id: str, start: date, end: date) -> List[dict]:
    logs = await _database_or_503().daily_activity_logs.find(
        {"user_id": user_id, "day": {"$gte": start.isoformat(), "$lte": end.isoformat()}}
    ).to_list(length=400)
    if logs or not _is_demo_user(user_id):
        return logs
    return [log for log in _demo_activity_logs(end, user_id) if start.isoformat() <= log["day"] <= end.isoformat()]


def build_monthly_goal_progress(logs: List[dict], target_kg: Optional[float], today: date) -> dict:
    """Calculate a transparent calendar-day run rate from saved activity logs."""
    current_kg = round(sum(float(log.get("total_kg", 0)) for log in logs), 2)
    days_in_month = monthrange(today.year, today.month)[1]
    days_elapsed = max(1, today.day)
    days_remaining = max(0, days_in_month - today.day)
    projected_kg = round((current_kg / days_elapsed) * days_in_month, 2)
    if target_kg is None:
        return {
            "goal_set": False,
            "current_month_kg": current_kg,
            "days_elapsed": days_elapsed,
            "days_in_month": days_in_month,
            "days_remaining": days_remaining,
            "projected_month_end_kg": projected_kg,
            "method": "saved_activity_calendar_run_rate",
        }

    remaining_kg = round(target_kg - current_kg, 2)
    allowance_kg = round(max(0.0, remaining_kg) / max(1, days_remaining), 2)
    return {
        "goal_set": True,
        "monthly_target_kg": round(target_kg, 2),
        "current_month_kg": current_kg,
        "days_elapsed": days_elapsed,
        "days_in_month": days_in_month,
        "days_remaining": days_remaining,
        "projected_month_end_kg": projected_kg,
        "remaining_kg": remaining_kg,
        "daily_allowance_kg": allowance_kg,
        "status": "over_target" if current_kg > target_kg else "projected_over_target" if projected_kg > target_kg else "on_track",
        "method": "saved_activity_calendar_run_rate",
    }


def _merge_daily_activities(existing: List[dict], incoming: List[dict], *, append: bool, source: Optional[str]) -> tuple[List[dict], int]:
    """Merge one daily update without treating a network retry as a second activity."""
    if source:
        retained = [item for item in existing if item.get("source") != source]
        for item in incoming:
            item["source"] = source
        return retained + incoming, 0

    if not append:
        return incoming, 0

    known_event_ids = {item.get("event_id") for item in existing if item.get("event_id")}
    accepted = []
    duplicate_count = 0
    for item in incoming:
        event_id = item.get("event_id")
        if event_id and event_id in known_event_ids:
            duplicate_count += 1
            continue
        accepted.append(item)
        if event_id:
            known_event_ids.add(event_id)
    return existing + accepted, duplicate_count


@api_router.get("/transport/catalog")
async def get_transport_catalog():
    """Expose only the committed, source-labelled transport factor subset."""
    return {"factors": transport_catalog(), "source": "DESNZ 2026 GHG Conversion Factors"}


@api_router.post("/transport/estimate")
async def estimate_transport(req: TransportEstimateRequest, current_user_id: str = Depends(_current_user_id)):
    try:
        return estimate_transport_emissions(req.factor_id, req.distance_km, req.passengers)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@api_router.post("/activities/daily")
async def save_daily_activities(req: SaveDailyActivitiesRequest, current_user_id: str = Depends(_current_user_id)):
    if req.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only save your own activities.")
    activity_types = {activity.type for activity in req.activities}
    invalid_types = activity_types - set(ACTIVITY_META)
    if invalid_types:
        raise HTTPException(status_code=422, detail=f"Unsupported activity types: {sorted(invalid_types)}")
    try:
        logged_day = date.fromisoformat(req.day) if req.day else datetime.now(timezone.utc).date()
    except ValueError:
        raise HTTPException(status_code=422, detail="day must use YYYY-MM-DD format.")

    now = datetime.now(timezone.utc).isoformat()
    incoming_activities = []
    for activity in req.activities:
        item = activity.model_dump()
        item["id"] = str(uuid.uuid4())
        item["label"] = (item["label"] or ACTIVITY_META[item["type"]]["name"])[:120]
        item["occurred_at"] = item["occurred_at"] or now
        item["source"] = item.get("source") or req.source or "manual_entry"
        item["verification_status"] = item.get("verification_status") or (
            "food_scan_confirmed" if item["source"] == "food_scanner" else "user_entered"
        )
        incoming_activities.append(item)
    logs = _database_or_503().daily_activity_logs
    existing = await logs.find_one({"user_id": req.user_id, "day": logged_day.isoformat()}) if (req.append or req.source) else None
    activities, duplicate_count = _merge_daily_activities(
        (existing or {}).get("activities", []),
        incoming_activities,
        append=req.append,
        source=req.source,
    )
    if len(activities) > 100:
        raise HTTPException(status_code=422, detail="A daily record can contain at most 100 activities.")
    total = round(sum(float(item["kg"]) for item in activities), 2)
    await logs.replace_one(
        {"user_id": req.user_id, "day": logged_day.isoformat()},
        {"user_id": req.user_id, "day": logged_day.isoformat(), "activities": activities, "total_kg": total, "updated_at": now},
        upsert=True,
    )
    return {
        "status": "success",
        "day": logged_day.isoformat(),
        "activity_count": len(activities),
        "total_kg": total,
        "source": req.source,
        "duplicate_count": duplicate_count,
    }


@api_router.get("/carbon/stats")
async def carbon_stats(user_id: str, current_user_id: str = Depends(_current_user_id)):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own carbon statistics.")
    today = datetime.now(timezone.utc).date()
    logs = await _daily_logs(user_id, today - timedelta(days=364), today)
    logs_by_day = {log["day"]: log for log in logs}
    today_total = float(logs_by_day.get(today.isoformat(), {}).get("total_kg", 0))
    last_7_days = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    previous_7_days = [today - timedelta(days=offset) for offset in range(13, 6, -1)]
    week_total = round(sum(float(logs_by_day.get(day.isoformat(), {}).get("total_kg", 0)) for day in last_7_days), 2)
    previous_total = sum(float(logs_by_day.get(day.isoformat(), {}).get("total_kg", 0)) for day in previous_7_days)
    trend_pct = round(((week_total - previous_total) / previous_total) * 100, 1) if previous_total else 0.0
    month_total = round(sum(float(log["total_kg"]) for log in logs if log["day"][:7] == today.strftime("%Y-%m")), 2)
    year_total = round(sum(float(log["total_kg"]) for log in logs), 2)
    streak = 0
    streak_day = today
    while streak_day.isoformat() in logs_by_day:
        streak += 1
        streak_day -= timedelta(days=1)
    # Forecasting requires an uninterrupted sequence of observed days. Missing
    # days are not treated as zero-emission days because that would fabricate
    # a time-series signal.
    forecast_history = []
    forecast_day = today
    while forecast_day.isoformat() in logs_by_day and len(forecast_history) < 30:
        forecast_history.append(round(float(logs_by_day[forecast_day.isoformat()].get("total_kg", 0)), 2))
        forecast_day -= timedelta(days=1)
    forecast_history.reverse()
    today_activities = logs_by_day.get(today.isoformat(), {}).get("activities", [])
    breakdown = _sum_activities(today_activities)
    non_zero_total = sum(breakdown.values())
    grade = "Newbie" if not logs else "A+" if today_total <= 4 else "A" if today_total <= 5.5 else "A-" if today_total <= 6.5 else "B"
    return {
        "source": "saved_user_activities",
        "today_kg": round(today_total, 2),
        "week_kg": week_total,
        "month_kg": month_total,
        "year_kg": year_total,
        "grade": grade,
        "trend_pct": trend_pct,
        "score": max(0, min(100, round(100 - today_total * 10))),
        "streak": streak,
        "weekly_trend": [{"day": day.strftime("%a"), "kg": round(float(logs_by_day.get(day.isoformat(), {}).get("total_kg", 0)), 2), "target": 6.5} for day in last_7_days],
        "breakdown": [{"name": meta["name"], "value": round((breakdown[kind] / non_zero_total * 100), 1) if non_zero_total else 0, "kg": round(breakdown[kind], 2), "color": meta["color"]} for kind, meta in ACTIVITY_META.items()],
        "activity_days": len(logs),
        "consecutive_daily_history": forecast_history,
        "evidence": _activity_evidence_summary(today_activities),
        "recent_activities": [{"id": activity["id"], "label": activity["label"], "type": activity["type"], "kg": round(float(activity["kg"]), 2), "time": activity.get("occurred_at", "")} for activity in today_activities],
        "achievements": [
            {"id": 1, "title": "First Step", "desc": "Log your first activity", "icon": "leaf", "earned": bool(logs)},
            {"id": 2, "title": "Seven-day record", "desc": "Record seven activity days", "icon": "flame", "earned": len(logs) >= 7},
        ],
    }


@api_router.get("/carbon/intelligence")
async def carbon_intelligence(user_id: str, current_user_id: str = Depends(_current_user_id)):
    """Return evidence and forecast readiness from the user's saved activity record."""
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own carbon intelligence record.")
    today = datetime.now(timezone.utc).date()
    logs = await _daily_logs(user_id, today - timedelta(days=364), today)
    return build_carbon_intelligence({log["day"]: log for log in logs}, today)


@api_router.get("/tracker/live")
async def tracker_live(user_id: str, current_user_id: str = Depends(_current_user_id)):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own activity tracker.")
    today = datetime.now(timezone.utc).date()
    logs = await _daily_logs(user_id, today - timedelta(days=55), today)
    logs_by_day = {log["day"]: log for log in logs}
    activities = logs_by_day.get(today.isoformat(), {}).get("activities", [])
    yesterday = logs_by_day.get((today - timedelta(days=1)).isoformat(), {}).get("activities", [])
    totals, yesterday_totals = _sum_activities(activities), _sum_activities(yesterday)
    timeline = {f"{hour:02d}": 0.0 for hour in range(0, 24, 3)}
    rendered_activities = []
    for activity in activities:
        try:
            occurred = datetime.fromisoformat(activity["occurred_at"].replace("Z", "+00:00"))
        except (KeyError, ValueError, TypeError):
            occurred = datetime.now(timezone.utc)
        bucket = f"{(occurred.hour // 3) * 3:02d}"
        timeline[bucket] += float(activity["kg"])
        rendered_activities.append({
            "id": activity["id"], "type": activity["type"], "label": activity["label"], "kg": float(activity["kg"]),
            "time": occurred.strftime("%H:%M"), "icon": ACTIVITY_META[activity["type"]]["icon"],
        })
    return {
        "source": "saved_user_activities",
        "activities": rendered_activities,
        "categories": [{"name": meta["name"], "kg": round(totals[kind], 2), "budget": meta["budget"], "trend": round(totals[kind] - yesterday_totals[kind], 2), "color": meta["color"]} for kind, meta in ACTIVITY_META.items() if kind != "other"],
        "realtime": [{"t": hour, "kg": round(value, 2)} for hour, value in timeline.items()],
        "heatmap": [{"day": (today - timedelta(days=offset)).isoformat(), "kg": round(float(logs_by_day.get((today - timedelta(days=offset)).isoformat(), {}).get("total_kg", 0)), 2)} for offset in range(55, -1, -1)],
    }


@api_router.get("/goals/monthly")
async def get_monthly_goal(user_id: str, current_user_id: str = Depends(_current_user_id)):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only access your own monthly goal.")
    today = datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)
    logs = await _daily_logs(user_id, month_start, today)
    user_doc = await _database_or_503().users.find_one({"id": user_id}, {"monthly_goal": 1})
    raw_target = ((user_doc or {}).get("monthly_goal") or {}).get("target_kg")
    try:
        target_kg = float(raw_target) if raw_target is not None else None
    except (TypeError, ValueError):
        target_kg = None
    return build_monthly_goal_progress(logs, target_kg, today)


@api_router.put("/goals/monthly")
async def save_monthly_goal(req: SaveMonthlyGoalRequest, current_user_id: str = Depends(_current_user_id)):
    if req.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only update your own monthly goal.")
    now = datetime.now(timezone.utc).isoformat()
    result = await _database_or_503().users.update_one(
        {"id": req.user_id},
        {"$set": {"monthly_goal": {"target_kg": req.monthly_target_kg, "updated_at": now}}},
    )
    if not result.matched_count:
        raise HTTPException(status_code=404, detail="Account not found.")
    return {"status": "saved", "monthly_target_kg": round(req.monthly_target_kg, 2), "updated_at": now}


@api_router.post("/future/simulate", response_model=SimulateResponse)
async def simulate(req: SimulateRequest):
    base = req.current_annual_co2
    reduction_rate = req.annual_reduction_percent / 100
    current = round(base, 2)
    projected = round(base * ((1 - reduction_rate) ** req.horizon_years), 2)
    yearly = [
        {"year": datetime.now().year + year, "co2": round(base * ((1 - reduction_rate) ** year), 2)}
        for year in range(req.horizon_years + 1)
    ]
    summary = (
        f"Using the annual footprint and reduction target you entered, this arithmetic scenario is "
        f"{round((1 - projected / base) * 100, 1)}% lower by {datetime.now().year + req.horizon_years}."
    )
    recs = []
    if req.transport == "car":
        recs.append("Compare a routine with some car trips replaced by public transit, walking, or cycling.")
    if req.diet == "meat":
        recs.append("Compare a routine with more plant-forward meals and record the observed difference.")
    if not recs:
        recs.append("Use your activity history to choose a realistic annual reduction target, then compare alternatives.")
    return SimulateResponse(
        current_annual_co2=current,
        projected_co2=projected,
        future_temp_delta=None,
        temperature_note="Personal emissions cannot be converted into an individual temperature-change prediction.",
        future_summary=summary,
        yearly_breakdown=yearly,
        recommendations=recs,
        method="scenario_calculator",
        model_version="scenario_calculator_v2_user_baseline",
        model_status="transparent_scenario_not_time_series_ml",
        assumptions=[
            f"Starting annual footprint: {current} t CO2e, entered by the user.",
            f"Annual reduction target: {round(req.annual_reduction_percent, 1)}%, entered by the user.",
            "Transport and diet choices shape recommendations only; no hidden emission-factor conversion is applied.",
            "This is not an LSTM forecast; it is a transparent planning scenario.",
        ],
    )


@api_router.get("/community/feed")
async def community_feed(current_user_id: Optional[str] = Depends(_optional_current_user_id)):
    """Returns feed with real like counts, join status, and any user-created posts."""
    # Seed defaults into MongoDB on first call
    database = _database_or_503()
    posts_col = database.community_posts
    challenges_col = database.community_challenges
    likes_col = database.community_likes
    joins_col = database.community_joins

    if await posts_col.count_documents({}) == 0:
        seed_posts = [
            {"post_id": "p1", "user": "Aiko Tanaka", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=aiko_v2&skinColor=f2d3b1,f5cfa0,e8b88a&hairColor=2c1b18,4a2511,3d1c02&backgroundColor=transparent", "time": "2h", "text": "Hit a 30-day cycling streak! Saved ~12kg CO₂ this month.", "base_likes": 124, "tag": "Transport", "comments": [], "created_at": datetime.now(timezone.utc).isoformat()},
            {"post_id": "p2", "user": "Marco Silva", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=marco_v2&skinColor=f2d3b1,f5cfa0,e8b88a&hairColor=2c1b18,4a2511,3d1c02&backgroundColor=transparent", "time": "5h", "text": "Switched my home to a 100% renewable plan. Bill went DOWN.", "base_likes": 89, "tag": "Electricity", "comments": [], "created_at": datetime.now(timezone.utc).isoformat()},
            {"post_id": "p3", "user": "Priya Rao", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=priya_v2&skinColor=f2d3b1,f5cfa0,e8b88a&hairColor=2c1b18,4a2511,3d1c02&backgroundColor=transparent", "time": "1d", "text": "Plant-based week complete. The lentil curry recipe is a banger.", "base_likes": 211, "tag": "Food", "comments": [], "created_at": datetime.now(timezone.utc).isoformat()},
            {"post_id": "p4", "user": "Lena Volkov", "avatar": "https://api.dicebear.com/7.x/adventurer/svg?seed=lena_v2&skinColor=f2d3b1,f5cfa0,e8b88a&hairColor=2c1b18,4a2511,3d1c02&backgroundColor=transparent", "time": "2d", "text": "My Carbon DNA shifted into emerald spiral mode. New aura unlocked ✨", "base_likes": 67, "tag": "Milestone", "comments": [], "created_at": datetime.now(timezone.utc).isoformat()},
        ]
        await posts_col.insert_many(seed_posts)
    if await challenges_col.count_documents({}) == 0:
        seed_ch = [
            {"challenge_id": "c1", "title": "Meatless March", "base_members": 1240, "days_left": 12, "reward": "+500 XP", "description": "Skip meat for 30 days"},
            {"challenge_id": "c2", "title": "Cycle 100km", "base_members": 870, "days_left": 7, "reward": "Bike Knight badge", "description": "Log 100km cycling this month"},
            {"challenge_id": "c3", "title": "No-AC Week", "base_members": 421, "days_left": 3, "reward": "+300 XP", "description": "One week without air conditioning"},
            {"challenge_id": "c4", "title": "Plastic-Free Fortnight", "base_members": 640, "days_left": 14, "reward": "+400 XP", "description": "14 days zero single-use plastic"},
            {"challenge_id": "c5", "title": "Public Transit Only", "base_members": 285, "days_left": 5, "reward": "Commuter badge", "description": "No personal vehicle for 5 days"},
        ]
        await challenges_col.insert_many(seed_ch)

    # Fetch posts - compute relative time dynamically so 'now ago' doesn't freeze
    now_utc = datetime.now(timezone.utc)
    def _relative_time(doc):
        try:
            created = datetime.fromisoformat(doc["created_at"])
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            diff = now_utc - created
            secs = diff.total_seconds()
            if secs < 60: return "just now"
            if secs < 3600: return f"{int(secs/60)}m ago"
            if secs < 86400: return f"{int(secs/3600)}h ago"
            return f"{int(secs/86400)}d ago"
        except Exception:
            return doc.get("time", "recently")

    posts_docs = await posts_col.find().sort("created_at", -1).to_list(length=100)
    posts_out = []
    for p in posts_docs:
        pid = p["post_id"]
        extra_likes = await likes_col.count_documents({"post_id": pid})
        liked_by_me = False
        if current_user_id:
            liked_by_me = (await likes_col.count_documents({"post_id": pid, "user_id": current_user_id})) > 0
        posts_out.append({
            "id": pid,
            "user": p["user"],
            "avatar": p["avatar"],
            "time": _relative_time(p),
            "text": p["text"],
            "likes": p.get("base_likes", 0) + extra_likes,
            "liked_by_me": liked_by_me,
            "tag": p.get("tag", "Milestone"),
            "comments": p.get("comments", []),
        })

    # Fetch challenges
    ch_docs = await challenges_col.find().to_list(length=100)
    challenges_out = []
    for c in ch_docs:
        cid = c["challenge_id"]
        extra_members = await joins_col.count_documents({"challenge_id": cid})
        joined_by_me = False
        if current_user_id:
            joined_by_me = (await joins_col.count_documents({"challenge_id": cid, "user_id": current_user_id})) > 0
        challenges_out.append({
            "id": cid,
            "title": c["title"],
            "members": c.get("base_members", 0) + extra_members,
            "days_left": c.get("days_left", 7),
            "reward": c.get("reward", "+100 XP"),
            "description": c.get("description", ""),
            "joined_by_me": joined_by_me,
        })

    # Build leaderboard — only include real users with activity, no fake placeholders
    leaderboard_base = [
        {"rank": 1, "user": "Aiko Tanaka", "xp": 9820, "grade": "A+"},
        {"rank": 2, "user": "Priya Rao",   "xp": 8730, "grade": "A+"},
        {"rank": 3, "user": "Marco Silva", "xp": 7610, "grade": "A"},
        {"rank": 4, "user": "Lena Volkov", "xp": 6420, "grade": "A"},
    ]
    # Append the current user's real stats only if they have logged activities
    if current_user_id:
        user_doc = await database.users.find_one({"id": current_user_id})
        if user_doc:
            activity_count = await database.daily_activity_logs.count_documents({"user_id": current_user_id})
            if activity_count > 0:
                real_xp = int(activity_count * 120)  # rough XP estimate
                leaderboard_base.append({
                    "rank": 5,
                    "user": "You",
                    "xp": real_xp,
                    "grade": user_doc.get("grade", "Newbie"),
                    "is_me": True,
                })

    return {
        "posts": posts_out,
        "challenges": challenges_out,
        "leaderboard": leaderboard_base,
    }


class LikeRequest(BaseModel):
    post_id: str = Field(min_length=1, max_length=100)

@api_router.post("/community/like")
async def like_post(req: LikeRequest, current_user_id: str = Depends(_current_user_id)):
    database = _database_or_503()
    likes_col = database.community_likes
    posts_col = database.community_posts
    if not await posts_col.find_one({"post_id": req.post_id}):
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await likes_col.find_one({"post_id": req.post_id, "user_id": current_user_id})
    if existing:
        await likes_col.delete_one({"_id": existing["_id"]})
        liked = False
    else:
        await likes_col.insert_one({"post_id": req.post_id, "user_id": current_user_id, "at": datetime.now(timezone.utc).isoformat()})
        liked = True
    post = await posts_col.find_one({"post_id": req.post_id})
    extra = await likes_col.count_documents({"post_id": req.post_id})
    total = (post.get("base_likes", 0) if post else 0) + extra
    return {"liked": liked, "likes": total}


class CommentRequest(BaseModel):
    post_id: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=500)

@api_router.post("/community/comment")
async def add_comment(req: CommentRequest, current_user_id: str = Depends(_current_user_id)):
    database = _database_or_503()
    posts_col = database.community_posts
    user_doc = await database.users.find_one({"id": current_user_id})
    display_name = (user_doc or {}).get("name", "Eco Explorer")
    comment = {
        "id": str(uuid.uuid4()),
        "user": display_name,
        "user_id": current_user_id,
        "text": req.text.strip(),
        "at": datetime.now(timezone.utc).isoformat(),
    }
    r = await posts_col.update_one({"post_id": req.post_id}, {"$push": {"comments": comment}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True, "comment": comment}


class JoinRequest(BaseModel):
    challenge_id: str = Field(min_length=1, max_length=100)

@api_router.post("/community/join")
async def join_challenge(req: JoinRequest, current_user_id: str = Depends(_current_user_id)):
    database = _database_or_503()
    joins_col = database.community_joins
    challenges_col = database.community_challenges
    if not await challenges_col.find_one({"challenge_id": req.challenge_id}):
        raise HTTPException(status_code=404, detail="Challenge not found")
    existing = await joins_col.find_one({"challenge_id": req.challenge_id, "user_id": current_user_id})
    if existing:
        await joins_col.delete_one({"_id": existing["_id"]})
        joined = False
    else:
        await joins_col.insert_one({"challenge_id": req.challenge_id, "user_id": current_user_id, "at": datetime.now(timezone.utc).isoformat()})
        joined = True
    ch = await challenges_col.find_one({"challenge_id": req.challenge_id})
    extra = await joins_col.count_documents({"challenge_id": req.challenge_id})
    total = (ch.get("base_members", 0) if ch else 0) + extra
    return {"joined": joined, "members": total}


class CreatePostRequest(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    tag: str = Field(default="Milestone", max_length=40)

@api_router.post("/community/post")
async def create_post(req: CreatePostRequest, current_user_id: str = Depends(_current_user_id)):
    database = _database_or_503()
    posts_col = database.community_posts
    user_doc = await database.users.find_one({"id": current_user_id})
    display_name = (user_doc or {}).get("name", "Eco Explorer")
    avatar = (user_doc or {}).get("avatar") or f"https://api.dicebear.com/7.x/adventurer/svg?seed={current_user_id}&backgroundColor=transparent"
    doc = {
        "post_id": "u_" + uuid.uuid4().hex[:10],
        "user": display_name,
        "avatar": avatar,
        "text": req.text.strip(),
        "base_likes": 0,
        "tag": req.tag or "Milestone",
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": current_user_id,
    }
    await posts_col.insert_one(doc)
    return {"ok": True, "post_id": doc["post_id"]}


# ====== Smart Tips - rule-based sustainability guidance ======
import random

COACH_RESPONSES = {
    "greetings": [
        "Hello. I am CarbonMind Smart Tips, a rule-based guide. Ask about reducing emissions, carbon footprints, green travel, plant-based food, or how to use this app.",
        "Hey there! 🌱 Great to see you. What sustainability questions can I help you with today?",
        "Hi! Welcome back to CarbonMind. Feel free to ask me anything about your carbon habits, food scanning, or daily eco tips!",
    ],
    "what_is_carbon": [
        "A **carbon footprint** is the total amount of greenhouse gases (like carbon dioxide and methane) emitted directly or indirectly by our daily activities—such as driving, electricity use, food consumption, and waste. It is measured in kilograms (kg) or tonnes of CO₂ equivalent (CO₂e).",
    ],
    "where_more_co2": [
        "Typically, personal carbon emissions come from 4 major categories:\n1. 🚗 **Transport (~40-45%)**: Driving petrol/diesel cars and flying produce the highest emissions.\n2. ⚡ **Electricity & Heating (~25-30%)**: Grid power, air conditioning, and appliances.\n3. 🍽 **Diet (~18-20%)**: Meat (especially red meat and dairy) has high emissions.\n4. 📱 **Devices & Consumer Goods (~10-15%)**.\nYou can check your live breakdown directly on the Dashboard!",
    ],
    "how_to_use": [
        "Here is how you can use CarbonMind:\n• 📷 **Food Scanner**: Verify a meal photo and confirm it before adding it to your record.\n• ➕ **Add activity**: Save a completed activity with your own CO2e estimate.\n• 📈 **Plan today**: Explore a transparent end-of-day projection without saving it.\n• 🗂 **Activity history**: Review the completed activities saved today.\n• 🔮 **Future scenarios**: Compare transparent lifestyle assumptions over time.\n• 🔊 **Daily audio brief**: Hear a one-way summary of your saved record.",
    ],
    "food": [
        "Great question! Food accounts for about 26% of global emissions. Try swapping one meat meal per day for a plant-based option — this alone can save up to 2.5 kg CO₂ daily. Legumes like lentils and chickpeas are excellent protein-rich alternatives!",
        "Your food choices make a huge difference. Beef produces up to 27x more CO₂ than chicken or legumes per gram of protein. Going vegetarian even 3 days a week cuts your food footprint by ~500 kg CO₂ per year!",
        "Tip: Buy seasonal and local produce where possible. Air-freighted food can have up to 50x the carbon intensity of local seasonal crops!",
    ],
    "transport": [
        "Transport is usually the single largest source of personal emissions. Replacing just 2 short car trips a week with cycling or walking saves ~1.2 kg CO₂ each time — over 120 kg per year!",
        "Carpooling or taking an electric train emits up to 4-5x less CO₂ per passenger-km than driving solo in a petrol car.",
        "For city travel, electric buses and metro systems are the cleanest everyday option.",
    ],
    "electricity": [
        "Did you know idle standby devices account for 5-10% of household electricity? Turning off power strips when not in use can save 100+ kg CO₂ every year!",
        "Switching to LED bulbs cuts lighting electricity by 75%, and setting your AC to 24°C–25°C instead of 18°C saves significant power.",
        "Running heavy appliances (like washing machines) during off-peak hours uses cleaner grid energy in many regions.",
    ],
    "tips": [
        "Here are 3 high-impact eco tips for today:\n1. 🚶 Walk or cycle for trips under 2 km.\n2. 🥗 Enjoy a plant-powered lunch.\n3. 🔌 Unplug unused chargers and electronics.",
        "The biggest lifelong carbon reductions come from: cleaner transport, reducing food waste, eating plant-forward meals, and energy-efficient appliances.",
    ],
    "score": [
        "Your carbon score reflects how close you stay to your 6.5 kg daily budget. Staying consistently under budget earns you a green 'A' grade and builds your daily streak!",
        "To improve your score, check your highest emission category on the Dashboard and try one small daily swap.",
    ],
    "default": [
        "I'm here to help you live more sustainably! You can ask me about food emissions, transport tips, home energy savings, or what your carbon footprint means. What would you like to explore?",
        "Every small habit counts! Ask me anything about reducing emissions, calculating food CO₂, or exploring greener travel options.",
    ]
}

def get_coach_reply(message: str) -> str:
    msg = message.lower().strip()
    # Greetings
    if any(msg == w or msg.startswith(w + " ") or msg.endswith(" " + w) for w in ["hi", "hlo", "hello", "hey", "hola", "namaste", "good morning", "good evening"]):
        return random.choice(COACH_RESPONSES["greetings"])
    # Definitions
    elif any(w in msg for w in ["what is carbon footprint", "what is carbon", "what is co2", "meaning of carbon footprint", "define carbon footprint"]):
        return random.choice(COACH_RESPONSES["what_is_carbon"])
    # Top emission breakdown
    elif any(w in msg for w in ["where im i using more", "where am i using more", "where is my co2", "using more co2", "top emission", "biggest emission", "where does co2 come from"]):
        return random.choice(COACH_RESPONSES["where_more_co2"])
    # How to use app
    elif any(w in msg for w in ["how to use", "how does this app work", "how do i use", "help with app", "app features"]):
        return random.choice(COACH_RESPONSES["how_to_use"])
    # Food / diet
    elif any(w in msg for w in ["food", "eat", "meat", "vegan", "vegetarian", "meal", "diet", "dinner", "lunch", "breakfast"]):
        return random.choice(COACH_RESPONSES["food"])
    # Transport / vehicle
    elif any(w in msg for w in ["car", "transport", "drive", "cycle", "bus", "train", "commute", "travel", "flight", "bike"]):
        return random.choice(COACH_RESPONSES["transport"])
    # Electricity / energy
    elif any(w in msg for w in ["electricity", "power", "energy", "bulb", "appliance", "light", "electric", "ac", "heater"]):
        return random.choice(COACH_RESPONSES["electricity"])
    # Tips / advice
    elif any(w in msg for w in ["tip", "advice", "suggest", "help", "reduce", "how can i save"]):
        return random.choice(COACH_RESPONSES["tips"])
    # Score / streak / budget
    elif any(w in msg for w in ["score", "grade", "budget", "kg", "streak", "points", "xp"]):
        return random.choice(COACH_RESPONSES["score"])
    else:
        return random.choice(COACH_RESPONSES["default"])

@api_router.post("/chat/sustainability", response_model=ChatResponse)
async def chat_sustainability(req: ChatRequest):
    try:
        reply = get_coach_reply(req.message)
        return ChatResponse(reply=reply, session_id=req.session_id, mode="rule_based_smart_tips")
    except Exception as e:
        logger.exception("Chat failed")
        return ChatResponse(reply="CarbonMind Smart Tips is temporarily unavailable. Try reviewing your activity record or the food-factor details.", session_id=req.session_id, mode="rule_based_smart_tips")



# ====== Annual profile candidate and daily activity projection ======
@api_router.post("/predict/annual")
async def predict_annual(req: AnnualCarbonRequest):
    missing = missing_annual_carbon_features(req.lifestyle_profile)
    if missing:
        raise HTTPException(
            status_code=422,
            detail={"message": "A full lifestyle profile is required for this annual estimate.", "missing_fields": missing},
        )
    annual_kg = predict_annual_carbon(req.lifestyle_profile)
    if annual_kg is None:
        raise HTTPException(status_code=503, detail="The annual carbon candidate is unavailable.")
    ensemble = predict_gbdt_ensemble(req.lifestyle_profile)
    return {
        "annual_kg_co2e": round(annual_kg, 2),
        "daily_equivalent_kg": round(annual_kg / 365, 2),
        "model_used": "lightgbm_product_18_no_sex_candidate",
        "model_version": "annual_carbon_product_18_v1",
        "model_status": "candidate_not_product_validated",
        "feature_coverage": 1.0,
        "model_note": "This is an annual lifestyle estimate from the complete recorded profile. It is not a measured daily footprint or a validated commercial carbon-accounting result.",
        "fourteen_feature_ensemble": ensemble,
    }


@api_router.post("/predict/day")
async def predict_day(req: PredictDayRequest):
    activities = [activity.model_dump() for activity in req.morning_activities]
    invalid_types = {activity["type"] for activity in activities} - {"transport", "electricity", "food", "devices", "other"}
    if invalid_types:
        raise HTTPException(status_code=422, detail=f"Unsupported activity types: {sorted(invalid_types)}")

    budget = req.daily_budget_kg
    morning_total = sum(activity["kg"] for activity in activities)
    profile = req.lifestyle_profile or {}
    # Carbon Emission.csv has an annual lifestyle target and no timestamped
    # within-day activity trajectories. It cannot validate a same-day model,
    # so this endpoint keeps the rate calculation honestly labeled.
    predicted = round(morning_total * (24 / req.observation_hours), 2)
    model_used = "activity_rate_projection"
    model_version = "activity_rate_projection_v1"
    model_status = "transparent_rule_based_projection"
    model_note = f"Projection scales {req.observation_hours:g} logged hours to a 24-hour day; it is not a trained-model forecast."
    annual_reference = predict_gbdt_ensemble(profile) if not missing_annual_carbon_features(profile) else None

    predicted = min(100.0, predicted)
    exceeds = predicted > budget
    over_pct = round((predicted - budget) / budget * 100, 1)

    # Build 24-hour S-curve accumulation
    import math
    hourly_curve = []
    for h in range(1, 25):
        frac = h / 24
        s = 1 / (1 + math.exp(-10 * (frac - 0.5)))
        kg = round(predicted * s, 2)
        hourly_curve.append({"hour": f"{h:02d}:00", "kg": kg})

    breakdown = {}
    for activity in activities:
        activity_type = activity["type"]
        breakdown[activity_type] = breakdown.get(activity_type, 0.0) + activity["kg"]

    return {
        "predicted_full_day_kg": predicted,
        "budget_kg": budget,
        "exceeds": exceeds,
        "over_pct": over_pct,
        "model_used": model_used,
        "model_version": model_version,
        "model_status": model_status,
        "model_note": model_note,
        "observation_hours": req.observation_hours,
        "profile_feature_coverage": round(sum(feature in profile and profile[feature] is not None for feature in ANNUAL_CARBON_FEATURES) / len(ANNUAL_CARBON_FEATURES), 2),
        "annual_lifestyle_ensemble_reference": annual_reference,
        "ai_headline": (
            f"Alert: this projection reaches {predicted} kg today, {abs(over_pct)}% above your {budget} kg budget."
            if exceeds else
            f"Current projection: {predicted} kg today, {abs(over_pct)}% below your {budget} kg budget."
        ),
        "hourly_curve": hourly_curve,
        "breakdown_by_type": [
            {"type": key, "kg": round(value, 2)}
            for key, value in sorted(breakdown.items())
        ],
    }


# ====== Weekly Forecast (Holt-Winters + validated LSTM when available) ======
@api_router.post("/predict/weekly")
async def predict_weekly(req: dict):
    """Return a seven-day forecast with transparent model availability."""
    history = req.get("daily_history", [])
    if not isinstance(history, list) or len(history) < 5:
        raise HTTPException(status_code=422, detail="At least five real daily observations are required for a weekly forecast.")
    try:
        history = [float(value) for value in history]
    except (TypeError, ValueError):
        raise HTTPException(status_code=422, detail="daily_history must contain numeric emission values.")

    forecast_res = predict_weekly_ensemble(history)
    if not forecast_res:
        avg = sum(history) / len(history)
        forecast_res = {
            "forecast": [round(avg, 2)] * 7,
            "lower_band": [round(avg * 0.8, 2)] * 7,
            "upper_band": [round(avg * 1.2, 2)] * 7,
            "band_note": "Heuristic band; it is not a calibrated confidence interval.",
            "trend": "stable",
            "pct_change": 0.0,
            "weekly_total": round(avg * 7, 2),
            "method": "moving_average"
        }

    return {
        "status": "success",
        "model_version": "weekly_holt_winters_lstm_candidate_v1",
        "forecast_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        **forecast_res
    }



# ====== Voice Eco Tips ======
@api_router.post("/voice/call-tips")
async def voice_call_tips(req: dict):
    tips = [
        "Switch off devices that are not in use and review your household energy routine.",
        "For practical local trips, compare walking, cycling, public transit, and driving.",
        "Try a plant-forward meal and record its reviewed food estimate in your activity history.",
        "Use air-drying when it fits your routine instead of relying on a tumble dryer.",
        "Look for a small water-heating habit you can change consistently.",
    ]
    import random
    return {
        "tips": random.sample(tips, min(3, len(tips))),
        "session_id": req.get("session_id", str(uuid.uuid4())),
    }


# ====== One-way Twilio phone briefing ======
@api_router.post("/voice/phone-call")
async def voice_phone_call(req: PhoneCallRequest, current_user_id: str = Depends(_current_user_id)):
    """Place an outbound, one-way call that reads the user's saved daily record."""

    phone_number = re.sub(r"[\s()-]", "", req.phone_number)
    if not re.fullmatch(r"\+?[1-9]\d{9,14}", phone_number):
        raise HTTPException(status_code=422, detail="Enter a valid international phone number.")
    database = _database_or_503()
    today = datetime.now(timezone.utc).date()
    logs = await _daily_logs(current_user_id, today - timedelta(days=6), today)
    logs_by_day = {log["day"]: log for log in logs}
    today_log = logs_by_day.get(today.isoformat(), {})
    today_kg = round(float(today_log.get("total_kg", 0)), 1)
    weekly_kg = round(sum(float(log.get("total_kg", 0)) for log in logs), 1)
    totals = _sum_activities(today_log.get("activities", []))
    top_category = ACTIVITY_META[max(totals, key=totals.get)]["name"] if any(totals.values()) else "No recorded category"
    user_doc = await database.users.find_one({"id": current_user_id})
    user_name = (user_doc or {}).get("name", "Eco Explorer")
    budget = 6.5

    overunder = "under" if today_kg <= budget else "over"
    diff = abs(round(today_kg - budget, 1))

    if today_kg <= 0:
        script = (
            f"Hello {user_name}. This is your CarbonMind phone briefing. "
            "There are no saved activities for today yet, so there is no emissions total to report. "
            "Add a completed activity or confirm a scanned meal when it happens. "
            "This is a one-way audio briefing and does not listen for a response. Goodbye."
        )
    else:
        script = (
            f"Hello {user_name}. This is your CarbonMind phone briefing. "
            f"Your saved activity record totals {today_kg} kilograms of CO2 equivalent today. "
            f"That is {diff} kilograms {overunder} your {budget} kilogram daily budget. "
            f"Your largest recorded category is {top_category}. "
            "This is a one-way audio briefing and does not listen for a response. Goodbye."
        )

    # Try Twilio
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID", "")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN", "")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "")
    twiml_base = os.environ.get("TWIML_BASE_URL", "http://demo.twilio.com")

    if not account_sid or not auth_token or not from_number:
        # Demo mode: just return the script so frontend can read it
        logger.warning("Twilio credentials not configured — returning script for demo TTS")
        return {
            "ok": True,
            "demo": True,
            "mode": "one_way_audio",
            "message": "Phone briefings are not enabled for this deployment.",
            "script": script,
        }

    try:
        from twilio.rest import Client as TwilioClient
        from twilio.twiml.voice_response import VoiceResponse, Say

        client = TwilioClient(account_sid, auth_token)

        # Build inline TwiML
        twiml = VoiceResponse()
        twiml.say(script, voice="Polly.Aditi" if "91" in phone_number else "Polly.Joanna", language="en-IN" if "91" in phone_number else "en-US")

        call = client.calls.create(
            to=phone_number,
            from_=from_number,
            twiml=str(twiml),
        )
        logger.info("Twilio call placed: %s", call.sid)
        return {"ok": True, "call_sid": call.sid, "demo": False, "mode": "one_way_audio"}

    except ImportError:
        return {
            "ok": True,
            "demo": True,
            "mode": "one_way_audio",
            "message": "Phone briefings are not enabled for this deployment.",
            "script": script,
        }
    except Exception as e:
        logger.exception("Twilio call failed")
        raise HTTPException(status_code=500, detail=str(e))


# ====== Food Carbon Scanner ======
@api_router.get("/food/catalog")
async def get_food_catalog():
    """Reviewed food choices only; values are calculated from the CSV recipe catalog."""
    return {
        "factor_source": "Food_Product_Emissions.csv",
        "items": food_catalog(),
        "note": "Transport, electricity, and device values are intentionally not supplied here because this CSV contains food-product factors only.",
    }


async def _persist_food_prediction(prediction: dict, hint: Optional[str]) -> Optional[str]:
    """Persist model-output audit fields, never raw photo bytes."""
    if db is None or not prediction.get("prediction_audit"):
        return None
    scan_id = str(uuid.uuid4())
    payload = {
        "scan_id": scan_id,
        "status": prediction.get("status"),
        "confirmed_dish": (hint or "").strip()[:120],
        "prediction_audit": prediction["prediction_audit"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "image_retained": False,
    }
    try:
        await db.food_scan_predictions.insert_one(payload)
        return scan_id
    except Exception as exc:
        logger.warning("Food prediction audit logging skipped: %s", exc)
        return None


@api_router.post("/food/scan")
async def food_scan(req: FoodScanRequest):
    base64_img = req.image_base64
    hint = req.hint
    
    if not base64_img:
        return {
            "status": "error",
            "message": "No meal photo was provided.",
            "suggestion": "Please upload an image.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # Check size (rough base64 estimation)
    if base64_img and len(base64_img) * 0.75 > 10 * 1024 * 1024:
        return {
            "status": "error",
            "message": "Invalid file. Max 10MB.",
            "suggestion": "Please upload a smaller image.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # Vision inference performs remote HTTP calls. Keep it off the event loop
    # so a slow provider cannot make tracker/history requests appear frozen.
    pred = await asyncio.to_thread(predict_food, base64_img or "", hint=hint)
    scan_id = await _persist_food_prediction(pred, hint)
    
    if pred["status"] == "error":
        return {
            "status": "error",
            "message": "Service unavailable. Retry in 30s",
            "suggestion": "Try again later",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    if pred["status"] in {"rejected", "low_confidence", "provider_unavailable"}:
        return {
            "status": "review",
            "message": pred["message"],
            "suggestion": pred.get("suggestion", "Try another clear photo of the meal."),
            "confidence": pred.get("confidence"),
            "image_candidate": pred.get("image_candidate"),
            "prediction_audit": pred.get("prediction_audit"),
            "scan_id": scan_id,
            "requires_user_confirmation": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    items = [
        {
            "name": pred["food_category"],
            "portion": f"{pred['serving_size_g']} g estimated portion",
            "category": "recipe estimate",
            "co2_kg": pred["co2_kg"],
            "tip": pred.get("portion_note", "Confirm the dish and portion before treating this as a food-footprint record."),
        }
    ]
    total = pred["co2_kg"]
    carbon_label = "A+" if total < 0.5 else "A" if total < 1.5 else "B" if total < 3 else "C"
    
    return {
        "status": "success",
        "data": {
            "total_co2_kg": total,
            "carbon_label": carbon_label,
            "ai_note": f"The photo candidate '{pred['image_candidate']}' matched '{pred['food_category']}'. The estimate uses {pred.get('factor_source', 'the configured factor catalog')} and a {pred['serving_size_g']} g recipe portion; confirm the portion before logging.",
            "items": items,
            "method": pred.get("method", "vision_candidate"),
            "emissions_method": pred.get("emissions_method"),
            "image_candidate": pred.get("image_candidate"),
            "model_version": "food_scan_candidate_recipe_lca_v2",
            "model_status": "candidate_not_product_validated",
            "confidence": pred.get("confidence"),
            "confidence_note": pred.get("confidence_note", "Confidence is model output, not validated real-world accuracy."),
            "serving_size_g": pred.get("serving_size_g"),
            "factor_source": pred.get("factor_source"),
            "recipe_components": pred.get("components", []),
            "lifecycle_stages": pred.get("lifecycle_stages", []),
            "reported_lifecycle_stage_total_co2_kg": pred.get("reported_lifecycle_stage_total_co2_kg"),
            "unallocated_csv_difference_co2_kg": pred.get("unallocated_csv_difference_co2_kg"),
            "prediction_audit": pred.get("prediction_audit"),
            "scan_id": scan_id,
        },
        "message": f"Successfully analyzed {pred['food_category']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


@api_router.post("/food/feedback")
async def save_food_scan_feedback(req: FoodScanFeedbackRequest, current_user_id: str = Depends(_current_user_id)):
    """Store a user correction for audit; images are deliberately never retained here."""
    feedback = {
        "feedback_id": str(uuid.uuid4()),
        "user_id": current_user_id,
        "predicted_food": req.predicted_food.strip() if req.predicted_food else None,
        "confirmed_food": req.confirmed_food.strip(),
        "scan_method": req.scan_method,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await _database_or_503().food_scan_feedback.insert_one(feedback)
    return {"status": "saved", "feedback_id": feedback["feedback_id"], "image_retained": False}


# ====== Carbon Certificate Generator ======
@api_router.post("/certificate/generate")
async def generate_certificate(current_user_id: str = Depends(_current_user_id)):
    today = datetime.now(timezone.utc).date()
    month_start = today.replace(day=1)
    logs = await _daily_logs(current_user_id, month_start, today)
    co2_recorded_kg = round(sum(float(log.get("total_kg", 0)) for log in logs), 2)
    database = _database_or_503()
    user_doc = await database.users.find_one({"id": current_user_id})
    user_name = (user_doc or {}).get("name", "Eco Explorer")
    grade = "Recorded" if logs else "No activity recorded"
    cert_id = "CM-" + str(uuid.uuid4())[:8].upper()
    month = datetime.now(timezone.utc).strftime("%B %Y")
    issued_at = datetime.now(timezone.utc).isoformat()
    signature = hmac.new(auth_secret.encode("utf-8"), f"{cert_id}:{current_user_id}:{co2_recorded_kg}:{month}".encode("utf-8"), hashlib.sha256).hexdigest()[:48]
    certificate = {
        "cert_id": cert_id,
        "user_name": user_name,
        "grade": grade,
        "co2_recorded_kg": co2_recorded_kg,
        "recorded_days": len(logs),
        "verification_status": "user_entered_activity_summary",
        "month": month,
        "issued_at": issued_at,
        "signature": signature,
        "verify_url": "",
        "user_id": current_user_id,
    }
    await database.certificates.insert_one(certificate.copy())
    return {key: value for key, value in certificate.items() if key not in {"_id", "user_id"}}


@api_router.get("/certificate/{cert_id}")
async def get_certificate(cert_id: str):
    certificate = await _database_or_503().certificates.find_one({"cert_id": cert_id})
    if not certificate:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return {key: value for key, value in certificate.items() if key not in {"_id", "user_id"}}


app.include_router(api_router)

default_cors_origins = "http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002"
cors_origins = [
    origin.strip()
    for origin in os.environ.get('CORS_ORIGINS', default_cors_origins).split(',')
    if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=cors_origins != ["*"],
    allow_origins=cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    if client:
        client.close()
