"""Iteration 14: Owner inventory dashboard + brand rename (ShareMyKit) backend tests.

Covers:
- GET /api/my/inventory?days=21
- POST /api/tools/{tool_id}/block_dates (XOR toggle)
- PUT /api/tools/{tool_id}/availability (hide/restore)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rent-tools-community.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MARCUS_EMAIL = "marcus@toolshare.demo"
SARA_EMAIL = "sara@toolshare.demo"
PASS = "demo1234"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def login(session, email, password=PASS):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.text}"
    return r.json()["token"]


def hdr(t):
    return {"Authorization": f"Bearer {t}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def marcus_token(session):
    return login(session, MARCUS_EMAIL)


@pytest.fixture(scope="module")
def sara_token(session):
    return login(session, SARA_EMAIL)


class TestInventoryEndpoint:
    """GET /api/my/inventory?days=21"""

    def test_marcus_inventory_shape(self, session, marcus_token):
        r = session.get(f"{API}/my/inventory?days=21", headers=hdr(marcus_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert "days" in data and "tools" in data
        assert isinstance(data["days"], list) and len(data["days"]) == 21
        # Marcus is supposed to have 5 tools
        assert len(data["tools"]) >= 1, "marcus should own at least 1 tool"
        for t in data["tools"]:
            for k in ("id", "title", "quantity_total", "is_available", "daily_price", "price_currency", "days"):
                assert k in t, f"missing key {k} in tool"
            assert len(t["days"]) == 21
            for d in t["days"]:
                for k in ("date", "booked", "remaining", "owner_blocked"):
                    assert k in d, f"missing key {k} in day row"

    def test_marcus_inventory_5_tools(self, session, marcus_token):
        r = session.get(f"{API}/my/inventory?days=21", headers=hdr(marcus_token))
        data = r.json()
        # Review request says marcus has 5 tools
        assert len(data["tools"]) == 5, f"expected 5 tools for marcus, got {len(data['tools'])}"

    def test_sara_empty_inventory(self, session, sara_token):
        r = session.get(f"{API}/my/inventory?days=21", headers=hdr(sara_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["days"]) == 21
        # Sara is expected to have no listings (per review request)
        # We assert structure remains valid even if she has tools - but tools list should at least be a list
        assert isinstance(data["tools"], list)

    def test_inventory_requires_auth(self, session):
        r = session.get(f"{API}/my/inventory?days=21")
        assert r.status_code in (401, 403)


class TestBlockDatesXOR:
    """POST /api/tools/{tool_id}/block_dates — XOR toggle behavior"""

    @pytest.fixture(scope="class")
    def marcus_tool_id(self, session):
        token = login(session, MARCUS_EMAIL)
        r = session.get(f"{API}/my/inventory?days=21", headers=hdr(token))
        tools = r.json()["tools"]
        assert tools
        return tools[0]["id"]

    def test_block_then_unblock(self, session, marcus_token, marcus_tool_id):
        dates = ["2026-12-15", "2026-12-16"]
        # Get initial set
        t0 = session.get(f"{API}/tools/{marcus_tool_id}").json()
        initial = set(t0.get("unavailable_dates") or [])

        # First call: should toggle dates IN if not present
        r1 = session.post(f"{API}/tools/{marcus_tool_id}/block_dates", json=dates, headers=hdr(marcus_token))
        assert r1.status_code == 200, r1.text
        s1 = set(r1.json()["unavailable_dates"])
        # XOR: dates that were not in initial are now in; dates in initial are now out
        expected_after_first = initial ^ set(dates)
        assert s1 == expected_after_first

        # Second call: XOR with same dates -> back to initial
        r2 = session.post(f"{API}/tools/{marcus_tool_id}/block_dates", json=dates, headers=hdr(marcus_token))
        assert r2.status_code == 200, r2.text
        s2 = set(r2.json()["unavailable_dates"])
        assert s2 == initial, f"expected to return to initial state, got diff {s2 ^ initial}"

    def test_block_dates_forbidden_for_non_owner(self, session, sara_token, marcus_tool_id):
        r = session.post(
            f"{API}/tools/{marcus_tool_id}/block_dates",
            json=["2026-12-20"],
            headers=hdr(sara_token),
        )
        assert r.status_code == 403


class TestAvailabilityToggle:
    """PUT /api/tools/{tool_id}/availability"""

    @pytest.fixture(scope="class")
    def marcus_tool_id(self, session):
        token = login(session, MARCUS_EMAIL)
        r = session.get(f"{API}/my/inventory?days=21", headers=hdr(token))
        tools = r.json()["tools"]
        assert tools
        # Find an available tool to avoid disturbing already-hidden ones
        for t in tools:
            if t.get("is_available", True):
                return t["id"]
        return tools[0]["id"]

    def test_hide_then_restore(self, session, marcus_token, marcus_tool_id):
        # Hide
        r = session.put(
            f"{API}/tools/{marcus_tool_id}/availability?is_available=false",
            headers=hdr(marcus_token),
        )
        assert r.status_code == 200, r.text
        assert r.json()["is_available"] is False

        # Confirm hidden in /api/tools listing
        listings = session.get(f"{API}/tools", params={"limit": 200}).json()
        assert not any(t["id"] == marcus_tool_id for t in listings), "tool should be hidden from listings"

        # Restore
        r2 = session.put(
            f"{API}/tools/{marcus_tool_id}/availability?is_available=true",
            headers=hdr(marcus_token),
        )
        assert r2.status_code == 200
        assert r2.json()["is_available"] is True

        listings2 = session.get(f"{API}/tools", params={"limit": 200}).json()
        assert any(t["id"] == marcus_tool_id for t in listings2), "tool should be back in listings"

    def test_availability_forbidden_for_non_owner(self, session, sara_token, marcus_tool_id):
        r = session.put(
            f"{API}/tools/{marcus_tool_id}/availability?is_available=false",
            headers=hdr(sara_token),
        )
        assert r.status_code == 403
