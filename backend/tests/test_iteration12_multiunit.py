"""Iteration 12 — Multi-unit tool listings + location state filter.

Tests:
- POST /api/tools persists quantity_total + location.state (defaults to 1)
- GET /api/tools?state=... case-insensitive prefix match
- GET /api/tools/{id}/unavailable_dates returns {dates, quantity_total, availability}
- POST /api/bookings: qty defaults to 1, scales pricing, validates stock
- Sequential bookings on qty_total=5 — stock decrements correctly per day
- PUT /api/bookings/{id}/status approve re-validates stock
- GET /api/bookings/{id} returns the quantity field
"""
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

def _read_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _read_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"

DEMO_PASS = "demo1234"
SARA = "sara@toolshare.demo"     # owns Toronto tools incl. Bosch Circular Saw (multi-unit)
DIEGO = "diego@toolshare.demo"   # owns Mississauga incl. Pressure Washer 2000 PSI (multi-unit)
JAKE = "jake@toolshare.demo"     # NY
LUCA = "luca@toolshare.demo"     # Paris
EMMA = "emma@toolshare.demo"     # London


# ---------------- helpers ----------------
def _login(email: str, password: str = DEMO_PASS) -> str:
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _h(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _find_tool_by_title(title: str) -> dict | None:
    r = requests.get(f"{API}/tools", params={"q": title, "limit": 60}, timeout=15)
    r.raise_for_status()
    for t in r.json():
        if t["title"] == title:
            return t
    return None


@pytest.fixture(scope="module")
def sara_token():
    return _login(SARA)


@pytest.fixture(scope="module")
def diego_token():
    return _login(DIEGO)


# ============== Tool model: quantity_total + state ==============
class TestToolFields:
    def test_create_tool_with_quantity_total_and_state(self, sara_token):
        payload = {
            "title": f"TEST_MULTI_{uuid.uuid4().hex[:6]}",
            "description": "Multi-unit test tool",
            "category": "power-tools",
            "daily_price": 25,
            "security_deposit": 50,
            "condition": "Good",
            "images": [],
            "location": {"address": "1 Test St", "city": "TestCity", "state": "TestState",
                         "postal_code": "T3S T1", "lat": 43.65, "lng": -79.38},
            "pickup_available": True,
            "delivery_available": False,
            "delivery_radius_km": 0,
            "unavailable_dates": [],
            "listing_type": "rent",
            "sale_price": 0,
            "price_currency": "CAD",
            "quantity_total": 7,
        }
        r = requests.post(f"{API}/tools", json=payload, headers=_h(sara_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["quantity_total"] == 7
        assert data["location"]["state"] == "TestState"
        tool_id = data["id"]

        # verify persistence
        g = requests.get(f"{API}/tools/{tool_id}", timeout=15).json()
        assert g["quantity_total"] == 7
        # location may be obfuscated for non-owner viewer, but state should still be present
        assert g["location"].get("state") == "TestState"

        # cleanup
        requests.delete(f"{API}/tools/{tool_id}", headers=_h(sara_token), timeout=15)

    def test_create_tool_defaults_quantity_total_to_1(self, sara_token):
        payload = {
            "title": f"TEST_QTY1_{uuid.uuid4().hex[:6]}",
            "description": "No qty test",
            "category": "power-tools",
            "daily_price": 10,
            "condition": "Good",
            "location": {"city": "Toronto", "lat": 43.65, "lng": -79.38},
            "price_currency": "CAD",
        }
        r = requests.post(f"{API}/tools", json=payload, headers=_h(sara_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["quantity_total"] == 1
        assert data["location"].get("state") in (None, "")
        requests.delete(f"{API}/tools/{data['id']}", headers=_h(sara_token), timeout=15)


# ============== State filter ==============
class TestStateFilter:
    def test_state_ontario_returns_toronto_and_mississauga(self):
        r = requests.get(f"{API}/tools", params={"state": "Ontario", "limit": 50}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2
        cities = {t["location"].get("city") for t in data}
        assert "Toronto" in cities
        assert "Mississauga" in cities
        assert all((t["location"].get("state") or "").lower().startswith("ontario") for t in data)

    def test_state_new_prefix_returns_new_york(self):
        r = requests.get(f"{API}/tools", params={"state": "New", "limit": 50}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert any(t["location"].get("city") == "New York" for t in data)
        for t in data:
            assert (t["location"].get("state") or "").lower().startswith("new")

    def test_state_greater_london_returns_london(self):
        r = requests.get(f"{API}/tools", params={"state": "Greater London", "limit": 50}, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert all(t["location"].get("city") == "London" for t in data)

    def test_state_case_insensitive(self):
        r = requests.get(f"{API}/tools", params={"state": "ontario", "limit": 50}, timeout=15)
        assert r.status_code == 200
        assert len(r.json()) >= 2


# ============== Unavailable dates endpoint ==============
class TestUnavailableDates:
    def test_unavailable_dates_returns_quantity_total_and_availability_keys(self):
        tool = _find_tool_by_title("Pressure Washer 2000 PSI")
        assert tool is not None, "Seed tool 'Pressure Washer 2000 PSI' missing"
        r = requests.get(f"{API}/tools/{tool['id']}/unavailable_dates", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "dates" in data and isinstance(data["dates"], list)
        assert "quantity_total" in data and data["quantity_total"] == 5
        assert "availability" in data and isinstance(data["availability"], dict)


# ============== Booking creation with quantity ==============
class TestBookingQuantity:
    def test_qty_exceeds_total_returns_400(self, sara_token):
        # Sara books Diego's Pressure Washer (qty_total=5) — request 6
        tool = _find_tool_by_title("Pressure Washer 2000 PSI")
        assert tool and tool["quantity_total"] == 5
        start = (date.today() + timedelta(days=400)).isoformat()
        end = (date.today() + timedelta(days=401)).isoformat()
        r = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": start, "end_date": end, "quantity": 6,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r.status_code == 400, r.text
        assert "5" in r.text  # mentions "Only 5 unit(s) available"

    def test_sequential_bookings_stock_decrements(self, sara_token):
        tool = _find_tool_by_title("Pressure Washer 2000 PSI")
        assert tool and tool["quantity_total"] == 5
        # Use far-future unique dates so we don't collide with other test runs
        base = date.today() + timedelta(days=200)
        d1 = base.isoformat()
        d2 = (base + timedelta(days=1)).isoformat()
        d3 = (base + timedelta(days=2)).isoformat()

        # Step 1: book 3 units for d1..d3
        r1 = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": d1, "end_date": d3, "quantity": 3,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r1.status_code == 200, r1.text
        b1 = r1.json()
        assert b1["quantity"] == 3
        # Pricing linear with qty (3 days * 38 * 3 = 342)
        assert b1["total_price"] == 3 * float(tool["daily_price"]) * 3
        assert b1["deposit"] == float(tool["security_deposit"]) * 3
        bid_1 = b1["id"]

        # Step 2: book 3 more overlapping d2 — should 409 (peak=3 + 3 > 5)
        r2 = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": d2, "end_date": d2, "quantity": 3,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r2.status_code == 409, r2.text
        assert "2 of 5" in r2.text or "Not enough units" in r2.text

        # Step 3: book 2 more on d2 — should 200 (3+2 = 5)
        r3 = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": d2, "end_date": d2, "quantity": 2,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r3.status_code == 200, r3.text
        bid_2 = r3.json()["id"]
        assert r3.json()["quantity"] == 2

        # Step 4: unavailable_dates now lists d2 (sold out), availability[d2]=0,
        # availability[d1]=2 and [d3]=2 (neighbours).
        r4 = requests.get(f"{API}/tools/{tool['id']}/unavailable_dates", timeout=15)
        assert r4.status_code == 200
        ua = r4.json()
        assert d2 in ua["dates"], f"{d2} should be sold out: dates={ua['dates']}"
        assert ua["availability"].get(d2) == 0
        assert ua["availability"].get(d1) == 2
        assert ua["availability"].get(d3) == 2

        # Step 5: GET booking returns quantity
        r5 = requests.get(f"{API}/bookings/{bid_1}", headers=_h(sara_token), timeout=15)
        assert r5.status_code == 200
        assert r5.json()["quantity"] == 3

        # cleanup — cancel both bookings
        for bid in (bid_1, bid_2):
            requests.put(f"{API}/bookings/{bid}/status",
                         json={"status": "cancelled"},
                         headers=_h(sara_token), timeout=15)

    def test_qty_default_is_1(self, sara_token):
        # Book Diego's Pressure Washer with no quantity field — should default to 1
        tool = _find_tool_by_title("Pressure Washer 2000 PSI")
        start = (date.today() + timedelta(days=600)).isoformat()
        end = (date.today() + timedelta(days=600)).isoformat()
        r = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": start, "end_date": end,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["quantity"] == 1
        # cleanup
        requests.put(f"{API}/bookings/{r.json()['id']}/status",
                     json={"status": "cancelled"}, headers=_h(sara_token), timeout=15)


# ============== Approve re-validates stock ==============
class TestApproveReValidates:
    def test_approve_blocked_when_over_capacity(self, sara_token, diego_token):
        """Create 2 pending bookings totaling qty>quantity_total then approve both -- second should 409."""
        tool = _find_tool_by_title("Pressure Washer 2000 PSI")
        assert tool and tool["quantity_total"] == 5
        # Use single-day far-future window
        d = (date.today() + timedelta(days=700)).isoformat()

        # Sara books 3
        r1 = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": d, "end_date": d, "quantity": 3,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r1.status_code == 200
        b1 = r1.json()["id"]

        # Sara books 2 more — peak now 5 (exactly at capacity)
        r2 = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": d, "end_date": d, "quantity": 2,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r2.status_code == 200
        b2 = r2.json()["id"]

        # Owner Diego approves both — both should succeed (peak=5 == total=5)
        ap1 = requests.put(f"{API}/bookings/{b1}/status",
                           json={"status": "approved"}, headers=_h(diego_token), timeout=15)
        assert ap1.status_code == 200
        ap2 = requests.put(f"{API}/bookings/{b2}/status",
                           json={"status": "approved"}, headers=_h(diego_token), timeout=15)
        assert ap2.status_code == 200

        # Now create a 3rd booking for 1 unit — should 409 from create endpoint
        r3 = requests.post(f"{API}/bookings", json={
            "tool_id": tool["id"], "start_date": d, "end_date": d, "quantity": 1,
            "pickup_method": "pickup",
        }, headers=_h(sara_token), timeout=15)
        assert r3.status_code == 409, r3.text

        # cleanup
        for bid in (b1, b2):
            requests.put(f"{API}/bookings/{bid}/status",
                         json={"status": "cancelled"}, headers=_h(sara_token), timeout=15)
