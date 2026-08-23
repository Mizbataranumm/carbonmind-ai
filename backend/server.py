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
from datetime import datetime, timezone

# Optional AI integration — falls back gracefully if not installed
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    HAS_LLM = True
except ImportError:
    HAS_LLM = False

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="CarbonMind AI")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

import sys
import os
sys.path.append(os.path.dirname(__file__))

from ml_service import load_models, predict_food, predict_gbdt, predict_lstm

@app.on_event("startup")
async def startup_event():
    load_models(models_dir=str(Path(__file__).parent / "ml" / "models"))


# ====== Models ======
class DemoLoginRequest(BaseModel):
    name: Optional[str] = "Eco Explorer"

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

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
    onboarding_completed: bool = False
    onboarding_step: int = 1
    onboarding_preferences: dict = {}

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    reply: str
    session_id: str

class MorningActivity(BaseModel):
    type: str  # transport / electricity / food / devices
    kg: float

class PredictDayRequest(BaseModel):
    morning_activities: List[MorningActivity]
    daily_budget_kg: float = 6.5

class PredictDayResponse(BaseModel):
    predicted_full_day_kg: float
    budget_kg: float
    exceeds: bool
    over_pct: float
    hourly_curve: List[dict]
    equivalents: dict
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
    hint: Optional[str] = None  # optional description hint

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

class CertificateRequest(BaseModel):
    user_name: str
    month: Optional[str] = None
    co2_saved_kg: Optional[float] = None
    grade: Optional[str] = "A-"

class CertificateResponse(BaseModel):
    cert_id: str
    user_name: str
    month: str
    co2_saved_kg: float
    grade: str
    equivalents: dict
    issued_at: str
    signature: str
    verify_url: str

class SimulateRequest(BaseModel):
    transport: str  # car / public / bike / mixed
    diet: str  # meat / mixed / vegetarian / vegan
    electricity_kwh: float
    flights_per_year: int
    horizon_years: int = 10

class SimulateResponse(BaseModel):
    current_annual_co2: float
    projected_co2: float
    future_temp_delta: float
    earth_health: int
    future_summary: str
    yearly_breakdown: List[dict]
    recommendations: List[str]


# ====== Routes ======
@api_router.get("/")
async def root():
    return {"message": "CarbonMind AI API online", "status": "ok"}

@api_router.get("/onboarding/status")
async def get_onboarding_status(user_id: str):
    user = await db.users.find_one({"id": user_id})
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
async def save_onboarding(req: dict):
    user_id = req.get("user_id")
    preferences = req.get("preferences", {})
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "onboarding_completed": True,
            "onboarding_step": 4,
            "onboarding_preferences": preferences
        }}
    )
    return {"status": "success", "message": "Onboarding saved successfully"}

# ====== Auth ======
@api_router.post("/auth/demo-login", response_model=UserProfile)
async def demo_login(req: DemoLoginRequest):
    is_demo = not req.name or req.name.lower() in ["eco explorer", "demo"]
    user = {
        "id": "demo-123" if is_demo else str(uuid.uuid4()),
        "name": req.name or "Eco Explorer",
        "email": "demo@carbonmind.ai" if is_demo else f"{req.name.lower().replace(' ', '')}@earth.io",
        "avatar": f"https://api.dicebear.com/7.x/adventurer/svg?seed={req.name or 'demo'}&skinColor=f2d3b1,f5cfa0,e8b88a&hairColor=2c1b18,4a2511,3d1c02&backgroundColor=transparent",
        "carbon_aura": "#00FFB2" if is_demo else "#9EABBC",
        "streak": 14 if is_demo else 0,
        "xp": 2480 if is_demo else 0,
        "grade": "A-" if is_demo else "Newbie",
    }
    return user

@api_router.post("/auth/register", response_model=UserProfile)
async def register(req: RegisterRequest):
    users_col = db.users
    existing = await users_col.find_one({"email": req.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")
    user_doc = {
        "id": str(uuid.uuid4()),
        "name": req.name,
        "email": req.email.lower(),
        "password": req.password,
        "avatar": f"https://api.dicebear.com/7.x/adventurer/svg?seed={req.name}&skinColor=f2d3b1,f5cfa0,e8b88a&hairColor=2c1b18,4a2511,3d1c02&backgroundColor=transparent",
        "carbon_aura": "#9EABBC",
        "streak": 0,
        "xp": 0,
        "grade": "Newbie",
    }
    await users_col.insert_one(user_doc.copy())
    return user_doc

@api_router.post("/auth/login", response_model=UserProfile)
async def login(req: LoginRequest):
    if req.email.lower() == "demo@carbonmind.ai" or req.email.lower() == "demo":
        return await demo_login(DemoLoginRequest(name="Eco Explorer"))
    
    users_col = db.users
    user_doc = await users_col.find_one({"email": req.email.lower(), "password": req.password})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials or user not found")
    
    # Exclude MongoDB specific internal id to match UserProfile schema
    user_doc.pop("_id", None)
    return user_doc


@api_router.get("/carbon/stats")
async def carbon_stats(is_new: bool = False):
    """Mock dashboard stats. Demo data."""
    if is_new:
        return {
            "today_kg": 0.0,
            "week_kg": 0.0,
            "month_kg": 0.0,
            "year_kg": 0.0,
            "grade": "Newbie",
            "trend_pct": 0.0,
            "score": 0,
            "weekly_trend": [
                {"day": "Mon", "kg": 0.0, "target": 6.5},
                {"day": "Tue", "kg": 0.0, "target": 6.5},
                {"day": "Wed", "kg": 0.0, "target": 6.5},
                {"day": "Thu", "kg": 0.0, "target": 6.5},
                {"day": "Fri", "kg": 0.0, "target": 6.5},
                {"day": "Sat", "kg": 0.0, "target": 6.5},
                {"day": "Sun", "kg": 0.0, "target": 6.5},
            ],
            "breakdown": [
                {"name": "Transport", "value": 0, "color": "#00FFB2"},
                {"name": "Electricity", "value": 0, "color": "#00D9FF"},
                {"name": "Food", "value": 0, "color": "#FFD166"},
                {"name": "Devices", "value": 0, "color": "#FF66E1"},
                {"name": "Other", "value": 100, "color": "#9EABBC"},
            ],
            "prediction": [
                {"month": "Jan", "actual": 0, "predicted": 0},
                {"month": "Feb", "actual": 0, "predicted": 0},
                {"month": "Mar", "actual": 0, "predicted": 0},
                {"month": "Apr", "actual": 0, "predicted": 0},
                {"month": "May", "actual": None, "predicted": 0},
                {"month": "Jun", "actual": None, "predicted": 0},
                {"month": "Jul", "actual": None, "predicted": 0},
                {"month": "Aug", "actual": None, "predicted": 0},
            ],
            "achievements": [
                {"id": 1, "title": "First Step", "desc": "Log your first activity", "icon": "leaf", "earned": False},
                {"id": 2, "title": "Green Streak", "desc": "14 days under target", "icon": "flame", "earned": False},
            ],
            "recommendations": [
                {"id": 1, "title": "Log your daily commute", "impact": "Start tracking", "category": "transport"},
                {"id": 2, "title": "Scan a meal", "impact": "Learn footprints", "category": "food"},
            ],
        }

    return {
        "today_kg": 6.4,
        "week_kg": 41.8,
        "month_kg": 178.3,
        "year_kg": 2140.0,
        "grade": "A-",
        "trend_pct": -8.2,
        "score": 78,
        "weekly_trend": [
            {"day": "Mon", "kg": 7.2, "target": 6.5},
            {"day": "Tue", "kg": 6.8, "target": 6.5},
            {"day": "Wed", "kg": 5.4, "target": 6.5},
            {"day": "Thu", "kg": 6.2, "target": 6.5},
            {"day": "Fri", "kg": 8.1, "target": 6.5},
            {"day": "Sat", "kg": 4.9, "target": 6.5},
            {"day": "Sun", "kg": 3.2, "target": 6.5},
        ],
        "breakdown": [
            {"name": "Transport", "value": 42, "color": "#00FFB2"},
            {"name": "Electricity", "value": 27, "color": "#00D9FF"},
            {"name": "Food", "value": 18, "color": "#FFD166"},
            {"name": "Devices", "value": 8, "color": "#FF66E1"},
            {"name": "Other", "value": 5, "color": "#9EABBC"},
        ],
        "prediction": [
            {"month": "Jan", "actual": 180, "predicted": 180},
            {"month": "Feb", "actual": 175, "predicted": 175},
            {"month": "Mar", "actual": 168, "predicted": 168},
            {"month": "Apr", "actual": 178, "predicted": 178},
            {"month": "May", "actual": None, "predicted": 162},
            {"month": "Jun", "actual": None, "predicted": 154},
            {"month": "Jul", "actual": None, "predicted": 148},
            {"month": "Aug", "actual": None, "predicted": 141},
        ],
        "achievements": [
            {"id": 1, "title": "Green Streak", "desc": "14 days under target", "icon": "flame", "earned": True},
            {"id": 2, "title": "Bike Knight", "desc": "Cycled 50km this week", "icon": "bike", "earned": True},
            {"id": 3, "title": "Plant Lord", "desc": "20 meatless meals", "icon": "leaf", "earned": True},
            {"id": 4, "title": "Solar Adept", "desc": "Reduce grid use by 30%", "icon": "sun", "earned": False},
        ],
        "recommendations": [
            {"id": 1, "title": "Switch to LED bulbs", "impact": "-0.6 kg/day", "category": "electricity"},
            {"id": 2, "title": "Cycle for trips < 3km", "impact": "-1.2 kg/day", "category": "transport"},
            {"id": 3, "title": "Try 2 meatless days", "impact": "-0.9 kg/day", "category": "food"},
            {"id": 4, "title": "Unplug idle devices", "impact": "-0.3 kg/day", "category": "devices"},
        ],
    }


@api_router.get("/tracker/live")
async def tracker_live(is_new: bool = False):
    if is_new:
        return {
            "activities": [],
            "categories": [
                {"name": "Transport", "kg": 0.0, "budget": 4.0, "trend": 0.0, "color": "#00FFB2"},
                {"name": "Electricity", "kg": 0.0, "budget": 2.5, "trend": 0.0, "color": "#00D9FF"},
                {"name": "Food", "kg": 0.0, "budget": 1.2, "trend": 0.0, "color": "#FFD166"},
                {"name": "Devices", "kg": 0.0, "budget": 0.8, "trend": 0.0, "color": "#FF66E1"},
            ],
            "realtime": [{"t": f"{i:02d}", "kg": 0.0} for i in range(0, 24, 3)],
        }
    return {
        "activities": [
            {"id": 1, "type": "transport", "label": "Morning commute", "kg": 2.1, "time": "08:14", "icon": "car"},
            {"id": 2, "type": "electricity", "label": "Home appliances", "kg": 1.8, "time": "12:30", "icon": "zap"},
            {"id": 3, "type": "food", "label": "Lunch (vegetarian)", "kg": 0.6, "time": "13:05", "icon": "utensils"},
            {"id": 4, "type": "devices", "label": "Laptop + monitor", "kg": 0.4, "time": "16:00", "icon": "monitor"},
            {"id": 5, "type": "transport", "label": "Evening cycle", "kg": 0.0, "time": "19:20", "icon": "bike"},
        ],
        "categories": [
            {"name": "Transport", "kg": 2.1, "budget": 4.0, "trend": -0.4, "color": "#00FFB2"},
            {"name": "Electricity", "kg": 1.8, "budget": 2.5, "trend": -0.2, "color": "#00D9FF"},
            {"name": "Food", "kg": 0.6, "budget": 1.2, "trend": -0.1, "color": "#FFD166"},
            {"name": "Devices", "kg": 0.4, "budget": 0.8, "trend": 0.0, "color": "#FF66E1"},
        ],
        "realtime": [
            {"t": "00", "kg": 0.2}, {"t": "03", "kg": 0.1}, {"t": "06", "kg": 0.3},
            {"t": "09", "kg": 1.8}, {"t": "12", "kg": 2.4}, {"t": "15", "kg": 1.1},
            {"t": "18", "kg": 0.6}, {"t": "21", "kg": 0.3},
        ],
    }


@api_router.post("/future/simulate", response_model=SimulateResponse)
async def simulate(req: SimulateRequest):
    import random
    transport_factor = {"car": 4.6, "mixed": 2.8, "public": 1.4, "bike": 0.2}.get(req.transport, 2.5)
    diet_factor = {"meat": 3.3, "mixed": 2.1, "vegetarian": 1.4, "vegan": 1.0}.get(req.diet, 2.0)
    electric_co2 = req.electricity_kwh * 0.4 / 1000  # tons
    flights_co2 = req.flights_per_year * 0.9
    base = transport_factor + diet_factor + electric_co2 + flights_co2
    current = round(base, 2)
    
    # ML Inference via LSTM
    # Generate 30 days of pseudo-historical data centered around base/365
    daily_base = base / 365
    historical_30_days = [[max(0, daily_base + random.gauss(0, daily_base*0.1))] for _ in range(30)]
    lstm_preds = predict_lstm(historical_30_days)
    
    if lstm_preds:
        # LSTM predicts next 7 days, extrapolate to a year for projection
        projected_daily_avg = sum(lstm_preds) / len(lstm_preds)
        projected = round(projected_daily_avg * 365, 2)
    else:
        projected = round(base * ((0.97) ** req.horizon_years), 2)
        
    yearly = []
    for i in range(req.horizon_years + 1):
        yearly.append({"year": datetime.now().year + i, "co2": round(base + (projected - base)*(i/req.horizon_years) if req.horizon_years else base, 2)})
        
    earth_health = max(0, min(100, int(100 - (projected * 8))))
    temp_delta = round((projected - 2.0) * 0.18, 2)
    if projected < 3.5:
        summary = f"Your future-self walks a lighter Earth. By {datetime.now().year + req.horizon_years}, your carbon footprint drops by {round((1 - projected/base)*100)}%. Forests breathe easier because of you."
    elif projected < 6:
        summary = f"You're on a balanced trajectory. Small upgrades — public transit, plant-based meals — could shave another 25%."
    else:
        summary = f"Your trajectory needs a course-correction. Without changes, you contribute to a +{temp_delta}°C local impact by {datetime.now().year + req.horizon_years}."
    recs = []
    if req.transport == "car":
        recs.append("Switch 2 weekly commutes to cycling or public transit (-1.2 t/yr)")
    if req.diet == "meat":
        recs.append("Introduce 3 plant-based dinners weekly (-0.8 t/yr)")
    if req.electricity_kwh > 4000:
        recs.append("Audit standby power & switch to renewable plan (-0.6 t/yr)")
    if req.flights_per_year >= 3:
        recs.append("Replace 1 short-haul flight with rail (-0.5 t/yr)")
    if not recs:
        recs.append("You're already a sustainability pioneer. Share your habits in the Community.")
    return SimulateResponse(
        current_annual_co2=current,
        projected_co2=projected,
        future_temp_delta=temp_delta,
        earth_health=earth_health,
        future_summary=summary,
        yearly_breakdown=yearly,
        recommendations=recs,
    )


@api_router.get("/community/feed")
async def community_feed(user_id: Optional[str] = None):
    """Returns feed with real like counts, join status, and any user-created posts."""
    # Seed defaults into MongoDB on first call
    posts_col = db.community_posts
    challenges_col = db.community_challenges
    likes_col = db.community_likes
    joins_col = db.community_joins

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

    # Fetch posts
    posts_docs = await posts_col.find().sort("created_at", -1).to_list(length=100)
    posts_out = []
    for p in posts_docs:
        pid = p["post_id"]
        extra_likes = await likes_col.count_documents({"post_id": pid})
        liked_by_me = False
        if user_id:
            liked_by_me = (await likes_col.count_documents({"post_id": pid, "user_id": user_id})) > 0
        posts_out.append({
            "id": pid,
            "user": p["user"],
            "avatar": p["avatar"],
            "time": p.get("time", "now"),
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
        if user_id:
            joined_by_me = (await joins_col.count_documents({"challenge_id": cid, "user_id": user_id})) > 0
        challenges_out.append({
            "id": cid,
            "title": c["title"],
            "members": c.get("base_members", 0) + extra_members,
            "days_left": c.get("days_left", 7),
            "reward": c.get("reward", "+100 XP"),
            "description": c.get("description", ""),
            "joined_by_me": joined_by_me,
        })

    return {
        "posts": posts_out,
        "challenges": challenges_out,
        "leaderboard": [
            {"rank": 1, "user": "Aiko Tanaka", "xp": 9820, "grade": "A+"},
            {"rank": 2, "user": "Priya Rao", "xp": 8730, "grade": "A+"},
            {"rank": 3, "user": "Marco Silva", "xp": 7610, "grade": "A"},
            {"rank": 4, "user": "Lena Volkov", "xp": 6420, "grade": "A"},
            {"rank": 5, "user": "You", "xp": 2480, "grade": "A-"},
        ],
    }


class LikeRequest(BaseModel):
    user_id: str
    post_id: str

@api_router.post("/community/like")
async def like_post(req: LikeRequest):
    likes_col = db.community_likes
    posts_col = db.community_posts
    existing = await likes_col.find_one({"post_id": req.post_id, "user_id": req.user_id})
    if existing:
        await likes_col.delete_one({"_id": existing["_id"]})
        liked = False
    else:
        await likes_col.insert_one({"post_id": req.post_id, "user_id": req.user_id, "at": datetime.now(timezone.utc).isoformat()})
        liked = True
    post = await posts_col.find_one({"post_id": req.post_id})
    extra = await likes_col.count_documents({"post_id": req.post_id})
    total = (post.get("base_likes", 0) if post else 0) + extra
    return {"liked": liked, "likes": total}


class CommentRequest(BaseModel):
    user_id: str
    user_name: str
    post_id: str
    text: str

@api_router.post("/community/comment")
async def add_comment(req: CommentRequest):
    posts_col = db.community_posts
    comment = {"id": str(uuid.uuid4()), "user": req.user_name, "text": req.text[:500], "at": datetime.now(timezone.utc).isoformat()}
    r = await posts_col.update_one({"post_id": req.post_id}, {"$push": {"comments": comment}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    return {"ok": True, "comment": comment}


class JoinRequest(BaseModel):
    user_id: str
    challenge_id: str

@api_router.post("/community/join")
async def join_challenge(req: JoinRequest):
    joins_col = db.community_joins
    challenges_col = db.community_challenges
    existing = await joins_col.find_one({"challenge_id": req.challenge_id, "user_id": req.user_id})
    if existing:
        await joins_col.delete_one({"_id": existing["_id"]})
        joined = False
    else:
        await joins_col.insert_one({"challenge_id": req.challenge_id, "user_id": req.user_id, "at": datetime.now(timezone.utc).isoformat()})
        joined = True
    ch = await challenges_col.find_one({"challenge_id": req.challenge_id})
    extra = await joins_col.count_documents({"challenge_id": req.challenge_id})
    total = (ch.get("base_members", 0) if ch else 0) + extra
    return {"joined": joined, "members": total}


class CreatePostRequest(BaseModel):
    user_id: str
    user_name: str
    avatar: Optional[str] = None
    text: str
    tag: Optional[str] = "Milestone"

@api_router.post("/community/post")
async def create_post(req: CreatePostRequest):
    posts_col = db.community_posts
    doc = {
        "post_id": "u_" + uuid.uuid4().hex[:10],
        "user": req.user_name,
        "avatar": req.avatar or f"https://api.dicebear.com/7.x/adventurer/svg?seed={req.user_name}&skinColor=f2d3b1,f5cfa0,e8b88a&hairColor=2c1b18,4a2511,3d1c02&backgroundColor=transparent",
        "time": "now",
        "text": req.text[:600],
        "base_likes": 0,
        "tag": req.tag or "Milestone",
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user_id": req.user_id,
    }
    await posts_col.insert_one(doc)
    return {"ok": True, "post_id": doc["post_id"]}


# ====== AI Coach - Smart Rule-Based Sustainability Coach ======
import random

COACH_RESPONSES = {
    "food": [
        "Great question! Food accounts for about 26% of global CO2 emissions. Try swapping one meat meal per day for a plant-based option — this alone can save up to 2.5 kg CO2 daily. Legumes like lentils are a great protein-rich alternative!",
        "Your food choices really matter. Beef produces 27x more CO2 than chicken per gram of protein. Even going vegetarian just 3 days a week reduces your annual food carbon footprint by about 500 kg CO2.",
        "A great tip: buy local and seasonal produce. Food transported by air can have 50x the carbon footprint of locally grown food. Farmers markets are a fantastic way to reduce food miles!",
    ],
    "transport": [
        "Transport is usually the biggest source of personal carbon emissions. Swapping 2 car trips per week with cycling or walking saves approximately 1.2 kg CO2 each trip. Over a year, that adds up to over 120 kg saved!",
        "If you must drive, try carpooling! Sharing a ride with just one other person halves your per-person transport emissions instantly. Apps like BlaBlaCar make this easy.",
        "For city commutes, public transit beats private cars by 4-5x in CO2 efficiency. An electric train emits just 41g CO2 per km per passenger vs 192g for a petrol car.",
    ],
    "electricity": [
        "Did you know standby power (devices on idle) accounts for 5-10% of home electricity use? Unplugging chargers, TVs and computers when not in use can save 100+ kg CO2 per year!",
        "Switching to LED bulbs saves 75% of lighting energy. But the biggest win is your thermostat — every degree you lower heating saves about 8% on your heating bill and CO2.",
        "Consider shifting heavy appliance use (washing machine, dishwasher) to off-peak hours (10pm–7am). This uses greener grid electricity in many regions and saves money too.",
    ],
    "tips": [
        "Here are 3 quick wins for today: (1) Use a reusable water bottle — saves 120g CO2 per plastic bottle avoided. (2) Take the stairs instead of elevator. (3) Eat one vegetarian meal. Small habits stack up to big impact!",
        "The most impactful changes you can make: reduce flying, go car-free or electric, eat plant-heavy, and switch to renewable energy. These top 4 choices can cut your footprint by 3-4 tonnes CO2 per year.",
        "Track your streaks! Research shows people who track habits are 3x more likely to stick to them. Your CarbonMind streak is your best motivator.",
    ],
    "score": [
        "Your carbon score is based on daily activities you log. A green A-grade means you're under your 6.5 kg daily budget — great work! The global average is 12 kg per person per day, so you're already ahead.",
        "To improve your score: focus on your top emission category first. Small consistent wins every day are more effective than occasional big changes. Consistency is key!",
        "Carbon scores update daily. The best strategy is to aim for steady improvement week-over-week, not perfection every day. Even a 10% reduction month-on-month is excellent progress.",
    ],
    "default": [
        "Great question! As your AI sustainability coach, I recommend starting with your highest emission category — usually transport or food. Even one small daily swap can save 300-500 kg CO2 over a year. What area would you like to focus on?",
        "I'm here to help you on your sustainability journey! The most impactful daily habits are: eating less meat, using public transport, and reducing home energy use. Which one do you want to tackle first?",
        "Every action you take matters! I can help you with food choices, transport, energy, or general tips. Your streak and daily logs show you're already making a difference. Keep going!",
        "Here's something motivating: if 1 million people made one small eco-swap daily, the collective impact equals planting 25 million trees. You are part of that change!",
    ]
}

def get_coach_reply(message: str) -> str:
    msg = message.lower()
    if any(w in msg for w in ["food", "eat", "meat", "vegan", "vegetarian", "meal", "diet"]):
        return random.choice(COACH_RESPONSES["food"])
    elif any(w in msg for w in ["car", "transport", "drive", "cycle", "bus", "train", "commute", "travel"]):
        return random.choice(COACH_RESPONSES["transport"])
    elif any(w in msg for w in ["electricity", "power", "energy", "bulb", "appliance", "light", "electric"]):
        return random.choice(COACH_RESPONSES["electricity"])
    elif any(w in msg for w in ["tip", "advice", "suggest", "help", "how", "what can", "reduce"]):
        return random.choice(COACH_RESPONSES["tips"])
    elif any(w in msg for w in ["score", "grade", "budget", "kg", "emission", "carbon"]):
        return random.choice(COACH_RESPONSES["score"])
    else:
        return random.choice(COACH_RESPONSES["default"])

@api_router.post("/chat/sustainability", response_model=ChatResponse)
async def chat_sustainability(req: ChatRequest):
    try:
        reply = get_coach_reply(req.message)
        return ChatResponse(reply=reply, session_id=req.session_id)
    except Exception as e:
        logger.exception("Chat failed")
        return ChatResponse(reply="Great effort on your sustainability journey! Try swapping one car trip with cycling today — it saves ~1.2 kg CO2.", session_id=req.session_id)



# ====== Predictive Budget Alert ======
@api_router.post("/predict/day")
async def predict_day(req: dict):
    activities = req.get("morning_activities", [])
    budget = req.get("daily_budget_kg", 6.5)

    # ✅ FIXED: Use actual user preferences from request (no more hardcoding)
    user_transport = req.get("user_transport", "public")
    user_diet = req.get("user_diet", "mixed")
    user_tv_hours = float(req.get("user_tv_hours", 2.0))
    user_vehicle_km = float(req.get("user_vehicle_km", 50.0))

    # Validate inputs
    valid_transports = ["public", "private", "hybrid", "cycling", "walking", "car", "bike"]
    valid_diets = ["vegetarian", "vegan", "mixed", "meat-heavy", "omnivore", "meat", "pescatarian"]
    if user_transport not in valid_transports:
        user_transport = "public"
    if user_diet not in valid_diets:
        user_diet = "mixed"
    user_tv_hours = max(0.0, min(16.0, user_tv_hours))
    user_vehicle_km = max(0.0, min(1000.0, user_vehicle_km))

    # ML Inference via GBDT with real user data
    user_data = {
        'Transport': user_transport,
        'Diet': user_diet,
        'How Long TV PC Daily Hour': user_tv_hours,
        'Vehicle Monthly Distance Km': user_vehicle_km
    }
    pred_val = predict_gbdt(user_data)

    if pred_val is not None:
        # GBDT predicts annual CO2 (kg/year) → convert to daily
        predicted = round(pred_val / 365, 2)
    else:
        # Fallback: extrapolate from morning activities
        morning_total = sum(float(a.get("kg", 0)) for a in activities)
        predicted = round(max(morning_total / 0.3, 1.5), 2)

    # Clamp to realistic daily range
    predicted = max(0.5, min(50.0, predicted))
    exceeds = predicted > budget
    over_pct = round((predicted - budget) / budget * 100, 1)

    # Build 24-hour S-curve accumulation
    import math
    hourly_curve = []
    for h in range(25):
        frac = h / 24
        # Logistic curve — slow start, peak midday, gradual end
        s = 1 / (1 + math.exp(-10 * (frac - 0.5)))
        kg = round(predicted * s, 2)
        hourly_curve.append({"hour": f"{h:02d}:00", "kg": kg})

    return {
        "predicted_full_day_kg": predicted,
        "budget_kg": budget,
        "exceeds": exceeds,
        "over_pct": over_pct,
        "model_used": "GBDT" if pred_val is not None else "fallback",
        "user_inputs": {
            "transport": user_transport,
            "diet": user_diet,
            "tv_hours": user_tv_hours,
            "vehicle_km": user_vehicle_km,
        },
        "ai_headline": (
            f"⚠️ Alert! Projected {predicted} kg today — {abs(over_pct)}% above your {budget} kg budget. Cut back on {user_transport} trips."
            if exceeds else
            f"✅ Great pacing! Projected {predicted} kg — {abs(over_pct)}% under your {budget} kg target. Keep it up!"
        ),
        "hourly_curve": hourly_curve,
        "equivalents": {
            "trees_to_offset": round(predicted / 21.7, 1),
            "km_by_car": round(predicted * 6.3, 1),
            "smartphone_charges": round(predicted * 122),
            "beef_burgers": round(predicted / 3.6, 1),
        },
    }


# ====== Voice Eco Tips ======
@api_router.post("/voice/call-tips")
async def voice_call_tips(req: dict):
    tips = [
        "Switch off devices on standby — they drain up to 10% of your home energy.",
        "Cycling for trips under 5 km saves around 1.2 kg CO₂ per trip versus driving.",
        "A plant-based meal produces 50% less carbon than a beef-based one.",
        "Line-drying clothes instead of tumble drying saves 2.4 kg CO₂ per load.",
        "Reducing your shower by 2 minutes saves roughly 0.2 kg CO₂ daily.",
    ]
    import random
    return {
        "tips": random.sample(tips, min(3, len(tips))),
        "session_id": req.get("session_id", str(uuid.uuid4())),
    }


# ====== Twilio AI Voice Call ======
@api_router.post("/voice/phone-call")
async def voice_phone_call(req: dict):
    """Place an outbound Twilio call that reads the user's daily carbon summary."""
    import random

    phone_number = req.get("phone_number", "")
    user_name = req.get("user_name", "there")
    today_kg = req.get("today_kg", 5.9)
    top_category = req.get("top_category", "Transport")
    weekly_kg = req.get("weekly_kg", 41.8)
    budget = 6.5

    overunder = "under" if today_kg <= budget else "over"
    diff = abs(round(today_kg - budget, 1))

    tips = [
        "Try cycling or walking for trips under 2 kilometres.",
        "Unplug chargers and devices when not in use to cut standby power.",
        "Eat one plant-based meal today to save up to 2 and a half kilograms of CO2.",
        "Use public transport instead of driving to reduce transport emissions by up to 70 percent.",
        "Set your thermostat one degree lower to save around 8 percent on heating energy.",
    ]
    selected_tips = random.sample(tips, 3)

    # Build the voice script
    script = (
        f"Hello {user_name}! This is CarbonMind AI with your daily carbon briefing. "
        f"Today you emitted approximately {today_kg} kilograms of CO2. "
        f"Your daily budget is {budget} kilograms. "
        f"You are {diff} kilograms {overunder} budget. "
        f"Your biggest emission source today is {top_category}. "
        f"Here are three personalised tips to reduce your footprint. "
        f"Tip one: {selected_tips[0]}. "
        f"Tip two: {selected_tips[1]}. "
        f"Tip three: {selected_tips[2]}. "
        f"Great work tracking your carbon today, {user_name}. "
        f"Every small action adds up. See you tomorrow. Goodbye!"
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
            "message": "Twilio not configured. Use Voice Brief on Dashboard instead.",
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
        logger.info(f"Twilio call placed: {call.sid} to {phone_number}")
        return {"ok": True, "call_sid": call.sid, "demo": False}

    except ImportError:
        return {
            "ok": True,
            "demo": True,
            "message": "Twilio package not installed. Run: pip install twilio",
            "script": script,
        }
    except Exception as e:
        logger.exception("Twilio call failed")
        raise HTTPException(status_code=500, detail=str(e))


# ====== Food Carbon Scanner ======
@api_router.post("/food/scan")
async def food_scan(req: dict):
    base64_img = req.get("image_base64")
    
    if not base64_img:
        return {
            "status": "error",
            "message": "No image provided.",
            "suggestion": "Please upload an image.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    # Check size (rough base64 estimation)
    if len(base64_img) * 0.75 > 10 * 1024 * 1024:
        return {
            "status": "error",
            "message": "Invalid file. Max 10MB.",
            "suggestion": "Please upload a smaller image.",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

    # Run PyTorch CNN Inference
    pred = predict_food(base64_img)
    
    if pred["status"] == "error":
        return {
            "status": "error",
            "message": "Service unavailable. Retry in 30s",
            "suggestion": "Try again later",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    if pred["status"] == "rejected":
        return {
            "status": "error",
            "message": pred["message"],
            "suggestion": pred["suggestion"],
            "confidence": pred["confidence"],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    items = [
        {
            "name": pred["food_category"].capitalize(),
            "portion": "1 serving",
            "category": "mixed",
            "co2_kg": pred["co2_kg"],
            "tip": f"AI identified {pred['food_category']}.",
        }
    ]
    total = pred["co2_kg"]
    carbon_label = "A+" if total < 0.5 else "A" if total < 1.5 else "B" if total < 3 else "C"
    
    return {
        "status": "success",
        "data": {
            "total_co2_kg": total,
            "carbon_label": carbon_label,
            "ai_note": f"CNN identified this meal emitting approximately {total} kg CO₂e. Confidence: {pred['confidence']:.1f}%",
            "items": items,
        },
        "message": f"Successfully analyzed {pred['food_category']}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ====== Carbon Certificate Generator ======
@api_router.post("/certificate/generate")
async def generate_certificate(req: dict):
    import hashlib
    user_name = req.get("user_name", "Eco Explorer")
    grade = req.get("grade", "A-")
    co2_saved_kg = req.get("co2_saved_kg", 24.8)
    cert_id = "CM-" + str(uuid.uuid4())[:8].upper()
    month = datetime.now(timezone.utc).strftime("%B %Y")
    # Deterministic signature based on cert content
    sig_raw = f"{cert_id}:{user_name}:{co2_saved_kg}:{month}"
    signature = hashlib.sha256(sig_raw.encode()).hexdigest()[:48]
    return {
        "cert_id": cert_id,
        "user_name": user_name,
        "grade": grade,
        "co2_saved_kg": round(float(co2_saved_kg), 1),
        "month": month,
        "issued_at": datetime.now(timezone.utc).isoformat(),
        "equivalents": {
            "trees_planted_equivalent": round(float(co2_saved_kg) / 21.7, 1),
            "km_by_car_avoided": round(float(co2_saved_kg) * 6.3, 1),
        },
        "signature": signature,
        "verify_url": f"https://carbonmind.ai/verify/{cert_id}",
    }


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
