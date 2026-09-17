# Seven Day CarbonMind Pilot Runbook

## Goal

Collect a small, real, dated personal-activity dataset from four consenting
team members. The pilot measures workflow feasibility and produces exploratory
model comparisons. It is not a product-validation study.

## Who

Four team members create separate **private personal accounts**. Do not use the
demo account because its records are seeded example data.

## Daily UI Flow

Each participant repeats this for seven consecutive days, starting today:

1. Sign in to their own account.
2. Use **Add activity** after a real completed transport, electricity, food, or
   device activity. Enter a short label and the best available kg CO2e estimate.
3. For a meal photo, use **Food Scanner**, enter the dish name, verify the
   image-dish candidate, then choose **Confirm and add to today**. Do not add
   the same meal again through Add activity.
4. Keep the recorded time accurate. A same-day activity should be saved when it
   happens, not entered in a batch at midnight.
5. At the end of the day, open **Activity history** and confirm the total and
   list are complete. Do not invent an activity for a missing day.

Use the same 14:00 local cut-off for the experiment. Activities recorded before
14:00 form the input; the final saved total for that calendar day is the target.

## Team Data Sheet

Every member should log at least one before-14:00 activity and one after-14:00
activity on as many days as naturally possible. The pilot cannot infer a target
for a day with no saved record.

| Date | Member | Before 14:00 activity saved | After 14:00 activity saved | End-of-day record checked |
|---|---|---|---|---|
| Day 1 | A/B/C/D | Yes/No | Yes/No | Yes/No |
| Day 2 | A/B/C/D | Yes/No | Yes/No | Yes/No |
| Day 3 | A/B/C/D | Yes/No | Yes/No | Yes/No |
| Day 4 | A/B/C/D | Yes/No | Yes/No | Yes/No |
| Day 5 | A/B/C/D | Yes/No | Yes/No | Yes/No |
| Day 6 | A/B/C/D | Yes/No | Yes/No | Yes/No |
| Day 7 | A/B/C/D | Yes/No | Yes/No | Yes/No |

## Export and Pilot Evaluation

Run these commands from the repository root after Day 7. `MONGO_URL` should be
set in the local environment, not copied into a document or committed to Git.

```powershell
python scripts/export_pilot_activity_logs.py `
  --start 2026-09-17 --end 2026-09-23 `
  --output data/pilot_activity_logs.json

python scripts/build_proactive_daily_dataset.py `
  --input data/pilot_activity_logs.json `
  --output data/pilot_14_feature_examples.csv `
  --cutoff-hour 14 --history-days 3

python scripts/train_proactive_daily_models.py `
  --data data/pilot_14_feature_examples.csv --pilot
```

The last command produces MAE, RMSE, and R2 for the rate baseline,
HistGradientBoosting, LightGBM, and their R2-weighted ensemble. Its report is
labelled `exploratory_pilot_not_generalizable`; it must be reported that way in
the paper and must not be deployed as a production predictor.

## What To Put In The Paper

- Number of participants and number of valid chronological examples.
- Date range and fixed 14:00 input cut-off.
- Actual rate-baseline versus model metrics.
- Missing-day rate and record-completeness rate.
- A limitation stating that the sample is four participants over one week and
  cannot establish generalization.
