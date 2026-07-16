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

# ====== Models ======
class DemoLoginRequest(BaseModel):
    name: Optional[str] = "Eco Explorer"

class UserProfile(BaseModel):
    id: str
    name: str
    email: str
    avatar: str
    carbon_aura: str
    streak: int
    xp: int
    grade: str

class ChatRequest(BaseModel):
    session_id: str
    message: str

class ChatResponse(BaseModel):
    reply: str
    session_id: str

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


@api_router.post("/auth/demo-login", response_model=UserProfile)
async def demo_login(req: DemoLoginRequest):
    user = {
        "id": str(uuid.uuid4()),
        "name": req.name or "Eco Explorer",
        "email": "demo@carbonmind.ai",
        "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=" + (req.name or "demo"),
        "carbon_aura": "#00FFB2",
        "streak": 14,
        "xp": 2480,
        "grade": "A-",
    }
    return user


@api_router.get("/carbon/stats")
async def carbon_stats():
    """Mock dashboard stats. Demo data."""
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
async def tracker_live():
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
    transport_factor = {"car": 4.6, "mixed": 2.8, "public": 1.4, "bike": 0.2}.get(req.transport, 2.5)
    diet_factor = {"meat": 3.3, "mixed": 2.1, "vegetarian": 1.4, "vegan": 1.0}.get(req.diet, 2.0)
    electric_co2 = req.electricity_kwh * 0.4 / 1000  # tons
    flights_co2 = req.flights_per_year * 0.9
    base = transport_factor + diet_factor + electric_co2 + flights_co2
    current = round(base, 2)
    # Decay assumes 3% improvement each year if conscious
    projected = round(base * ((0.97) ** req.horizon_years), 2)
    yearly = []
    for i in range(req.horizon_years + 1):
        yearly.append({"year": datetime.now().year + i, "co2": round(base * ((0.97) ** i), 2)})
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
async def community_feed():
    return {
        "posts": [
            {"id": 1, "user": "Aiko Tanaka", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=aiko", "time": "2h", "text": "Hit a 30-day cycling streak! Saved ~12kg CO₂ this month.", "likes": 124, "tag": "Transport"},
            {"id": 2, "user": "Marco Silva", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=marco", "time": "5h", "text": "Switched my home to a 100% renewable plan. Bill went DOWN.", "likes": 89, "tag": "Electricity"},
            {"id": 3, "user": "Priya Rao", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=priya", "time": "1d", "text": "Plant-based week complete. The lentil curry recipe is a banger.", "likes": 211, "tag": "Food"},
            {"id": 4, "user": "Lena Volkov", "avatar": "https://api.dicebear.com/7.x/avataaars/svg?seed=lena", "time": "2d", "text": "My Carbon DNA shifted into emerald spiral mode. New aura unlocked ✨", "likes": 67, "tag": "Milestone"},
        ],
        "challenges": [
            {"id": 1, "title": "Meatless March", "members": 1240, "days_left": 12, "reward": "+500 XP"},
            {"id": 2, "title": "Cycle 100km", "members": 870, "days_left": 7, "reward": "Bike Knight badge"},
            {"id": 3, "title": "No-AC Week", "members": 421, "days_left": 3, "reward": "+300 XP"},
        ],
        "leaderboard": [
            {"rank": 1, "user": "Aiko Tanaka", "xp": 9820, "grade": "A+"},
            {"rank": 2, "user": "Priya Rao", "xp": 8730, "grade": "A+"},
            {"rank": 3, "user": "Marco Silva", "xp": 7610, "grade": "A"},
            {"rank": 4, "user": "Lena Volkov", "xp": 6420, "grade": "A"},
            {"rank": 5, "user": "You", "xp": 2480, "grade": "A-"},
        ],
    }


# ====== AI Chat via Emergent Universal Key ======
@api_router.post("/chat/sustainability", response_model=ChatResponse)
async def chat_sustainability(req: ChatRequest):
    fallback = (
        "Quick tip: shifting just 2 weekly car trips to cycling or transit can save ~1.2 kg CO₂/day. "
        "Want me to break down your top emission category?"
    )
    try:
        if not HAS_LLM:
            return ChatResponse(reply=fallback, session_id=req.session_id)
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="LLM key missing")
        chat = LlmChat(
            api_key=api_key,
            session_id=req.session_id,
            system_message=(
                "You are CarbonMind, a friendly, concise AI sustainability coach. "
                "Reply in 2-4 short sentences. Be warm, practical, and specific. "
                "Recommend actionable carbon-reduction tips. Avoid lecturing. Use plain text, no markdown headings."
            ),
        ).with_model("gemini", "gemini-3-flash-preview")
        user_msg = UserMessage(text=req.message)
        reply = await chat.send_message(user_msg)
        return ChatResponse(reply=str(reply), session_id=req.session_id)
    except Exception as e:
        logger.exception("Chat failed")
        return ChatResponse(reply=fallback, session_id=req.session_id)


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
