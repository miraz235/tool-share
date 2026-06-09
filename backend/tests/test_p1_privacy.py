"""Tests for ToolShare iteration_5 privacy/UX features:
- Location obfuscation for unauthed / unpaid renters
- /tools/{id}/unavailable_dates endpoint
- Messaging blocked for past bookings
"""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://rent-tools-community.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'test_database')

_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def marcus_token():
    return _login("marcus@toolshare.demo", "demo1234")


@pytest.fixture(scope="module")
def sara_token():
    return _login("sara@toolshare.demo", "demo1234")


@pytest.fixture(scope="module")
def marcus_id(marcus_token):
    r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {marcus_token}"}, timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


@pytest.fixture(scope="module")
def marcus_tool(marcus_id):
    r = requests.get(f"{API}/tools", params={"owner_id": marcus_id, "limit": 5}, timeout=15)
    assert r.status_code == 200
    tools = r.json()
    assert len(tools) > 0, "marcus has no tools"
    return tools[0]


# ------------ Location obfuscation ------------
class TestLocationObfuscation:
    def test_unauthed_get_tool_returns_approximate_location(self, marcus_tool):
        tid = marcus_tool["id"]
        r = requests.get(f"{API}/tools/{tid}", timeout=15)
        assert r.status_code == 200
        loc = r.json()["location"]
        assert loc.get("is_approximate") is True, loc
        assert loc.get("address") is None
        assert loc.get("postal_code") is None
        assert loc.get("city")  # still visible
        # lat/lng rounded to 2 decimals
        lat = loc["lat"]
        lng = loc["lng"]
        assert round(lat, 2) == lat, f"lat not rounded: {lat}"
        assert round(lng, 2) == lng, f"lng not rounded: {lng}"

    def test_owner_get_tool_returns_precise_location(self, marcus_tool, marcus_token):
        tid = marcus_tool["id"]
        r = requests.get(f"{API}/tools/{tid}", headers={"Authorization": f"Bearer {marcus_token}"}, timeout=15)
        assert r.status_code == 200
        loc = r.json()["location"]
        assert loc.get("is_approximate") is False
        # precision: lat/lng usually have more decimals
        # postal_code may or may not be set in seed; require address presence to be unchanged from db
        raw = _db.tools.find_one({"id": tid})
        assert loc.get("address") == raw["location"].get("address")
        assert loc.get("postal_code") == raw["location"].get("postal_code")
        assert loc.get("lat") == raw["location"]["lat"]
        assert loc.get("lng") == raw["location"]["lng"]

    def test_non_paid_renter_gets_approximate(self, sara_token, marcus_tool):
        # Sara hasn't paid for marcus_tool (presumably) — should get approximate
        tid = marcus_tool["id"]
        # ensure no paid booking exists for sara on this tool
        sara_id = requests.get(f"{API}/auth/me",
                               headers={"Authorization": f"Bearer {sara_token}"}, timeout=15).json()["id"]
        existing_paid = _db.bookings.find_one({
            "tool_id": tid, "renter_id": sara_id, "paid": True,
            "status": {"$in": ["approved", "completed"]}
        })
        if existing_paid:
            pytest.skip("Sara already has a paid booking on this tool")
        r = requests.get(f"{API}/tools/{tid}",
                         headers={"Authorization": f"Bearer {sara_token}"}, timeout=15)
        assert r.status_code == 200
        loc = r.json()["location"]
        assert loc.get("is_approximate") is True

    def test_paid_renter_gets_precise(self, sara_token):
        # Find the paid booking sara has (bk_3f8b07fe1ec0 on Air Compressor)
        sara_id = requests.get(f"{API}/auth/me",
                               headers={"Authorization": f"Bearer {sara_token}"}, timeout=15).json()["id"]
        paid = _db.bookings.find_one({
            "renter_id": sara_id, "paid": True,
            "status": {"$in": ["approved", "completed"]}
        })
        if not paid:
            pytest.skip("No paid booking exists for sara")
        tid = paid["tool_id"]
        r = requests.get(f"{API}/tools/{tid}",
                         headers={"Authorization": f"Bearer {sara_token}"}, timeout=15)
        assert r.status_code == 200
        loc = r.json()["location"]
        assert loc.get("is_approximate") is False, loc
        raw = _db.tools.find_one({"id": tid})
        assert loc.get("address") == raw["location"].get("address")


# ------------ Unavailable dates endpoint ------------
class TestUnavailableDates:
    def test_endpoint_returns_dates_list(self, marcus_tool):
        tid = marcus_tool["id"]
        r = requests.get(f"{API}/tools/{tid}/unavailable_dates", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "dates" in data
        assert isinstance(data["dates"], list)
        # each date should be ISO format YYYY-MM-DD
        for d in data["dates"]:
            datetime.fromisoformat(d)

    def test_endpoint_includes_approved_booking_range(self):
        # Find an approved booking, ensure all dates in range appear
        b = _db.bookings.find_one({"status": {"$in": ["approved", "completed"]}})
        if not b:
            pytest.skip("No approved booking exists")
        tid = b["tool_id"]
        r = requests.get(f"{API}/tools/{tid}/unavailable_dates", timeout=15)
        assert r.status_code == 200
        dates = set(r.json()["dates"])
        s = datetime.fromisoformat(b["start_date"]).date()
        e = datetime.fromisoformat(b["end_date"]).date()
        cur = s
        while cur <= e:
            assert cur.isoformat() in dates, f"missing {cur} for booking {b['id']}"
            cur += timedelta(days=1)

    def test_unknown_tool_returns_404(self):
        r = requests.get(f"{API}/tools/tool_does_not_exist_xxx/unavailable_dates", timeout=15)
        assert r.status_code == 404


# ------------ Messaging blocked for ended bookings ------------
class TestMessagingClosed:
    def test_post_message_blocked_for_past_end_date(self, sara_token):
        # Find or create a booking with end_date in the past where sara is renter
        sara_id = requests.get(f"{API}/auth/me",
                               headers={"Authorization": f"Bearer {sara_token}"}, timeout=15).json()["id"]
        today_iso = datetime.now(timezone.utc).date().isoformat()
        past_booking = _db.bookings.find_one({
            "renter_id": sara_id,
            "end_date": {"$lt": today_iso}
        })
        created_id = None
        if not past_booking:
            # Create a past booking directly in Mongo (the create API would reject past dates)
            # pick any tool not owned by sara
            tool = _db.tools.find_one({"owner_id": {"$ne": sara_id}})
            assert tool is not None
            bid = f"bk_TEST_{datetime.now().timestamp():.0f}"
            doc = {
                "id": bid,
                "tool_id": tool["id"],
                "renter_id": sara_id,
                "owner_id": tool["owner_id"],
                "start_date": (datetime.now(timezone.utc).date() - timedelta(days=10)).isoformat(),
                "end_date": (datetime.now(timezone.utc).date() - timedelta(days=5)).isoformat(),
                "total_price": 50.0,
                "deposit": 0.0,
                "status": "completed",
                "pickup_method": "pickup",
                "delivery_address": None,
                "message_to_owner": None,
                "paid": True,
                "payout_owed": 45.0,
                "platform_fee_collected": 5.0,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }
            _db.bookings.insert_one(doc)
            past_booking = doc
            created_id = bid

        try:
            r = requests.post(
                f"{API}/messages",
                json={"booking_id": past_booking["id"], "content": "hello after end"},
                headers={"Authorization": f"Bearer {sara_token}"},
                timeout=15,
            )
            assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"
            detail = r.json().get("detail", "")
            assert "ended" in detail.lower() or "closed" in detail.lower(), detail
        finally:
            if created_id:
                _db.bookings.delete_one({"id": created_id})

    def test_post_message_works_for_active_booking(self, sara_token):
        sara_id = requests.get(f"{API}/auth/me",
                               headers={"Authorization": f"Bearer {sara_token}"}, timeout=15).json()["id"]
        today_iso = datetime.now(timezone.utc).date().isoformat()
        active = _db.bookings.find_one({
            "$or": [{"renter_id": sara_id}, {"owner_id": sara_id}],
            "end_date": {"$gte": today_iso}
        })
        if not active:
            pytest.skip("no active booking for sara")
        r = requests.post(
            f"{API}/messages",
            json={"booking_id": active["id"], "content": "TEST iteration_5 active message"},
            headers={"Authorization": f"Bearer {sara_token}"},
            timeout=15,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        assert data["content"] == "TEST iteration_5 active message"
        # cleanup
        _db.messages.delete_one({"id": data["id"]})


# ------------ Anti-double-booking regression ------------
class TestDoubleBookingRegression:
    def test_overlapping_booking_returns_409(self, sara_token):
        sara_id = requests.get(f"{API}/auth/me",
                               headers={"Authorization": f"Bearer {sara_token}"}, timeout=15).json()["id"]
        # Find an approved booking where sara is NOT involved
        b = _db.bookings.find_one({
            "status": "approved",
            "renter_id": {"$ne": sara_id},
            "start_date": {"$gte": datetime.now(timezone.utc).date().isoformat()},
        })
        if not b:
            pytest.skip("no future approved booking for regression")
        # Try to book the same tool for overlapping dates as sara
        r = requests.post(
            f"{API}/bookings",
            json={
                "tool_id": b["tool_id"],
                "start_date": b["start_date"],
                "end_date": b["end_date"],
                "pickup_method": "pickup",
            },
            headers={"Authorization": f"Bearer {sara_token}"},
            timeout=15,
        )
        # Should get 409 (overlap) or 400 (can't book your own tool) — assert it's not a successful 200
        assert r.status_code in (400, 409), f"expected conflict, got {r.status_code}: {r.text}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
