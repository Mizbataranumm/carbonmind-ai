# CarbonMind: An Evidence-Aware Proactive Personal Carbon Tracking and Planning System

**Draft status:** Phase 1 working draft, 18 September 2026. Entries marked
**PENDING** are deliberately not results claims.

## Abstract

Personal carbon applications often combine manually entered activities with
static calculators, leaving users unable to distinguish observed records from
assumptions or unvalidated model output. This paper presents CarbonMind, a
software-first personal carbon tracking and planning system centred on an
evidence-aware activity ledger. Each activity carries a category, timestamp,
kg CO2e value, source, and verification state. The system aggregates observed
records, reports forecast readiness, and presents transparent next actions. It
combines a user-confirmed food-photo pathway with a CSV-backed recipe estimate,
a distance-based transport calculator using a committed 2026 Department for
Energy Security and Net Zero (DESNZ) factor subset, a monthly goal run rate,
and a candidate annual lifestyle model. CarbonMind does not claim calibrated
food-recognition accuracy, a deployed LSTM, a trained partial-day predictor, or
live IoT/GPS collection. Food-vision and pilot-scale predictive results remain
pending in this Phase 1 draft.

**Index Terms:** carbon accounting, personal informatics, evidence provenance,
sustainable computing, human-in-the-loop systems.

## 1. Introduction

Personal carbon tracking is most useful when a person can see what supports a
number and what must still be collected. A confirmed meal should not carry the
same interpretation as a manual estimate, and a missing day must not be treated
as a zero-emission day. CarbonMind addresses this through an evidence-aware
personal activity ledger. Food recognition is one input path, not the whole
system: the Phase 1 contribution is a workflow that captures an activity,
records its provenance, aggregates observed evidence, assesses readiness, and
only then offers an appropriate planning action.

## 2. Literature Review and Background

Food lifecycle assessment provides a factor-based way to map a documented food
portion to an impact estimate. CarbonMind uses the seven reported CSV columns
Land Use Change, Feed, Farm, Processing, Transport, Packaging, and Retail. The
application shows their scaled subtotal separately from the CSV global-average
total; it does not assert that they are equal.

Distance-based travel accounting uses activity units such as vehicle-km or
passenger-km. CarbonMind commits a compact subset of the DESNZ 2026 factors.
Car factors are vehicle-km values and are divided by declared occupants; bus,
coach, rail, and flight factors are passenger-km values. Each factor retains its
source and declared boundary. This work is a system integration contribution,
not a claim of a new factor database or neural-network architecture.

## 3. Problem Statement and Objectives

The problem is to build a privacy-aware application that records personal
carbon-related activity, shows evidence provenance, calculates sourced
estimates, and supports proactive planning without representing unvalidated
inference as fact.

The Phase 1 objectives are to: (1) maintain a private ledger with source and
verification metadata; (2) provide a user-confirmed food-photo workflow for
reviewed recipes; (3) calculate transport from a cited factor and visible unit
basis; (4) assess forecast readiness from saved observations; and (5) bound all
model and scenario claims by their actual validation status.

## 4. Methodology

### 4.1 Evidence-Aware Activity Ledger

Each saved activity includes a category, kg CO2e, event identifier, source, and
verification status. The currently used statuses include `user_entered` and
`food_scan_confirmed`; imported and sensor-verified forms are reserved by the
schema for later work. The server uses `event_id` to avoid duplicate entries on
an append retry.

```text
manual activity ------------------------------+
                                               |
food photo -> image candidate -> user confirms recipe -> CSV estimate
                                               |
                                               v
                 versioned personal activity ledger
          {time, category, kg CO2e, source, verification}
                                               |
              observed totals -> readiness -> permitted planning action
```

### 4.2 Food Estimate Workflow

Gemini Vision is the preferred remote food candidate provider when configured;
a local ResNet18 candidate is evaluated alongside it. A dish-name hint is
optional. A candidate must map to a reviewed recipe, and the user explicitly
confirms the estimate before it becomes a ledger entry. When providers are
unavailable or a candidate needs review, the system does not create a guessed
food estimate.

For a reviewed recipe, each ingredient mass is scaled by the committed
`Food_Product_Emissions.csv` global-average factor. The seven stage columns are
also scaled and returned for inspection. This is a factor and recipe lookup,
not a food-carbon regression model.

### 4.3 Transport Estimate Workflow

The Add Activity transport form loads selectable factors from the backend and
sends `factor_id`, kilometres, and declared occupants to
`POST /api/transport/estimate`. For vehicle-km rows, the implemented rule is:

```text
personal_trip_kgCO2e = distance_km * factor_kgCO2e_per_km / occupants
```

Passenger-km rows are not divided again because their factor is already
allocated per passenger. The response displays the calculation and boundary
before saving. The committed subset covers average petrol, diesel, and
battery-electric cars; local bus; coach; national rail; and domestic,
short-haul, and long-haul average flights.

### 4.4 Readiness, Forecasting, and Planning

Let H be consecutive observed days ending today, C categories recorded today,
V confirmed records today, A all records today, and D all observed days. The
implemented readiness indicator is:

```text
readiness = round(
    min(|H|, 14) / 14 * 45
  + min(C, 4) / 4 * 25
  + (V / A if A > 0 else 0) * 20
  + min(D, 30) / 30 * 10
)
```

This is a transparent data-readiness rule, not a trained carbon model. Fewer
than five consecutive observed days produces no forecast; five to thirteen days
enables a Holt-Winters weekly baseline. Fourteen or more days marks the record
as eligible for future LSTM evaluation data collection, but does not serve an
LSTM. The monthly goal card uses a calendar-day run rate from saved activity,
not ML. The Future Plan is a user-assumption arithmetic scenario, not a climate
or time-series prediction.

### 4.5 Annual Candidate Model and Smart Tips

The repository contains HistGradientBoosting and LightGBM pipelines for annual
lifestyle profile features and exposes their candidate outputs separately. Their
current validation is random holdout, not chronological personal forecasting.
The conversational feature is called **Smart Tips** in this paper: it is a
rule-based keyword-matched response endpoint, not a deployed LLM chatbot.

## 5. Implementation

The client is React and the API is FastAPI with MongoDB-backed users and
activity logs. `backend/server.py` contains API and ledger operations;
`backend/food_emissions.py` implements recipe scaling;
`backend/ml_service.py` invokes candidate models; and
`backend/transport_emissions.py` calculates sourced travel estimates.

`backend/Transport_Emission_Factors_DESNZ_2026.csv` stores each transport
factor's identifier, mode, unit basis, value, boundary, source document, source
table/sheet, and URL. The frontend contains no duplicate transport constants: it
fetches the catalog and estimate from the backend.

## 6. Experimental Design

The planned pilot consists of four private accounts logging real activity for
seven consecutive days. Exported data must preserve user and date order. Any
comparison between a rate baseline, HistGradientBoosting, LightGBM, and an
ensemble must use a chronological split and be labelled exploratory, not
generalizable.

Food evaluation must use at least 15--20 labelled images spanning Indian and
Western dishes, non-food inputs, and difficult lighting. It must report provider
availability, primary-only, CNN-only, and ensemble outputs with a manifest and
confusion information. Provider failures may not be excluded.

## 7. Results

**Table 1. Phase 1 results status.**

| Evaluation task | Baseline | Candidate/system | Metric | Current result | Status |
|---|---|---|---|---|---|
| Food vision | Provider alone | Provider + local ResNet18 | Accuracy, macro F1, confusion | **PENDING: valid 15--20 image evaluation** | A 20-image attempt had provider unavailable for 19; no reportable score |
| Daily pilot prediction | Rate baseline | HistGradientBoosting, LightGBM, ensemble | MAE, RMSE, R2 | **PENDING: pilot data due Sep 24--25** | No chronological pilot split |
| Weekly forecasting | Holt-Winters | LSTM | MAE, RMSE, R2 | **PENDING / not served** | LSTM not deployed or validated |
| Annual lifestyle estimate | Simple baseline | GBDT/LightGBM candidate | MAE, RMSE, R2 | **PENDING: reproducible final evaluation** | Current validation is random holdout |
| Transport calculator | Manual entry | DESNZ 2026 factor calculation | Contract test | 20 km petrol car / 2 occupants = 1.6152 kg CO2e | Implemented and tested |

The interrupted food run is retained as a limitation record. Only one provider
result was available, while the local CNN made zero correct predictions across
the 20 convenience images. The resulting 1/1 provider/ensemble values are not
valid accuracy or F1 estimates and are intentionally not reported as results.

## 8. Limitations and Ethics

The local ResNet18 artifact has no clean representative external evaluation.
Provider and CNN confidence values are not calibrated probabilities. The food
gate uses a score threshold and label agreement; it does not implement Bayesian
fusion, entropy-based out-of-distribution detection, or a top-two margin test.

The daily endpoint is an activity-rate projection, not a GBDT end-of-day model.
The annual candidate does not validate temporal forecasting. No LSTM is served.
MOMILP optimisation, Gaussian uncertainty propagation, live IoT/GPS collection,
and externally verified carbon certificates are future work. DESNZ factors are
UK reference factors and may not represent another country, fleet, grid, or
operator. Pilot exports require consent and pseudonymisation.

## 9. Conclusion

CarbonMind Phase 1 implements an evidence-aware personal carbon workflow rather
than an all-knowing carbon AI. It combines a provenance-bearing ledger,
human-confirmed food estimation, sourced transport calculation, transparent
readiness logic, and bounded candidate ML modules. The next evidence step is a
seven-day pilot and a repeatable food evaluation with available providers. Only
those results should populate the final Results section.

## References to Complete in IEEE Style

[1] J. Poore and T. Nemecek, "Reducing food's environmental impacts through
producers and consumers," *Science*, vol. 360, no. 6392, pp. 987--992, 2018,
doi: 10.1126/science.aaq0216.

[2] UK Department for Energy Security and Net Zero, "Greenhouse gas reporting:
conversion factors 2026," 2026. Available:
https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2026

[3] CarbonMind Research Team, "Phase 1 System Specification," internal project
document, 2026.

[4] CarbonMind Research Team, "IEEE Paper Implementation Audit," internal
project document, 2026.
