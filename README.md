<div align="center">

# 🌱 CarbonMind AI

### *Your Intelligent Carbon Footprint Companion*

**A futuristic, AI-powered sustainability operating system.**
Track your carbon DNA. Meet your future self. Change the timeline.

![Status](https://img.shields.io/badge/status-demo--phase--1-00FFB2?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20FastAPI%20%2B%20MongoDB-00D9FF?style=flat-square)
![AI](https://img.shields.io/badge/AI-Gemini%203%20Flash-9B7EDF?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-white?style=flat-square)

</div>

---

## ✨ Overview

**CarbonMind AI** is a futuristic carbon-footprint tracking platform inspired by leading sustainability research (CarbonTracker, EcoTrack, EcoLogic). Built to *feel* like Tesla's dashboard × Spotify Wrapped × Notion AI — it turns environmental awareness from a chore into a cinematic, gamified experience.

> **Reviewer promise:** *"This looks like a real startup product, not a student project."*

---

## 🎬 Key Features

| Feature | What it does |
|---|---|
| 🌍 **Animated Landing** | Cinematic hero with orbiting Earth, carbon particles, and neon typography |
| 📊 **Dashboard** | Circular Carbon Score · Weekly trend chart · Emission breakdown · AI risk prediction |
| 🤖 **AI Sustainability Coach** | Real-time chat powered by **Gemini 3 Flash** |
| 🎙️ **Voice Assistant** | One-tap voice briefings via browser Speech Synthesis |
| 📡 **Live Tracker** | Real-time emission charts, 8-week heatmap, category-wise budget tracking |
| 🔮 **AI Future Simulator** | Enter your lifestyle → see your 10-year carbon impact & future Earth condition |
| 🏆 **Community** | Sustainability feed, eco-challenges, leaderboard |
| 🎨 **Carbon Aura** | Dynamic glowing profile identity based on habits |

---

## 🛠️ Tech Stack

**Frontend**
- React 19 · React Router DOM
- Tailwind CSS · Framer Motion · Recharts
- Lucide React · Sonner (toasts) · Radix UI (shadcn)
- Typography: **Outfit** + **Manrope** + **JetBrains Mono**

**Backend**
- FastAPI · Motor (async MongoDB)
- `emergentintegrations` → **Gemini 3 Flash Preview**
- Pydantic v2 · Python 3.11+

**Design System**
- Dark futuristic theme · Glassmorphism · Neon accents
- Palette: `#071014` (bg) · `#00FFB2` (neon green) · `#00D9FF` (cyan)

---

## 📸 Screens

| Landing | Dashboard |
|---|---|
| Cinematic hero with animated Earth | Carbon Score · Charts · AI Chat · Voice |

| Future Simulator | Community |
|---|---|
| Meet your future self · 10-year projection | Feed · Challenges · Leaderboard |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18, **Yarn** ≥ 1.22
- **Python** ≥ 3.11
- **MongoDB** (local or Atlas)

### 1. Clone
```bash
git clone https://github.com/Mizbataranumm/carbonmind-ai.git
cd carbonmind-ai
```

### 2. Backend
```bash
cd backend
pip install -r requirements.txt

# Configure .env
cat > .env <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=carbonmind
CORS_ORIGINS=*
EMERGENT_LLM_KEY=your-emergent-universal-key
EOF

uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### 3. Frontend
```bash
cd frontend
yarn install

# Configure .env
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env

yarn start
```

Open http://localhost:3000 and click **"Continue as demo eco-explorer"**.

---

## 📁 Project Structure

```
carbonmind-ai/
├── backend/
│   ├── server.py              # FastAPI app · all /api routes
│   ├── requirements.txt
│   └── .env                   # MONGO_URL · EMERGENT_LLM_KEY
├── frontend/
│   ├── src/
│   │   ├── App.js             # Router setup
│   │   ├── index.css          # Design tokens · fonts · glass utilities
│   │   ├── pages/
│   │   │   ├── Landing.jsx    # Cinematic hero
│   │   │   ├── Auth.jsx       # Split-screen demo login
│   │   │   ├── Dashboard.jsx  # Score · Chat · Voice · Predictions
│   │   │   ├── Tracker.jsx    # Live emissions · Heatmap
│   │   │   ├── Future.jsx     # AI Future Simulator
│   │   │   └── Community.jsx  # Feed · Challenges · Leaderboard
│   │   ├── components/
│   │   │   ├── AppLayout.jsx      # Sidebar + top bar shell
│   │   │   ├── AnimatedEarth.jsx  # CSS-based orbiting globe
│   │   │   └── ParticleField.jsx  # Carbon particle animation
│   │   └── lib/
│   │       ├── api.js             # Axios API client
│   │       └── UserContext.js     # Auth context
│   └── package.json
└── README.md
```

---

## 🔌 API Reference

All endpoints prefixed with `/api`.

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/` | Health check |
| `POST` | `/api/auth/demo-login` | Instant demo user session |
| `GET` | `/api/carbon/stats` | Dashboard metrics (score, trend, breakdown, prediction) |
| `GET` | `/api/tracker/live` | Live activities · category budgets · heatmap data |
| `POST` | `/api/future/simulate` | Lifestyle → projected 10-year footprint |
| `GET` | `/api/community/feed` | Posts · challenges · leaderboard |
| `POST` | `/api/chat/sustainability` | Gemini-powered AI coach (graceful fallback) |

### Example: Simulate the future
```bash
curl -X POST http://localhost:8001/api/future/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "transport": "car",
    "diet": "meat",
    "electricity_kwh": 4000,
    "flights_per_year": 3,
    "horizon_years": 10
  }'
```

---

## 🎨 Design Philosophy

CarbonMind isn't a calculator — it's a **sustainability operating system**.

- **Anti-slop palette.** No purple gradients on white. Committed dark cinematic neon.
- **Left-aligned & asymmetric layouts.** Natural reading flow, not centered brochureware.
- **Micro-animations everywhere.** Every hover, transition, and page load is intentional.
- **Glassmorphism with restraint.** 20px backdrop blur, sparingly used.
- **Font trio, not Inter.** Outfit (display) + Manrope (body) + JetBrains Mono (data).

---

## 🧪 Demo Notes

This is a **Phase-1 academic prototype** — some flows are visually rich but powered by computed/mock data. Real backend logic:

- ✅ Gemini AI chat (real API)
- ✅ Future Simulator math (real projections)
- 🟡 Carbon stats · tracker · community (mocked demo data — ready to be swapped with real sources)
- 🟡 Auth (demo-only, no JWT — ready to plug in real auth)

---

## 🗺️ Roadmap

- [ ] Persist user emissions to MongoDB
- [ ] Real auth (JWT / Google OAuth)
- [ ] **Carbon DNA generator** — animated SVG identity from your habits
- [ ] Shareable Wrapped-style annual carbon card
- [ ] Real-time WebSocket emissions stream
- [ ] Mobile-native experience (React Native)
- [ ] Integrate real utility / bank / travel APIs for actual carbon attribution

---

## 📚 Research Inspiration

- **CarbonTracker** — per-activity emission attribution
- **EcoTrack** — lifestyle pattern recognition
- **EcoLogic** — impact-scored recommendations
- **Privacy-aware AI** — on-device personal data processing

---

## 📄 License

MIT © 2026 — CarbonMind AI

---

<div align="center">

**Built with 🌍 for a lighter Earth.**

*If this project made you smile, star it and share your Carbon Aura.*

</div>
