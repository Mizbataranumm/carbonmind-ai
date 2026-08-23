"""Community endpoints test suite - iteration 3."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'http://localhost:8001').rstrip('/')
API = f"{BASE_URL}/api"

USER_ID = f"TEST_{uuid.uuid4().hex[:8]}"
USER_NAME = "TEST Runner"


@pytest.fixture(scope="module")
def feed():
    """Trigger seed + get initial feed."""
    r = requests.get(f"{API}/community/feed", params={"user_id": USER_ID}, timeout=15)
    assert r.status_code == 200
    return r.json()


def test_feed_shape(feed):
    assert "posts" in feed and "challenges" in feed and "leaderboard" in feed
    assert len(feed["posts"]) >= 4
    assert len(feed["challenges"]) >= 5
    p = feed["posts"][0]
    for k in ("id", "user", "avatar", "text", "likes", "liked_by_me", "tag", "comments"):
        assert k in p, f"missing {k} in post"
    c = feed["challenges"][0]
    for k in ("id", "title", "members", "days_left", "reward", "joined_by_me"):
        assert k in c, f"missing {k} in challenge"


def test_like_toggle(feed):
    post_id = feed["posts"][0]["id"]
    base_likes = feed["posts"][0]["likes"]
    # Like
    r = requests.post(f"{API}/community/like", json={"user_id": USER_ID, "post_id": post_id})
    assert r.status_code == 200
    d = r.json()
    assert d["liked"] is True
    assert d["likes"] == base_likes + 1
    # Unlike
    r = requests.post(f"{API}/community/like", json={"user_id": USER_ID, "post_id": post_id})
    d = r.json()
    assert d["liked"] is False
    assert d["likes"] == base_likes


def test_comment(feed):
    post_id = feed["posts"][0]["id"]
    txt = "TEST comment " + uuid.uuid4().hex[:6]
    r = requests.post(f"{API}/community/comment", json={
        "user_id": USER_ID, "user_name": USER_NAME, "post_id": post_id, "text": txt
    })
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["comment"]["text"] == txt
    assert d["comment"]["user"] == USER_NAME
    # Verify persisted
    feed2 = requests.get(f"{API}/community/feed", params={"user_id": USER_ID}).json()
    post = next(p for p in feed2["posts"] if p["id"] == post_id)
    assert any(c["text"] == txt for c in post["comments"])


def test_comment_404():
    r = requests.post(f"{API}/community/comment", json={
        "user_id": USER_ID, "user_name": USER_NAME, "post_id": "nonexistent_pid", "text": "hi"
    })
    assert r.status_code == 404


def test_join_toggle(feed):
    cid = feed["challenges"][0]["id"]
    base_members = feed["challenges"][0]["members"]
    r = requests.post(f"{API}/community/join", json={"user_id": USER_ID, "challenge_id": cid})
    assert r.status_code == 200
    d = r.json()
    assert d["joined"] is True
    assert d["members"] == base_members + 1
    # Toggle off
    r = requests.post(f"{API}/community/join", json={"user_id": USER_ID, "challenge_id": cid})
    d = r.json()
    assert d["joined"] is False
    assert d["members"] == base_members


def test_create_post():
    txt = "TEST post " + uuid.uuid4().hex[:6]
    r = requests.post(f"{API}/community/post", json={
        "user_id": USER_ID, "user_name": USER_NAME, "text": txt, "tag": "Milestone"
    })
    assert r.status_code == 200
    d = r.json()
    assert d["ok"] is True
    assert d["post_id"].startswith("u_")
    # Verify in feed
    feed2 = requests.get(f"{API}/community/feed", params={"user_id": USER_ID}).json()
    assert any(p["text"] == txt and p["user"] == USER_NAME for p in feed2["posts"])


# ============ Legacy endpoints sanity ============

def test_demo_login():
    r = requests.post(f"{API}/auth/demo-login", json={"name": "Tester"})
    assert r.status_code == 200
    assert r.json()["name"] == "Tester"


def test_carbon_stats():
    r = requests.get(f"{API}/carbon/stats")
    assert r.status_code == 200
    assert "today_kg" in r.json()


def test_predict_day():
    r = requests.post(f"{API}/predict/day", json={
        "morning_activities": [{"type": "transport", "kg": 1.4}, {"type": "food", "kg": 0.3}],
        "daily_budget_kg": 6.5,
    })
    assert r.status_code == 200
    d = r.json()
    assert "predicted_full_day_kg" in d and "ai_headline" in d
    assert len(d["hourly_curve"]) == 24


def test_tracker_live():
    r = requests.get(f"{API}/tracker/live")
    assert r.status_code == 200 and "activities" in r.json()


def test_food_scan():
    r = requests.post(f"{API}/food/scan", json={"hint": "burger"})
    assert r.status_code == 200
    assert r.json()["total_co2_kg"] >= 0


def test_certificate():
    r = requests.post(f"{API}/certificate/generate", json={"user_name": "Tester"})
    assert r.status_code == 200
    assert r.json()["cert_id"].startswith("CM-")


def test_future_simulate():
    r = requests.post(f"{API}/future/simulate", json={
        "transport": "mixed", "diet": "mixed", "electricity_kwh": 3000,
        "flights_per_year": 2, "horizon_years": 5
    })
    assert r.status_code == 200
    assert "projected_co2" in r.json()
