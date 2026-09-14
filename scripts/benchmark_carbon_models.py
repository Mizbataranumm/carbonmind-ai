"""Compare annual-carbon regression candidates on one reproducible holdout.

The source data is a cross-sectional annual-emissions table. The resulting
models predict annual kg CO2e only; they must not be represented as a measured
partial-day forecast in the product UI.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

# This desktop's restricted process environment cannot create worker pipes.
# Keeping these candidates single-threaded is deterministic and avoids changing
# the model results with a platform-specific fallback.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import joblib
import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor


TARGET = "CarbonEmission"
LEGACY_FEATURES = [
    "Body Type",
    "Diet",
    "How Often Shower",
    "Heating Energy Source",
    "Transport",
    "Vehicle Type",
    "Monthly Grocery Bill",
    "Frequency of Traveling by Air",
    "Vehicle Monthly Distance Km",
    "Waste Bag Size",
    "Waste Bag Weekly Count",
    "How Long TV PC Daily Hour",
    "How Long Internet Daily Hour",
    "Energy efficiency",
]
PRODUCT_FEATURES = [
    "Body Type",
    "Diet",
    "How Often Shower",
    "Heating Energy Source",
    "Transport",
    "Vehicle Type",
    "Social Activity",
    "Monthly Grocery Bill",
    "Frequency of Traveling by Air",
    "Vehicle Monthly Distance Km",
    "Waste Bag Size",
    "Waste Bag Weekly Count",
    "How Long TV PC Daily Hour",
    "How Many New Clothes Monthly",
    "How Long Internet Daily Hour",
    "Energy efficiency",
    "Recycling",
    "Cooking_With",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, default=Path("Carbon Emission.csv"))
    parser.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    parser.add_argument("--metrics-dir", type=Path, default=Path("backend/ml/evaluation"))
    parser.add_argument("--random-state", type=int, default=42)
    return parser.parse_args()


def make_pipeline(features: list[str], estimator) -> Pipeline:
    categorical = [feature for feature in features if feature not in {"Monthly Grocery Bill", "Vehicle Monthly Distance Km", "Waste Bag Weekly Count", "How Long TV PC Daily Hour", "How Many New Clothes Monthly", "How Long Internet Daily Hour"}]
    numeric = [feature for feature in features if feature not in categorical]
    preprocess = ColumnTransformer(
        transformers=[
            ("categorical", Pipeline([
                ("impute", SimpleImputer(strategy="most_frequent")),
                ("encode", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]), categorical),
            ("numeric", Pipeline([("impute", SimpleImputer(strategy="median"))]), numeric),
        ],
        remainder="drop",
        sparse_threshold=0,
    )
    return Pipeline([("preprocess", preprocess), ("model", estimator)])


def metrics(y_true: pd.Series, prediction: np.ndarray) -> dict:
    return {
        "mae_kg_year": round(float(mean_absolute_error(y_true, prediction)), 4),
        "rmse_kg_year": round(float(np.sqrt(mean_squared_error(y_true, prediction))), 4),
        "r2_holdout": round(float(r2_score(y_true, prediction)), 4),
    }


def main() -> None:
    args = parse_args()
    if not args.data.is_file():
        raise SystemExit(f"Dataset not found: {args.data}")

    frame = pd.read_csv(args.data)
    if TARGET not in frame:
        raise SystemExit(f"Expected target column {TARGET!r}, found: {list(frame.columns)}")
    full_features = [column for column in frame.columns if column != TARGET]
    if any(feature not in frame for feature in LEGACY_FEATURES):
        raise SystemExit("The dataset does not contain the expected legacy feature schema.")

    X_train, X_test, y_train, y_test = train_test_split(
        frame, frame[TARGET], test_size=0.2, random_state=args.random_state
    )
    candidates = {
        "hist_gradient_legacy_14": (LEGACY_FEATURES, HistGradientBoostingRegressor(max_iter=300, learning_rate=0.08, l2_regularization=0.25, random_state=args.random_state)),
        "hist_gradient_full_19": (full_features, HistGradientBoostingRegressor(max_iter=350, learning_rate=0.06, l2_regularization=0.25, random_state=args.random_state)),
        "xgboost_full_19": (full_features, XGBRegressor(n_estimators=450, max_depth=6, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0, objective="reg:squarederror", n_jobs=1, random_state=args.random_state, tree_method="hist")),
        "lightgbm_full_19": (full_features, LGBMRegressor(n_estimators=450, num_leaves=31, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0, n_jobs=1, random_state=args.random_state, verbosity=-1)),
        "lightgbm_product_18_no_sex": (PRODUCT_FEATURES, LGBMRegressor(n_estimators=450, num_leaves=31, learning_rate=0.05, subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0, n_jobs=1, random_state=args.random_state, verbosity=-1)),
    }

    results: dict[str, dict] = {}
    fitted: dict[str, Pipeline] = {}
    baseline_prediction = np.full(len(y_test), float(y_train.median()))
    for name, (features, estimator) in candidates.items():
        pipeline = make_pipeline(features, estimator)
        pipeline.fit(X_train[features], y_train)
        result = metrics(y_test, pipeline.predict(X_test[features]))
        result["feature_count"] = len(features)
        results[name] = result
        fitted[name] = pipeline
        print(f"{name}: MAE={result['mae_kg_year']:.2f}, RMSE={result['rmse_kg_year']:.2f}, R2={result['r2_holdout']:.4f}")

    overall_winner = min(results, key=lambda name: results[name]["mae_kg_year"])
    product_candidate = "lightgbm_product_18_no_sex"
    product_features = candidates[product_candidate][0]
    args.models_dir.mkdir(parents=True, exist_ok=True)
    artifact_path = args.models_dir / "annual_carbon_champion.joblib"
    joblib.dump(fitted[product_candidate], artifact_path)

    report = {
        "model_family": "annual_carbon_regression_benchmark",
        "status": "candidate_not_yet_product_approved",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dataset": str(args.data),
        "dataset_sha256": hashlib.sha256(args.data.read_bytes()).hexdigest(),
        "target": TARGET,
        "row_count": int(len(frame)),
        "split": f"random_80_20_random_state_{args.random_state}",
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "baseline_median": metrics(y_test, baseline_prediction),
        "candidates": results,
        "overall_holdout_winner": {
            "name": overall_winner,
            "features": candidates[overall_winner][0],
            "metrics": results[overall_winner],
        },
        "product_candidate": {
            "name": product_candidate,
            "artifact": str(artifact_path),
            "features": product_features,
            "metrics": results[product_candidate],
        },
        "limitations": [
            "All candidates are compared on a single random holdout, not a temporal or user-level split.",
            "The target is annual CarbonEmission, so these metrics do not validate a partial-day projection.",
            "The model requires the full recorded lifestyle schema; do not silently default product inputs.",
            "The product candidate excludes the source dataset's Sex field. Its lower holdout score is the trade-off for not collecting that sensitive field in the app.",
        ],
    }
    args.metrics_dir.mkdir(parents=True, exist_ok=True)
    report_path = args.metrics_dir / "annual_carbon_model_benchmark.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Saved champion artifact: {artifact_path}")
    print(f"Saved benchmark report: {report_path}")


if __name__ == "__main__":
    main()
