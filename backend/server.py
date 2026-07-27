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
async def _gemini_chat(session_id: str, system: str, message: str) -> Optional[str]:
    """Helper to call Gemini via emergentintegrations. Returns None on failure."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            return None
        chat = LlmChat(api_key=api_key, session_id=session_id, system_message=system).with_model("gemini", "gemini-3-flash-preview")
        reply = await chat.send_message(UserMessage(text=message))
        return str(reply)
    except Exception:
        logger.exception("Gemini call failed")
        return None


@api_router.post("/chat/sustainability", response_model=ChatResponse)
async def chat_sustainability(req: ChatRequest):
    system = (
        "You are CarbonMind, a friendly, concise AI sustainability coach. "
        "Reply in 2-4 short sentences. Be warm, practical, and specific. "
        "Recommend actionable carbon-reduction tips. Avoid lecturing. Use plain text, no markdown headings."
    )
    reply = await _gemini_chat(req.session_id, system, req.message)
    if not reply:
        reply = (
            "Quick tip: shifting just 2 weekly car trips to cycling or transit can save ~1.2 kg CO₂/day. "
            "Want me to break down your top emission category?"
        )
    return ChatResponse(reply=reply, session_id=req.session_id)


# ====== NOVEL FEATURE 1: Predictive Carbon Budget Alert ======
@api_router.post("/predict/day", response_model=PredictDayResponse)
async def predict_day(req: PredictDayRequest):
    """
    Predict full-day CO₂ from morning activities (first 2 hrs).
    Inspired by CarbonTracker first-epoch prediction.
    """
    morning_total = sum(a.kg for a in req.morning_activities)
    # Simple linear extrapolation: morning 2hr = ~18% of day
    if morning_total == 0:
        predicted = 0.5
    else:
        predicted = round(morning_total / 0.18, 2)

    breakdown_map = {}
    for a in req.morning_activities:
        breakdown_map[a.type] = breakdown_map.get(a.type, 0) + a.kg
    breakdown = [
        {"type": k, "morning_kg": round(v, 2), "predicted_day_kg": round(v / 0.18, 2)}
        for k, v in breakdown_map.items()
    ]

    exceeds = predicted > req.daily_budget_kg
    over_pct = round(((predicted - req.daily_budget_kg) / req.daily_budget_kg) * 100, 1) if req.daily_budget_kg else 0

    # Hourly curve (24 points) — morning known, rest extrapolated
    curve = []
    for h in range(24):
        if h < 8:
            v = morning_total * (h / 8) * 0.4
        elif h < 12:
            v = morning_total + (predicted - morning_total) * ((h - 8) / 16) * 0.6
        else:
            v = morning_total + (predicted - morning_total) * ((h - 8) / 16)
        curve.append({"hour": f"{h:02d}:00", "kg": round(v, 2), "predicted": h >= 10})

    # Relatable equivalents (IPCC-ish factors)
    equivalents = {
        "trees_to_offset": max(1, round(predicted * 0.9)),
        "km_by_car": round(predicted * 5.4, 1),
        "smartphone_charges": round(predicted * 121000),
        "beef_burgers": round(predicted / 3.0, 1),
    }

    if exceeds:
        headline = f"⚠ On track to exceed budget by {over_pct}% — that's like {equivalents['km_by_car']} km of car driving today."
    else:
        headline = f"✓ You're on track — projected {predicted} kg, {abs(over_pct)}% under budget. Keep it up."

    return PredictDayResponse(
        predicted_full_day_kg=predicted,
        budget_kg=req.daily_budget_kg,
        exceeds=exceeds,
        over_pct=over_pct,
        hourly_curve=curve,
        equivalents=equivalents,
        breakdown_by_type=breakdown,
        ai_headline=headline,
    )


# ====== NOVEL FEATURE 2: AI Agent Voice Call ======
@api_router.post("/voice/call-tips", response_model=VoiceTipsResponse)
async def voice_call_tips(req: VoiceTipsRequest):
    """Generate a conversational voice-call script with 3 personalized tips."""
    system = (
        "You are CarbonMind, calling a user on the phone about their weekly emissions. "
        "Respond ONLY in this format on separate lines: "
        "GREETING: <one warm sentence> | BODY: <one sentence about their weekly kg and top category> | "
        "TIP1: <one specific action> | TIP2: <one specific action> | TIP3: <one specific action> | "
        "SIGNOFF: <one warm closing sentence>. Keep each line under 22 words. Plain text, no markdown."
    )
    user_prompt = (
        f"User {req.user_name} emitted {req.weekly_kg} kg CO2 this week (top category: {req.top_category}). "
        f"Give a warm phone-style briefing."
    )
    reply = await _gemini_chat(f"voice_{req.user_name}", system, user_prompt)

    parsed = {"GREETING": None, "BODY": None, "TIP1": None, "TIP2": None, "TIP3": None, "SIGNOFF": None}
    if reply:
        # Split on | and newlines
        for chunk in reply.replace("\n", "|").split("|"):
            for key in parsed:
                if chunk.strip().upper().startswith(key + ":"):
                    parsed[key] = chunk.split(":", 1)[1].strip()

    # Fill in fallbacks
    greeting = parsed["GREETING"] or f"Hey {req.user_name}, it's CarbonMind checking in on your week."
    body = parsed["BODY"] or f"You emitted {req.weekly_kg} kg of CO₂ this week — {req.top_category} was your biggest source."
    tips = [
        parsed["TIP1"] or f"Try swapping two {req.top_category.lower()} trips with cycling or public transit.",
        parsed["TIP2"] or "Unplug idle devices and switch to LED bulbs to shave off standby power.",
        parsed["TIP3"] or "Add three plant-based dinners next week — small change, big impact.",
    ]
    signoff = parsed["SIGNOFF"] or "You've got this. I'll check back in seven days. Take care."

    full = f"{greeting} {body} Here are three quick tips. One, {tips[0]} Two, {tips[1]} Three, {tips[2]} {signoff}"
    return VoiceTipsResponse(greeting=greeting, body=body, tips=tips, signoff=signoff, full_script=full)


# ====== NOVEL FEATURE 3: Food Carbon Scanner ======
FOOD_DB = [
    {"name": "Beef Burger", "portion": "1 patty (200g)", "co2_kg": 3.10, "category": "meat", "tip": "Try a bean burger — 90% less CO₂."},
    {"name": "Cheddar Cheese", "portion": "50g slice", "co2_kg": 0.65, "category": "dairy", "tip": "Plant-based cheese cuts this by 70%."},
    {"name": "Chicken Curry", "portion": "1 bowl", "co2_kg": 1.20, "category": "poultry", "tip": "Sub with paneer or tofu for 60% less impact."},
    {"name": "White Rice", "portion": "1 cup cooked", "co2_kg": 0.45, "category": "grain", "tip": "Millets are 4x lower carbon."},
    {"name": "Avocado Toast", "portion": "1 slice", "co2_kg": 0.30, "category": "produce", "tip": "Local produce reduces transport emissions."},
    {"name": "Coffee (with milk)", "portion": "1 cup", "co2_kg": 0.28, "category": "beverage", "tip": "Oat milk = ~50% less CO₂."},
    {"name": "Salmon Fillet", "portion": "150g", "co2_kg": 1.80, "category": "seafood", "tip": "Freshwater fish has lower carbon."},
    {"name": "Green Salad", "portion": "1 bowl", "co2_kg": 0.12, "category": "produce", "tip": "You're already doing great here!"},
    {"name": "Dal & Roti", "portion": "1 plate", "co2_kg": 0.35, "category": "vegetarian", "tip": "Excellent low-carbon choice."},
    {"name": "Chocolate Cake", "portion": "1 slice", "co2_kg": 0.85, "category": "dessert", "tip": "Fruit desserts cut CO₂ by 80%."},
    {"name": "Grilled Paneer", "portion": "100g", "co2_kg": 0.55, "category": "vegetarian", "tip": "Try tofu for even lower impact."},
    {"name": "Pizza Margherita", "portion": "2 slices", "co2_kg": 0.95, "category": "mixed", "tip": "Veggie toppings > pepperoni."},
    {"name": "Banana", "portion": "1 medium", "co2_kg": 0.08, "category": "fruit", "tip": "Perfect low-carbon snack."},
    {"name": "Boiled Eggs", "portion": "2 eggs", "co2_kg": 0.55, "category": "protein", "tip": "Tofu scramble is 4x lower."},
]

@api_router.post("/food/scan", response_model=FoodScanResponse)
async def food_scan(req: FoodScanRequest):
    """
    Demo food scan: returns plausible detections from curated IPCC-based food DB.
    In production this would call a vision model on `image_base64`.
    """
    import random
    # Use hint if provided to bias detection
    if req.hint:
        hint_lower = req.hint.lower()
        matched = [f for f in FOOD_DB if any(t in hint_lower for t in f["name"].lower().split())]
        pool = matched if matched else FOOD_DB
    else:
        pool = FOOD_DB
    count = random.randint(2, 4)
    picks = random.sample(pool, min(count, len(pool)))
    items = [FoodItem(**p) for p in picks]
    total = round(sum(p["co2_kg"] for p in picks), 2)

    if total < 0.5:
        note = "🌿 Excellent — this meal is very light on the planet."
    elif total < 1.2:
        note = "🙂 Balanced. Swap one item for a plant-based option to go even lower."
    elif total < 2.5:
        note = "⚠ Moderate impact. Try meat-free tomorrow to offset."
    else:
        note = "🚨 High-carbon meal. Consider vegetarian alternatives twice this week."

    return FoodScanResponse(items=items, total_co2_kg=total, ai_note=note)


# ====== NOVEL FEATURE 4: Verified Carbon Reduction Certificate ======
@api_router.post("/certificate/generate", response_model=CertificateResponse)
async def generate_certificate(req: CertificateRequest):
    import hashlib
    cert_id = "CM-" + hashlib.sha256(f"{req.user_name}-{req.month or datetime.now().strftime('%Y-%m')}".encode()).hexdigest()[:10].upper()
    month = req.month or datetime.now().strftime("%B %Y")
    saved = req.co2_saved_kg if req.co2_saved_kg is not None else 24.8
    equivalents = {
        "trees_planted_equivalent": max(1, round(saved * 0.9)),
        "km_by_car_avoided": round(saved * 5.4, 1),
        "smartphone_charges_saved": round(saved * 121000),
    }
    signature = "CarbonMind AI · Verified Chain #" + hashlib.sha256((cert_id + str(saved)).encode()).hexdigest()[:16]
    verify_url = f"https://carbonmind-ai-ashen.vercel.app/verify/{cert_id}"
    return CertificateResponse(
        cert_id=cert_id,
        user_name=req.user_name,
        month=month,
        co2_saved_kg=round(saved, 2),
        grade=req.grade or "A-",
        equivalents=equivalents,
        issued_at=datetime.now(timezone.utc).isoformat(),
        signature=signature,
        verify_url=verify_url,
    )


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
