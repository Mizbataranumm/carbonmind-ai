# ML Evaluation Reports

This folder is for committed, reproducible model evaluation artifacts.

Each trained model should produce a metrics file with:

- model name and version
- git commit SHA
- training dataset path or dataset version
- validation/test dataset path or dataset version
- feature schema or class list
- preprocessing details
- metrics
- known limitations
- release decision

Do not hard-code model accuracy, R2, MAE, or confidence claims in API responses or README copy unless the value is generated from one of these reports.

Suggested files:

- `food_vision_baseline_metrics.json`
- `daily_carbon_gbdt_metrics.json`
- `future_scenario_backtest_metrics.json`
