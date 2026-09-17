# CarbonMind: An Evidence-Aware Proactive Personal Carbon Tracking and Planning System

## Abstract Draft

Personal carbon applications commonly depend on static calculators and manual
logs, which makes it difficult to distinguish incomplete data from observed
behaviour. This paper presents CarbonMind, a software-first personal carbon
tracking and planning system that attaches evidence provenance to each activity
record and uses that evidence to determine forecast readiness and next actions.
The system combines a user-confirmed food-photo pathway, a CSV-backed recipe
impact estimator, a candidate annual lifestyle regressor, observed-history
weekly baseline forecasting, and transparent long-range scenarios. Unlike a
single calculator, CarbonMind explicitly separates observed records, candidate
model outputs, and user assumptions. We describe the implementation, data
schema, evaluation protocol, and safety gates required for deployment. Final
quantitative results must be populated from the registered evaluation protocol;
the current build does not claim validated production accuracy for food vision,
LSTM forecasting, or partial-day prediction.

## 1. Introduction

Individual carbon tracking is usually retrospective: users enter activities,
receive a total, and leave without knowing whether the record is sufficient for
prediction or how much of it is independently supported. CarbonMind addresses
this by maintaining a personal activity ledger with timestamp, category, impact,
source, and verification state. The system then exposes data readiness rather
than filling gaps with assumed zero values.

## 2. Problem Statement

Design a privacy-aware, software-first system that enables an individual to
record carbon-related activity, inspect evidence provenance, receive transparent
proactive guidance, and explore future scenarios without falsely presenting
unvalidated ML or factor assumptions as measured truth.

## 3. Contributions

1. An evidence-aware carbon activity schema spanning manual, confirmed food
   scan, imported, and future sensor-verified records.
2. A transparent readiness algorithm that links record continuity, category
   coverage, evidence status, and forecast availability.
3. A modular architecture separating food recognition, factor-based impact
   estimation, annual lifestyle ML, weekly baseline forecasting, and scenario
   planning.
4. An evaluation protocol that prevents annual cross-sectional data from being
   misrepresented as daily temporal training data.

## 4. Methodology

Use Figure 1 generated from the architecture in
`PHASE1_SYSTEM_SPECIFICATION.md`. The core pipeline is:

```text
capture -> validate -> store provenance -> aggregate observed record
-> assess readiness -> forecast only when eligible -> recommend next action
```

The readiness equation and all thresholds are defined in the system
specification. It is a transparent decision-support rule, not a trained model.

## 5. Implementation

The web client is React and the API is FastAPI with MongoDB persistence. The
implementation evidence is listed in `PHASE1_SYSTEM_SPECIFICATION.md`, including
the exact endpoint and function responsible for each capability.

## 6. Experimental Design

Use `DATA_COLLECTION_AND_EVALUATION_PROTOCOL.md` as the registered method. The
paper must use chronological, user-aware splits for daily and weekly prediction.
Food results must include non-food rejection cases. Include a table for each
model only after running the stated experiment.

## 7. Results Template

| Task | Baseline | Candidate | Test design | MAE/RMSE/R2 or F1 | Status |
|---|---|---|---|---|---|
| Annual lifestyle estimate | Mean predictor | 18-field LightGBM | Current random holdout | Cite committed JSON | Candidate only |
| Partial-day projection | Rate projection | GBDT/LightGBM | Chronological, per user | To collect | Not trained |
| Weekly forecast | Holt-Winters | LSTM | Rolling origin | To collect | LSTM not served |
| Food recognition | Provider alone | Provider + CNN | Held-out real images | To collect | Candidate only |

## 8. Limitations and Ethics

The current food CNN artifact is not release-ready, the annual dataset is not a
daily longitudinal dataset, and the future screen is an assumption-based
scenario rather than an LSTM forecast. All user study data must be collected
with consent and pseudonymised before analysis.

## 9. Conclusion

CarbonMind demonstrates an honest pathway from a personal activity ledger to
proactive carbon decision support. Its main contribution is evidence-aware
workflow design and disciplined model gating; validated model-performance claims
remain conditional on the registered data collection and evaluation protocol.
