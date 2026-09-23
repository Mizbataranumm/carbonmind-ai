"""P2: Annual carbon model deep analysis.

Performs:
A. Feature importance (LightGBM gain and split counts)
B. SHAP analysis (TreeExplainer, 500 random samples)
C. Feature ablation (4 reduced feature sets vs full model, same 5-fold protocol)
D. OLS 5-fold CV as additional baseline (confirms synthetic origin)
E. Residual analysis (actual vs predicted, residuals by emission tertile)

All CV uses the same 5-fold protocol (KFold, shuffle=True, random_state=42)
as the previous audit — identical folds for fair comparison.
"""

from __future__ import annotations

import json
import os
import warnings
from pathlib import Path

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.impute import SimpleImputer

DATA_PATH = Path("Carbon Emission.csv")
TARGET = "CarbonEmission"
RANDOM_STATE = 42
N_SPLITS = 5

FULL_FEATURES = [
    "Body Type", "Sex", "Diet", "How Often Shower", "Heating Energy Source",
    "Transport", "Vehicle Type", "Social Activity", "Monthly Grocery Bill",
    "Frequency of Traveling by Air", "Vehicle Monthly Distance Km",
    "Waste Bag Size", "Waste Bag Weekly Count", "How Long TV PC Daily Hour",
    "How Many New Clothes Monthly", "How Long Internet Daily Hour",
    "Energy efficiency", "Recycling", "Cooking_With",
]
PRIVACY_18 = [f for f in FULL_FEATURES if f != "Sex"]
NUMERIC_COLS = [
    "Monthly Grocery Bill", "Vehicle Monthly Distance Km", "Waste Bag Weekly Count",
    "How Long TV PC Daily Hour", "How Many New Clothes Monthly", "How Long Internet Daily Hour",
]

# Ablation groups
ABLATION_SETS = {
    "no_transport": [f for f in FULL_FEATURES if f not in (
        "Transport", "Vehicle Type", "Vehicle Monthly Distance Km"
    )],
    "no_food": [f for f in FULL_FEATURES if f not in (
        "Diet", "Monthly Grocery Bill"
    )],
    "no_digital": [f for f in FULL_FEATURES if f not in (
        "How Long TV PC Daily Hour", "How Long Internet Daily Hour"
    )],
    "minimal_10": [
        "Diet", "Transport", "Vehicle Monthly Distance Km",
        "Frequency of Traveling by Air", "Heating Energy Source",
        "Waste Bag Weekly Count", "Waste Bag Size", "Energy efficiency",
        "How Many New Clothes Monthly", "Monthly Grocery Bill",
    ],
}


def make_ordinal_preprocessor(features: list[str]) -> ColumnTransformer:
    cat_cols = [f for f in features if f not in NUMERIC_COLS]
    num_cols = [f for f in features if f in NUMERIC_COLS]
    transformers = []
    if cat_cols:
        transformers.append((
            "cat",
            Pipeline([
                ("imp", SimpleImputer(strategy="most_frequent")),
                ("enc", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1)),
            ]),
            cat_cols,
        ))
    if num_cols:
        transformers.append((
            "num",
            Pipeline([
                ("imp", SimpleImputer(strategy="median")),
                ("sc", StandardScaler()),
            ]),
            num_cols,
        ))
    return ColumnTransformer(transformers, remainder="drop", sparse_threshold=0)


def make_ohe_preprocessor(features: list[str]) -> ColumnTransformer:
    from sklearn.preprocessing import OneHotEncoder
    cat_cols = [f for f in features if f not in NUMERIC_COLS]
    num_cols = [f for f in features if f in NUMERIC_COLS]
    transformers = []
    if cat_cols:
        transformers.append((
            "cat",
            Pipeline([
                ("imp", SimpleImputer(strategy="most_frequent")),
                ("enc", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
            ]),
            cat_cols,
        ))
    if num_cols:
        transformers.append((
            "num",
            Pipeline([
                ("imp", SimpleImputer(strategy="median")),
                ("sc", StandardScaler()),
            ]),
            num_cols,
        ))
    return ColumnTransformer(transformers, remainder="drop", sparse_threshold=0)


def cv_metrics(df: pd.DataFrame, features: list[str], model_factory,
               use_ohe: bool = False) -> dict:
    kf = KFold(n_splits=N_SPLITS, shuffle=True, random_state=RANDOM_STATE)
    mae_list, rmse_list, r2_list = [], [], []
    all_preds, all_true = [], []

    for train_idx, val_idx in kf.split(df):
        train_df, val_df = df.iloc[train_idx], df.iloc[val_idx]
        pre = make_ohe_preprocessor(features) if use_ohe else make_ordinal_preprocessor(features)
        pipe = Pipeline([("pre", pre), ("est", model_factory())])
        pipe.fit(train_df[features], train_df[TARGET])
        preds = pipe.predict(val_df[features])
        mae_list.append(float(mean_absolute_error(val_df[TARGET], preds)))
        rmse_list.append(float(np.sqrt(mean_squared_error(val_df[TARGET], preds))))
        r2_list.append(float(r2_score(val_df[TARGET], preds)))
        all_preds.extend(preds.tolist())
        all_true.extend(val_df[TARGET].tolist())

    return {
        "mae_mean": round(np.mean(mae_list), 4),
        "mae_std": round(np.std(mae_list, ddof=1), 4),
        "rmse_mean": round(np.mean(rmse_list), 4),
        "rmse_std": round(np.std(rmse_list, ddof=1), 4),
        "r2_mean": round(np.mean(r2_list), 4),
        "r2_std": round(np.std(r2_list, ddof=1), 4),
        "fold_maes": [round(x, 4) for x in mae_list],
        "fold_r2s": [round(x, 4) for x in r2_list],
        "_all_preds": all_preds,
        "_all_true": all_true,
    }


def train_lgbm_full(df: pd.DataFrame) -> tuple:
    """Train LightGBM on full data once to extract feature importance + SHAP."""
    pre = make_ordinal_preprocessor(FULL_FEATURES)
    X = pre.fit_transform(df[FULL_FEATURES])
    y = df[TARGET].values
    lgbm = LGBMRegressor(
        n_estimators=450, num_leaves=31, learning_rate=0.05,
        subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
        n_jobs=1, random_state=RANDOM_STATE, verbosity=-1,
    )
    lgbm.fit(X, y)
    return lgbm, pre, X, y


def feature_importance_analysis(lgbm, pre: ColumnTransformer) -> dict:
    """Extract LightGBM feature importances with feature names."""
    # Recover feature names from the preprocessor
    feature_names = []
    for name, transformer, cols in pre.transformers_:
        if name == "cat":
            enc = transformer.named_steps["enc"]
            feature_names.extend(cols)  # OrdinalEncoder: one column per input
        elif name == "num":
            feature_names.extend(cols)

    importance_gain = lgbm.feature_importances_
    importance_split = lgbm.booster_.feature_importance(importance_type="split")

    sorted_gain = sorted(
        zip(feature_names, importance_gain.tolist()),
        key=lambda x: x[1], reverse=True
    )
    sorted_split = sorted(
        zip(feature_names, importance_split.tolist()),
        key=lambda x: x[1], reverse=True
    )

    return {
        "by_gain": [(name, round(val, 2)) for name, val in sorted_gain],
        "by_split": [(name, int(val)) for name, val in sorted_split],
        "top_10_by_gain": [(name, round(val, 2)) for name, val in sorted_gain[:10]],
        "top_10_by_split": [(name, int(val)) for name, val in sorted_split[:10]],
        "bottom_5_by_gain": [(name, round(val, 2)) for name, val in sorted_gain[-5:]],
    }


def shap_analysis(lgbm, X: np.ndarray, y: np.ndarray,
                  pre: ColumnTransformer, n_samples: int = 500) -> dict:
    """Compute SHAP values for a random subsample."""
    try:
        import shap
    except ImportError:
        return {"error": "shap not installed; run: pip install shap"}

    rng = np.random.default_rng(RANDOM_STATE)
    idx = rng.choice(len(X), size=min(n_samples, len(X)), replace=False)
    X_sample = X[idx]
    y_sample = y[idx]

    explainer = shap.TreeExplainer(lgbm)
    shap_values = explainer.shap_values(X_sample)

    # Recover feature names
    feature_names = []
    for name, transformer, cols in pre.transformers_:
        if name in ("cat", "num"):
            feature_names.extend(cols)

    mean_abs_shap = np.abs(shap_values).mean(axis=0)
    shap_ranking = sorted(
        zip(feature_names, mean_abs_shap.tolist()),
        key=lambda x: x[1], reverse=True
    )

    # Tertile SHAP breakdown
    tertile_33 = np.percentile(y_sample, 33)
    tertile_67 = np.percentile(y_sample, 67)
    low_mask = y_sample <= tertile_33
    mid_mask = (y_sample > tertile_33) & (y_sample <= tertile_67)
    high_mask = y_sample > tertile_67

    def tertile_shap(mask):
        if mask.sum() == 0:
            return {}
        vals = np.abs(shap_values[mask]).mean(axis=0)
        ranked = sorted(zip(feature_names, vals.tolist()), key=lambda x: x[1], reverse=True)
        return [(n, round(v, 4)) for n, v in ranked[:5]]

    return {
        "n_samples": len(X_sample),
        "mean_abs_shap_ranking": [(n, round(v, 5)) for n, v in shap_ranking],
        "top_10_by_shap": [(n, round(v, 5)) for n, v in shap_ranking[:10]],
        "near_zero_shap_features": [(n, round(v, 5)) for n, v in shap_ranking if v < 1.0],
        "tertile_breakdown": {
            "low_emitters": {"n": int(low_mask.sum()), "top5": tertile_shap(low_mask)},
            "mid_emitters": {"n": int(mid_mask.sum()), "top5": tertile_shap(mid_mask)},
            "high_emitters": {"n": int(high_mask.sum()), "top5": tertile_shap(high_mask)},
        },
    }


def residual_analysis(preds: list[float], true: list[float]) -> dict:
    """Analyze residuals by emission tertile."""
    preds_arr = np.array(preds)
    true_arr = np.array(true)
    residuals = preds_arr - true_arr

    tertile_33 = np.percentile(true_arr, 33)
    tertile_67 = np.percentile(true_arr, 67)

    def tertile_stats(mask: np.ndarray, name: str) -> dict:
        return {
            "group": name,
            "n": int(mask.sum()),
            "mae": round(float(np.abs(residuals[mask]).mean()), 4),
            "rmse": round(float(np.sqrt((residuals[mask] ** 2).mean())), 4),
            "mean_residual": round(float(residuals[mask].mean()), 4),
            "std_residual": round(float(residuals[mask].std()), 4),
            "max_overestimate": round(float(residuals[mask].max()), 4),
            "max_underestimate": round(float(residuals[mask].min()), 4),
        }

    low_mask = true_arr <= tertile_33
    mid_mask = (true_arr > tertile_33) & (true_arr <= tertile_67)
    high_mask = true_arr > tertile_67

    return {
        "overall": {
            "mae": round(float(np.abs(residuals).mean()), 4),
            "rmse": round(float(np.sqrt((residuals ** 2).mean())), 4),
            "mean_residual": round(float(residuals.mean()), 4),
            "std_residual": round(float(residuals.std()), 4),
            "correlation_residual_vs_predicted": round(
                float(np.corrcoef(preds_arr, residuals)[0, 1]), 4
            ),
        },
        "by_tertile": [
            tertile_stats(low_mask, f"low (<={tertile_33:.0f} kg/yr)"),
            tertile_stats(mid_mask, f"mid ({tertile_33:.0f}–{tertile_67:.0f} kg/yr)"),
            tertile_stats(high_mask, f"high (>{tertile_67:.0f} kg/yr)"),
        ],
    }


def main():
    if not DATA_PATH.is_file():
        raise SystemExit(f"Missing {DATA_PATH}")
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded {len(df)} rows from {DATA_PATH}")

    # ─── A. Feature importance ───────────────────────────────────────────────
    print("\n[A] Training LightGBM on full data for feature importance...")
    lgbm, pre, X_all, y_all = train_lgbm_full(df)
    fi = feature_importance_analysis(lgbm, pre)
    print("  Top-10 by gain:")
    for name, val in fi["top_10_by_gain"]:
        print(f"    {name:<35} gain={val:>10.1f}")

    # ─── B. SHAP ─────────────────────────────────────────────────────────────
    print("\n[B] Computing SHAP values (500 samples)...")
    shap_results = shap_analysis(lgbm, X_all, y_all, pre, n_samples=500)
    if "error" not in shap_results:
        print("  Top-10 by mean |SHAP|:")
        for name, val in shap_results["top_10_by_shap"]:
            print(f"    {name:<35} mean|SHAP|={val:.3f}")
        near_zero = shap_results.get("near_zero_shap_features", [])
        if near_zero:
            print(f"  Near-zero SHAP features: {[n for n, _ in near_zero]}")
    else:
        print(f"  SHAP skipped: {shap_results['error']}")

    # ─── C. OLS 5-fold baseline ───────────────────────────────────────────────
    print("\n[C] OLS 5-fold CV baseline...")
    ols_cv = cv_metrics(df, FULL_FEATURES,
                        lambda: LinearRegression(), use_ohe=True)
    print(f"  OLS: MAE={ols_cv['mae_mean']:.2f}±{ols_cv['mae_std']:.2f}  "
          f"R²={ols_cv['r2_mean']:.4f}±{ols_cv['r2_std']:.4f}")

    # ─── D. Feature ablation CV ───────────────────────────────────────────────
    print("\n[D] Feature ablation (5-fold CV per set)...")
    def lgbm_factory():
        return LGBMRegressor(
            n_estimators=450, num_leaves=31, learning_rate=0.05,
            subsample=0.9, colsample_bytree=0.9, reg_lambda=1.0,
            n_jobs=1, random_state=RANDOM_STATE, verbosity=-1,
        )

    ablation_results = {}
    # Full model as reference
    full_cv = cv_metrics(df, FULL_FEATURES, lgbm_factory)
    privacy_cv = cv_metrics(df, PRIVACY_18, lgbm_factory)
    ablation_results["full_19"] = {
        "features": FULL_FEATURES, "n_features": len(FULL_FEATURES),
        **{k: v for k, v in full_cv.items() if not k.startswith("_")},
    }
    ablation_results["privacy_18_no_sex"] = {
        "features": PRIVACY_18, "n_features": len(PRIVACY_18),
        **{k: v for k, v in privacy_cv.items() if not k.startswith("_")},
    }
    for name, features in ABLATION_SETS.items():
        valid_feats = [f for f in features if f in FULL_FEATURES]
        print(f"  [{name}] {len(valid_feats)} features...")
        res = cv_metrics(df, valid_feats, lgbm_factory)
        ablation_results[name] = {
            "features": valid_feats, "n_features": len(valid_feats),
            "removed_from_full": [f for f in FULL_FEATURES if f not in valid_feats],
            **{k: v for k, v in res.items() if not k.startswith("_")},
        }
        print(f"    MAE={res['mae_mean']:.2f}±{res['mae_std']:.2f}  "
              f"R²={res['r2_mean']:.4f}±{res['r2_std']:.4f}")

    # ─── E. Residual analysis (full model OOF predictions) ───────────────────
    print("\n[E] Residual analysis (full LightGBM OOF predictions)...")
    residuals = residual_analysis(full_cv["_all_preds"], full_cv["_all_true"])
    print(f"  Overall MAE={residuals['overall']['mae']:.2f}  "
          f"residual-pred corr={residuals['overall']['correlation_residual_vs_predicted']:.4f}")
    for t in residuals["by_tertile"]:
        print(f"  {t['group']}: MAE={t['mae']:.2f}, bias={t['mean_residual']:.2f}")

    # ─── Save all results ─────────────────────────────────────────────────────
    output = {
        "generated_at": pd.Timestamp.now(tz="UTC").isoformat(),
        "dataset": str(DATA_PATH),
        "n_samples": len(df),
        "cv_protocol": f"{N_SPLITS}-fold KFold, shuffle=True, random_state={RANDOM_STATE}",
        "feature_importance": fi,
        "shap_analysis": shap_results,
        "ols_5fold_baseline": {k: v for k, v in ols_cv.items() if not k.startswith("_")},
        "ablation_results": ablation_results,
        "residual_analysis": residuals,
        "interpretation": {
            "ols_r2_confirms_synthetic": (
                f"OLS 5-fold R²={ols_cv['r2_mean']:.4f} ± {ols_cv['r2_std']:.4f}. "
                "A simple linear model recovering this much variance confirms the target "
                "was constructed from an additive linear formula."
            ),
            "feature_ablation_interpretation": (
                "MAE change from removing feature groups shows relative contribution. "
                "If removing a group raises MAE significantly, that group is genuinely "
                "predictive within this synthetic dataset."
            ),
        },
    }

    out_path = Path("backend/ml/evaluation/annual_carbon_deep_analysis.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    print(f"\nResults saved to {out_path}")


if __name__ == "__main__":
    main()
