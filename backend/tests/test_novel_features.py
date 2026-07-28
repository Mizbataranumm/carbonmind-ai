"""Backend tests for the 4 NOVEL features of CarbonMind AI (iteration 2)."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ============ Novel Feature 1: Predictive Carbon Budget ============
def test_predict_day_exceeds(client):
    payload = {
        "morning_activities": [
            {"type": "transport", "kg": 1.4},
            {"type": "electricity", "kg": 0.6},
        ],
        "daily_budget_kg": 6.5,
    }
    r = client.post(f"{BASE_URL}/api/predict/day", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ["predicted_full_day_kg", "budget_kg", "exceeds", "over_pct",
              "hourly_curve", "equivalents", "breakdown_by_type", "ai_headline"]:
        assert k in data, f"missing {k}"
    # 2.0 / 0.18 = 11.11 -> exceeds 6.5 budget
    assert data["predicted_full_day_kg"] > 6.5
    assert data["exceeds"] is True
    assert data["over_pct"] > 0
    assert isinstance(data["hourly_curve"], list) and len(data["hourly_curve"]) == 24
    for eq_key in ["trees_to_offset", "km_by_car", "smartphone_charges", "beef_burgers"]:
        assert eq_key in data["equivalents"], f"missing equiv {eq_key}"
    assert isinstance(data["breakdown_by_type"], list) and len(data["breakdown_by_type"]) == 2


def test_predict_day_under_budget(client):
    payload = {
        "morning_activities": [{"type": "food", "kg": 0.2}],
        "daily_budget_kg": 6.5,
    }
    r = client.post(f"{BASE_URL}/api/predict/day", json=payload, timeout=15)
    assert r.status_code == 200
    d = r.json()
    # 0.2/0.18 = 1.11 -> under 6.5
    assert d["exceeds"] is False
    assert d["predicted_full_day_kg"] < 6.5


# ============ Novel Feature 2: Voice Call Tips ============
def test_voice_call_tips(client):
    payload = {"weekly_kg": 41.8, "top_category": "Transport", "user_name": "Test"}
    r = client.post(f"{BASE_URL}/api/voice/call-tips", json=payload, timeout=90)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["greeting", "body", "tips", "signoff", "full_script"]:
        assert k in d
    assert isinstance(d["tips"], list) and len(d["tips"]) == 3
    assert len(d["full_script"]) > 30
    # Ensure fallback still populates
    for t in d["tips"]:
        assert isinstance(t, str) and len(t) > 0


# ============ Novel Feature 3: Food Carbon Scanner ============
def test_food_scan_with_hint(client):
    r = client.post(f"{BASE_URL}/api/food/scan", json={"hint": "burger"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert "items" in d and isinstance(d["items"], list) and len(d["items"]) >= 1
    assert "total_co2_kg" in d and isinstance(d["total_co2_kg"], (int, float))
    assert "ai_note" in d and isinstance(d["ai_note"], str)
    for item in d["items"]:
        for k in ["name", "portion", "co2_kg", "category", "tip"]:
            assert k in item


def test_food_scan_no_hint(client):
    r = client.post(f"{BASE_URL}/api/food/scan", json={}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert 2 <= len(d["items"]) <= 4


# ============ Novel Feature 4: Certificate Generation ============
def test_certificate_generate(client):
    payload = {"user_name": "Mizba", "co2_saved_kg": 24.8}
    r = client.post(f"{BASE_URL}/api/certificate/generate", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ["cert_id", "user_name", "month", "co2_saved_kg", "grade",
              "equivalents", "issued_at", "signature", "verify_url"]:
        assert k in d
    assert d["cert_id"].startswith("CM-")
    assert d["user_name"] == "Mizba"
    assert d["co2_saved_kg"] == 24.8
    for eq_key in ["trees_planted_equivalent", "km_by_car_avoided", "smartphone_charges_saved"]:
        assert eq_key in d["equivalents"]
    assert "CarbonMind" in d["signature"]


def test_certificate_defaults(client):
    r = client.post(f"{BASE_URL}/api/certificate/generate",
                    json={"user_name": "DefaultUser"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["cert_id"].startswith("CM-")
    assert d["co2_saved_kg"] == 24.8  # default
    assert d["grade"] == "A-"
