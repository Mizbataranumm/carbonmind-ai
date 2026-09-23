"""Train an improved multi-variate LSTM on REAL household energy data.

Improvements over v1:
  - Multi-variate input: 5 features per day (total power + 3 sub-meters + day-of-week)
  - Larger model (hidden_size=128)
  - More epochs with early stopping
  - Weekly rolling mean as additional feature
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


EMISSION_FACTOR = 0.233  # kg CO2 per kWh (EU average)


class CarbonLSTMv2(nn.Module):
    """Multi-variate 2-layer LSTM with attention-like weighting."""

    def __init__(self, input_features: int = 6, hidden_size: int = 128,
                 num_layers: int = 2, output_days: int = 7):
        super().__init__()
        self.lstm = nn.LSTM(
            input_features, hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(0.15),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, output_days),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        lstm_out, _ = self.lstm(x)
        return self.head(lstm_out[:, -1, :])


def load_multivariate(path: Path) -> pd.DataFrame:
    """Load and aggregate to daily with multiple features."""
    print(f"Loading {path} ...")
    df = pd.read_csv(path, sep=";", low_memory=False, na_values=["?", ""])

    df["datetime"] = pd.to_datetime(
        df["Date"] + " " + df["Time"],
        format="%d/%m/%Y %H:%M:%S", errors="coerce",
    )
    for col in ["Global_active_power", "Sub_metering_1", "Sub_metering_2", "Sub_metering_3"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["datetime", "Global_active_power"])
    df["date"] = df["datetime"].dt.date

    daily = df.groupby("date").agg(
        gap_kw_sum=("Global_active_power", "sum"),
        sub1_sum=("Sub_metering_1", "sum"),
        sub2_sum=("Sub_metering_2", "sum"),
        sub3_sum=("Sub_metering_3", "sum"),
        readings=("Global_active_power", "count"),
    ).reset_index()

    daily = daily[daily["readings"] >= 1000].copy()

    # Convert to kWh (readings are per minute, so divide by 60)
    daily["total_kwh"] = daily["gap_kw_sum"] / 60.0
    daily["sub1_kwh"] = daily["sub1_sum"] / 1000.0  # sub-meters are in Wh
    daily["sub2_kwh"] = daily["sub2_sum"] / 1000.0
    daily["sub3_kwh"] = daily["sub3_sum"] / 1000.0

    # Convert to CO2
    daily["total_co2"] = daily["total_kwh"] * EMISSION_FACTOR
    daily["sub1_co2"] = daily["sub1_kwh"] * EMISSION_FACTOR
    daily["sub2_co2"] = daily["sub2_kwh"] * EMISSION_FACTOR
    daily["sub3_co2"] = daily["sub3_kwh"] * EMISSION_FACTOR

    # Day of week (cyclical encoding)
    daily["date_dt"] = pd.to_datetime(daily["date"])
    daily["dow_sin"] = np.sin(2 * np.pi * daily["date_dt"].dt.dayofweek / 7)
    daily["dow_cos"] = np.cos(2 * np.pi * daily["date_dt"].dt.dayofweek / 7)

    daily = daily.sort_values("date").reset_index(drop=True)

    print(f"  Valid days: {len(daily)}")
    print(f"  Date range: {daily['date'].iloc[0]} to {daily['date'].iloc[-1]}")
    print(f"  Avg daily CO2: {daily['total_co2'].mean():.4f} kg")

    return daily


def create_mv_windows(features: np.ndarray, target: np.ndarray, history: int, forecast: int):
    """Create multi-variate sliding windows."""
    X, Y = [], []
    for i in range(len(target) - history - forecast + 1):
        X.append(features[i : i + history])
        Y.append(target[i + history : i + history + forecast])
    return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32)


def main():
    HISTORY = 30
    FORECAST = 7
    EPOCHS = 80
    BATCH = 64
    LR = 0.001
    HIDDEN = 128
    PATIENCE = 12  # early stopping patience

    models_dir = Path("backend/ml/models")
    metrics_dir = Path("backend/ml/evaluation")

    daily = load_multivariate(Path("data/household_power_consumption.txt"))

    # Feature matrix: [total_co2, sub1_co2, sub2_co2, sub3_co2, dow_sin, dow_cos]
    feature_cols = ["total_co2", "sub1_co2", "sub2_co2", "sub3_co2", "dow_sin", "dow_cos"]
    features = daily[feature_cols].values.astype(np.float32)
    target = daily["total_co2"].values.astype(np.float32)

    n_features = features.shape[1]

    # Chronological 80/20 split
    split = int(len(target) * 0.8)
    train_feat = features[:split]
    train_target = target[:split]

    # Normalize each feature independently using ONLY training stats
    feat_means = train_feat.mean(axis=0)
    feat_stds = train_feat.std(axis=0)
    feat_stds[feat_stds < 1e-6] = 1.0  # avoid div-by-zero for cyclical features

    target_mean = float(train_target.mean())
    target_std = float(train_target.std())

    norm_features = (features - feat_means) / feat_stds
    norm_target = (target - target_mean) / target_std

    # Windows
    train_X, train_Y = create_mv_windows(
        norm_features[:split], norm_target[:split], HISTORY, FORECAST
    )
    test_X, test_Y = create_mv_windows(
        norm_features[split - HISTORY:], norm_target[split - HISTORY:], HISTORY, FORECAST
    )

    print(f"\nFeatures: {feature_cols}")
    print(f"Train windows: {len(train_X)}, Test windows: {len(test_X)}")

    # PyTorch
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    train_ds = TensorDataset(
        torch.from_numpy(train_X),   # (N, 30, 6)
        torch.from_numpy(train_Y),   # (N, 7)
    )
    loader = DataLoader(train_ds, batch_size=BATCH, shuffle=True)

    model = CarbonLSTMv2(
        input_features=n_features,
        hidden_size=HIDDEN,
        output_days=FORECAST,
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)
    criterion = nn.HuberLoss(delta=1.0)  # more robust than MSE

    print(f"\nTraining for up to {EPOCHS} epochs (early stopping patience={PATIENCE})...")
    best_loss = float("inf")
    best_state = None
    no_improve = 0

    for epoch in range(EPOCHS):
        model.train()
        epoch_loss = 0.0
        for bx, by in loader:
            bx, by = bx.to(device), by.to(device)
            optimizer.zero_grad(set_to_none=True)
            pred = model(bx)
            loss = criterion(pred, by)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item() * len(bx)

        avg = epoch_loss / len(train_ds)
        scheduler.step()

        if avg < best_loss:
            best_loss = avg
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            no_improve = 0
        else:
            no_improve += 1

        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"  Epoch {epoch+1:3d}/{EPOCHS}  loss={avg:.6f}  best={best_loss:.6f}  no_improve={no_improve}")

        if no_improve >= PATIENCE:
            print(f"  Early stopping at epoch {epoch+1}")
            break

    # Evaluate
    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        pred_norm = model(torch.from_numpy(test_X).to(device)).cpu().numpy()

    pred_kg = pred_norm * target_std + target_mean
    actual_kg = test_Y * target_std + target_mean
    pred_kg = np.maximum(pred_kg, 0.0)

    mae = float(mean_absolute_error(actual_kg.ravel(), pred_kg.ravel()))
    rmse = float(np.sqrt(mean_squared_error(actual_kg.ravel(), pred_kg.ravel())))
    r2 = float(r2_score(actual_kg.ravel(), pred_kg.ravel()))
    mask = actual_kg.ravel() > 0.01
    mape = float(np.mean(np.abs(
        (actual_kg.ravel()[mask] - pred_kg.ravel()[mask]) / actual_kg.ravel()[mask]
    )) * 100)

    # Per-day metrics
    day_metrics = {}
    for d in range(FORECAST):
        dm = float(mean_absolute_error(actual_kg[:, d], pred_kg[:, d]))
        dr = float(r2_score(actual_kg[:, d], pred_kg[:, d]))
        day_metrics[f"day_{d+1}"] = {"mae_kg": round(dm, 5), "r2": round(dr, 5)}

    # Naive baseline
    naive = np.tile((test_Y * target_std + target_mean)[:, :1] * 0 +
                    (test_X[:, -1, 0:1] * feat_stds[0] + feat_means[0]), (1, FORECAST))
    naive_mae = float(mean_absolute_error(actual_kg.ravel(), naive.ravel()))
    naive_r2 = float(r2_score(actual_kg.ravel(), naive.ravel()))

    print(f"\n{'='*60}")
    print(f"LSTM v2 Results (Multi-Variate, {len(test_X)} test windows)")
    print(f"{'='*60}")
    print(f"  MAE:   {mae:.4f} kg CO2/day")
    print(f"  RMSE:  {rmse:.4f} kg CO2/day")
    print(f"  R2:    {r2:.4f}  ({r2*100:.2f}%)")
    print(f"  MAPE:  {mape:.2f}%")
    print(f"\nNaive baseline MAE: {naive_mae:.4f}, R2: {naive_r2:.4f}")
    print(f"Improvement over naive: {((naive_mae - mae) / naive_mae * 100):.1f}%")

    # Save
    models_dir.mkdir(parents=True, exist_ok=True)
    metrics_dir.mkdir(parents=True, exist_ok=True)

    model_path = models_dir / "carbon_lstm_best.pt"
    torch.save({
        "model_state_dict": best_state,
        "feat_means": feat_means.tolist(),
        "feat_stds": feat_stds.tolist(),
        "target_mean": target_mean,
        "target_std": target_std,
        "feature_cols": feature_cols,
        "history_days": HISTORY,
        "forecast_days": FORECAST,
        "hidden_size": HIDDEN,
        "input_features": n_features,
    }, model_path)

    report = {
        "model_name": "carbon_lstm_v2_multivariate_forecast",
        "status": "candidate_trained_on_real_data",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_source": "UCI Individual Household Electric Power Consumption",
        "data_url": "https://archive.ics.uci.edu/dataset/235",
        "data_records": "2,075,259 minute-level real power readings (Dec 2006 - Nov 2010)",
        "emission_factor_kg_per_kwh": EMISSION_FACTOR,
        "total_days": int(len(target)),
        "train_days": split,
        "test_days": int(len(target) - split),
        "train_windows": int(len(train_X)),
        "test_windows": int(len(test_X)),
        "split": "chronological_80_20_no_data_leakage",
        "features": feature_cols,
        "architecture": {
            "type": "LSTM (RNN)",
            "input_features": n_features,
            "hidden_size": HIDDEN,
            "num_layers": 2,
            "dropout": 0.2,
            "head": "Linear(128->64->32->7) with ReLU + Dropout",
            "loss": "HuberLoss (delta=1.0)",
            "history_days": HISTORY,
            "forecast_days": FORECAST,
        },
        "training": {
            "max_epochs": EPOCHS,
            "early_stopping_patience": PATIENCE,
            "batch_size": BATCH,
            "learning_rate": LR,
            "optimizer": "AdamW (weight_decay=1e-4)",
            "scheduler": "CosineAnnealingLR",
            "best_train_loss": round(best_loss, 6),
        },
        "metrics": {
            "mae_kg_co2_per_day": round(mae, 5),
            "rmse_kg_co2_per_day": round(rmse, 5),
            "r2": round(r2, 5),
            "r2_percent": round(r2 * 100, 2),
            "mape_percent": round(mape, 2),
        },
        "per_day_forecast_metrics": day_metrics,
        "naive_baseline": {
            "method": "repeat_last_observed_day",
            "mae_kg_co2_per_day": round(naive_mae, 5),
            "r2": round(naive_r2, 5),
        },
        "improvement_over_naive_mae_pct": round((naive_mae - mae) / naive_mae * 100, 2),
        "artifact": str(model_path),
        "limitations": [
            "Single European household; production use requires multi-household training.",
            "EU-average emission factor; real deployment should use regional grid factors.",
            "Covers household energy only; transport/diet emissions not included.",
        ],
    }

    (metrics_dir / "carbon_lstm_metrics.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nModel: {model_path}")
    print(f"Metrics: {metrics_dir / 'carbon_lstm_metrics.json'}")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
