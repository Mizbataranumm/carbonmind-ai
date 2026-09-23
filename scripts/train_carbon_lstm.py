"""Train a carbon-emissions LSTM on REAL household energy consumption data.

Data source: UCI Individual Household Electric Power Consumption
  - 2,075,259 minute-level readings from Dec 2006 to Nov 2010
  - Global_active_power (kW) is aggregated to daily kWh
  - Daily kWh is converted to kg CO2 using the EU average grid emission factor

Architecture: 2-layer LSTM  (30 days in → 7 days forecast)
Split: Chronological 80/20 (no data leakage)
"""

from __future__ import annotations

import argparse
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


# ---------- EU average grid emission factor (kg CO2 per kWh) ----------
# Source: European Environment Agency, 2023 average
EMISSION_FACTOR_KG_PER_KWH = 0.233


class CarbonLSTM(nn.Module):
    """Two-layer LSTM for daily carbon emission forecasting."""

    def __init__(self, input_size: int = 1, hidden_size: int = 64,
                 num_layers: int = 2, output_days: int = 7, dropout: float = 0.15):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size, hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(32, output_days),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        lstm_out, _ = self.lstm(x)          # (batch, seq, hidden)
        last_hidden = lstm_out[:, -1, :]    # (batch, hidden)
        return self.head(last_hidden)       # (batch, output_days)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", type=Path,
                   default=Path("data/household_power_consumption.txt"))
    p.add_argument("--models-dir", type=Path,
                   default=Path("backend/ml/models"))
    p.add_argument("--metrics-dir", type=Path,
                   default=Path("backend/ml/evaluation"))
    p.add_argument("--history-days", type=int, default=30,
                   help="Number of past days as input")
    p.add_argument("--forecast-days", type=int, default=7,
                   help="Number of future days to predict")
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--batch-size", type=int, default=64)
    p.add_argument("--lr", type=float, default=1e-3)
    p.add_argument("--hidden-size", type=int, default=64)
    return p.parse_args()


def load_and_aggregate(data_path: Path) -> pd.DataFrame:
    """Load minute-level data and aggregate to daily kg CO2."""
    print(f"Loading {data_path} ...")
    df = pd.read_csv(
        data_path, sep=";", low_memory=False,
        na_values=["?", ""],
    )

    # Parse datetime
    df["datetime"] = pd.to_datetime(
        df["Date"] + " " + df["Time"],
        format="%d/%m/%Y %H:%M:%S",
        errors="coerce",
    )
    df = df.dropna(subset=["datetime", "Global_active_power"])
    df["Global_active_power"] = pd.to_numeric(df["Global_active_power"], errors="coerce")
    df = df.dropna(subset=["Global_active_power"])

    # Aggregate to daily kWh
    # Global_active_power is in kW, each reading is 1 minute = 1/60 hour
    df["date"] = df["datetime"].dt.date
    daily = df.groupby("date")["Global_active_power"].agg(
        total_kw_minutes="sum",
        readings="count",
    ).reset_index()

    # Only keep days with at least 1000 readings (>16 hours of data)
    daily = daily[daily["readings"] >= 1000].copy()
    daily["daily_kwh"] = daily["total_kw_minutes"] / 60.0  # kW * (1 min / 60 min/hr) = kWh
    daily["daily_kg_co2"] = daily["daily_kwh"] * EMISSION_FACTOR_KG_PER_KWH
    daily = daily.sort_values("date").reset_index(drop=True)

    print(f"  Total minute readings: {len(df):,}")
    print(f"  Valid days (>=1000 readings): {len(daily)}")
    print(f"  Date range: {daily['date'].iloc[0]} to {daily['date'].iloc[-1]}")
    print(f"  Avg daily kWh: {daily['daily_kwh'].mean():.2f}")
    print(f"  Avg daily kg CO2: {daily['daily_kg_co2'].mean():.4f}")

    return daily


def create_windows(values: np.ndarray, history: int, forecast: int):
    """Create sliding windows for time-series forecasting."""
    X, Y = [], []
    for i in range(len(values) - history - forecast + 1):
        X.append(values[i : i + history])
        Y.append(values[i + history : i + history + forecast])
    return np.array(X, dtype=np.float32), np.array(Y, dtype=np.float32)


def main() -> None:
    args = parse_args()

    # ---- 1. Load and aggregate ----
    daily = load_and_aggregate(args.data)
    values = daily["daily_kg_co2"].values.astype(np.float32)

    if len(values) < args.history_days + args.forecast_days + 50:
        sys.exit(f"Not enough data: {len(values)} days, need at least "
                 f"{args.history_days + args.forecast_days + 50}")

    # ---- 2. Chronological train/test split (80/20) ----
    split_idx = int(len(values) * 0.8)
    train_values = values[:split_idx]
    test_values = values[split_idx - args.history_days:]  # overlap for context

    # ---- 3. Normalize using ONLY training statistics ----
    train_mean = float(train_values.mean())
    train_std = float(train_values.std())
    print(f"\nNormalization: mean={train_mean:.4f}, std={train_std:.4f}")

    normalize = lambda v: (v - train_mean) / train_std
    denormalize = lambda v: v * train_std + train_mean

    # ---- 4. Create windows ----
    train_X, train_Y = create_windows(
        normalize(train_values), args.history_days, args.forecast_days
    )
    test_X, test_Y = create_windows(
        normalize(test_values), args.history_days, args.forecast_days
    )

    print(f"Train windows: {len(train_X)}")
    print(f"Test windows:  {len(test_X)}")

    # ---- 5. PyTorch setup ----
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    train_dataset = TensorDataset(
        torch.from_numpy(train_X).unsqueeze(-1),  # (N, 30, 1)
        torch.from_numpy(train_Y),                # (N, 7)
    )
    loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)

    model = CarbonLSTM(
        hidden_size=args.hidden_size,
        output_days=args.forecast_days,
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5, verbose=True
    )
    criterion = nn.MSELoss()

    # ---- 6. Training loop ----
    print(f"\nTraining for {args.epochs} epochs...")
    best_loss = float("inf")
    best_state = None

    for epoch in range(args.epochs):
        model.train()
        epoch_loss = 0.0
        for batch_X, batch_Y in loader:
            batch_X, batch_Y = batch_X.to(device), batch_Y.to(device)
            optimizer.zero_grad(set_to_none=True)
            pred = model(batch_X)
            loss = criterion(pred, batch_Y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            epoch_loss += loss.item() * len(batch_X)

        avg_loss = epoch_loss / len(train_dataset)
        scheduler.step(avg_loss)

        if avg_loss < best_loss:
            best_loss = avg_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"  Epoch {epoch+1:3d}/{args.epochs}  loss={avg_loss:.6f}  best={best_loss:.6f}")

    # ---- 7. Evaluate on test set ----
    model.load_state_dict(best_state)
    model.eval()

    with torch.no_grad():
        test_tensor = torch.from_numpy(test_X).unsqueeze(-1).to(device)
        pred_norm = model(test_tensor).cpu().numpy()

    # Denormalize predictions and actuals
    pred_kg = denormalize(pred_norm)
    actual_kg = denormalize(test_Y)

    # Clip negative predictions to 0
    pred_kg = np.maximum(pred_kg, 0.0)

    # ---- 8. Compute metrics ----
    mae = float(mean_absolute_error(actual_kg.ravel(), pred_kg.ravel()))
    rmse = float(np.sqrt(mean_squared_error(actual_kg.ravel(), pred_kg.ravel())))
    r2 = float(r2_score(actual_kg.ravel(), pred_kg.ravel()))

    # MAPE (avoid division by zero)
    mask = actual_kg.ravel() > 0.01
    mape = float(np.mean(np.abs(
        (actual_kg.ravel()[mask] - pred_kg.ravel()[mask]) / actual_kg.ravel()[mask]
    )) * 100)

    # Per-day-ahead metrics
    day_metrics = {}
    for d in range(args.forecast_days):
        day_mae = float(mean_absolute_error(actual_kg[:, d], pred_kg[:, d]))
        day_r2 = float(r2_score(actual_kg[:, d], pred_kg[:, d]))
        day_metrics[f"day_{d+1}"] = {"mae_kg": round(day_mae, 5), "r2": round(day_r2, 5)}

    # Naive baseline: repeat last day of history for all 7 forecast days
    naive_pred = np.tile(denormalize(test_X[:, -1:]), (1, args.forecast_days))
    naive_mae = float(mean_absolute_error(actual_kg.ravel(), naive_pred.ravel()))
    naive_rmse = float(np.sqrt(mean_squared_error(actual_kg.ravel(), naive_pred.ravel())))
    naive_r2 = float(r2_score(actual_kg.ravel(), naive_pred.ravel()))

    print(f"\n{'='*60}")
    print(f"LSTM Results on Test Set ({len(test_X)} windows)")
    print(f"{'='*60}")
    print(f"  MAE:   {mae:.4f} kg CO2/day")
    print(f"  RMSE:  {rmse:.4f} kg CO2/day")
    print(f"  R²:    {r2:.4f}  ({r2*100:.2f}%)")
    print(f"  MAPE:  {mape:.2f}%")
    print(f"\nNaive Baseline (repeat last day):")
    print(f"  MAE:   {naive_mae:.4f} kg CO2/day")
    print(f"  RMSE:  {naive_rmse:.4f} kg CO2/day")
    print(f"  R²:    {naive_r2:.4f}")
    print(f"\nImprovement over naive: MAE {((naive_mae - mae) / naive_mae * 100):.1f}% better")

    # ---- 9. Save model and metrics ----
    args.models_dir.mkdir(parents=True, exist_ok=True)
    args.metrics_dir.mkdir(parents=True, exist_ok=True)

    model_path = args.models_dir / "carbon_lstm_best.pt"
    torch.save({
        "model_state_dict": best_state,
        "train_mean": train_mean,
        "train_std": train_std,
        "history_days": args.history_days,
        "forecast_days": args.forecast_days,
        "hidden_size": args.hidden_size,
        "emission_factor": EMISSION_FACTOR_KG_PER_KWH,
    }, model_path)
    print(f"\nModel saved: {model_path}")

    report = {
        "model_name": "carbon_lstm_daily_forecast",
        "status": "candidate_trained_on_real_data",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_source": "UCI Individual Household Electric Power Consumption",
        "data_url": "https://archive.ics.uci.edu/dataset/235",
        "data_description": "2,075,259 minute-level real power readings from Dec 2006 to Nov 2010",
        "emission_factor_kg_per_kwh": EMISSION_FACTOR_KG_PER_KWH,
        "total_days": int(len(values)),
        "train_days": int(split_idx),
        "test_days": int(len(values) - split_idx),
        "train_windows": int(len(train_X)),
        "test_windows": int(len(test_X)),
        "split": "chronological_80_20_no_leakage",
        "architecture": {
            "type": "LSTM",
            "input_size": 1,
            "hidden_size": args.hidden_size,
            "num_layers": 2,
            "dropout": 0.15,
            "history_days": args.history_days,
            "forecast_days": args.forecast_days,
        },
        "training": {
            "epochs": args.epochs,
            "batch_size": args.batch_size,
            "learning_rate": args.lr,
            "optimizer": "AdamW",
            "scheduler": "ReduceLROnPlateau",
            "best_train_loss": round(best_loss, 6),
        },
        "metrics": {
            "mae_kg_co2_per_day": round(mae, 5),
            "rmse_kg_co2_per_day": round(rmse, 5),
            "r2": round(r2, 5),
            "mape_percent": round(mape, 2),
        },
        "per_day_metrics": day_metrics,
        "naive_baseline": {
            "method": "repeat_last_observed_day",
            "mae_kg_co2_per_day": round(naive_mae, 5),
            "rmse_kg_co2_per_day": round(naive_rmse, 5),
            "r2": round(naive_r2, 5),
        },
        "improvement_over_naive_pct": round((naive_mae - mae) / naive_mae * 100, 2),
        "artifact": str(model_path),
        "limitations": [
            "Trained on a single European household; generalization to other users requires retraining or fine-tuning.",
            "Emission factor is EU-average; region-specific factors should be used in production.",
            "The model forecasts energy-based carbon only; transport, diet, and other sources are not covered.",
            "Chronological split prevents leakage but the test period may have different seasonality.",
        ],
    }

    metrics_path = args.metrics_dir / "carbon_lstm_metrics.json"
    metrics_path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Metrics saved: {metrics_path}")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
