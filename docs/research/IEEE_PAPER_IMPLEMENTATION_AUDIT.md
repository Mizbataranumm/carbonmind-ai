# IEEE Paper Implementation Audit

Reviewed: 2026-09-18

This document distinguishes mathematical theory from the code currently
implemented in CarbonMind AI. It is an internal writing safeguard: do not
describe a formulation as deployed or evaluated unless its status below says
so and a reproducible result is committed.

## Implemented And Traceable

| Paper topic | Code evidence | Paper-safe wording |
| --- | --- | --- |
| Recipe-scaled food total | `backend/food_emissions.py:estimate_food_emissions` | Reviewed recipe ingredient masses are multiplied by the CSV's `Total Global Average GHG Emissions per kg` factor. |
| Seven reported food stages | `backend/food_emissions.py:LIFECYCLE_STAGE_COLUMNS` | The UI reports the seven explicit CSV columns after ingredient/portion scaling. Their subtotal is shown separately because it can differ from the CSV global-average total. |
| Food confirmation gate | `backend/ml_service.py:predict_food`, `frontend/src/pages/Scan.jsx` | An image candidate is never automatically logged; the user confirms an estimate before it becomes a saved activity. |
| Monthly target run rate | `backend/server.py:build_monthly_goal_progress` | Month-end projection is a calendar-day run-rate from saved activities, not an ML forecast. |
| Annual tabular candidate | `backend/ml_service.py:predict_gbdt_ensemble` | HistGradientBoosting and LightGBM output an annual candidate estimate using the committed 14-feature pipelines. Its current validation is random-holdout only. |

## Do Not Present As Implemented

| Theory document claim | Current repository reality | Required correction |
| --- | --- | --- |
| Equation 2.3 conservation property: stage sum equals dish total | The seven listed stage columns can differ from the CSV `Total Global Average GHG Emissions per kg`; code exposes `unallocated_csv_difference_co2_kg`. | Remove the equality claim. State that the stage subtotal is reported separately from the dataset total. |
| Entropy and margin OOD gate in Section 3.3 | `predict_food` uses a primary score threshold and model-label agreement. It does not compute Shannon entropy or top-two margin. | Call this a threshold/agreement review gate, not entropy-based OOD detection. |
| Bayesian fusion in Section 3.2 | No posterior probability or `P(H|c)` is computed. Hint agreement is a string-level safety check. | Describe it as cross-modal consistency checking, not Bayesian fusion. |
| GBDT end-of-day formula in Section 4.2 | `/api/predict/day` is a transparent activity-rate projection. The GBDT ensemble serves an annual target. | Do not call the daily projection GBDT until chronologically validated daily training data exists. |
| MOMILP optimisation in Section 5 | No mixed-integer solver or optimisation route exists. | Move to proposed future work. |
| Gaussian uncertainty propagation in Section 6.2 | No per-factor/quantity variance inputs or confidence-interval calculation exists. | Move to future work, or implement and test it before paper submission. |
| IoT/GPS provenance tier | No live IoT or GPS collector is connected. | Present as a provenance schema/future extension only. |
| LSTM forecast | No validated LSTM artifact is served; existing weekly output is explicitly guarded from fabricating LSTM results. | State that LSTM is not part of the deployed Phase 1 model stack. |
| CNN accuracy/F1 claims | The local ResNet18 artifact exists, but a clean externally evaluated result has not been committed. | Do not state an accuracy or F1 until the documented evaluation completes without provider quota failures. |

## Results Section Rule

The paper may report only values from committed evaluation artifacts under
`backend/ml/evaluation/`, with the dataset, split strategy, date, and metric
definition stated next to each result. Pilot data from four participants over
seven days must be labelled exploratory and not generalizable.
