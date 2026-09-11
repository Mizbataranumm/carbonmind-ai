# CarbonMind AI ML Product Hardening Plan

This document is the working plan for moving CarbonMind AI from demo-grade ML behavior to a product-grade, model-based system for B2C and B2B use.

## Current Risk

The existing app has useful UX, but model behavior is not yet product-grade. The food scanner path mixes remote inference, hints, local visual heuristics, and fixed carbon factors. The checked-in CNN metadata records 4.0% accuracy. The daily carbon predictor can run from mostly default lifestyle features because the frontend does not yet collect the full model schema. The future simulator presents a long-range forecast but currently uses generated pseudo-history and a short-horizon smoothing shim.

## Product ML Principles

1. Separate recognition from estimation.
   - Food recognition predicts what is visible.
   - Portion estimation predicts quantity or serving size.
   - Carbon estimation maps recognized ingredients or dishes to emissions factors.
   - The UI should show uncertainty when any stage is uncertain.

2. Every model must have a versioned contract.
   - Input schema
   - Output schema
   - Training dataset
   - Evaluation dataset
   - Metrics
   - Known limitations
   - Serving owner and fallback behavior

3. No confidence value is product-safe until calibrated.
   - Raw neural-network softmax, remote model score, and LLM self-reported confidence are not the same as real-world accuracy.
   - Product confidence must be measured on a held-out real-world validation set.

4. Fallbacks must be labeled as fallbacks.
   - Hints, presets, default CO2 factors, and client-side heuristics can support UX, but they must not be presented as model evidence.

## Phase 1: Honest Baseline

- Add a model registry file describing which models are actually used today.
- Add evaluation scripts that can be run repeatedly on held-out datasets.
- Generate metrics JSON files for every model.
- Remove or avoid unsupported README/API claims such as fixed 95% accuracy or R2 values until reports exist.

## Phase 2: Food Vision v1

Target pipeline:

```text
image -> image validation -> top-k food classifier -> non-food rejection -> food/ingredient mapping -> CO2 range
```

Required datasets:

- Food-101 official train/test split.
- Indian food dataset with dishes relevant to the product market.
- Real phone photos from expected users.
- Non-food rejection set: people, menus, kitchen scenes without food, packaged goods, animals, documents, random objects.
- Mixed-plate dataset: thali, biryani with sides, snacks, beverages.

Required metrics:

- Top-1 accuracy
- Top-3 accuracy
- Macro F1
- Per-class precision/recall
- Confusion matrix
- Non-food false accept rate
- Food false reject rate
- Expected calibration error
- Latency p50/p95

Release gate:

- No launch without a held-out real-world validation report.
- No hard-coded 95% or 98% confidence display.
- Top-3 predictions shown when the model is uncertain.

## Phase 3: Tabular Carbon Predictor

Target pipeline:

```text
validated user lifestyle schema -> preprocessing pipeline -> GBDT model -> annual kg CO2e -> daily estimate + uncertainty
```

Required changes:

- Save the full preprocessing pipeline with the model.
- Prefer one-hot encoding for nominal categories instead of arbitrary label IDs.
- Store training metrics in `backend/ml/evaluation/`.
- Validate that frontend fields match model features.
- Compare against simple baselines: mean predictor and rules-based calculator.

Release gate:

- Metrics must be from a locked holdout set.
- The API must not claim R2 unless reading it from a metrics artifact.
- The UI must disclose when defaults are used.

## Phase 4: Future Simulator

For now, use a transparent scenario calculator instead of claiming long-range LSTM forecasting. A true time-series model should wait until the product has real per-user longitudinal data.

Target pipeline:

```text
current annual footprint -> selected lifestyle interventions -> yearly scenario curve -> assumptions + uncertainty
```

Release gate:

- The endpoint names the method as scenario simulation unless a real temporal model is trained and evaluated.
- No pseudo-history should be generated and called user history.

## Phase 5: Product Ops

- Add prediction logging with user consent.
- Store user corrections to food predictions.
- Add model version to every prediction response.
- Build admin review tools for mislabeled scans.
- Add rollback support for models.
- Add monitoring for latency, error rate, rejection rate, top-class drift, and fallback rate.
