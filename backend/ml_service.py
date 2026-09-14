"""
CarbonMind AI ML Service
========================
Runtime inference helpers for food scanning, daily carbon prediction, and
short-horizon forecasting.

  1. FOOD SCANNER: remote vision and optional Gemini responses are candidate
     labels only. The user-provided dish name must agree with an independent
     image candidate before an emissions lookup is returned.

  2. DAILY CARBON: the preferred artifact is a reproducible sklearn pipeline
     that owns preprocessing plus the estimator. Legacy XGBoost/LightGBM
     artifacts remain an optional compatibility fallback.

  3. WEEKLY FORECAST: Holt-Winters is used only with observed history. The
     future planner is implemented separately as a transparent scenario tool.

Product claims must come from committed evaluation artifacts under
backend/ml/evaluation/. Do not hard-code accuracy, R2, MAE, or confidence claims.
"""

import os
import json
import base64
import pickle
import logging
import re
import requests
import joblib
from io import BytesIO
from pathlib import Path
from typing import Optional, List

import numpy as np
from PIL import Image

try:
    # Package import used by tests and local module execution.
    from .food_emissions import (
        estimate_food_emissions,
        food_catalog_status,
        normalise_food_key as _normalise_catalog_key,
    )
except ImportError:
    # Render starts ``uvicorn server:app`` from the backend directory.
    from food_emissions import (  # type: ignore[no-redef]
        estimate_food_emissions,
        food_catalog_status,
        normalise_food_key as _normalise_catalog_key,
    )

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Optional heavy deps — all fail gracefully
# ─────────────────────────────────────────────────────────────────────────────
try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False
    logger.warning("google-generativeai not installed")

try:
    import pandas as pd
except ImportError:
    pd = None
    logger.warning("pandas not installed")

# XGBoost is retained only for compatibility with an unused legacy artifact.
# Importing recent wheels pulls GPU/NCCL dependencies and can keep a small web
# service from binding its port. The serving path uses the committed sklearn and
# LightGBM artifacts instead, so do not import it at process startup.
HAS_XGB = False

try:
    import lightgbm as lgb
    HAS_LGB = True
except ImportError:
    HAS_LGB = False
    logger.warning("lightgbm not installed — XGBoost-only mode")

try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    from statsmodels.tsa.arima.model import ARIMA
    HAS_STATSMODELS = True
except ImportError:
    HAS_STATSMODELS = False
    logger.warning("statsmodels not installed — using linear trend fallback")

# ─────────────────────────────────────────────────────────────────────────────
# Global model state (loaded once on startup via load_models())
# ─────────────────────────────────────────────────────────────────────────────
gbdt_xgb_data: Optional[dict] = None   # Legacy XGBoost model + encoders
gbdt_lgb_data: Optional[dict] = None   # Legacy LightGBM model + encoders
gbdt_pipeline = None                    # Reproducible sklearn preprocessing + estimator
annual_carbon_champion = None            # Full-schema LightGBM candidate
_gemini_model = None

# Hugging Face Inference API — Vision Transformer (ViT) fine-tuned on Food-101
HF_API_URL = "https://api-inference.huggingface.co/models/nateraw/food"
HF_API_KEY = None   # Set via env var HF_API_KEY (optional — free tier works without key)


def get_model_status(models_dir: str = "ml/models") -> dict:
    """Return model readiness and runtime wiring without claiming accuracy."""
    model_path = Path(models_dir)
    registry_path = model_path.parent / "model_registry.json"
    registry = None

    if registry_path.exists():
        try:
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
        except Exception as exc:
            registry = {"error": f"Could not read model registry: {exc}"}

    metrics_path = model_path.parent / "evaluation" / "daily_carbon_gbdt_metrics.json"
    daily_metrics = None
    if metrics_path.exists():
        try:
            daily_metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
        except Exception as exc:
            daily_metrics = {"error": f"Could not read daily model metrics: {exc}"}

    annual_metrics_path = model_path.parent / "evaluation" / "annual_carbon_model_benchmark.json"
    annual_metrics = None
    if annual_metrics_path.exists():
        try:
            annual_metrics = json.loads(annual_metrics_path.read_text(encoding="utf-8"))
        except Exception as exc:
            annual_metrics = {"error": f"Could not read annual model benchmark: {exc}"}

    xgb_features = list(GBDT_DEFAULTS.keys())
    if gbdt_xgb_data:
        xgb_features = gbdt_xgb_data.get("features", xgb_features)

    return {
        "status": "candidate_not_product_validated",
        "registry": registry,
        "evaluation": {
            "daily_carbon": daily_metrics,
            "annual_carbon_benchmark": annual_metrics,
        },
        "runtime": {
            "food_scanner": {
                "local_cnn_loaded": False,
                "hf_vit_configured": True,
                "gemini_configured": _gemini_model is not None,
                "hf_api_key_configured": bool(HF_API_KEY),
                "cnn_artifact_exists": (model_path / "cnn_food_model.pt").exists(),
                "cnn_metadata_exists": (model_path / "cnn_food_metadata.json").exists(),
                "serving_note": "The checked-in CNN artifact is present but not used by predict_food().",
                "emissions_calculation": food_catalog_status(),
            },
            "daily_carbon_predictor": {
                "xgboost_loaded": gbdt_xgb_data is not None,
                "lightgbm_loaded": gbdt_lgb_data is not None,
                "schema_features": xgb_features,
                "pipeline_loaded": gbdt_pipeline is not None,
                "metric_claim_source": "backend/ml/evaluation/daily_carbon_gbdt_metrics.json" if daily_metrics else "No committed metrics artifact found.",
            },
            "annual_carbon_predictor": {
                "candidate_loaded": annual_carbon_champion is not None,
                "schema_features": ANNUAL_CARBON_FEATURES,
                "metric_claim_source": "backend/ml/evaluation/annual_carbon_model_benchmark.json" if annual_metrics else "No committed benchmark artifact found.",
                "serving_note": "Only /predict/annual and complete 18-field profiles use this annual-emissions candidate.",
            },
            "weekly_forecast": {
                "statsmodels_available": HAS_STATSMODELS,
                "method": "holt_winters_or_linear_fallback",
                "serving_note": "predict_lstm() is a compatibility shim over predict_weekly_arima().",
            },
        },
    }

# ─────────────────────────────────────────────────────────────────────────────
# Legacy serving-factor catalog (not used by the serving path)
# ─────────────────────────────────────────────────────────────────────────────
# Kept temporarily to avoid breaking external imports while
# Food_Product_Emissions.csv becomes the calculation source for predict_food().
FOOD_CO2_FACTORS = {
    # Indian / South Asian
    "biryani": 2.2, "chicken_biryani": 2.8, "mutton_biryani": 4.1, "veg_biryani": 1.2,
    "thali": 1.6, "veg_thali": 0.9, "chicken_thali": 2.4,
    "dosa": 0.6, "masala_dosa": 0.7, "idli": 0.4, "sambar": 0.5,
    "paneer": 1.8, "palak_paneer": 1.4, "butter_chicken": 3.1, "dal": 0.5,
    "dal_makhani": 1.2, "roti": 0.3, "naan": 0.4, "chole_bhature": 1.3,
    "pav_bhaji": 1.1, "samosa": 0.6, "rajma": 0.8, "chicken_curry": 1.9,
    "fish_curry": 2.1, "prawn_curry": 2.5, "egg_curry": 1.2,
    "upma": 0.5, "poha": 0.4, "aloo_paratha": 0.7, "khichdi": 0.6,
    "tandoori_chicken": 2.4, "kadai_chicken": 2.6,
    # Western
    "pizza": 2.8, "hamburger": 4.8, "burger": 4.8, "french_fries": 0.4, "fries": 0.4,
    "sandwich": 1.2, "salad": 0.4, "caesar_salad": 0.7, "greek_salad": 0.6,
    "pasta": 1.3, "spaghetti_bolognese": 3.2, "lasagna": 2.6,
    "steak": 8.9, "beef_carpaccio": 4.5, "beef_tartare": 5.2,
    "chicken": 1.8, "chicken_wings": 2.4, "chicken_quesadilla": 2.1,
    "grilled_salmon": 2.1, "sushi": 1.5, "sashimi": 1.4, "ramen": 1.7,
    "rice": 0.8, "fried_rice": 0.9, "pad_thai": 1.4, "pho": 1.6,
    "soup": 0.5, "clam_chowder": 1.3, "hot_and_sour_soup": 0.5,
    "omelette": 0.9, "eggs_benedict": 1.4, "pancakes": 0.6, "waffles": 0.6,
    "french_toast": 0.8, "breakfast_burrito": 1.8, "huevos_rancheros": 1.2,
    "ice_cream": 0.9, "cheesecake": 1.1, "chocolate_cake": 0.8, "chocolate_mousse": 0.7,
    "tiramisu": 0.7, "panna_cotta": 0.7, "creme_brulee": 0.8,
    "apple_pie": 0.8, "carrot_cake": 0.5, "red_velvet_cake": 0.6,
    "donuts": 0.4, "macarons": 0.4, "cup_cakes": 0.4, "cannoli": 0.5,
    "baklava": 0.6, "beignets": 0.5, "churros": 0.4, "strawberry_shortcake": 0.5,
    "coffee": 0.21, "tea": 0.03, "juice": 0.2, "milk": 0.6,
    "bread": 0.5, "garlic_bread": 0.4, "bruschetta": 0.3,
    "tacos": 2.2, "nachos": 1.6, "hot_dog": 2.1, "poutine": 1.8,
    "fish_and_chips": 2.2, "spring_rolls": 0.5, "dumplings": 0.9,
    "gyoza": 0.8, "bibimbap": 1.2, "peking_duck": 3.2, "takoyaki": 1.1,
    "lobster_bisque": 2.4, "lobster_roll_sandwich": 2.5,
    "shrimp_and_grits": 2.3, "crab_cakes": 1.6, "scallops": 1.2, "mussels": 0.9,
    "oysters": 0.8, "sashimi": 1.4, "tuna_tartare": 1.8, "fried_calamari": 1.5,
    "ceviche": 1.1, "foie_gras": 3.8, "escargots": 0.7,
    "hummus": 0.3, "falafel": 0.5, "guacamole": 0.4, "edamame": 0.3,
    "risotto": 1.1, "gnocchi": 0.8, "ravioli": 1.3, "macaroni_and_cheese": 1.4,
    "paella": 2.2, "pulled_pork_sandwich": 3.1, "pork_chop": 3.4,
    "prime_rib": 9.2, "filet_mignon": 8.5, "baby_back_ribs": 5.4,
    "beet_salad": 0.4, "caprese_salad": 0.6, "seaweed_salad": 0.2,
    "cheese_plate": 2.2, "deviled_eggs": 0.8, "club_sandwich": 1.7,
    "grilled_cheese_sandwich": 1.2, "croque_madame": 1.6,
    "frozen_yogurt": 0.6, "miso_soup": 0.3, "onion_rings": 0.5,
    "french_onion_soup": 0.7, "bread_pudding": 0.6,
}

# GBDT dataset feature defaults (mean/mode from Carbon Emission.csv — 10,001 rows)
GBDT_DEFAULTS = {
    'Body Type': 'normal',
    'Diet': 'omnivore',
    'How Often Shower': 'daily',
    'Heating Energy Source': 'natural gas',
    'Transport': 'public',
    'Vehicle Type': 'petrol',
    'Monthly Grocery Bill': 230.0,
    'Frequency of Traveling by Air': 'rarely',
    'Vehicle Monthly Distance Km': 500.0,
    'Waste Bag Size': 'medium',
    'Waste Bag Weekly Count': 3,
    'How Long TV PC Daily Hour': 4.0,
    'How Long Internet Daily Hour': 4.0,
    'Energy efficiency': 'Sometimes',
}

# Product schema for the annual-emissions candidate. The source dataset's Sex
# field is excluded deliberately, even though retaining it improves a single
# holdout score; the app does not collect sensitive data merely for that gain.
ANNUAL_CARBON_FEATURES = [
    'Body Type', 'Diet', 'How Often Shower', 'Heating Energy Source',
    'Transport', 'Vehicle Type', 'Social Activity', 'Monthly Grocery Bill',
    'Frequency of Traveling by Air', 'Vehicle Monthly Distance Km',
    'Waste Bag Size', 'Waste Bag Weekly Count', 'How Long TV PC Daily Hour',
    'How Many New Clothes Monthly', 'How Long Internet Daily Hour',
    'Energy efficiency', 'Recycling', 'Cooking_With',
]


# ─────────────────────────────────────────────────────────────────────────────
# STARTUP: load_models()
# ─────────────────────────────────────────────────────────────────────────────
def load_models(models_dir: str = "ml/models"):
    global gbdt_xgb_data, gbdt_lgb_data, gbdt_pipeline, annual_carbon_champion, _gemini_model, HF_API_KEY

    # Preferred artifact: the pipeline owns both preprocessing and estimator, so
    # category ordering cannot drift between training and serving.
    pipeline_path = Path(models_dir) / "daily_carbon_pipeline.joblib"
    if pipeline_path.exists():
        try:
            gbdt_pipeline = joblib.load(pipeline_path)
            logger.info("Daily carbon pipeline loaded")
        except Exception as exc:
            logger.warning("Daily carbon pipeline load failed: %s", exc)

    annual_champion_path = Path(models_dir) / "annual_carbon_champion.joblib"
    if annual_champion_path.exists():
        try:
            annual_carbon_champion = joblib.load(annual_champion_path)
            logger.info("Full-schema annual carbon candidate loaded")
        except Exception as exc:
            logger.warning("Annual carbon candidate load failed: %s", exc)

    # Legacy XGBoost artifacts are deliberately not loaded in the web process.
    # The reproducible sklearn pipeline above remains the compatibility path.

    # 1. LightGBM GBDT
    lgb_path = f"{models_dir}/lgbm_carbon_model.pkl"
    if os.path.exists(lgb_path):
        try:
            with open(lgb_path, 'rb') as f:
                gbdt_lgb_data = pickle.load(f)
            logger.info("LightGBM model loaded")
        except Exception as e:
            logger.warning(f"LightGBM load failed: {e}")

    # 2. Gemini Vision
    if HAS_GEMINI:
        api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('EMERGENT_LLM_KEY')
        if api_key:
            try:
                genai.configure(api_key=api_key)
                _gemini_model = genai.GenerativeModel(
                    model_name="gemini-1.5-flash",
                    generation_config={"temperature": 0.1, "max_output_tokens": 300},
                )
                logger.info("Gemini 1.5 Flash Vision configured")
            except Exception as e:
                logger.warning(f"Gemini config failed: {e}")

    # 3. HF API key (optional)
    HF_API_KEY = os.environ.get('HF_API_KEY', '')


# ─────────────────────────────────────────────────────────────────────────────
# HELPER: food-factor lookup and dish-name agreement
# ─────────────────────────────────────────────────────────────────────────────
def _normalise_food_key(food_name: str) -> str:
    return _normalise_catalog_key(food_name)


def _co2_from_name(food_name: str) -> Optional[float]:
    """Compatibility helper backed by the CSV recipe catalog's default portion."""
    estimate = estimate_food_emissions(food_name)
    return float(estimate["co2_kg"]) if estimate else None


def _dish_names_agree(confirmed_name: str, image_candidate: str) -> bool:
    """Return true only when the confirmed dish and image candidate share a dish phrase."""
    confirmed_key = _normalise_food_key(confirmed_name)
    candidate_key = _normalise_food_key(image_candidate)
    if not confirmed_key or not candidate_key:
        return False
    if confirmed_key in candidate_key or candidate_key in confirmed_key:
        return True

    ignored_words = {"food", "dish", "meal", "plate", "with", "and", "the", "a", "an"}
    confirmed_tokens = set(confirmed_key.split("_")) - ignored_words
    candidate_tokens = set(candidate_key.split("_")) - ignored_words
    return len(confirmed_tokens) >= 2 and len(confirmed_tokens & candidate_tokens) >= 2


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 1A: Hugging Face ViT Food-101 classifier
# ─────────────────────────────────────────────────────────────────────────────
def _predict_food_vit(image_bytes: bytes) -> Optional[dict]:
    """
    Call HF Inference API with nateraw/food ViT model.
    Returns top prediction label + score, or None on failure.
    """
    try:
        headers = {}
        if HF_API_KEY:
            headers["Authorization"] = f"Bearer {HF_API_KEY}"
        response = requests.post(
            HF_API_URL,
            headers=headers,
            data=image_bytes,
            timeout=12,
        )
        if response.status_code == 200:
            results = response.json()
            if isinstance(results, list) and len(results) > 0:
                top = results[0]
                return {
                    "food": top.get("label", "").replace("_", " "),
                    "score": top.get("score", 0.0),
                    "all_predictions": results[:5],
                }
        elif response.status_code == 503:
            # Model loading (cold start) — HF free tier
            logger.warning("HF model cold start (503) — skipping ViT this request")
    except Exception as e:
        logger.warning(f"HF ViT API error: {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 1B: Gemini 1.5 Flash Vision
# ─────────────────────────────────────────────────────────────────────────────
def _predict_food_gemini(image_bytes: bytes) -> Optional[dict]:
    """
    Use Gemini 1.5 Flash Vision to identify food + estimate portion.
    Returns dict with food name and confidence, or None on failure.
    """
    if not _gemini_model:
        return None
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
        img.thumbnail((640, 640))
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=85)
        img_b64 = base64.b64encode(buf.getvalue()).decode()

        prompt = (
            "Identify the food in this image. Reply ONLY in this JSON format:\n"
            "{\"food\": \"<specific dish name>\", \"confidence\": <0-100>, \"serving_g\": <grams>}\n\n"
            "Rules:\n"
            "- Be specific: 'Chicken Biryani' not 'rice', 'Masala Dosa' not 'pancake'\n"
            "- If no food is visible, return: {\"food\": \"none\", \"confidence\": 0, \"serving_g\": 0}\n"
            "- For Indian dishes, name them correctly\n"
            "- serving_g is realistic portion (150-500g typically)"
        )

        response = _gemini_model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": img_b64}
        ])

        text = response.text.strip()
        if "`" in text:
            text = text.split("`")[1].replace("json", "").strip()
        parsed = json.loads(text)
        return parsed
    except Exception as e:
        logger.warning(f"Gemini Vision error: {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 1: ENSEMBLE Food Prediction (ViT + Gemini)
# ─────────────────────────────────────────────────────────────────────────────
def predict_food(base64_image_str: str, hint: Optional[str] = None) -> dict:
    """
    Candidate food-image classifier with a user-confirmed dish verification.

    Scores returned by provider models are ranking scores, not calibrated
    probabilities. They are retained for evaluation only and must not be
    described as accuracy or certainty in the product UI.
    """

    confirmed_name = " ".join(re.findall(r"[A-Za-z0-9]+", hint or "")).strip()
    if not confirmed_name:
        return {
            "status": "rejected",
            "message": "Enter the dish name before analyzing the photo.",
            "suggestion": "Type or select the dish shown in the photo.",
            "confidence": None,
        }

    # Decode image once
    raw_bytes: Optional[bytes] = None
    if base64_image_str:
        try:
            raw = base64_image_str.split(",")[-1]
            raw_bytes = base64.b64decode(raw)
        except Exception:
            pass

    if not raw_bytes:
        return {
            "status": "rejected",
            "message": "Upload a valid food photo before estimating the dish.",
            "suggestion": "Choose a clear photo where the food is visible.",
            "confidence": None,
        }

    # Cheap image-quality guard. This cannot determine whether an image contains
    # food, so it is deliberately not used as a non-food classifier.
    try:
        img_check = Image.open(BytesIO(raw_bytes)).convert("RGB").resize((64, 64))
        pixels = list(img_check.getdata())
        total = len(pixels)
        skin = sum(1 for r, g, b in pixels
                   if r > 95 and g > 40 and b > 20
                   and max(r, g, b) - min(r, g, b) > 15
                   and abs(r - g) > 15 and r > g and r > b)
        if skin / total > 0.60:
            return {
                "status": "rejected",
                "message": "The image looks like a portrait rather than a meal. Please upload a clear meal photo.",
                "suggestion": "Retake the photo with the meal clearly visible.",
                "confidence": None,
                "confidence_note": "No validated non-food classifier is configured.",
            }
    except Exception:
        pass

    # The providers are independent image-only candidates. A single remote model
    # can confidently misclassify a meal, so one candidate is not sufficient to
    # turn a user-entered dish name into a carbon estimate.
    vit_result = _predict_food_vit(raw_bytes)
    gemini_result = _predict_food_gemini(raw_bytes)

    vit_food: Optional[str] = None
    vit_score: float = 0.0
    gem_food: Optional[str] = None
    gem_confidence: float = 0.0

    if vit_result:
        vit_food = vit_result["food"]
        vit_score = float(vit_result["score"]) * 100  # convert 0-1 → 0-100

    if gemini_result:
        gem_food_raw = gemini_result.get("food", "none")
        gem_confidence = float(gemini_result.get("confidence", 0))
        if gem_food_raw.lower() != "none" and gem_confidence >= 40:
            gem_food = gem_food_raw

    # ── Conservative verification gate ───────────────────────────────────────
    chosen_food: Optional[str] = None
    chosen_confidence: float = 0.0

    if vit_food and gem_food:
        if _dish_names_agree(vit_food, gem_food):
            chosen_food = gem_food
            chosen_confidence = min(vit_score, gem_confidence)
        else:
            return {
                "status": "rejected",
                "message": "The image checks disagreed about this meal, so no estimate was created.",
                "suggestion": "Use a clearer photo focused on one dish, or record the meal manually.",
                "confidence": None,
                "image_candidate": f"{vit_food.title()} / {gem_food.title()}",
            }

    if not chosen_food or chosen_confidence < 35:
        return {
            "status": "rejected",
            "message": "Two independent image checks could not verify this meal.",
            "suggestion": "Use a clear, well-lit photo focused on one dish, then try again.",
            "confidence": None,
            "confidence_note": "No carbon estimate is shown until image-only candidates agree.",
        }

    if not _dish_names_agree(confirmed_name, chosen_food):
        return {
            "status": "rejected",
            "message": f"The photo candidate ('{chosen_food.title()}') does not match the dish name ('{confirmed_name}').",
            "suggestion": "Use a clearer photo of the meal or correct the dish name. No estimate was added.",
            "confidence": None,
            "image_candidate": chosen_food.title(),
        }

    serving_g = gemini_result.get("serving_g") if gemini_result else None
    emission_estimate = estimate_food_emissions(confirmed_name, serving_g)
    if emission_estimate is None:
        return {
            "status": "rejected",
            "message": f"'{confirmed_name}' does not yet have a reviewed recipe in the Food Product Emissions catalog.",
            "suggestion": "Use a specific option such as Chicken Biryani, Veg Biryani, Margherita Pizza, Beef Burger, Garden Salad, or Tomato Pasta.",
            "confidence": None,
        }

    return {
        "status": "success",
        "food_category": emission_estimate["food_category"],
        "co2_kg": emission_estimate["co2_kg"],
        "confidence": None,
        "raw_candidate_score": round(chosen_confidence, 1),
        "confidence_note": "The image candidate and dish-name agreement are not yet validated on a held-out real-world food/non-food set.",
        "serving_size_g": emission_estimate["serving_size_g"],
        "default_serving_g": emission_estimate["default_serving_g"],
        "method": "vision_dish_agreement",
        "emissions_method": emission_estimate["method"],
        "factor_source": emission_estimate["factor_source"],
        "components": emission_estimate["components"],
        "portion_note": emission_estimate["portion_note"],
        "image_candidate": chosen_food.title(),
        "requires_user_confirmation": True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 2: XGBoost + LightGBM Ensemble Carbon Predictor
# ─────────────────────────────────────────────────────────────────────────────
def _build_feature_row(user_inputs: dict, encoders: dict, features: list) -> dict:
    """Merge user inputs with dataset defaults and encode categoricals."""
    merged = {**GBDT_DEFAULTS, **{k: v for k, v in user_inputs.items() if v is not None}}
    row = {}
    for feat in features:
        val = merged.get(feat, GBDT_DEFAULTS.get(feat, 0))
        if feat in encoders:
            enc = encoders[feat]
            str_val = str(val)
            if str_val in enc.classes_:
                row[feat] = int(enc.transform([str_val])[0])
            else:
                row[feat] = 0
        else:
            try:
                row[feat] = float(val)
            except (ValueError, TypeError):
                row[feat] = 0.0
    return row


def predict_gbdt(user_inputs: dict) -> Optional[float]:
    """
    Compatibility inference for the checked-in 14-field annual pipeline.

    Product code should call predict_annual_carbon() only after collecting all
    19 annual-profile fields. This legacy path remains for existing callers.
    """
    if gbdt_pipeline is not None:
        try:
            row = {feature: user_inputs.get(feature) for feature in GBDT_DEFAULTS}
            return float(gbdt_pipeline.predict(pd.DataFrame([row]))[0])
        except Exception as exc:
            logger.error("Saved daily carbon pipeline prediction error: %s", exc)
            return None

    if not HAS_XGB or not gbdt_xgb_data:
        return None

    encoders = gbdt_xgb_data.get('encoders', {})
    features = gbdt_xgb_data.get('features', list(GBDT_DEFAULTS.keys()))
    row = _build_feature_row(user_inputs, encoders, features)

    try:
        df = pd.DataFrame([row])
        xgb_pred = float(gbdt_xgb_data['model'].predict(df)[0])
    except Exception as e:
        logger.error(f"XGBoost predict error: {e}")
        return None

    # If LightGBM model also available, ensemble (XGB 55% + LGB 45%)
    if HAS_LGB and gbdt_lgb_data:
        try:
            lgb_encoders = gbdt_lgb_data.get('encoders', encoders)
            lgb_features = gbdt_lgb_data.get('features', features)
            lgb_row = _build_feature_row(user_inputs, lgb_encoders, lgb_features)
            lgb_df = pd.DataFrame([lgb_row])
            lgb_pred = float(gbdt_lgb_data['model'].predict(lgb_df)[0])
            ensemble_pred = xgb_pred * 0.55 + lgb_pred * 0.45
            logger.info(f"Ensemble: XGB={xgb_pred:.0f}, LGB={lgb_pred:.0f}, final={ensemble_pred:.0f}")
            return max(500.0, min(20000.0, ensemble_pred))
        except Exception as e:
            logger.warning(f"LightGBM predict error (using XGB only): {e}")

    return max(500.0, min(20000.0, xgb_pred))


def missing_annual_carbon_features(profile: dict) -> list[str]:
    """Return full-schema fields that the caller did not explicitly provide."""
    return [
        feature
        for feature in ANNUAL_CARBON_FEATURES
        if profile.get(feature) is None or (isinstance(profile.get(feature), str) and not profile[feature].strip())
    ]


def predict_annual_carbon(profile: dict) -> Optional[float]:
    """Predict annual kg CO2e from a complete, user-supplied lifestyle profile."""
    if missing_annual_carbon_features(profile):
        return None
    if annual_carbon_champion is None:
        return None
    try:
        row = {feature: profile[feature] for feature in ANNUAL_CARBON_FEATURES}
        return max(0.0, float(annual_carbon_champion.predict(pd.DataFrame([row]))[0]))
    except Exception as exc:
        logger.error("Annual carbon candidate prediction error: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 3: Holt-Winters Weekly Baseline (requires observed history)
# ─────────────────────────────────────────────────────────────────────────────
def predict_weekly_arima(daily_kg_series: List[float]) -> Optional[dict]:
    """
    Forecast next 7 days of daily CO2 emissions.

    Method:
      - 14+ days: Holt-Winters Triple Exponential Smoothing (captures trend + weekly seasonality)
      - 5-13 days: Holt-Winters Double (trend only, no seasonality)
      - <5 days:   Returns None

    This is an unevaluated baseline for the user's own observed history. It is
    not a release-approved forecast until it has rolling backtest metrics.
    """
    if not daily_kg_series or len(daily_kg_series) < 5:
        return None

    series = np.array(daily_kg_series, dtype=float)
    series = np.clip(series, 0.01, 100.0)  # sanity clamp

    if not HAS_STATSMODELS:
        # Pure numpy linear trend fallback
        x = np.arange(len(series))
        m, b = np.polyfit(x, series, 1)
        last = len(series)
        forecast = [max(0.1, round(float(m * (last + i) + b), 2)) for i in range(7)]
        return {
            "forecast": forecast,
            "lower_band": [max(0.1, v * 0.82) for v in forecast],
            "upper_band": [v * 1.18 for v in forecast],
            "band_note": "Heuristic band; it is not a calibrated confidence interval.",
            "trend": "improving" if m < -0.02 else "worsening" if m > 0.02 else "stable",
            "weekly_total": round(sum(forecast), 2),
            "method": "linear_trend_numpy",
        }

    try:
        n = len(series)
        if n >= 14:
            # Triple Exponential Smoothing — trend + weekly (7-day) seasonality
            model = ExponentialSmoothing(
                series,
                trend='add',
                seasonal='add',
                seasonal_periods=7,
                damped_trend=True,    # prevents over-extrapolation
            )
            fit = model.fit(optimized=True, use_brute=False)
            fc = fit.forecast(7)
        else:
            # Double Exponential Smoothing — trend only
            model = ExponentialSmoothing(series, trend='add', damped_trend=True)
            fit = model.fit(optimized=True)
            fc = fit.forecast(7)

        forecast = [max(0.1, round(float(v), 2)) for v in fc]

        # Residual spread gives a visual uncertainty band, not calibrated coverage.
        residuals = fit.resid
        sigma = float(np.std(residuals)) if len(residuals) > 0 else 0.5
        lower_band = [max(0.1, round(v - 1.28 * sigma, 2)) for v in forecast]
        upper_band = [round(v + 1.28 * sigma, 2) for v in forecast]

        recent_avg = float(np.mean(series[-7:]))
        forecast_avg = float(np.mean(forecast))
        pct = (forecast_avg - recent_avg) / max(recent_avg, 0.01) * 100
        trend = "improving" if pct < -5 else "worsening" if pct > 5 else "stable"

        return {
            "forecast": forecast,
            "lower_band": lower_band,
            "upper_band": upper_band,
            "band_note": "Heuristic residual band; it is not a calibrated confidence interval.",
            "trend": trend,
            "pct_change": round(pct, 1),
            "weekly_total": round(sum(forecast), 2),
            "method": "holt_winters_triple" if n >= 14 else "holt_winters_double",
        }

    except Exception as e:
        logger.error(f"Holt-Winters error: {e}")
        return None


# Backward compat shim
def predict_lstm(historical_30_days):
    result = predict_weekly_arima(historical_30_days)
    return result["forecast"] if result else None
