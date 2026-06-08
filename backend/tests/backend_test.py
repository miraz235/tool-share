"""ToolShare Backend pytest suite.

Tests core flows: health, auth, tools, bookings, favorites, reviews, AI.
"""
import io
import os
import time
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rent-tools-community.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SEED_EMAIL = "marcus@toolshare.demo"
SEED_PASS = "demo1234"
SARA_EMAIL = "sara@toolshare.demo"
TORONTO = (43.6532, -79.3832)


# -------- Fixtures --------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def marcus_token(session):
    r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": SEED_PASS})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def sara_token(session):
    r = session.post(f"{API}/auth/login", json={"email": SARA_EMAIL, "password": SEED_PASS})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------- Health & categories --------
class TestHealth:
    def test_root(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_categories(self, session):
        r = session.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 13
        slugs = {c["slug"] for c in cats}
        assert "power-tools" in slugs


# -------- Auth --------
class TestAuth:
    def test_register_new_user(self, session):
        email = f"test_{uuid.uuid4().hex[:8]}@toolshare.demo"
        r = session.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "name": "Test User"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "token" in d and len(d["token"]) > 20
        assert d["user"]["email"] == email
        assert d["user"]["auth_provider"] == "email"

    def test_register_duplicate(self, session):
        r = session.post(f"{API}/auth/register", json={"email": SEED_EMAIL, "password": "x" * 6, "name": "Dup"})
        assert r.status_code == 400

    def test_login_seeded_user(self, session, marcus_token):
        assert isinstance(marcus_token, str) and len(marcus_token) > 20

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"email": SEED_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me(self, session, marcus_token):
        r = session.get(f"{API}/auth/me", headers=auth_headers(marcus_token))
        assert r.status_code == 200
        assert r.json()["email"] == SEED_EMAIL

    def test_auth_me_unauthenticated(self, session):
        r = session.get(f"{API}/auth/me", headers={"Content-Type": "application/json"})
        assert r.status_code == 401


# -------- Tools --------
class TestTools:
    def test_list_tools_min_12(self, session):
        r = session.get(f"{API}/tools")
        assert r.status_code == 200
        tools = r.json()
        assert len(tools) >= 12

    def test_filter_by_category(self, session):
        r = session.get(f"{API}/tools", params={"category": "power-tools"})
        assert r.status_code == 200
        tools = r.json()
        assert len(tools) > 0
        assert all(t["category"] == "power-tools" for t in tools)

    def test_filter_by_city(self, session):
        r = session.get(f"{API}/tools", params={"city": "Toronto"})
        assert r.status_code == 200
        tools = r.json()
        assert len(tools) > 0
        assert all(t["location"]["city"].lower() == "toronto" for t in tools)

    def test_distance_sort(self, session):
        r = session.get(f"{API}/tools", params={"lat": TORONTO[0], "lng": TORONTO[1], "radius_km": 100})
        assert r.status_code == 200
        tools = r.json()
        assert len(tools) > 0
        for t in tools:
            assert "distance_km" in t
        dists = [t["distance_km"] for t in tools]
        assert dists == sorted(dists)

    def test_get_tool_with_owner_and_view_increment(self, session):
        tools = session.get(f"{API}/tools").json()
        tid = tools[0]["id"]
        v0 = tools[0].get("view_count", 0)
        r = session.get(f"{API}/tools/{tid}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == tid
        assert "owner" in d and d["owner"] is not None
        assert d["owner"]["id"] == d["owner_id"]
        # second call should have incremented
        r2 = session.get(f"{API}/tools/{tid}")
        assert r2.json()["view_count"] > v0

    def test_create_tool(self, session, marcus_token):
        payload = {
            "title": "TEST_Hammer Drill",
            "description": "TEST tool listing",
            "category": "power-tools",
            "daily_price": 25.0,
            "security_deposit": 50.0,
            "condition": "Good",
            "images": [],
            "location": {"city": "Toronto", "lat": TORONTO[0], "lng": TORONTO[1]},
            "pickup_available": True,
        }
        r = session.post(f"{API}/tools", json=payload, headers=auth_headers(marcus_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == payload["title"]
        assert d["owner_id"]
        # cleanup
        session.delete(f"{API}/tools/{d['id']}", headers=auth_headers(marcus_token))


# -------- Upload --------
class TestUpload:
    def test_upload_image(self, marcus_token):
        # 1x1 PNG
        png = bytes.fromhex(
            "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        r = requests.post(
            f"{API}/upload",
            files=files,
            headers={"Authorization": f"Bearer {marcus_token}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "path" in d and "url" in d
        assert d["url"].startswith("/api/files/")


# -------- Bookings, favorites, reviews flow --------
class TestBookingFlow:
    @pytest.fixture(scope="class")
    def setup_ids(self, session, marcus_token, sara_token):
        # Find a tool owned by Marcus and ensure Sara books it
        marcus_me = session.get(f"{API}/auth/me", headers=auth_headers(marcus_token)).json()
        sara_me = session.get(f"{API}/auth/me", headers=auth_headers(sara_token)).json()
        tools = session.get(f"{API}/tools", params={"owner_id": marcus_me["id"]}).json()
        assert tools, "Marcus should own seeded tools"
        return {"marcus_id": marcus_me["id"], "sara_id": sara_me["id"], "tool": tools[0]}

    def test_cannot_book_own_tool(self, session, marcus_token, setup_ids):
        tool = setup_ids["tool"]
        today = date.today()
        payload = {
            "tool_id": tool["id"],
            "start_date": today.isoformat(),
            "end_date": (today + timedelta(days=2)).isoformat(),
            "pickup_method": "pickup",
        }
        r = session.post(f"{API}/bookings", json=payload, headers=auth_headers(marcus_token))
        assert r.status_code == 400

    def test_full_booking_flow(self, session, marcus_token, sara_token, setup_ids):
        tool = setup_ids["tool"]
        today = date.today()
        days = 3
        start = today + timedelta(days=10)
        end = start + timedelta(days=days - 1)
        payload = {
            "tool_id": tool["id"],
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "pickup_method": "pickup",
            "message_to_owner": "TEST booking",
        }
        # Sara books
        r = session.post(f"{API}/bookings", json=payload, headers=auth_headers(sara_token))
        assert r.status_code == 200, r.text
        booking = r.json()
        assert booking["status"] == "pending"
        assert booking["total_price"] == days * tool["daily_price"]
        bid = booking["id"]

        # Renter cannot approve own
        r = session.put(f"{API}/bookings/{bid}/status", json={"status": "approved"}, headers=auth_headers(sara_token))
        assert r.status_code == 403

        # Owner approves
        r = session.put(f"{API}/bookings/{bid}/status", json={"status": "approved"}, headers=auth_headers(marcus_token))
        assert r.status_code == 200

        # Verify in bookings list
        r = session.get(f"{API}/bookings", params={"role": "renter"}, headers=auth_headers(sara_token))
        assert r.status_code == 200
        renter_bookings = r.json()
        my_b = next((b for b in renter_bookings if b["id"] == bid), None)
        assert my_b and my_b["status"] == "approved"
        assert my_b.get("tool") and my_b.get("counterparty")

        r = session.get(f"{API}/bookings", params={"role": "owner"}, headers=auth_headers(marcus_token))
        assert r.status_code == 200
        owner_bookings = r.json()
        assert any(b["id"] == bid for b in owner_bookings)

        # Review: tool review by renter
        r = session.post(
            f"{API}/reviews",
            json={"booking_id": bid, "rating": 5, "comment": "TEST great", "target_type": "tool"},
            headers=auth_headers(sara_token),
        )
        assert r.status_code == 200, r.text
        # Verify tool rating updated
        t_after = session.get(f"{API}/tools/{tool['id']}").json()
        assert t_after["rating_count"] >= 1
        assert t_after["rating_avg"] > 0

    def test_favorites_flow(self, session, sara_token, setup_ids):
        tool_id = setup_ids["tool"]["id"]
        r = session.post(f"{API}/favorites/{tool_id}", headers=auth_headers(sara_token))
        assert r.status_code == 200
        r = session.get(f"{API}/favorites", headers=auth_headers(sara_token))
        assert r.status_code == 200
        favs = r.json()
        assert any(t["id"] == tool_id for t in favs)
        r = session.delete(f"{API}/favorites/{tool_id}", headers=auth_headers(sara_token))
        assert r.status_code == 200
        favs2 = session.get(f"{API}/favorites", headers=auth_headers(sara_token)).json()
        assert not any(t["id"] == tool_id for t in favs2)


# -------- AI --------
class TestAI:
    def test_ai_recommend_fence(self, session):
        payload = {"task": "I need to build a fence", "lat": TORONTO[0], "lng": TORONTO[1], "radius_km": 100}
        r = session.post(f"{API}/ai/recommend", json=payload, timeout=90)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("summary", "difficulty", "estimated_time", "tools", "safety_tips"):
            assert k in d, f"missing {k}"
        assert isinstance(d["tools"], list) and len(d["tools"]) > 0
        for t in d["tools"]:
            for k in ("name", "category", "why", "essential", "available_listings"):
                assert k in t, f"tool missing {k}: {t}"
            assert isinstance(t["available_listings"], list)
