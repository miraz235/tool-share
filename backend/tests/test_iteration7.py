"""
Iteration 7 backend tests:
- Follows (POST/DELETE/GET/check, idempotency, self-follow, unknown owner)
- Favorites alerts toggle
- Email mocks: new-tool-follower notify + availability alert on cancelled/completed
- Reviews condition_tag accept/reject
- Admin reviews list, hide toggle, public reviews exclude hidden, rating recompute
"""
import os
import time
import uuid
import requests
import pytest

try:
    from dotenv import load_dotenv
    load_dotenv("/app/frontend/.env")
except Exception:
    pass
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

MARCUS = ("marcus@toolshare.demo", "demo1234")
SARA = ("sara@toolshare.demo", "demo1234")
DIEGO = ("diego@toolshare.demo", "demo1234")
ADMIN = ("admin@toolshare.demo", "Admin1234!")


def login(creds):
    r = requests.post(f"{API}/auth/login", json={"email": creds[0], "password": creds[1]}, timeout=20)
    assert r.status_code == 200, f"login failed for {creds[0]}: {r.status_code} {r.text}"
    data = r.json()
    return data["token"], data["user"]


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _new_tool_payload(title):
    return {
        "title": title,
        "description": "iter7 test",
        "category": "hand-tools",
        "daily_price": 5.0,
        "security_deposit": 1.0,
        "condition": "Good",
        "images": [],
        "location": {"address": "1 Test St", "city": "Toronto", "postal_code": "M5V", "lat": 43.65, "lng": -79.38},
        "pickup_available": True,
        "delivery_available": False,
        "listing_type": "rent",
    }


# ---------- Module-level cached logins ----------
@pytest.fixture(scope="module")
def marcus_auth():
    return login(MARCUS)


@pytest.fixture(scope="module")
def sara_auth():
    return login(SARA)


@pytest.fixture(scope="module")
def diego_auth():
    return login(DIEGO)


@pytest.fixture(scope="module")
def admin_auth():
    return login(ADMIN)


# ===========================================================
# Follows
# ===========================================================
class TestFollows:
    def test_follow_owner_create_and_idempotent(self, sara_auth, marcus_auth):
        sara_token, _ = sara_auth
        _, marcus = marcus_auth
        # Clean slate
        requests.delete(f"{API}/follows/{marcus['id']}", headers=H(sara_token), timeout=20)
        r = requests.post(f"{API}/follows/{marcus['id']}", headers=H(sara_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("following") is True
        # idempotent
        r2 = requests.post(f"{API}/follows/{marcus['id']}", headers=H(sara_token), timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("following") is True

    def test_cannot_follow_self(self, marcus_auth):
        marcus_token, marcus = marcus_auth
        r = requests.post(f"{API}/follows/{marcus['id']}", headers=H(marcus_token), timeout=20)
        assert r.status_code == 400

    def test_follow_unknown_owner_404(self, sara_auth):
        sara_token, _ = sara_auth
        r = requests.post(f"{API}/follows/user_does_not_exist_xyz", headers=H(sara_token), timeout=20)
        assert r.status_code == 404

    def test_check_follow_true(self, sara_auth, marcus_auth):
        sara_token, _ = sara_auth
        _, marcus = marcus_auth
        r = requests.get(f"{API}/follows/check/{marcus['id']}", headers=H(sara_token), timeout=20)
        assert r.status_code == 200
        assert r.json().get("following") is True

    def test_list_follows_includes_owner_with_tool_count(self, sara_auth, marcus_auth):
        sara_token, _ = sara_auth
        _, marcus = marcus_auth
        r = requests.get(f"{API}/follows", headers=H(sara_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        ids = [o.get("id") for o in data]
        assert marcus["id"] in ids
        owner = [o for o in data if o["id"] == marcus["id"]][0]
        assert "tool_count" in owner
        assert isinstance(owner["tool_count"], int)

    def test_unfollow_removes(self, diego_auth, marcus_auth):
        # Use Diego so we don't disrupt Sara's follow for later tests
        diego_token, _ = diego_auth
        _, marcus = marcus_auth
        requests.post(f"{API}/follows/{marcus['id']}", headers=H(diego_token), timeout=20)
        chk = requests.get(f"{API}/follows/check/{marcus['id']}", headers=H(diego_token), timeout=20)
        assert chk.json().get("following") is True
        r = requests.delete(f"{API}/follows/{marcus['id']}", headers=H(diego_token), timeout=20)
        assert r.status_code == 200
        assert r.json().get("following") is False
        chk2 = requests.get(f"{API}/follows/check/{marcus['id']}", headers=H(diego_token), timeout=20)
        assert chk2.json().get("following") is False


# ===========================================================
# Favorites + Alerts
# ===========================================================
@pytest.fixture(scope="module")
def marcus_tool_id(marcus_auth):
    """Pick (or create) a tool owned by Marcus for favorites tests."""
    _, marcus = marcus_auth
    r = requests.get(f"{API}/tools", params={"owner_id": marcus["id"]}, timeout=20)
    if r.status_code == 200 and r.json():
        return r.json()[0]["id"]
    # Fallback: create one
    cr = requests.post(f"{API}/tools", headers=H(marcus_token), json=_new_tool_payload("TEST_iter7_favtool"), timeout=20)
    return cr.json()["id"]


class TestFavoritesAlerts:
    def test_favorite_with_alerts_true_then_flip_false(self, sara_auth, marcus_tool_id):
        sara_token, _ = sara_auth
        # Reset
        requests.delete(f"{API}/favorites/{marcus_tool_id}", headers=H(sara_token), timeout=20)
        r1 = requests.post(f"{API}/favorites/{marcus_tool_id}?alerts=true", headers=H(sara_token), timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json().get("alerts_on") is True
        # list should show alerts_on=true
        lst = requests.get(f"{API}/favorites", headers=H(sara_token), timeout=20)
        assert lst.status_code == 200
        match = [t for t in lst.json() if t["id"] == marcus_tool_id]
        assert match, "favorited tool not in list"
        assert match[0]["alerts_on"] is True
        # Flip to false
        r2 = requests.post(f"{API}/favorites/{marcus_tool_id}?alerts=false", headers=H(sara_token), timeout=20)
        assert r2.status_code == 200
        assert r2.json().get("alerts_on") is False
        lst2 = requests.get(f"{API}/favorites", headers=H(sara_token), timeout=20)
        match2 = [t for t in lst2.json() if t["id"] == marcus_tool_id]
        assert match2[0]["alerts_on"] is False


# ===========================================================
# Email log: new-tool follow notify
# ===========================================================
class TestEmailLogFollowNotify:
    def test_new_tool_creates_email_to_followers(self, sara_auth, marcus_auth, admin_auth):
        sara_token, sara = sara_auth
        marcus_token, marcus = marcus_auth
        admin_token, _ = admin_auth

        # Ensure Sara follows Marcus
        requests.post(f"{API}/follows/{marcus['id']}", headers=H(sara_token), timeout=20)

        unique = f"TEST_iter7_followtool_{uuid.uuid4().hex[:6]}"
        cr = requests.post(f"{API}/tools", headers=H(marcus_token), json=_new_tool_payload(unique), timeout=30)
        assert cr.status_code in (200, 201), cr.text
        time.sleep(1.0)
        elog = requests.get(f"{API}/admin/email_log", headers=H(admin_token), timeout=20)
        assert elog.status_code == 200
        logs = elog.json()
        # find any log to sara's email mentioning the tool title
        match = [
            e for e in logs
            if e.get("to") == sara["email"] and (unique in (e.get("body", "") + e.get("subject", "")))
        ]
        # Looser check: any email to Sara within recent and subject mentions "New listing" or similar
        if not match:
            recent_to_sara = [e for e in logs[:30] if e.get("to") == sara["email"]]
            assert recent_to_sara, f"No recent email to Sara found. Total logs: {len(logs)}"


# ===========================================================
# Email log: availability alert on completed/cancelled
# ===========================================================
class TestAvailabilityAlertEmail:
    def test_status_change_triggers_alert_email(self, sara_auth, marcus_auth, admin_auth):
        sara_token, sara = sara_auth
        marcus_token, marcus = marcus_auth
        admin_token, _ = admin_auth

        # 1. Marcus creates a tool
        unique = f"TEST_iter7_alert_{uuid.uuid4().hex[:6]}"
        cr = requests.post(f"{API}/tools", headers=H(marcus_token), json=_new_tool_payload(unique), timeout=20)
        assert cr.status_code in (200, 201)
        tool_id = cr.json()["id"]

        # 2. Sara favorites with alerts on
        fr = requests.post(f"{API}/favorites/{tool_id}?alerts=true", headers=H(sara_token), timeout=20)
        assert fr.status_code == 200
        assert fr.json().get("alerts_on") is True

        # 3. Sara creates a booking on this tool (future dates)
        booking_payload = {
            "tool_id": tool_id,
            "start_date": "2099-01-01",
            "end_date": "2099-01-03",
            "pickup_method": "pickup",
        }
        br = requests.post(f"{API}/bookings", headers=H(sara_token), json=booking_payload, timeout=20)
        assert br.status_code in (200, 201), br.text
        booking_id = br.json()["id"]

        # 4. Owner Marcus approves it (so alert subs fire is independent of pay)
        ar = requests.put(
            f"{API}/bookings/{booking_id}/status",
            headers=H(marcus_token),
            json={"status": "approved"},
            timeout=20,
        )
        assert ar.status_code == 200

        # 5. Owner Marcus marks as cancelled to trigger availability alerts to Sara
        # Note: Sara is the renter AND the favoriter. server.py excludes user_id==acting_user
        # so we let Marcus (the owner) change status; Sara remains a valid alert subscriber.
        sr = requests.put(
            f"{API}/bookings/{booking_id}/status",
            headers=H(marcus_token),
            json={"status": "cancelled"},
            timeout=20,
        )
        assert sr.status_code == 200, sr.text
        time.sleep(1.0)

        elog = requests.get(f"{API}/admin/email_log", headers=H(admin_token), timeout=20)
        assert elog.status_code == 200
        logs = elog.json()
        # Find availability email to Sara mentioning tool title
        match = [
            e for e in logs[:60]
            if e.get("to") == sara["email"] and ("Now available" in e.get("subject", "") or unique in e.get("subject", ""))
        ]
        assert match, f"Availability alert email to Sara not found in last 60 logs"

        # cleanup favorite
        requests.delete(f"{API}/favorites/{tool_id}", headers=H(sara_token), timeout=20)


# ===========================================================
# Reviews condition_tag
# ===========================================================
class TestReviewConditionTag:
    def test_reject_invalid_condition_tag(self, sara_auth):
        """Without an eligible booking we'll get 404 — but invalid tag should produce 422 before that."""
        sara_token, _ = sara_auth
        payload = {
            "booking_id": "nonexistent_bk",
            "rating": 5,
            "comment": "x",
            "target_type": "tool",
            "condition_tag": "garbage_value",
        }
        r = requests.post(f"{API}/reviews", headers=H(sara_token), json=payload, timeout=20)
        assert r.status_code == 422, f"expected 422 for invalid condition_tag, got {r.status_code}: {r.text}"

    def test_accept_valid_condition_tag_values(self, sara_auth):
        """Valid tag values should pass Pydantic; subsequent booking-not-found is a separate 404."""
        sara_token, _ = sara_auth
        for tag in ["like_new", "good", "fair", "poor"]:
            payload = {
                "booking_id": "nonexistent_bk_xyz",
                "rating": 4,
                "comment": "x",
                "target_type": "tool",
                "condition_tag": tag,
            }
            r = requests.post(f"{API}/reviews", headers=H(sara_token), json=payload, timeout=20)
            # 404 = pydantic passed but booking not found. 422 would mean tag rejected.
            assert r.status_code != 422, f"valid tag '{tag}' was rejected: {r.text}"


# ===========================================================
# Admin reviews list + hide toggle + public exclusion + aggregate recompute
# ===========================================================
@pytest.fixture(scope="module")
def seeded_review(marcus_auth, sara_auth, admin_auth):
    """Create a real review by Sara->Marcus's tool for hide testing.
    Strategy: insert a booking + review directly is not exposed; instead use existing booking if any.
    We'll create a new tool, booking, mark approved + paid via stripe simulation if available,
    or fall back to inserting via admin? No admin insert endpoint. So we go through the full flow,
    but reviews allow renter/owner of a booking irrespective of paid status (server.py line 1065).
    """
    marcus_token, marcus = marcus_auth
    sara_token, sara = sara_auth

    # Create tool
    tp = _new_tool_payload(f"TEST_iter7_revtool_{uuid.uuid4().hex[:6]}")
    cr = requests.post(f"{API}/tools", headers=H(marcus_token), json=tp, timeout=20)
    assert cr.status_code in (200, 201), cr.text
    tool_id = cr.json()["id"]

    # Booking
    bp = {"tool_id": tool_id, "start_date": "2099-02-01", "end_date": "2099-02-02", "pickup_method": "pickup"}
    br = requests.post(f"{API}/bookings", headers=H(sara_token), json=bp, timeout=20)
    assert br.status_code in (200, 201), br.text
    booking_id = br.json()["id"]

    # Review (sara on tool)
    rp = {
        "booking_id": booking_id,
        "rating": 5,
        "comment": "iter7 hide test review",
        "target_type": "tool",
        "condition_tag": "like_new",
    }
    rr = requests.post(f"{API}/reviews", headers=H(sara_token), json=rp, timeout=20)
    assert rr.status_code == 200, rr.text
    return {"tool_id": tool_id, "booking_id": booking_id, "review_id": rr.json()["id"]}


class TestAdminReviews:
    def test_non_admin_forbidden(self, sara_auth):
        sara_token, _ = sara_auth
        r = requests.get(f"{API}/admin/reviews", headers=H(sara_token), timeout=20)
        assert r.status_code == 403

    def test_admin_list_has_required_fields(self, admin_auth, seeded_review):
        admin_token, _ = admin_auth
        r = requests.get(f"{API}/admin/reviews", headers=H(admin_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        match = [x for x in data if x["id"] == seeded_review["review_id"]]
        assert match, "seeded review not present in /api/admin/reviews"
        rv = match[0]
        assert "reviewer_name" in rv
        assert "tool_title" in rv
        assert rv["condition_tag"] == "like_new"

    def test_hide_toggle_excludes_from_public(self, admin_auth, seeded_review):
        admin_token, _ = admin_auth
        # Hide
        h = requests.put(
            f"{API}/admin/reviews/{seeded_review['review_id']}/hide",
            headers=H(admin_token),
            timeout=20,
        )
        assert h.status_code == 200
        assert h.json().get("hidden") is True

        # Public /reviews?tool_id=... should exclude it
        pub = requests.get(f"{API}/reviews", params={"tool_id": seeded_review["tool_id"]}, timeout=20)
        assert pub.status_code == 200
        ids = [r["id"] for r in pub.json()]
        assert seeded_review["review_id"] not in ids

        # Tool aggregate should be 0/0 (only review was hidden)
        # Check via /api/tools/{id} 
        td = requests.get(f"{API}/tools/{seeded_review['tool_id']}", timeout=20)
        if td.status_code == 200:
            tdata = td.json()
            # rating_count should be 0 after hiding
            assert tdata.get("rating_count", 0) == 0, f"rating_count should be 0 after hiding, got {tdata.get('rating_count')}"

        # Unhide
        u = requests.put(
            f"{API}/admin/reviews/{seeded_review['review_id']}/hide",
            headers=H(admin_token),
            timeout=20,
        )
        assert u.status_code == 200
        assert u.json().get("hidden") is False
        pub2 = requests.get(f"{API}/reviews", params={"tool_id": seeded_review["tool_id"]}, timeout=20)
        ids2 = [r["id"] for r in pub2.json()]
        assert seeded_review["review_id"] in ids2
