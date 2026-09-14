import asyncio
import base64
from datetime import date
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
)
from backend.food_emissions import estimate_food_emissions, load_food_product_factors
import backend.ml_service as ml_service
from backend.server import (
    FoodScanRequest,
    MorningActivity,
    PredictDayRequest,
    SimulateRequest,
    DemoLoginRequest,
    _demo_activity_logs,
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
            transport="mixed", diet="mixed", electricity_kwh=3200, flights_per_year=2, horizon_years=10,
        )))

        self.assertEqual(body.method, "scenario_calculator")
        self.assertEqual(body.model_status, "transparent_scenario_not_time_series_ml")
        self.assertIsNone(body.future_temp_delta)

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

    def test_french_fries_are_calculated_from_csv_factors_and_portion(self):
        estimate = estimate_food_emissions("french fries", serving_g=180)

        self.assertIsNotNone(estimate)
        self.assertEqual(estimate["factor_source"], "Food_Product_Emissions.csv")
        self.assertEqual(estimate["serving_size_g"], 180)
        self.assertEqual(estimate["co2_kg"], 0.146)
        self.assertEqual({item["ingredient"] for item in estimate["components"]}, {"Potatoes", "Sunflower Oil"})

    def test_food_scan_requires_image_candidate_and_dish_name_to_agree(self):
        image_data = base64.b64encode(b"test-image-bytes").decode("ascii")
        vit_result = {"food": "french fries", "score": 0.99}

        with patch.object(ml_service, "_predict_food_vit", return_value=vit_result), \
             patch.object(ml_service, "_predict_food_gemini", return_value={"food": "french fries", "confidence": 90, "serving_g": 200}):
            mismatch = ml_service.predict_food(image_data, hint="biryani")
            match = ml_service.predict_food(image_data, hint="french fries")

        self.assertEqual(mismatch["status"], "rejected")
        self.assertIn("does not match", mismatch["message"])
        self.assertEqual(match["status"], "success")
        self.assertEqual(match["method"], "vision_dish_agreement")
        self.assertEqual(match["co2_kg"], 0.162)
        self.assertEqual(match["factor_source"], "Food_Product_Emissions.csv")

    def test_food_scan_rejects_when_independent_image_checks_disagree(self):
        image_data = base64.b64encode(b"test-image-bytes").decode("ascii")

        with patch.object(ml_service, "_predict_food_vit", return_value={"food": "french fries", "score": 0.99}), \
             patch.object(ml_service, "_predict_food_gemini", return_value={"food": "chicken biryani", "confidence": 95, "serving_g": 300}):
            result = ml_service.predict_food(image_data, hint="french fries")

        self.assertEqual(result["status"], "rejected")
        self.assertIn("disagreed", result["message"])

    def test_reproducible_daily_pipeline_and_metrics_are_loadable(self):
        project_root = Path(__file__).resolve().parents[2]
        models_dir = project_root / "backend" / "ml" / "models"
        load_models(str(models_dir))

        prediction = predict_gbdt(GBDT_DEFAULTS)
        status = get_model_status(str(models_dir))

        self.assertIsNotNone(prediction)
        self.assertTrue(status["runtime"]["daily_carbon_predictor"]["pipeline_loaded"])
        self.assertEqual(status["evaluation"]["daily_carbon"]["metrics"]["r2_holdout"], 0.8935)

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
