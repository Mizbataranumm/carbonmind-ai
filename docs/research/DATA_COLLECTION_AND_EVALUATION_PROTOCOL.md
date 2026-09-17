# CarbonMind Data Collection and Evaluation Protocol

## Objective

Build the dated personal dataset required to evaluate the proactive daily and
weekly prediction components without misusing `Carbon Emission.csv`, which has
annual targets and no within-day timestamps.

## Minimum Study Dataset

Recruit consenting participants, including the project team if necessary.
Collect at least 30 consecutive days per participant before training the LSTM
candidate. Store no raw meal photos by default; retain only consented labels and
prediction audit data.

Each activity event must contain:

```json
{
  "user_id": "pseudonymous-id",
  "day": "YYYY-MM-DD",
  "occurred_at": "ISO-8601 timestamp",
  "type": "transport|electricity|food|devices|other",
  "kg": 0.0,
  "source": "manual_entry|food_scanner|imported|sensor_verified",
  "verification_status": "user_entered|food_scan_confirmed|imported|sensor_verified",
  "event_id": "idempotency-id"
}
```

## Daily Prediction Dataset

For each completed day `d`, create one training row at a fixed cut-off such as
14:00 local time:

- Features: category totals before cut-off, event counts, active hours,
  day-of-week, source/verification ratios, and user-safe historical aggregates.
- Target: final observed day total after the day closes.
- Split: chronological split by user, never random rows from the same day into
  both train and test.

Compare:

1. Persistence baseline: current total at cut-off.
2. Rate baseline: `(observed total / elapsed hours) * 24`.
3. HistGradientBoosting.
4. LightGBM.
5. R2-weighted ensemble only if it wins on validation data.

Report MAE, RMSE, R2, mean bias, P50/P95 absolute error, and error by user and
category coverage. Do not deploy the trained model if it loses to the rate
baseline on a locked test period.

## Weekly Forecast Dataset

For each participant and each forecast origin after at least 14 observed days:

- Input: the previous 14, 21, or 30 consecutive daily totals.
- Target: the next seven observed daily totals.
- Backtest: rolling-origin chronological windows.

Compare Holt-Winters, seasonal naive, and LSTM. Report seven-day MAE, MAPE
where denominators are nonzero, RMSE, and forecast bias. The LSTM is included
only when it beats the selected baseline on the locked test windows and has a
committed metrics artifact matching its model version.

## Food Recognition Evaluation

Create a held-out set with at least 20 real phone images for a demonstration
and a materially larger validation set before publication. Include Indian and
Western dishes, mixed plates, poor lighting, non-food images, and confusing
objects. Record ground truth, provider candidate, CNN candidate, final decision,
latency, and whether user confirmation was required.

Report top-1/top-3 accuracy, macro F1, food false-reject rate, non-food
false-accept rate, calibration error, and confidence interval. Never call an
API confidence score an accuracy result.

## Consent and Privacy

- Obtain informed consent before research data collection.
- Replace account IDs with pseudonymous study IDs in exports.
- Do not export passwords, phone numbers, access tokens, or raw photos.
- Store image prediction audits without raw image bytes by default.
- Allow a participant to request deletion of study records.

## Reproducibility Checklist

- Freeze dataset version, schema, and collection dates.
- Commit training command, feature list, random seed, and metrics JSON.
- Record package versions and hardware.
- Keep test participants or dates out of training.
- Include failure cases, not only successful examples.
