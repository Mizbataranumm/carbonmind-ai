import asyncio
import base64
from datetime import date, datetime, timezone
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from backend.ml_service import (
    ANNUAL_CARBON_FEATURES,
    GBDT_DEFAULTS,
    get_model_status,
    load_models,
    predict_annual_carbon,
    predict_food,
    predict_gbdt,
    predict_gbdt_ensemble,
    predict_weekly_ensemble,
)
from backend.food_emissions import estimate_food_emissions, food_catalog, load_food_product_factors
from backend.transport_emissions import estimate_transport_emissions, load_transport_factors
import backend.ml_service as ml_service
from backend.server import (
    FoodScanRequest,
    MorningActivity,
    PredictDayRequest,
    SimulateRequest,
    DemoLoginRequest,
    _demo_activity_logs,
    build_monthly_goal_progress,
    build_carbon_intelligence,
    _merge_daily_activities,
    _hash_password,
    _public_user,
    _verify_password,
    cors_origins,
    demo_login,
    predict_day,
    predict_weekly,
    simulate,
    food_scan,
    DemoLoginRequest,
    demo_login,
)


class ModelContractTests(unittest.TestCase):
    VALID_IMAGE = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGOsCNBgYGBgYgADAAu6APRmkuoXAAAAAElFTkSuQmCC"

    def test_transport_estimate_uses_committed_desnz_factor_and_occupancy(self):
        factors = load_transport_factors()
        self.assertEqual(factors["car_petrol_average"]["kg_co2e_per_km"], 0.16152)
        result = estimate_transport_emissions("car_petrol_average", 20, passengers=2)
        self.assertEqual(result["co2_kg"], 1.6152)
        self.assertEqual(result["formula"], "20 km x 0.16152 kg CO2e/km / 2 occupants")
        self.assertIn("DESNZ", result["factor"]["source_document"])

    def test_monthly_goal_uses_saved_logs_and_a_transparent_calendar_run_rate(self):
        logs = [
            {"day": "2026-09-01", "total_kg": 3.0},
            {"day": "2026-09-02", "total_kg": 5.0},
        ]
        progress = build_monthly_goal_progress(logs, 120.0, date(2026, 9, 2))

        self.assertEqual(progress["current_month_kg"], 8.0)
        self.assertEqual(progress["projected_month_end_kg"], 120.0)
        self.assertEqual(progress["daily_allowance_kg"], 4.0)
        self.assertEqual(progress["method"], "saved_activity_calendar_run_rate")
    def test_daily_activity_projection_is_not_labeled_as_a_model(self):
        body = asyncio.run(predict_day(PredictDayRequest(
            morning_activities=[MorningActivity(type="transport", kg=1.0), MorningActivity(type="food", kg=0.5)],
            daily_budget_kg=20,
            observation_hours=2,
        )))

        self.assertEqual(body["predicted_full_day_kg"], 18.0)
        self.assertEqual(body["model_used"], "activity_rate_projection")
        self.assertEqual(body["model_status"], "transparent_rule_based_projection")
        self.assertEqual(len(body["hourly_curve"]), 24)

    def test_daily_activity_projection_rejects_unknown_categories(self):
        with self.assertRaises(HTTPException) as error:
            asyncio.run(predict_day(PredictDayRequest(morning_activities=[MorningActivity(type="mystery", kg=1.0)])))
        self.assertEqual(error.exception.status_code, 422)

    def test_weekly_forecast_requires_observed_history(self):
        with self.assertRaises(HTTPException) as error:
            asyncio.run(predict_weekly({"daily_history": [1, 2, 3, 4]}))
        self.assertEqual(error.exception.status_code, 422)

    def test_weekly_forecast_uses_an_uncalibrated_band_label(self):
        body = asyncio.run(predict_weekly({"daily_history": [1.0, 1.2, 0.9, 1.1, 1.0]}))

        self.assertIn("lower_band", body)
        self.assertIn("upper_band", body)
        self.assertIn("not a calibrated confidence interval", body["band_note"])
        self.assertNotIn("lower_ci", body)

    def test_carbon_intelligence_never_fabricates_missing_history(self):
        today = date(2026, 9, 16)
        logs = {
            today.isoformat(): {
                "total_kg": 2.4,
                "activities": [{
                    "type": "food", "kg": 2.4, "source": "food_scanner",
                    "verification_status": "food_scan_confirmed",
                    "occurred_at": datetime(2026, 9, 16, 12, tzinfo=timezone.utc).isoformat(),
                }],
            },
            "2026-09-14": {"total_kg": 1.2, "activities": []},
        }

        result = build_carbon_intelligence(logs, today)

        self.assertEqual(result["readiness_components"]["consecutive_history_days"], 1)
        self.assertEqual(result["evidence"]["verified_count"], 1)
        self.assertEqual(result["forecast_readiness"]["level"], "collect_more_observations")
        self.assertEqual(result["model_status"], "rules_over_saved_user_observations_not_trained_ml")

    def test_carbon_intelligence_marks_weekly_baseline_only_after_observed_streak(self):
        today = date(2026, 9, 16)
        logs = {}
        for offset in range(5):
            day = today.fromordinal(today.toordinal() - offset)
            logs[day.isoformat()] = {"total_kg": 1.0 + offset, "activities": []}

        result = build_carbon_intelligence(logs, today)

        self.assertEqual(result["forecast_readiness"]["level"], "weekly_baseline_available")

    def test_activity_event_id_makes_an_append_retry_idempotent(self):
        existing = [{"id": "stored", "event_id": "meal-42", "type": "food", "kg": 1.2}]
        incoming = [{"id": "retry", "event_id": "meal-42", "type": "food", "kg": 1.2}]

        activities, duplicate_count = _merge_daily_activities(existing, incoming, append=True, source=None)

        self.assertEqual(activities, existing)
        self.assertEqual(duplicate_count, 1)

    def test_predictor_source_replaces_only_its_own_entries(self):
        existing = [
            {"id": "meal", "type": "food", "kg": 1.2, "event_id": "meal-42"},
            {"id": "prediction", "type": "transport", "kg": 2.0, "source": "predictor"},
        ]
        incoming = [{"id": "updated", "type": "transport", "kg": 1.0}]

        activities, duplicate_count = _merge_daily_activities(existing, incoming, append=False, source="predictor")

        self.assertEqual(duplicate_count, 0)
        self.assertEqual(len(activities), 2)
        self.assertEqual(activities[0]["event_id"], "meal-42")
        self.assertEqual(activities[1]["source"], "predictor")

    def test_future_response_is_a_scenario_not_temperature_prediction(self):
        body = asyncio.run(simulate(SimulateRequest(
            current_annual_co2=7.5, annual_reduction_percent=4.0,
            transport="mixed", diet="mixed", horizon_years=10,
        )))

        self.assertEqual(body.method, "scenario_calculator")
        self.assertEqual(body.model_status, "transparent_scenario_not_time_series_ml")
        self.assertIsNone(body.future_temp_delta)
        self.assertEqual(body.current_annual_co2, 7.5)
        self.assertEqual(body.projected_co2, 4.99)
        self.assertIn("entered by the user", " ".join(body.assumptions))

    def test_food_scan_rejects_a_dish_name_without_a_photo(self):
        body = asyncio.run(food_scan(FoodScanRequest(image_base64=None, hint="biryani")))

        self.assertEqual(body["status"], "error")
        self.assertIn("photo", body["message"].lower())

    def test_food_factor_does_not_map_baby_to_baby_back_ribs(self):
        self.assertIsNone(ml_service._co2_from_name("baby"))
        self.assertIsNone(ml_service._co2_from_name("baby girl"))

    def test_food_factor_rejects_a_generic_dish_without_a_reviewed_recipe(self):
        self.assertIsNone(ml_service._co2_from_name("pizza"))
        self.assertIsNone(ml_service._co2_from_name("burger"))

    def test_food_factor_catalog_reads_the_project_csv(self):
        factors = load_food_product_factors()

        self.assertEqual(factors["potatoes"], 0.46)
        self.assertEqual(factors["rice"], 4.45)
        self.assertEqual(next(item for item in food_catalog() if item["value"] == "rice")["co2_kg"], 0.289)

    def test_french_fries_are_calculated_from_csv_factors_and_portion(self):
        estimate = estimate_food_emissions("french fries", serving_g=180)

        self.assertIsNotNone(estimate)
        self.assertEqual(estimate["factor_source"], "Food_Product_Emissions.csv")
        self.assertEqual(estimate["serving_size_g"], 180)
        self.assertEqual(estimate["co2_kg"], 0.146)
        self.assertEqual({item["ingredient"] for item in estimate["components"]}, {"Potatoes", "Sunflower Oil"})
        self.assertEqual(
            [stage["key"] for stage in estimate["lifecycle_stages"]],
            ["land_use_change", "feed", "farm", "processing", "transport", "packaging", "retail"],
        )
        self.assertAlmostEqual(
            estimate["reported_lifecycle_stage_total_co2_kg"],
            round(sum(stage["co2_kg"] for stage in estimate["lifecycle_stages"]), 4),
            places=3,
        )
        self.assertGreater(estimate["unallocated_csv_difference_co2_kg"], 0)

    def test_food_scan_requires_image_candidate_and_dish_name_to_agree(self):
        image_data = self.VALID_IMAGE
        primary_result = {"food": "french fries", "confidence": 0.91, "model": "test_primary"}
        cnn_result = {"food": "french fries", "confidence": 0.72, "model": "test_cnn"}

        with patch.object(ml_service, "_predict_primary_food", return_value=primary_result), \
             patch.object(ml_service, "_predict_food_cnn", return_value=cnn_result):
            mismatch = ml_service.predict_food(image_data, hint="biryani")
            match = ml_service.predict_food(image_data, hint="french fries")

        self.assertEqual(mismatch["status"], "rejected")
        self.assertIn("does not match", mismatch["message"])
        self.assertEqual(match["status"], "success")
        self.assertEqual(match["method"], "primary_vision_local_resnet18_ensemble")
        self.assertEqual(match["co2_kg"], 0.146)
        self.assertEqual(match["factor_source"], "Food_Product_Emissions.csv")
        self.assertEqual(match["prediction_audit"]["final_decision"], "primary_high_confidence")

    def test_food_scan_can_use_a_verified_image_candidate_without_a_hint(self):
        primary_result = {"food": "french fries", "confidence": 0.91, "model": "test_primary"}
        cnn_result = {"food": "french fries", "confidence": 0.72, "model": "test_cnn"}

        with patch.object(ml_service, "_predict_primary_food", return_value=primary_result), \
             patch.object(ml_service, "_predict_food_cnn", return_value=cnn_result):
            result = ml_service.predict_food(self.VALID_IMAGE, hint=None)

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["food_category"], "French fries")
        self.assertTrue(result["requires_user_confirmation"])

    def test_food_scan_uses_low_confidence_model_agreement_to_boost_candidate(self):
        image_data = self.VALID_IMAGE

        with patch.object(ml_service, "_predict_primary_food", return_value={"food": "french fries", "confidence": 0.60, "model": "test_primary"}), \
             patch.object(ml_service, "_predict_food_cnn", return_value={"food": "french fries", "confidence": 0.70, "model": "test_cnn"}):
            result = ml_service.predict_food(image_data, hint="french fries")

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["prediction_audit"]["final_decision"], "models_agree_boosted")
        self.assertEqual(result["confidence"], 0.95)

    def test_food_scan_marks_disagreeing_low_scores_for_manual_review(self):
        with patch.object(ml_service, "_predict_primary_food", return_value={"food": "french fries", "confidence": 0.60, "model": "test_primary"}), \
             patch.object(ml_service, "_predict_food_cnn", return_value={"food": "chicken curry", "confidence": 0.70, "model": "test_cnn"}):
            result = ml_service.predict_food(self.VALID_IMAGE, hint="french fries")

        self.assertEqual(result["status"], "low_confidence")
        self.assertEqual(result["prediction_audit"]["final_decision"], "low_confidence")

    def test_reproducible_daily_pipeline_and_metrics_are_loadable(self):
        project_root = Path(__file__).resolve().parents[2]
        models_dir = project_root / "backend" / "ml" / "models"
        load_models(str(models_dir))

        prediction = predict_gbdt(GBDT_DEFAULTS)
        ensemble = predict_gbdt_ensemble(GBDT_DEFAULTS)
        status = get_model_status(str(models_dir))

        self.assertIsNotNone(prediction)
        self.assertIsNotNone(ensemble)
        self.assertEqual(ensemble["target"], "annual_kg_co2e")
        self.assertAlmostEqual(sum(ensemble["weights"].values()), 1.0, places=5)
        self.assertTrue(status["runtime"]["daily_carbon_predictor"]["pipeline_loaded"])
        self.assertEqual(status["evaluation"]["daily_carbon"]["metrics"]["ensemble"]["r2_holdout"], 0.8938)

    def test_weekly_ensemble_does_not_fake_a_legacy_lstm_output(self):
        result = predict_weekly_ensemble([1.0, 1.2, 0.9, 1.1, 1.0])

        self.assertIsNotNone(result)
        self.assertIsNone(result["lstm_forecast"])
        self.assertEqual(result["model_weights"]["lstm"], 0.0)

    def test_weekly_ensemble_blend_policy_changes_after_fourteen_days(self):
        sparse_history = [1.0, 1.2, 0.9, 1.1, 1.0, 1.3, 1.1, 1.0, 1.2, 1.1]
        long_history = [1.0 + (index % 7) * 0.1 for index in range(30)]
        with patch.object(ml_service, "_predict_validated_lstm", return_value=[2.0] * 7):
            sparse = predict_weekly_ensemble(sparse_history)
            long = predict_weekly_ensemble(long_history)

        self.assertEqual(sparse["model_weights"], {"holt_winters": 0.8, "lstm": 0.2})
        self.assertEqual(long["model_weights"], {"holt_winters": 0.35, "lstm": 0.65})
        self.assertEqual(len(sparse["ensemble_forecast"]), 7)
        self.assertEqual(len(long["ensemble_forecast"]), 7)

    def test_annual_champion_requires_the_complete_schema(self):
        project_root = Path(__file__).resolve().parents[2]
        load_models(str(project_root / "backend" / "ml" / "models"))

        self.assertIsNone(predict_annual_carbon(GBDT_DEFAULTS))
        profile = {
            "Body Type": "normal", "Diet": "vegetarian",
            "How Often Shower": "daily", "Heating Energy Source": "electricity",
            "Transport": "public", "Vehicle Type": "electric", "Social Activity": "sometimes",
            "Monthly Grocery Bill": 230, "Frequency of Traveling by Air": "rarely",
            "Vehicle Monthly Distance Km": 500, "Waste Bag Size": "medium",
            "Waste Bag Weekly Count": 3, "How Long TV PC Daily Hour": 4,
            "How Many New Clothes Monthly": 2, "How Long Internet Daily Hour": 4,
            "Energy efficiency": "Yes", "Recycling": "['Paper', 'Plastic']",
            "Cooking_With": "['Stove', 'Microwave']",
        }
        self.assertEqual(set(profile), set(ANNUAL_CARBON_FEATURES))
        self.assertIsNotNone(predict_annual_carbon(profile))

    def test_passwords_are_hashed_and_verifiable(self):
        password_hash = _hash_password("a-longer-test-password")

        self.assertTrue(password_hash.startswith("scrypt$"))
        self.assertTrue(_verify_password("a-longer-test-password", password_hash))
        self.assertFalse(_verify_password("incorrect-password", password_hash))

    def test_access_tokens_are_signed_and_expireable(self):
        from backend.server import _issue_access_token, _read_access_token

        token = _issue_access_token("user-123")
        self.assertEqual(_read_access_token(token)["sub"], "user-123")
        self.assertIsNone(_read_access_token(token + "tampered"))

    def test_demo_sessions_have_distinct_ids(self):
        first = asyncio.run(demo_login(DemoLoginRequest(name="Eco Explorer")))
        second = asyncio.run(demo_login(DemoLoginRequest(name="Eco Explorer")))

        self.assertTrue(first["is_demo"])
        self.assertTrue(second["is_demo"])
        self.assertNotEqual(first["id"], second["id"])
        self.assertTrue(first["id"].startswith("demo-"))

    def test_demo_user_is_explicitly_marked_and_seeded(self):
        user = asyncio.run(demo_login(DemoLoginRequest(name="Eco Explorer")))
        demo_logs = _demo_activity_logs(date(2026, 9, 14))

        self.assertTrue(user["id"].startswith("demo-"))
        self.assertTrue(user["is_demo"])
        self.assertGreater(len(demo_logs), 0)
        self.assertGreater(demo_logs[-1]["total_kg"], 0)

    def test_fresh_public_user_is_not_demo(self):
        user = _public_user({
            "id": "fresh-user",
            "name": "Fresh User",
            "email": "fresh@example.com",
            "avatar": "/avatars/avatar_sofia.png",
            "carbon_aura": "#9EABBC",
            "streak": 0,
            "xp": 0,
            "grade": "Newbie",
        })

        self.assertFalse(user["is_demo"])

    def test_default_cors_policy_is_not_a_wildcard(self):
        self.assertNotIn("*", cors_origins)
        self.assertIn("http://localhost:3000", cors_origins)
