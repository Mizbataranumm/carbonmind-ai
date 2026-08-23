<div align="center">

# 🌱 CarbonMind AI

### *Your Intelligent Carbon Footprint Companion*

**A futuristic, ML-powered sustainability operating system.**  
Track your carbon DNA. Predict your daily emissions. Meet your future self. Change the timeline.

![Status](https://img.shields.io/badge/status-production--ready-00FFB2?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%2019%20%2B%20FastAPI%20%2B%20PyTorch%20%2B%20MongoDB-00D9FF?style=flat-square)
![AI/ML](https://img.shields.io/badge/ML-ResNet18%20CNN%20%7C%20GBDT%20%7C%20PyTorch%20LSTM-9B7EDF?style=flat-square)
![LLM](https://img.shields.io/badge/AI-Gemini%203%20Flash-FFD166?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-white?style=flat-square)

</div>

---

## ✨ Overview

**CarbonMind AI** is an advanced sustainability platform that transforms personal environmental accounting into a cinematic, AI-guided experience. By blending real Machine Learning models (Computer Vision, Gradient Boosting, and LSTM Time-Series forecasting) with an intuitive user interface, CarbonMind AI empowers users to track, predict, and systematically reduce their daily carbon footprint.

> **Key Promise:** *"An end-to-end AI platform combining computer vision meal scanning, predictive GBDT modeling, sequence forecasting, and real-time AI coaching."*

---

## 🎬 Machine Learning & AI Core

CarbonMind AI operates on a multi-model ML architecture:

| Model | Architecture / Technology | Purpose & Specs |
|---|---|---|
| 📷 **Food Scanner (CNN)** | PyTorch **ResNet-18** | Classifies meal photos into carbon emission intensity categories. Enforces a **70% confidence threshold** to reject non-food images. |
| 📊 **Daily Forecaster (GBDT)** | Scikit-Learn **Gradient Boosting Decision Trees** | Predicts full-day emissions (`kg CO₂/day`) based on morning activities, primary transport mode, diet preference, TV/PC usage, and monthly vehicle distance. |
| 🔮 **Future Simulator (LSTM)** | PyTorch 2-layer **Recurrent Neural Network (LSTM)** | Trained on **30,000 sequences** derived from `Carbon Emission.csv`. Predicts 7-day to 10-year emission trajectories (**Validation MAE: 0.79 kg/day**). |
| 🤖 **AI Coach** | Google **Gemini 3 Flash** | Provides real-time, context-aware advice on reducing food, transport, and energy emissions via a floating chat assistant. |
| 🎙️ **Voice Brief & Call** | Web Speech Synthesis + **Twilio Voice** | Auto-narrates daily carbon reports or places real phone calls to deliver personalized eco-reminders. |

---

## 🚀 Key App Features & Pages

- 🏠 **Landing Page**: Orbital Earth animation, feature showcases, and real-time stats.
- 🚀 **Onboarding Flow**: 3-step setup collecting transport & diet preferences to seed personalized ML models.
- 📊 **Responsive Dashboard**: 12-column dashboard featuring live budget tracking, weekly emission charts, category breakdown, quick action buttons, and top stat cards.
- 📷 **Food Scanner (`/scan`)**: Drag-and-drop or snapshot meal photos for instant CNN CO₂ analysis.
- 📡 **Live Tracker (`/tracker`)**: Log granular daily activities across Transport, Food, Energy, and Devices with an 8-week heatmap.
- 📈 **Daily Forecaster (`/predict`)**: Real-time GBDT prediction curve showing 24-hour accumulation and tree/car/burger equivalence offsets.
- 🔮 **10-Year Future Simulator (`/future`)**: Multi-year forecast projecting environmental conditions and personal footprint using PyTorch LSTM.
- 👥 **Community & Challenges (`/community`, `/challenges`)**: Sustainability social feed, post creation, likes, comments, and interactive eco-challenges.
- 🏆 **Certificates & Mini-Game (`/certificate`, `/game`)**: Earn XP, level up badges, unlock dynamic Carbon Auras, generate verified Eco-Certificates, and play the interactive Eco Game.
- 👤 **Profile Page (`/profile`)**: Customizable profile with aesthetic `adventurer` style avatars, theme switcher, and progress tracking.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework:** React 19 · React Router DOM v6
- **Styling:** Tailwind CSS · Framer Motion · Recharts
- **UI Components:** Lucide React Icons · Sonner Toasts · Radix UI
- **Typography:** Outfit · Manrope · JetBrains Mono

### **Backend**
- **Framework:** FastAPI · Pydantic v2 · Python 3.11+
- **Machine Learning:** PyTorch (`torch`, `torchvision`) · Scikit-Learn · NumPy · Pandas
- **LLM & Telephony:** Emergent LLM Integration (Gemini 3 Flash) · Twilio Voice API
- **Database:** MongoDB (Motor async driver)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** ≥ 18
- **Python** ≥ 3.11 (with PyTorch and Scikit-Learn installed)
- **MongoDB** (local or Atlas)

### 1. Clone Repository
```bash
git clone https://github.com/Mizbataranumm/carbonmind-ai.git
cd carbonmind-ai
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt

# Create .env configuration
cat > .env <<EOF
MONGO_URL=mongodb://localhost:27017
DB_NAME=carbonmind
CORS_ORIGINS=*
EMERGENT_LLM_KEY=your-emergent-universal-key
TWILIO_ACCOUNT_SID=your-twilio-sid (optional)
TWILIO_AUTH_TOKEN=your-twilio-token (optional)
TWILIO_PHONE_NUMBER=your-twilio-number (optional)
EOF

uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install

# Create .env configuration
echo "REACT_APP_BACKEND_URL=http://localhost:8000/api" > .env

npm start
```

Open `http://localhost:3000` in your browser.

---

## 📁 Project Structure

```
carbonmind-ai/
├── backend/
│   ├── server.py                   # Main FastAPI server & route handlers
│   ├── ml_service.py               # Inference service for CNN, GBDT, and LSTM
│   ├── ml/models/                  # Trained ML model weights
│   │   ├── cnn_food_model.pt       # PyTorch ResNet-18 model weights (44.9 MB)
│   │   ├── cnn_food_metadata.json  # Class mappings & emission values
│   │   ├── gbdt_carbon_model.pkl   # Scikit-Learn GBDT model
│   │   └── lstm_carbon_model.pt    # PyTorch LSTM time-series model (MAE: 0.79)
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   ├── carbonmind-logo2-transparent.png  # Primary transparent logo
│   │   └── favicon.ico                        # Plant emoji favicon (🌱)
│   ├── src/
│   │   ├── App.js                  # Main router & page routes
│   │   ├── index.css               # Design system, glassmorphic utilities, theme variables
│   │   ├── pages/                  # 13 application views (Dashboard, Scanner, Predict, etc.)
│   │   ├── components/             # Reusable UI widgets, AppLayout, FloatingAICoach, Modals
│   │   └── lib/                    # API client & UserContext
│   └── package.json
├── Carbon Emission.csv             # Dataset for training ML models
└── README.md
```

---

## 🔌 Core API Endpoints

All backend routes are exposed under `/api`:

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/food/scan` | Accepts base64 image → PyTorch ResNet-18 inference (70% threshold) |
| `POST` | `/api/predict/day` | Accepts morning activity + user transport/diet → GBDT daily prediction |
| `GET`  | `/api/tracker/live` | Calculates historical daily emissions → PyTorch LSTM 7-day forecast |
| `POST` | `/api/chat/sustainability` | Interacts with Gemini 3 Flash AI Coach |
| `POST` | `/api/voice/phone-call` | Triggers a real Twilio phone call briefing |
| `POST` | `/api/onboarding/save` | Saves user preferences & marks onboarding as completed |
| `GET`  | `/api/community/feed` | Retrieves social posts, challenges, and leaderboard data |

---

## 📄 License

MIT © 2026 — CarbonMind AI

---

<div align="center">

**Built with 🌍 for a lighter Earth.**

</div>
