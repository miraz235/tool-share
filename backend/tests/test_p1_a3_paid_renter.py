"""[A3] Flip a booking to paid=true approved and verify renter sees precise location."""
import os
import requests
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
API = f"{BASE_URL}/api"
MONGO_URL = os.environ.get('MONGO_URL')
DB_NAME = os.environ.get('DB_NAME')
_db = MongoClient(MONGO_URL)[DB_NAME]


def _login(email, pw):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=20)
    assert r.status_code == 200
    return r.json()["token"]


def test_paid_renter_sees_precise_location_after_flip():
    sara_token = _login("sara@toolshare.demo", "demo1234")
    sara_id = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {sara_token}"}, timeout=15).json()["id"]
    # Pick marcus's tool
    tool = _db.tools.find_one({"owner_id": {"$ne": sara_id}})
    assert tool is not None
    tid = tool["id"]

    # Step 1: Before flip — should be approximate
    r1 = requests.get(f"{API}/tools/{tid}", headers={"Authorization": f"Bearer {sara_token}"}, timeout=15)
    assert r1.status_code == 200
    assert r1.json()["location"]["is_approximate"] is True

    # Step 2: Insert a paid+approved booking for sara on this tool
    bid = f"bk_TEST_A3_{datetime.now().timestamp():.0f}"
    doc = {
        "id": bid,
        "tool_id": tid,
        "renter_id": sara_id,
        "owner_id": tool["owner_id"],
        "start_date": (datetime.now(timezone.utc).date() + timedelta(days=60)).isoformat(),
        "end_date": (datetime.now(timezone.utc).date() + timedelta(days=62)).isoformat(),
        "total_price": 60.0,
        "deposit": 0.0,
        "status": "approved",
        "pickup_method": "pickup",
        "paid": True,
        "payout_owed": 54.0,
        "platform_fee_collected": 6.0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _db.bookings.insert_one(doc)
    try:
        r2 = requests.get(f"{API}/tools/{tid}", headers={"Authorization": f"Bearer {sara_token}"}, timeout=15)
        assert r2.status_code == 200
        loc = r2.json()["location"]
        assert loc["is_approximate"] is False, f"expected precise after paid booking, got {loc}"
        raw = _db.tools.find_one({"id": tid})
        assert loc["lat"] == raw["location"]["lat"]
        assert loc["lng"] == raw["location"]["lng"]
        assert loc.get("address") == raw["location"].get("address")
    finally:
        _db.bookings.delete_one({"id": bid})


if __name__ == "__main__":
    test_paid_renter_sees_precise_location_after_flip()
    print("PASS")
