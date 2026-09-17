# CarbonMind Phase 1 System Specification

## Purpose

CarbonMind is an individual, proactive carbon-footprint tracking and planning
system. Food recognition is one input pathway, not the project itself. The
system keeps a personal evidence record, derives activity totals from that
record, reports forecast readiness, and makes transparent planning scenarios.

## Research Contribution

The Phase 1 contribution is an **evidence-aware personal carbon intelligence
workflow**. Instead of treating every number as equally trustworthy, each saved
activity carries its source and verification state. The proactive layer uses
only saved observations to answer three questions:

1. Is there enough continuous personal history for a weekly forecast?
2. How complete and independently verified is today's record?
3. What is the next data-collection or budget-review action?

This is a system contribution, not a claim that CarbonMind has invented a new
carbon emission factor or a new neural-network architecture.

## Implemented Architecture

```text
Manual activity entry ───────────────┐
                                    │
Food photo -> vision candidate -> user dish confirmation -> CSV recipe estimate
                                    │
                                    v
                     Versioned personal activity ledger
                 {time, category, kg CO2e, source, verification}
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          v                         v                         v
   Dashboard and history   Carbon intelligence layer    Forecast/scenario layer
   observed totals only    readiness + next action      weekly baseline or explicit
                                                          user-assumption scenario
```

## Runtime Modules and Evidence

| Capability | Code path | Runtime status | Honest interpretation |
|---|---|---|---|
| Activity ledger | `backend/server.py::save_daily_activities` | Implemented | MongoDB activity records; events are de-duplicated by `event_id`. |
| Evidence provenance | `DailyActivity`, `build_carbon_intelligence` | Implemented | `manual_entry` and `food_scanner` sources; confirmation state is stored per activity. |
| Proactive guidance | `GET /api/carbon/intelligence` | Implemented | Transparent decision support over saved records, not trained ML. |
| Food recognition | `backend/ml_service.py::predict_food` | Candidate | Provider image candidate plus local ResNet candidate; requires dish-image agreement. |
| Food impact | `backend/food_emissions.py` | Implemented for reviewed recipes | Recipe lookup scales committed `Food_Product_Emissions.csv` factors. |
| Annual lifestyle estimate | `backend/ml_service.py::predict_annual_carbon` | Candidate | 18-feature LightGBM; random-holdout result only. |
| Weekly forecast | `backend/ml_service.py::predict_weekly_ensemble` | Baseline only | Holt-Winters on five or more observed days; legacy LSTM is not served. |
| Future planning | `backend/server.py::simulate` | Implemented | Transparent arithmetic scenario based on user-entered baseline and target. |

## Proactive Readiness Algorithm

For a user on day `t`, let `H` be the uninterrupted saved-day history ending at
`t`, `C` be the number of categories recorded today, `V` be confirmed evidence
records today, `A` be all activity records today, and `D` be all observed days.

```text
readiness = round(
    min(|H|, 14) / 14 * 45
  + min(C, 4) / 4 * 25
  + (V / A if A > 0 else 0) * 20
  + min(D, 30) / 30 * 10
)
```

This score is a **data-readiness indicator**, not a carbon score and not a
climate-performance grade. Missing days reduce continuity; they are never
interpreted as zero-emission days.

## Forecast Policy

| Personal history | Product behaviour |
|---|---|
| Fewer than 5 consecutive observed days | Ask for more real observations; no forecast. |
| 5 to 13 consecutive observed days | Offer Holt-Winters weekly baseline forecast. |
| 14 or more consecutive observed days | Mark the user record as eligible for future LSTM evaluation data collection; keep Holt-Winters in production until chronological validation exists. |

## Phase 1 Demonstration Script

1. Create a new private account and show an empty activity ledger.
2. Add a completed transport or electricity activity. Show it as
   `manual_entry` / `user_entered` evidence.
3. Upload a real food image, enter the matching dish, and confirm the result.
   Show the resulting `food_scanner` / `food_scan_confirmed` entry.
4. Open Dashboard and show the Carbon Intelligence panel: evidence counts,
   observed-history count, forecast readiness, and next action.
5. Show that a missing day does not create a zero value or a forecast.
6. Add records on five consecutive days and show the weekly Holt-Winters
   baseline; explain that it is a baseline, not an LSTM claim.
7. Run a Future Scenario with a user-entered annual baseline and reduction
   target. Explain every assumption displayed in the response.

## Claims Allowed in Phase 1

- A working personal activity ledger with evidence provenance.
- Food estimates only after image-dish agreement and only for reviewed recipes.
- Transparent weekly baseline forecasting after sufficient observed history.
- Candidate annual lifestyle ML inference with a recorded random-holdout result.
- A transparent, user-assumption future scenario calculator.

## Claims Not Allowed Yet

- Product-grade food recognition accuracy or calibrated confidence.
- A trained and validated personal LSTM forecast.
- A trained two-hour-to-full-day predictor.
- IoT/sensor integration unless actual device/API data is collected and logged.
- Individual temperature-change prediction.
- Emissions reductions or certificates verified against an external baseline.
