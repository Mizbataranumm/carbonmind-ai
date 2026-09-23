"""Train CarbonForecastLSTM on UCI Household Energy data to activate future_lstm_candidate.

This trains the exact CarbonForecastLSTM architecture expected by backend/ml_service.py,
validates on a chronological test set, and produces:
  - backend/ml/models/future_lstm_candidate.pt
  - backend/ml/evaluation/future_lstm_candidate_metrics.json
"""
import json
import numpy as np
import pandas as pd
import torch
from torch import nn
from torch.utils.data import DataLoader, TensorDataset
from datetime import datetime, timezone
from pathlib import Path
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

EMISSION_FACTOR = 0.233  # kg CO2 / kWh

class CarbonForecastLSTM(nn.Module):
    def __init__(self, hidden_size: int = 64, output_days: int = 7):
        super().__init__()
        self.lstm = nn.LSTM(1, hidden_size, num_layers=2, batch_first=True, dropout=0.15)
        self.head = nn.Sequential(nn.Linear(hidden_size, 32), nn.ReLU(), nn.Linear(32, output_days))

    def forward(self, series: torch.Tensor) -> torch.Tensor:
        values, _ = self.lstm(series)
        return self.head(values[:, -1, :])

def main():
    data_path = Path("data/household_power_consumption.txt")
    if not data_path.exists():
        print(f"Data not found: {data_path}")
        return

    print("Loading UCI household power consumption data...")
    df = pd.read_csv(
        data_path,
        sep=";",
        low_memory=False,
        na_values=["?"],
        usecols=["Date", "Time", "Global_active_power"],
    )
    df["datetime"] = pd.to_datetime(df["Date"] + " " + df["Time"], format="%d/%m/%Y %H:%M:%S")
    df = df.dropna(subset=["Global_active_power"])
    df["Global_active_power"] = pd.to_numeric(df["Global_active_power"])

    # Aggregate to daily kWh and kg CO2
    df["kWh"] = df["Global_active_power"] / 60.0
    daily = df.groupby(df["datetime"].dt.date)["kWh"].sum().reset_index()
    daily.columns = ["date", "kwh"]
    daily["daily_kg"] = (daily["kwh"] * EMISSION_FACTOR).round(4)
    daily = daily[daily["kwh"] > 0].sort_values("date").reset_index(drop=True)

    values = daily["daily_kg"].to_numpy(dtype=np.float32)
    history_days = 30
    forecast_days = 7

    # Sliding windows
    X_all, Y_all = [], []
    for i in range(len(values) - history_days - forecast_days + 1):
        X_all.append(values[i : i + history_days])
        Y_all.append(values[i + history_days : i + history_days + forecast_days])
    X_all = np.array(X_all, dtype=np.float32)
    Y_all = np.array(Y_all, dtype=np.float32)

    # Chronological 80/20 split
    split = int(len(X_all) * 0.8)
    train_X, test_X = X_all[:split], X_all[split:]
    train_Y, test_Y = Y_all[:split], Y_all[split:]

    val_min = float(train_X.min())
    val_max = float(train_X.max())
    scale_width = max(val_max - val_min, 1e-6)

    def normalize(arr):
        return (arr - val_min) / scale_width

    train_X_norm = normalize(train_X)
    train_Y_norm = normalize(train_Y)
    test_X_norm = normalize(test_X)

    torch.manual_seed(42)
    np.random.seed(42)

    model = CarbonForecastLSTM(hidden_size=64, output_days=7)
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=5)
    criterion = nn.SmoothL1Loss()

    dataset = TensorDataset(
        torch.tensor(train_X_norm).unsqueeze(-1),
        torch.tensor(train_Y_norm),
    )
    loader = DataLoader(dataset, batch_size=64, shuffle=True)

    print("Training CarbonForecastLSTM...")
    best_loss = float("inf")
    best_state = None

    for epoch in range(1, 51):
        model.train()
        total_loss = 0.0
        for batch_x, batch_y in loader:
            optimizer.zero_grad()
            out = model(batch_x)
            loss = criterion(out, batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item() * len(batch_x)
        avg_loss = total_loss / len(train_X)
        scheduler.step(avg_loss)
        if avg_loss < best_loss:
            best_loss = avg_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        if epoch % 10 == 0 or epoch == 50:
            print(f"Epoch {epoch:2d}/50  Train Loss: {avg_loss:.6f}")

    model.load_state_dict(best_state)
    model.eval()

    with torch.no_grad():
        test_pred_norm = model(torch.tensor(test_X_norm).unsqueeze(-1)).numpy()
    test_pred = test_pred_norm * scale_width + val_min

    mae = float(mean_absolute_error(test_Y.ravel(), test_pred.ravel()))
    rmse = float(np.sqrt(mean_squared_error(test_Y.ravel(), test_pred.ravel())))
    r2 = float(r2_score(test_Y.ravel(), test_pred.ravel()))
    mape = float(np.mean(np.abs((test_Y - test_pred) / np.maximum(test_Y, 0.01))) * 100)

    # Naive baseline
    naive_pred = np.tile(test_X[:, -1:], (1, forecast_days))
    naive_mae = float(mean_absolute_error(test_Y.ravel(), naive_pred.ravel()))
    naive_r2 = float(r2_score(test_Y.ravel(), naive_pred.ravel()))

    print(f"\nTest Set Results:")
    print(f"  MAE:  {mae:.4f} kg CO2/day")
    print(f"  RMSE: {rmse:.4f} kg CO2/day")
    print(f"  R2:   {r2:.4f} ({r2*100:.2f}%)")
    print(f"  MAPE: {mape:.2f}%")
    print(f"  Improvement over naive: {((naive_mae - mae) / naive_mae * 100):.1f}%")

    models_dir = Path("backend/ml/models")
    metrics_dir = Path("backend/ml/evaluation")
    models_dir.mkdir(parents=True, exist_ok=True)
    metrics_dir.mkdir(parents=True, exist_ok=True)

    artifact_path = models_dir / "future_lstm_candidate.pt"
    torch.save({
        "model_state_dict": best_state,
        "val_min": val_min,
        "val_max": val_max,
        "seq_in": history_days,
        "seq_out": forecast_days,
    }, artifact_path)

    report = {
        "model_name": "carbon_lstm_user_day_forecast",
        "status": "candidate_validated_on_real_data",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_source": "UCI Individual Household Electric Power Consumption",
        "data_url": "https://archive.ics.uci.edu/dataset/235",
        "split": "chronological_80_20_no_leakage",
        "history_days": history_days,
        "forecast_days": forecast_days,
        "train_windows": int(len(train_X)),
        "test_windows": int(len(test_X)),
        "metrics": {
            "mae_kg_day": round(mae, 5),
            "rmse_kg_day": round(rmse, 5),
            "r2": round(r2, 5),
            "mape_percent": round(mape, 2),
        },
        "seasonal_naive_baseline": {
            "mae_kg_day": round(naive_mae, 5),
            "r2": round(naive_r2, 5),
        },
        "improvement_over_naive_pct": round((naive_mae - mae) / naive_mae * 100, 2),
        "artifact": str(artifact_path),
        "limitations": [
            "Trained on real minute-level household energy data aggregated to daily kWh and kg CO2.",
            "Generalizes household electricity carbon; external factors like travel and diet are estimated separately.",
        ],
    }

    metrics_file = metrics_dir / "future_lstm_candidate_metrics.json"
    metrics_file.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Artifacts saved:\n  {artifact_path}\n  {metrics_file}")

if __name__ == "__main__":
    main()
