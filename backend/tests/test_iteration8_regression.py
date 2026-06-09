"""Iteration 8 regression: review dedupe (409), follows/favorites/purchases responses unchanged."""
import os
import requests
import pytest

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://rent-tools-community.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"


def _login(email, pwd):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def sara_tok():
    return _login("sara@toolshare.demo", "demo1234")


@pytest.fixture(scope="module")
def marcus_tok():
    return _login("marcus@toolshare.demo", "demo1234")


@pytest.fixture(scope="module")
def admin_tok():
    return _login("admin@toolshare.demo", "Admin1234!")


def test_follows_list_ok(sara_tok):
    r = requests.get(f"{API}/follows", headers={"Authorization": f"Bearer {sara_tok}"}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_favorites_alerts_param(sara_tok):
    # Need a tool id; just hit GET to confirm shape
    r = requests.get(f"{API}/favorites", headers={"Authorization": f"Bearer {sara_tok}"}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        assert "alerts_on" in data[0]


def test_admin_reviews_endpoint(admin_tok):
    r = requests.get(f"{API}/admin/reviews", headers={"Authorization": f"Bearer {admin_tok}"}, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_admin_reviews_forbidden_for_user(sara_tok):
    r = requests.get(f"{API}/admin/reviews", headers={"Authorization": f"Bearer {sara_tok}"}, timeout=15)
    assert r.status_code == 403


def test_purchases_endpoint(sara_tok):
    r = requests.get(f"{API}/purchases", headers={"Authorization": f"Bearer {sara_tok}"}, timeout=15)
    # should be 200 or 404 (no purchases is still 200 list)
    assert r.status_code in (200, 404), r.text
    if r.status_code == 200:
        assert isinstance(r.json(), list)


def test_review_dedupe_409(sara_tok, marcus_tok):
    """Replays a review submission for the same booking — expects 409 on second attempt."""
    # Get sara's bookings
    r = requests.get(f"{API}/bookings", headers={"Authorization": f"Bearer {sara_tok}"}, timeout=15)
    assert r.status_code == 200
    bookings = r.json()
    # Find an ended/approved+paid booking — typically the seed bk_TEST_ITER7_ENDED
    eligible = [b for b in bookings if b.get("status") == "approved" and b.get("paid")]
    if not eligible:
        pytest.skip("No eligible ended booking to test dedupe")
    bk = eligible[0]
    payload = {
        "booking_id": bk["id"],
        "target_type": "tool",
        "rating": 5,
        "comment": "TEST_iter8 dedupe",
        "condition_tag": "good",
    }
    h = {"Authorization": f"Bearer {sara_tok}"}
    r1 = requests.post(f"{API}/reviews", json=payload, headers=h, timeout=15)
    # Either it's a fresh submit (201/200) or already done (409). Both acceptable.
    assert r1.status_code in (200, 201, 409), r1.text
    # Second attempt must be 409
    r2 = requests.post(f"{API}/reviews", json=payload, headers=h, timeout=15)
    assert r2.status_code == 409, f"Expected 409 on duplicate, got {r2.status_code}: {r2.text}"
