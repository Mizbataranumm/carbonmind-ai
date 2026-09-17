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
import logging
import re
import requests
import joblib
from concurrent.futures import ThreadPoolExecutor
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
    import torch
    from torch import nn
    from torchvision.models import resnet18
    from torchvision.transforms import Compose, Normalize, Resize, ToTensor
    HAS_TORCH = True
except ImportError:
    torch = None
    nn = None
    HAS_TORCH = False
    logger.warning("torch/torchvision not installed — local food CNN is unavailable")


if HAS_TORCH:
    class CarbonForecastLSTM(nn.Module):
        """Architecture shared with scripts/train_future_lstm.py."""
        def __init__(self, hidden_size: int = 64, output_days: int = 7):
            super().__init__()
            self.lstm = nn.LSTM(1, hidden_size, num_layers=2, batch_first=True, dropout=0.15)
            self.head = nn.Sequential(nn.Linear(hidden_size, 32), nn.ReLU(), nn.Linear(32, output_days))

        def forward(self, series):
            values, _ = self.lstm(series)
            return self.head(values[:, -1, :])
else:
    CarbonForecastLSTM = None

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
daily_hist_gradient_pipeline = None      # 14-feature HistGradientBoosting pipeline
daily_lightgbm_pipeline = None           # 14-feature LightGBM pipeline
daily_gbdt_ensemble_metrics: Optional[dict] = None
annual_carbon_champion = None            # Full-schema LightGBM candidate
_gemini_model = None
food_cnn_model = None
food_cnn_classes: list[str] = []
future_lstm_bundle: Optional[dict] = None

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

    metrics_path = model_path.parent / "evaluation" / "daily_gbdt_ensemble_metrics.json"
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

    return {
        "status": "candidate_not_product_validated",
        "registry": registry,
        "evaluation": {
            "daily_carbon": daily_metrics,
            "annual_carbon_benchmark": annual_metrics,
        },
        "runtime": {
            "food_scanner": {
                "local_cnn_loaded": food_cnn_model is not None,
                "hf_vit_configured": True,
                "gemini_configured": _gemini_model is not None,
                "hf_api_key_configured": bool(HF_API_KEY),
                "cnn_artifact_exists": (model_path / "cnn_food_model.pt").exists(),
                "cnn_metadata_exists": (model_path / "cnn_food_metadata.json").exists(),
                "serving_note": "The ResNet18 candidate runs in parallel with the configured primary vision provider. Its artifact is not release-approved until the committed evaluation report is populated.",
                "emissions_calculation": food_catalog_status(),
            },
            "daily_carbon_predictor": {
                "hist_gradient_loaded": daily_hist_gradient_pipeline is not None,
                "lightgbm_loaded": daily_lightgbm_pipeline is not None,
                "schema_features": list(GBDT_DEFAULTS.keys()),
                "pipeline_loaded": daily_hist_gradient_pipeline is not None and daily_lightgbm_pipeline is not None,
                "metric_claim_source": "backend/ml/evaluation/daily_gbdt_ensemble_metrics.json" if daily_metrics else "No committed ensemble metrics artifact found.",
            },
            "annual_carbon_predictor": {
                "candidate_loaded": annual_carbon_champion is not None,
                "schema_features": ANNUAL_CARBON_FEATURES,
                "metric_claim_source": "backend/ml/evaluation/annual_carbon_model_benchmark.json" if annual_metrics else "No committed benchmark artifact found.",
                "serving_note": "Only /predict/annual and complete 18-field profiles use this annual-emissions candidate.",
            },
            "weekly_forecast": {
                "statsmodels_available": HAS_STATSMODELS,
                "validated_lstm_loaded": future_lstm_bundle is not None,
                "method": "holt_winters_with_validated_lstm_blend_when_available",
                "serving_note": "A legacy LSTM is deliberately not served without a matching chronological validation report.",
            },
        },
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
    global daily_hist_gradient_pipeline, daily_lightgbm_pipeline, daily_gbdt_ensemble_metrics, annual_carbon_champion
    global _gemini_model, HF_API_KEY, food_cnn_model, food_cnn_classes, future_lstm_bundle

    hist_pipeline_path = Path(models_dir) / "daily_hist_gradient_pipeline.joblib"
    lightgbm_pipeline_path = Path(models_dir) / "daily_lightgbm_pipeline.joblib"
    ensemble_metrics_path = Path(models_dir).parent / "evaluation" / "daily_gbdt_ensemble_metrics.json"
    try:
        if hist_pipeline_path.exists():
            daily_hist_gradient_pipeline = joblib.load(hist_pipeline_path)
        if lightgbm_pipeline_path.exists():
            daily_lightgbm_pipeline = joblib.load(lightgbm_pipeline_path)
        if ensemble_metrics_path.exists():
            daily_gbdt_ensemble_metrics = json.loads(ensemble_metrics_path.read_text(encoding="utf-8"))
        if daily_hist_gradient_pipeline is not None and daily_lightgbm_pipeline is not None:
            logger.info("14-feature HistGradientBoosting + LightGBM ensemble loaded")
    except Exception as exc:
        daily_hist_gradient_pipeline = None
        daily_lightgbm_pipeline = None
        daily_gbdt_ensemble_metrics = None
        logger.warning("Daily GBDT ensemble load failed: %s", exc)

    annual_champion_path = Path(models_dir) / "annual_carbon_champion.joblib"
    if annual_champion_path.exists():
        try:
            annual_carbon_champion = joblib.load(annual_champion_path)
            logger.info("Full-schema annual carbon candidate loaded")
        except Exception as exc:
            logger.warning("Annual carbon candidate load failed: %s", exc)

    # Legacy XGBoost artifacts are deliberately not loaded in the web process.
    # The reproducible sklearn pipeline above remains the compatibility path.

    # Legacy pickle artifacts are intentionally not loaded. They have no
    # reproducible shared test split or metric report and cannot be weighted
    # honestly against the checked-in pipelines.

    metadata_path = Path(models_dir) / "cnn_food_metadata.json"
    cnn_path = Path(models_dir) / "cnn_food_model.pt"
    if HAS_TORCH and cnn_path.exists() and metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            classes = metadata.get("classes", [])
            if len(classes) != 101:
                raise ValueError("Expected 101 Food-101 class names in metadata")
            model = resnet18(weights=None)
            model.fc = nn.Linear(model.fc.in_features, len(classes))
            state = torch.load(cnn_path, map_location="cpu")
            model.load_state_dict(state["model_state_dict"] if isinstance(state, dict) and "model_state_dict" in state else state)
            model.eval()
            food_cnn_model = model
            food_cnn_classes = classes
            logger.info("Local Food-101 ResNet18 candidate loaded")
        except Exception as exc:
            food_cnn_model = None
            food_cnn_classes = []
            logger.warning("Local food CNN load failed: %s", exc)

    # Only an artifact produced by scripts/train_future_lstm.py together with
    # its chronological-validation report can be served. The older checked-in
    # lstm_carbon_model.pt has no provenance or metrics and is intentionally
    # quarantined from the live path.
    validated_lstm_path = Path(models_dir) / "future_lstm_candidate.pt"
    lstm_metrics_path = Path(models_dir).parent / "evaluation" / "future_lstm_candidate_metrics.json"
    future_lstm_bundle = None
    if HAS_TORCH and validated_lstm_path.exists() and lstm_metrics_path.exists():
        try:
            report = json.loads(lstm_metrics_path.read_text(encoding="utf-8"))
            checkpoint = torch.load(validated_lstm_path, map_location="cpu")
            required = {"model_state_dict", "val_min", "val_max", "seq_in", "seq_out"}
            if not required.issubset(checkpoint) or report.get("artifact") is None:
                raise ValueError("candidate LSTM is missing its model or validation contract")
            future_lstm_bundle = {"checkpoint": checkpoint, "report": report}
            logger.info("Validated future LSTM candidate loaded")
        except Exception as exc:
            logger.warning("Validated future LSTM load failed: %s", exc)

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
# MODEL 1: Primary vision + local ResNet18 Food-101 ensemble
# ─────────────────────────────────────────────────────────────────────────────
def _predict_food_cnn(image_bytes: bytes) -> Optional[dict]:
    """Run the checked-in ResNet18 on the same image as the remote primary."""
    if food_cnn_model is None or not food_cnn_classes or not HAS_TORCH:
        return None
    try:
        image = Image.open(BytesIO(image_bytes)).convert("RGB")
        transform = Compose([
            Resize((224, 224)),
            ToTensor(),
            Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        with torch.no_grad():
            probabilities = torch.softmax(food_cnn_model(transform(image).unsqueeze(0)), dim=1)[0]
            score, index = torch.max(probabilities, dim=0)
        return {
            "food": food_cnn_classes[int(index)].replace("_", " "),
            "confidence": float(score.item()),
            "model": "local_resnet18_food101_candidate",
        }
    except Exception as exc:
        logger.warning("Local food CNN inference failed: %s", exc)
        return None


def _predict_primary_food(image_bytes: bytes) -> Optional[dict]:
    """Use Gemini when explicitly configured, otherwise the configured HF ViT."""
    if _gemini_model is not None:
        result = _predict_food_gemini(image_bytes)
        if result and str(result.get("food", "")).lower() != "none":
            return {
                "food": result.get("food", ""),
                "confidence": min(1.0, max(0.0, float(result.get("confidence", 0)) / 100)),
                "serving_g": result.get("serving_g"),
                "model": "gemini_vision",
            }
        return None

    result = _predict_food_vit(image_bytes)
    if result and result.get("food"):
        return {
            "food": result["food"],
            "confidence": min(1.0, max(0.0, float(result.get("score", 0)))),
            "model": "huggingface_nateraw_food_vit",
        }
    return None


def _food_prediction_audit(primary: Optional[dict], cnn: Optional[dict], decision: str, reason: str) -> dict:
    """Stable audit payload persisted by the API without retaining image bytes."""
    return {
        "primary_result": primary.get("food") if primary else None,
        "primary_confidence": round(float(primary.get("confidence", 0)), 5) if primary else None,
        "primary_model": primary.get("model") if primary else None,
        "cnn_result": cnn.get("food") if cnn else None,
        "cnn_confidence": round(float(cnn.get("confidence", 0)), 5) if cnn else None,
        "cnn_model": cnn.get("model") if cnn else None,
        "final_decision": decision,
        "decision_reason": reason,
    }


def predict_food(base64_image_str: str, hint: Optional[str] = None) -> dict:
    """Verify a user-named meal with a primary vision model and local CNN.

    Provider and CNN scores are model scores, not calibrated probabilities or
    accuracy claims. A carbon estimate remains blocked unless the final image
    candidate agrees with the dish entered by the user and that dish has a
    reviewed recipe in the CSV-backed catalog.
    """
    confirmed_name = " ".join(re.findall(r"[A-Za-z0-9]+", hint or "")).strip()
    if not confirmed_name:
        return {
            "status": "rejected",
            "message": "Enter the dish name before analyzing the photo.",
            "suggestion": "Type or select the dish shown in the photo.",
            "confidence": None,
        }

    try:
        raw_bytes = base64.b64decode(base64_image_str.split(",")[-1]) if base64_image_str else b""
        Image.open(BytesIO(raw_bytes)).verify()
    except Exception:
        return {
            "status": "rejected",
            "message": "Upload a valid image before estimating the dish.",
            "suggestion": "Choose a clear photo where the meal is visible.",
            "confidence": None,
        }

    # Both models always receive exactly the same bytes. A failed provider does
    # not silently turn the ResNet candidate into a trusted image verification.
    with ThreadPoolExecutor(max_workers=2) as executor:
        primary_future = executor.submit(_predict_primary_food, raw_bytes)
        cnn_future = executor.submit(_predict_food_cnn, raw_bytes)
        primary = primary_future.result()
        cnn = cnn_future.result()

    primary_food = primary.get("food") if primary else None
    primary_confidence = float(primary.get("confidence", 0)) if primary else 0.0
    cnn_food = cnn.get("food") if cnn else None
    cnn_confidence = float(cnn.get("confidence", 0)) if cnn else 0.0
    final_food: Optional[str] = None
    final_confidence = 0.0
    decision = "low_confidence"
    reason = "No primary vision result was available; a local CNN candidate alone cannot verify a meal."

    if primary_food and primary_confidence > 0.85:
        final_food = primary_food
        final_confidence = primary_confidence
        decision = "primary_high_confidence"
        reason = "Primary vision score exceeded the 0.85 decision threshold."
    elif primary_food and cnn_food and _dish_names_agree(primary_food, cnn_food):
        # Agreement only boosts a low-confidence primary; it never turns model
        # scores into a statement of calibrated real-world certainty.
        final_food = primary_food
        final_confidence = min(0.99, primary_confidence + 0.5 * cnn_confidence)
        decision = "models_agree_boosted"
        reason = "Primary score was below 0.85, but the local ResNet18 agreed on the dish label."
    elif primary_food and cnn_food:
        reason = "Primary vision and local ResNet18 disagreed while neither met the high-confidence threshold."
    elif primary_food:
        reason = "Primary vision score was below 0.85 and the local ResNet18 did not return a matching result."

    audit = _food_prediction_audit(primary, cnn, decision, reason)
    if final_food is None:
        return {
            "status": "low_confidence",
            "message": "The image models could not verify this meal. Confirm it manually instead of using a guessed estimate.",
            "suggestion": "Use a clear meal photo or record a reviewed dish manually.",
            "confidence": None,
            "image_candidate": primary_food.title() if primary_food else (cnn_food.title() if cnn_food else None),
            "prediction_audit": audit,
            "requires_user_confirmation": True,
        }

    if not _dish_names_agree(confirmed_name, final_food):
        audit["final_decision"] = "dish_name_mismatch"
        audit["decision_reason"] = "The verified image candidate did not match the dish name supplied by the user."
        return {
            "status": "rejected",
            "message": f"The image candidate ('{final_food.title()}') does not match the dish name ('{confirmed_name}').",
            "suggestion": "Correct the dish name or upload a clearer photo. No estimate was added.",
            "confidence": None,
            "image_candidate": final_food.title(),
            "prediction_audit": audit,
            "requires_user_confirmation": True,
        }

    serving_g = primary.get("serving_g") if primary else None
    emission_estimate = estimate_food_emissions(confirmed_name, serving_g)
    if emission_estimate is None:
        audit["final_decision"] = "reviewed_recipe_missing"
        audit["decision_reason"] = "Image verification succeeded, but the dish is not in the reviewed CSV recipe catalog."
        return {
            "status": "rejected",
            "message": f"'{confirmed_name}' does not yet have a reviewed recipe in the Food Product Emissions catalog.",
            "suggestion": "Record it manually until a reviewed recipe is added.",
            "confidence": None,
            "image_candidate": final_food.title(),
            "prediction_audit": audit,
            "requires_user_confirmation": True,
        }

    return {
        "status": "success",
        "food_category": emission_estimate["food_category"],
        "co2_kg": emission_estimate["co2_kg"],
        "confidence": round(final_confidence, 3),
        "confidence_note": "Model scores are uncalibrated candidate scores, not validated real-world accuracy.",
        "serving_size_g": emission_estimate["serving_size_g"],
        "default_serving_g": emission_estimate["default_serving_g"],
        "method": "primary_vision_local_resnet18_ensemble",
        "emissions_method": emission_estimate["method"],
        "factor_source": emission_estimate["factor_source"],
        "components": emission_estimate["components"],
        "portion_note": emission_estimate["portion_note"],
        "image_candidate": final_food.title(),
        "prediction_audit": audit,
        "requires_user_confirmation": True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# MODEL 2: 14-feature HistGradientBoosting + LightGBM ensemble
# ─────────────────────────────────────────────────────────────────────────────
def _daily_ensemble_weights() -> Optional[dict[str, float]]:
    """Use only weights recorded by the shared holdout training report."""
    if not daily_gbdt_ensemble_metrics:
        return None
    weights = daily_gbdt_ensemble_metrics.get("weights", {})
    hist_weight = weights.get("hist_gradient")
    lightgbm_weight = weights.get("lightgbm")
    try:
        hist_weight = float(hist_weight)
        lightgbm_weight = float(lightgbm_weight)
    except (TypeError, ValueError):
        return None
    if hist_weight < 0 or lightgbm_weight < 0 or hist_weight + lightgbm_weight <= 0:
        return None
    total = hist_weight + lightgbm_weight
    return {"hist_gradient": hist_weight / total, "lightgbm": lightgbm_weight / total}


def predict_gbdt_ensemble(user_inputs: dict) -> Optional[dict]:
    """Predict annual kg CO2e with both models from the same 14-field row."""
    if pd is None or daily_hist_gradient_pipeline is None or daily_lightgbm_pipeline is None:
        return None
    weights = _daily_ensemble_weights()
    if weights is None:
        logger.error("Daily GBDT ensemble cannot serve without validated training weights")
        return None
    row = {feature: user_inputs.get(feature, GBDT_DEFAULTS[feature]) for feature in GBDT_DEFAULTS}
    try:
        frame = pd.DataFrame([row])
        hist_prediction = max(0.0, float(daily_hist_gradient_pipeline.predict(frame)[0]))
        lightgbm_prediction = max(0.0, float(daily_lightgbm_pipeline.predict(frame)[0]))
    except Exception as exc:
        logger.error("Daily GBDT ensemble prediction error: %s", exc)
        return None
    ensemble_prediction = (
        weights["hist_gradient"] * hist_prediction
        + weights["lightgbm"] * lightgbm_prediction
    )
    return {
        "target": "annual_kg_co2e",
        "feature_schema": list(GBDT_DEFAULTS),
        "hist_gradient_prediction_kg_year": round(hist_prediction, 2),
        "lightgbm_prediction_kg_year": round(lightgbm_prediction, 2),
        "ensemble_prediction_kg_year": round(max(0.0, ensemble_prediction), 2),
        "weights": {name: round(value, 6) for name, value in weights.items()},
        "evaluation_source": "backend/ml/evaluation/daily_gbdt_ensemble_metrics.json",
        "model_status": "candidate_random_holdout_only",
    }


def predict_gbdt(user_inputs: dict) -> Optional[float]:
    """Compatibility scalar accessor for the 14-feature annual ensemble."""
    result = predict_gbdt_ensemble(user_inputs)
    return result["ensemble_prediction_kg_year"] if result else None


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


def _predict_validated_lstm(daily_kg_series: List[float]) -> Optional[list[float]]:
    """Run only the candidate that has a matching chronological metrics report."""
    if not HAS_TORCH or not future_lstm_bundle or CarbonForecastLSTM is None:
        return None
    checkpoint = future_lstm_bundle["checkpoint"]
    history_days = int(checkpoint["seq_in"])
    forecast_days = int(checkpoint["seq_out"])
    if len(daily_kg_series) < history_days or forecast_days != 7:
        return None
    try:
        values = np.asarray(daily_kg_series[-history_days:], dtype=np.float32)
        low, high = float(checkpoint["val_min"]), float(checkpoint["val_max"])
        width = max(high - low, 1e-6)
        model = CarbonForecastLSTM(output_days=forecast_days)
        model.load_state_dict(checkpoint["model_state_dict"])
        model.eval()
        normalized = torch.tensor(((values - low) / width)).unsqueeze(0).unsqueeze(-1)
        with torch.no_grad():
            output = model(normalized).squeeze(0).cpu().numpy()
        return [max(0.0, round(float(value * width + low), 2)) for value in output]
    except Exception as exc:
        logger.warning("Validated LSTM inference failed: %s", exc)
        return None


def predict_weekly_ensemble(daily_kg_series: List[float]) -> Optional[dict]:
    """Blend Holt-Winters and a validated LSTM when both can predict.

    The requested policy favours Holt-Winters for sparse history and LSTM for
    longer histories, but never invents an LSTM output when the validated
    artifact needs more history than is available.
    """
    holt_result = predict_weekly_arima(daily_kg_series)
    if holt_result is None:
        return None
    holt_forecast = holt_result["forecast"]
    lstm_forecast = _predict_validated_lstm(daily_kg_series)
    if lstm_forecast is None:
        return {
            **holt_result,
            "holt_winters_forecast": holt_forecast,
            "lstm_forecast": None,
            "ensemble_forecast": holt_forecast,
            "model_weights": {"holt_winters": 1.0, "lstm": 0.0},
            "method": "holt_winters_only_lstm_not_validated_or_insufficient_history",
            "lstm_status": "unavailable_without_validated_artifact_or_required_history",
        }
    weights = {"holt_winters": 0.8, "lstm": 0.2} if len(daily_kg_series) < 14 else {"holt_winters": 0.35, "lstm": 0.65}
    blended = [
        round(weights["holt_winters"] * holt + weights["lstm"] * lstm, 2)
        for holt, lstm in zip(holt_forecast, lstm_forecast)
    ]
    return {
        **holt_result,
        "forecast": blended,
        "holt_winters_forecast": holt_forecast,
        "lstm_forecast": lstm_forecast,
        "ensemble_forecast": blended,
        "weekly_total": round(sum(blended), 2),
        "model_weights": weights,
        "method": "holt_winters_lstm_history_weighted_ensemble",
        "lstm_status": "validated_candidate",
    }


def predict_lstm(historical_30_days):
    """Compatibility accessor; returns only a validated LSTM prediction."""
    return _predict_validated_lstm(historical_30_days)
