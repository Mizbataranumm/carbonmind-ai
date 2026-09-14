"""Train a reproducible tabular carbon-emission model.

This script is intentionally separate from the app server. It trains a model,
saves the preprocessing pipeline with the estimator, and writes metrics that the
API/UI can quote only after review.

Usage:
    python scripts/train_carbon_gbdt_pipeline.py \
        --data "Carbon Emission.csv" \
        --out-dir backend/ml/models \
        --metrics-dir backend/ml/evaluation
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone

# HistGradientBoosting can otherwise create worker infrastructure that is not
# available in constrained Windows and CI environments. A caller can override
# this before starting Python when a managed training runner permits it.
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import joblib
import numpy as np
import pandas as pd
from sklearn import __version__ as sklearn_version
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

FEATURES = [
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
TARGET = "CarbonEmission"

CATEGORICAL_FEATURES = [
    "Body Type",
    "Diet",
    "How Often Shower",
    "Heating Energy Source",
    "Transport",
    "Vehicle Type",
    "Frequency of Traveling by Air",
    "Waste Bag Size",
    "Energy efficiency",
]
NUMERIC_FEATURES = [feature for feature in FEATURES if feature not in CATEGORICAL_FEATURES]


def build_pipeline() -> Pipeline:
    numeric = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric, NUMERIC_FEATURES),
            ("cat", categorical, CATEGORICAL_FEATURES),
        ]
    )
    model = HistGradientBoostingRegressor(
        learning_rate=0.05,
        max_iter=400,
        l2_regularization=0.01,
        random_state=42,
    )
    return Pipeline(steps=[("preprocess", preprocessor), ("model", model)])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="Carbon Emission.csv")
    parser.add_argument("--out-dir", default="backend/ml/models")
    parser.add_argument("--metrics-dir", default="backend/ml/evaluation")
    args = parser.parse_args()

    data_path = Path(args.data)
    out_dir = Path(args.out_dir)
    metrics_dir = Path(args.metrics_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    metrics_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(data_path)
    missing = [col for col in FEATURES + [TARGET] if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    X = df[FEATURES].copy()
    y = pd.to_numeric(df[TARGET], errors="coerce")
    valid = y.notna()
    X = X.loc[valid]
    y = y.loc[valid]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
    )

    baseline = float(y_train.median())
    baseline_pred = np.full(shape=len(y_test), fill_value=baseline, dtype=float)

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)

    metrics = {
        "model_name": "daily_carbon_hist_gradient_boosting",
        "status": "candidate_not_yet_product_approved",
        "dataset": str(data_path),
        "dataset_sha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "training_library": {"scikit_learn": sklearn_version},
        "target": TARGET,
        "features": FEATURES,
        "row_count": int(len(df)),
        "train_rows": int(len(X_train)),
        "test_rows": int(len(X_test)),
        "split": "random_80_20_random_state_42",
        "metrics": {
            "mae_kg_year": round(float(mean_absolute_error(y_test, preds)), 4),
            "rmse_kg_year": round(float(np.sqrt(mean_squared_error(y_test, preds))), 4),
            "r2_holdout": round(float(r2_score(y_test, preds)), 4),
            "baseline_median_mae_kg_year": round(float(mean_absolute_error(y_test, baseline_pred)), 4),
        },
        "warnings": [
            "This is a reproducible baseline, not a release approval.",
            "A stronger split should be used if user IDs, collection batches, regions, or dates are available.",
            "Frontend inputs must cover the same feature schema before this model can be considered product-grade.",
        ],
    }

    joblib.dump(pipeline, out_dir / "daily_carbon_pipeline.joblib")
    (metrics_dir / "daily_carbon_gbdt_metrics.json").write_text(
        json.dumps(metrics, indent=2),
        encoding="utf-8",
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
