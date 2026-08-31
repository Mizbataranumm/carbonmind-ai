<div align="center">

# 🌱 CarbonMind AI

### *Your Intelligent Carbon Footprint Companion*

**A futuristic, ML-powered sustainability operating system.**  
Track your carbon DNA. Predict your daily emissions. Meet your future self. Change the timeline.

![Status](https://img.shields.io/badge/status-production--ready-00FFB2?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20FastAPI%20%2B%20PyTorch%20%2B%20MongoDB-00D9FF?style=flat-square)
![AI/ML](https://img.shields.io/badge/ML-ResNet18%20CNN%20%7C%20GBDT%20%7C%20PyTorch%20LSTM-9B7EDF?style=flat-square)
![LLM](https://img.shields.io/badge/AI-Gemini%203%20Flash%20%2F%20Rule%20Engine-FFD166?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-white?style=flat-square)

</div>

---

## ✨ Overview

**CarbonMind AI** is an advanced sustainability engineering platform that transforms personal environmental accounting into an intelligent, AI-guided experience. By blending real Machine Learning models (Computer Vision, Gradient Boosted Decision Trees, and LSTM Time-Series sequence forecasting) with a responsive user interface, CarbonMind AI empowers users to track, predict, and systematically reduce their daily carbon footprint.

---

## 🎬 Machine Learning & AI Core (Verified Architecture)

CarbonMind AI operates on a multi-model ML architecture running on FastAPI & PyTorch:

| Model | Architecture / Technology | Purpose & Specs |
|---|---|---|
| 📷 **Food Scanner (CNN)** | PyTorch **ResNet-18** (`cnn_food_model.pt`, 44.9 MB) | Fine-tuned on Food-101 (101 classes). Classifies meal photos into CO₂ intensity categories. Enforces a **70% confidence threshold** to reject non-food images. |
| 📊 **Daily Forecaster (GBDT)** | Scikit-Learn / XGBoost **GBDT Regressor** (`gbdt_carbon_model.pkl`, 277 KB) | Trained on `Carbon Emission.csv` (10,000 records). Predicts full-day emissions (`kg CO₂/day`) based on user lifestyle features (Transport, Diet, TV/PC Hours, Vehicle Distance). |
| 🔮 **Future Simulator (LSTM)** | PyTorch **2-Layer LSTM** (`lstm_carbon_model.pt`, 0.21 MB) | 2 LSTM layers (64 hidden units, dropout 0.2) + FC Head (64 $\rightarrow$ 32 $\rightarrow$ 7). Window: **30-day historical sequence $\rightarrow$ 7-day future forecast** (Validation MAE: **0.79 kg/day**). |
| 🤖 **AI Coach** | Contextual **Conversational AI** + Gemini | Real-time guidance answering greetings, carbon footprint definitions, emission breakdowns, and custom reduction strategies. |
| 🎙️ **Voice Agent & Telephony** | Web Speech API + **Twilio Voice** | Features a 2-way interactive voice coach (mic speech recognition + spoken audio output) plus automated phone briefings. |

---

## 🚀 Key App Features & Pages

- 🏠 **Landing Page (`/`)**: Hero animation, interactive earth visual, live stats counter, and dark/light theme toggle.
- 🚀 **Onboarding Flow**: 3-step setup collecting user transport and dietary baselines to seed personalized ML inference.
- 📊 **Live Dashboard (`/dashboard`)**: Dynamic budget tracker, streak monitor, daily emission statistics, Recharts weekly trend, and category breakdown.
- 📷 **Food Scanner (`/scan`)**: Image upload or camera capture processed via PyTorch ResNet-18 CNN for instant meal carbon intensity.
- 📡 **Live Tracker (`/tracker`)**: Log granular daily activities across Transport, Electricity, Food, and Devices.
- 📈 **Daily Forecaster (`/predict`)**: Real-time GBDT prediction curve showing 24-hour accumulation and tree/car/burger equivalence offsets.
- 🔮 **10-Year Simulator (`/future`)**: Multi-year forecast projecting environmental conditions and personal footprint using PyTorch LSTM.
- 👥 **Community & Challenges (`/community`, `/challenges`)**: Sustainability social feed, post creation, likes, comments, and community eco-challenges.
- 🏆 **Certificates & Mini-Game (`/certificate`, `/game`)**: Earn XP, level up badges, unlock Carbon Auras, generate verified Eco-Certificates, and play the interactive DOM Eco-Game.
- 👤 **Profile Page (`/profile`)**: Avatar gallery picker, personal stats overview, and in-app user guide.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework:** React 19 · React Router DOM v7
- **Styling:** Tailwind CSS · Framer Motion · Recharts
- **UI Components:** Lucide React Icons · Sonner Toasts · Radix UI
- **Build Tool:** CRACO (Create React App Configuration Override)

### **Backend**
- **Framework:** FastAPI · Pydantic v2 · Python 3.11+
- **Machine Learning:** PyTorch (`torch`, `torchvision`) · Scikit-Learn · NumPy · Pandas
- **Database:** MongoDB (Motor async driver)
- **Audio & Telephony:** Web Speech API · Twilio Voice API

---

## 📡 API Endpoints (20 Total)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/` | Health check & API status |
| `GET` | `/api/onboarding/status` | User onboarding progress status |
| `POST` | `/api/onboarding/save` | Persist user onboarding preferences |
| `POST` | `/api/auth/demo-login` | Instant demo account session |
| `POST` | `/api/auth/register` | Create new user account |
| `POST` | `/api/auth/login` | Authenticate user |
| `GET` | `/api/carbon/stats` | Dashboard statistics & metrics |
| `GET` | `/api/tracker/live` | Real-time activities & categories |
| `POST` | `/api/future/simulate` | LSTM 10-year climate trajectory |
| `GET` | `/api/community/feed` | Community posts & challenges |
| `POST` | `/api/community/like` | Toggle post likes |
| `POST` | `/api/community/comment` | Add comment to post |
| `POST` | `/api/community/join` | Join community challenge |
| `POST` | `/api/community/post` | Publish new community post |
| `POST` | `/api/chat/sustainability` | AI Coach conversational queries |
| `POST` | `/api/predict/day` | GBDT full-day footprint forecast |
| `POST` | `/api/voice/call-tips` | Generate daily voice tips script |
| `POST` | `/api/voice/phone-call` | Trigger Twilio phone call briefing |
| `POST` | `/api/food/scan` | PyTorch ResNet-18 meal photo analysis |
| `POST` | `/api/certificate/generate` | Generate verified carbon certificate |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **MongoDB** (Local or Atlas)

### 1. Clone Repository
```bash
git clone https://github.com/Mizbataranumm/carbonmind-ai.git
cd carbonmind-ai
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Start backend server
uvicorn server:app --reload --port 8000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm start
```

---

## 📜 License & Academic Reference
- **Journal**: Journal of Applied Agriculture and Food Research (JAAFR), ISSN: 2984-889X
- **License**: MIT License
