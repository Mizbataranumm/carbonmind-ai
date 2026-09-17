"""Train a future-emissions LSTM only from genuine user-day observations.

Expected CSV columns: user_id, date, daily_kg. Carbon Emission.csv is rejected
on purpose because it is cross-sectional annual data with no dated history.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import mean_absolute_error, mean_squared_error
from torch import nn
from torch.utils.data import DataLoader, TensorDataset


class CarbonLSTM(nn.Module):
    def __init__(self, hidden_size: int = 64, output_days: int = 7):
        super().__init__()
        self.lstm = nn.LSTM(1, hidden_size, num_layers=2, batch_first=True, dropout=0.15)
        self.head = nn.Sequential(nn.Linear(hidden_size, 32), nn.ReLU(), nn.Linear(32, output_days))

    def forward(self, series: torch.Tensor) -> torch.Tensor:
        values, _ = self.lstm(series)
        return self.head(values[:, -1, :])


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True)
    parser.add_argument("--user-column", default="user_id")
    parser.add_argument("--date-column", default="date")
    parser.add_argument("--target-column", default="daily_kg")
    parser.add_argument("--models-dir", type=Path, default=Path("backend/ml/models"))
    parser.add_argument("--metrics-dir", type=Path, default=Path("backend/ml/evaluation"))
    parser.add_argument("--history-days", type=int, default=30)
    parser.add_argument("--forecast-days", type=int, default=7)
    parser.add_argument("--epochs", type=int, default=35)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    return parser.parse_args()


def _windows(frame: pd.DataFrame, user_column: str, date_column: str, target_column: str, history_days: int, forecast_days: int):
    train_x: list[list[float]] = []
    train_y: list[list[float]] = []
    test_x: list[list[float]] = []
    test_y: list[list[float]] = []
    for user_id, user_data in frame.groupby(user_column, sort=False):
        user_data = user_data.sort_values(date_column)
        gaps = user_data[date_column].diff().dropna().dt.days
        if (gaps != 1).any():
            raise ValueError(f"User {user_id!r} has missing calendar days; do not silently treat missing logs as zero.")
        values = user_data[target_column].to_numpy(dtype=np.float32)
        window_count = len(values) - history_days - forecast_days + 1
        if window_count < 5:
            continue
        cutoff = max(1, int(window_count * 0.8))
        for start in range(window_count):
            features = values[start : start + history_days].tolist()
            target = values[start + history_days : start + history_days + forecast_days].tolist()
            if start < cutoff:
                train_x.append(features)
                train_y.append(target)
            else:
                test_x.append(features)
                test_y.append(target)
    if not train_x or not test_x:
        raise ValueError("Not enough chronological user history for train/test windows. Need at least one user with about 45 consecutive days.")
    return np.asarray(train_x), np.asarray(train_y), np.asarray(test_x), np.asarray(test_y)


def main() -> None:
    args = parse_args()
    frame = pd.read_csv(args.data)
    required = {args.user_column, args.date_column, args.target_column}
    missing = sorted(required - set(frame.columns))
    if missing:
        raise SystemExit(
            f"Rejected {args.data}: missing {missing}. This LSTM requires dated per-user daily observations, not annual profile rows."
        )
    frame = frame[[args.user_column, args.date_column, args.target_column]].copy()
    frame[args.date_column] = pd.to_datetime(frame[args.date_column], errors="coerce", utc=False)
    frame[args.target_column] = pd.to_numeric(frame[args.target_column], errors="coerce")
    if frame.isna().any().any() or (frame[args.target_column] < 0).any():
        raise SystemExit("Time-series data contains missing/negative user IDs, dates, or daily_kg values.")
    if frame.duplicated([args.user_column, args.date_column]).any():
        raise SystemExit("Time-series data has duplicate user/day rows. Deduplicate with an audit trail before training.")

    train_x, train_y, test_x, test_y = _windows(
        frame, args.user_column, args.date_column, args.target_column, args.history_days, args.forecast_days
    )
    scale_min, scale_max = float(train_x.min()), float(train_x.max())
    scale_width = max(scale_max - scale_min, 1e-6)
    normalize = lambda values: (values - scale_min) / scale_width
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    train_data = TensorDataset(
        torch.tensor(normalize(train_x)).unsqueeze(-1), torch.tensor(normalize(train_y))
    )
    model = CarbonLSTM(output_days=args.forecast_days).to(device)
    loader = DataLoader(train_data, batch_size=args.batch_size, shuffle=True)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=1e-4)
    criterion = nn.MSELoss()
    for epoch in range(args.epochs):
        model.train()
        for features, target in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(features.to(device)), target.to(device))
            loss.backward()
            optimizer.step()
        if (epoch + 1) % 5 == 0 or epoch == 0:
            print(f"epoch={epoch + 1}/{args.epochs} loss={float(loss):.6f}")

    model.eval()
    with torch.no_grad():
        prediction = model(torch.tensor(normalize(test_x)).unsqueeze(-1).to(device)).cpu().numpy()
    prediction = prediction * scale_width + scale_min
    seasonal_naive = test_x[:, -args.forecast_days:]
    def metric_block(actual, forecast):
        return {
            "mae_kg_day": round(float(mean_absolute_error(actual.ravel(), forecast.ravel())), 5),
            "rmse_kg_day": round(float(np.sqrt(mean_squared_error(actual.ravel(), forecast.ravel()))), 5),
            "mape_percent": round(float(np.mean(np.abs((actual - forecast) / np.maximum(actual, 0.01))) * 100), 5),
        }
    report = {
        "model_name": "carbon_lstm_user_day_forecast",
        "status": "candidate_not_yet_product_approved",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "input_contract": {"user_id": args.user_column, "date": args.date_column, "daily_kg": args.target_column},
        "split": "chronological 80/20 windows within each user",
        "history_days": args.history_days,
        "forecast_days": args.forecast_days,
        "train_windows": int(len(train_x)),
        "test_windows": int(len(test_x)),
        "metrics": metric_block(test_y, prediction),
        "seasonal_naive_baseline": metric_block(test_y, seasonal_naive),
        "limitations": ["Metrics are valid only for the supplied users and time range.", "Do not promote without rolling-origin backtests and prediction-interval coverage."],
    }
    args.models_dir.mkdir(parents=True, exist_ok=True)
    args.metrics_dir.mkdir(parents=True, exist_ok=True)
    artifact = args.models_dir / "future_lstm_candidate.pt"
    torch.save({"model_state_dict": model.cpu().state_dict(), "val_min": scale_min, "val_max": scale_max, "seq_in": args.history_days, "seq_out": args.forecast_days}, artifact)
    report["artifact"] = str(artifact)
    (args.metrics_dir / "future_lstm_candidate_metrics.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
