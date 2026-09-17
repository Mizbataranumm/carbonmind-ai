<div align="center">

# 🌱 CarbonMind AI

### *A personal carbon tracking and scenario-planning application*

Track user-entered activities, estimate meal footprints, and explore transparent lifestyle scenarios.

![Status](https://img.shields.io/badge/status-candidate%20build-FFD166?style=flat-square)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20FastAPI%20%2B%20MongoDB-00D9FF?style=flat-square)
![ML](https://img.shields.io/badge/ML-evaluation%20required-FFD166?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-white?style=flat-square)

</div>

---

## ✨ Overview

**CarbonMind AI** is a candidate product build, not yet a validated B2B/B2C carbon-accounting service. The current application stores user-entered activity records in MongoDB, derives dashboard totals from those records, and clearly distinguishes transparent calculations from candidate ML inference.

## Model Status

The checked-in ResNet-18 metadata reports **4.0% accuracy** and the artifact is not used by the running food-scanner endpoint. The scan endpoint requires external vision candidates (Hugging Face and Gemini when configured) to agree with the user-confirmed dish name before it returns an estimate; text-only dish names are rejected. The carbon calculation reads the committed `Food_Product_Emissions.csv` per-kilogram factors and scales a reviewed recipe to the estimated portion. That CSV is an emissions-factor source, not an image-labelled training dataset. Provider scores are not calibrated and must not be treated as product accuracy.

The reproducible benchmark compares annual-emissions regressors on the same 2,000-row holdout. The app uses the 18-field LightGBM candidate that intentionally excludes the source dataset's `Sex` field; its recorded holdout MAE is 182.3640 kg/year in [the benchmark report](backend/ml/evaluation/annual_carbon_model_benchmark.json). This remains a candidate result from one random split, not a commercial performance claim. It is only available through a complete lifestyle profile. The activity screen uses a transparent time-scaled calculation instead. The `Carbon Emission.csv` target is annual kg CO2e, so it cannot validate a partial-day activity forecast.

The future screen is an assumption-based scenario calculator. It is not an LSTM forecast and it does not predict an individual temperature impact. Weekly forecasting requires at least five real daily observations and does not fabricate history.

See [the model registry](backend/ml/model_registry.json), [the evaluation report guidance](backend/ml/evaluation/README.md), and [the hardening plan](docs/ML_HARDENING_PLAN.md) before publishing model-quality claims.

For the Phase 1 demonstration and research-paper evidence pack, see the
[system specification](docs/research/PHASE1_SYSTEM_SPECIFICATION.md),
[data collection and evaluation protocol](docs/research/DATA_COLLECTION_AND_EVALUATION_PROTOCOL.md),
and [IEEE paper draft](docs/research/IEEE_PAPER_DRAFT.md). These documents
separate implemented behaviour from experiments that still require dated,
consented participant data.

---

## 🚀 Key App Features & Pages

- **Activity dashboard and tracker:** reads saved user activity records from MongoDB.
- **Food scan:** returns an estimate only when a candidate from the uploaded image agrees with the user-confirmed dish name; users must still confirm dish and portion before logging.
- **Daily projection:** scales the entered observation window to a day; candidate GBDT inference requires its complete lifestyle schema.
- **Future planner:** compares explicitly stated emissions assumptions across a selected horizon.
- **Community, voice, certificates, and game:** experience features that require their own moderation, security, and verification work before commercial release.

---

## 🛠️ Tech Stack

### **Frontend**
- **Framework:** React 19 · React Router DOM v7
- **Styling:** Tailwind CSS · Framer Motion · Recharts
- **UI Components:** Lucide React Icons · Sonner Toasts · Radix UI
- **Build Tool:** CRACO (Create React App Configuration Override)

### **Backend**
- **Framework:** FastAPI · Pydantic v2 · Python 3.11+
- **Machine Learning:** Scikit-Learn · XGBoost · LightGBM · NumPy · Pandas (candidate models)
- **Database:** MongoDB (Motor async driver)
- **Audio & Telephony:** Web Speech API · Twilio Voice API

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/` | Health check & API status |
| `GET` | `/api/ml/status` | Candidate model wiring and readiness status |
| `GET` | `/api/onboarding/status` | Authenticated user onboarding progress |
| `POST` | `/api/onboarding/save` | Persist authenticated onboarding preferences |
| `POST` | `/api/auth/demo-login` | Instant demo account session |
| `POST` | `/api/auth/register` | Create new user account |
| `POST` | `/api/auth/login` | Authenticate user |
| `POST` | `/api/activities/daily` | Save or append to an authenticated user's activity record |
| `GET` | `/api/carbon/stats` | Dashboard metrics derived from saved activities |
| `GET` | `/api/carbon/intelligence` | Evidence, forecast readiness, budget status, and next action from saved activities |
| `GET` | `/api/tracker/live` | Recorded activity timeline and history grid |
| `POST` | `/api/future/simulate` | Assumption-based personal footprint scenario |
| `GET` | `/api/community/feed` | Community posts & challenges |
| `POST` | `/api/community/like` | Toggle post likes |
| `POST` | `/api/community/comment` | Add comment to post |
| `POST` | `/api/community/join` | Join community challenge |
| `POST` | `/api/community/post` | Publish new community post |
| `POST` | `/api/chat/sustainability` | AI Coach conversational queries |
| `POST` | `/api/predict/day` | Activity projection or full-schema candidate GBDT estimate |
| `POST` | `/api/predict/annual` | Full 18-field annual-emissions candidate estimate |
| `GET`/`PUT` | `/api/profile/lifestyle` | Read or save an authenticated complete annual-profile schema |
| `POST` | `/api/predict/weekly` | Observed-history weekly baseline forecast |
| `POST` | `/api/voice/call-tips` | Generate daily voice tips script |
| `POST` | `/api/voice/phone-call` | Trigger Twilio phone call briefing |
| `POST` | `/api/food/scan` | Candidate food scan with image/dish-name agreement |
| `POST` | `/api/food/feedback` | Save an authenticated user dish correction without retaining the image |
| `POST` | `/api/certificate/generate` | Persist a monthly user-entered activity summary |
| `GET` | `/api/certificate/{cert_id}` | Retrieve a persisted activity-summary certificate |

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

## Deployment Requirements

Set these backend environment variables before deploying:

- `MONGO_URL`: a private MongoDB connection string.
- `CORS_ORIGINS`: the exact deployed frontend URL, for example `https://app.example.com`; do not use `*` with authenticated requests.
- `AUTH_SECRET`: a persistent, randomly generated secret. Render generates one for the supplied service definition.
- `HF_API_KEY` and/or `GEMINI_API_KEY`: optional candidate food-vision providers. Do not enable model-quality claims until the required evaluation reports exist.

Use a separate MongoDB database for development and production. The first successful backend start creates uniqueness indexes for emails, per-user daily records, community toggles, and summary IDs.

---

## 📜 License & Academic Reference
- **Journal**: Journal of Applied Agriculture and Food Research (JAAFR), ISSN: 2984-889X
- **License**: MIT License
