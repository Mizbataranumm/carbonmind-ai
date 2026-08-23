"""Backend API tests for CarbonMind AI"""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://carbon-aura-lab.preview.emergentagent.com').rstrip('/')


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# Health
def test_root_ok(client):
    r = client.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


# Auth
def test_demo_login(client):
    r = client.post(f"{BASE_URL}/api/auth/demo-login", json={"name": "TestUser"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ["id", "name", "email", "avatar", "carbon_aura", "streak", "xp", "grade"]:
        assert k in data, f"missing {k}"
    assert data["name"] == "TestUser"


# Carbon stats
def test_carbon_stats(client):
    r = client.get(f"{BASE_URL}/api/carbon/stats", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ["today_kg", "week_kg", "score", "weekly_trend",
              "breakdown", "prediction", "achievements", "recommendations"]:
        assert k in data, f"missing {k}"
    assert isinstance(data["weekly_trend"], list) and len(data["weekly_trend"]) == 7
    assert isinstance(data["breakdown"], list) and len(data["breakdown"]) > 0


# Tracker
def test_tracker_live(client):
    r = client.get(f"{BASE_URL}/api/tracker/live", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ["activities", "categories", "realtime"]:
        assert k in data
        assert isinstance(data[k], list) and len(data[k]) > 0


# Future simulate
def test_future_simulate(client):
    payload = {
        "transport": "car",
        "diet": "meat",
        "electricity_kwh": 4000,
        "flights_per_year": 3,
        "horizon_years": 10
    }
    r = client.post(f"{BASE_URL}/api/future/simulate", json=payload, timeout=20)
    assert r.status_code == 200
    data = r.json()
    for k in ["current_annual_co2", "projected_co2", "future_temp_delta",
              "earth_health", "future_summary", "yearly_breakdown", "recommendations"]:
        assert k in data, f"missing {k}"
    assert len(data["yearly_breakdown"]) == 11  # horizon+1
    assert 0 <= data["earth_health"] <= 100
    assert isinstance(data["recommendations"], list) and len(data["recommendations"]) > 0


# Community
def test_community_feed(client):
    r = client.get(f"{BASE_URL}/api/community/feed", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in ["posts", "challenges", "leaderboard"]:
        assert k in data and isinstance(data[k], list) and len(data[k]) > 0


# Chat (fallback OK)
def test_chat_sustainability(client):
    r = client.post(f"{BASE_URL}/api/chat/sustainability",
                    json={"session_id": "test-sess-1", "message": "How can I reduce my commute carbon?"},
                    timeout=60)
    assert r.status_code == 200
    data = r.json()
    assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0
    assert data["session_id"] == "test-sess-1"
