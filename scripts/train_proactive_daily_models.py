"""Train partial-day carbon candidates only from the generated temporal dataset.

This script intentionally rejects tiny datasets and uses a chronological holdout.
It is not connected to API serving until its metrics outperform the transparent
rate baseline on a locked test period.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import lightgbm as lgb
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from build_proactive_daily_dataset import FEATURES, TARGET


def metrics(actual, prediction) -> dict:
    return {
        "mae_kg_day": round(float(mean_absolute_error(actual, prediction)), 5),
        "rmse_kg_day": round(float(mean_squared_error(actual, prediction) ** 0.5), 5),
        "r2": round(float(r2_score(actual, prediction)), 5),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    parser.add_argument("--metrics-dir", type=Path, default=Path("backend/ml/evaluation"))
    parser.add_argument("--pilot", action="store_true", help="Allow an explicitly exploratory small-sample evaluation")
    args = parser.parse_args()

    frame = pd.read_csv(args.data, parse_dates=["date"])
    required = {"user_id", "date", *FEATURES, TARGET}
    missing = sorted(required - set(frame.columns))
    if missing:
        raise SystemExit(f"Rejected {args.data}: missing required columns {missing}.")
    minimum_rows = 12 if args.pilot else 60
    if len(frame) < minimum_rows:
        raise SystemExit(
            f"Rejected training: need at least {minimum_rows} dated examples after feature construction; "
            "collect more real participant history."
        )
    frame = frame.sort_values(["date", "user_id"]).reset_index(drop=True)
    split = int(len(frame) * 0.8)
    train, test = frame.iloc[:split], frame.iloc[split:]
    if test["date"].min() <= train["date"].max():
        # Same-date examples are valid across different users, but moving a
        # boundary date into test prevents a future timestamp entering train.
        boundary = test["date"].min()
        train, test = frame[frame["date"] < boundary], frame[frame["date"] >= boundary]
    minimum_train, minimum_test = (8, 3) if args.pilot else (40, 12)
    if len(train) < minimum_train or len(test) < minimum_test:
        raise SystemExit("Rejected training: chronological split left too few train or test examples.")

    hist = HistGradientBoostingRegressor(max_iter=300, learning_rate=0.05, l2_regularization=0.05, random_state=42).fit(train[FEATURES], train[TARGET])
    lightgbm = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.03, num_leaves=15, random_state=42, n_jobs=1, verbosity=-1).fit(train[FEATURES], train[TARGET])
    hist_prediction, lightgbm_prediction = hist.predict(test[FEATURES]), lightgbm.predict(test[FEATURES])
    hist_metrics, lgb_metrics = metrics(test[TARGET], hist_prediction), metrics(test[TARGET], lightgbm_prediction)
    r2_sum = max(hist_metrics["r2"], 0) + max(lgb_metrics["r2"], 0)
    hist_weight = max(hist_metrics["r2"], 0) / r2_sum if r2_sum else 0.5
    ensemble_prediction = hist_weight * hist_prediction + (1 - hist_weight) * lightgbm_prediction
    rate_prediction = (test["early_transport_kg"] + test["early_electricity_kg"] + test["early_food_kg"] + test["early_devices_kg"] + test["early_other_kg"]) * (24 / test["cutoff_hour"])
    report = {
        "model_name": "proactive_partial_day_hist_gradient_lightgbm_ensemble",
        "status": "exploratory_pilot_not_generalizable" if args.pilot else "candidate_not_served_until_locked_test_review",
        "features": FEATURES,
        "target": TARGET,
        "split": {"type": "chronological", "train_rows": len(train), "test_rows": len(test), "train_end": str(train["date"].max().date()), "test_start": str(test["date"].min().date())},
        "metrics": {"hist_gradient": hist_metrics, "lightgbm": lgb_metrics, "ensemble": metrics(test[TARGET], ensemble_prediction), "rate_baseline": metrics(test[TARGET], rate_prediction)},
        "weights": {"hist_gradient": round(hist_weight, 6), "lightgbm": round(1 - hist_weight, 6)},
        "release_gate": "This pilot must never be served. Train a release candidate only after independent review confirms the ensemble beats the rate baseline on a sufficiently sized locked chronological test set.",
    }
    args.models_dir.mkdir(parents=True, exist_ok=True)
    args.metrics_dir.mkdir(parents=True, exist_ok=True)
    joblib.dump(hist, args.models_dir / "proactive_daily_hist_gradient_candidate.joblib")
    joblib.dump(lightgbm, args.models_dir / "proactive_daily_lightgbm_candidate.joblib")
    (args.metrics_dir / "proactive_daily_candidate_metrics.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
