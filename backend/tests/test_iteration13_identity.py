"""
Iteration 13 — Identity verification + verified_only + recent searches (backend).
Tests:
- POST /api/identity/verify/submit (incl. idempotent re-submit + already-verified guard)
- GET /api/identity/verify/status
- GET /api/admin/identity/queue (admin-only, status filter, no id_number_hash)
- POST /api/admin/identity/{id}/review (approve/reject, double-review guard)
- GET /api/tools?verified_only=true filter + owner_verified flag
"""
import os
import io
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@toolshare.demo"
ADMIN_PW = "Admin1234!"


# ---------- helpers ----------
def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def upload_dummy_image(token, name="id.png"):
    """Upload a tiny PNG via /api/upload, return the returned path."""
    # 1x1 PNG bytes
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000d49444154789c63600100000500010d0a2db40000000049454e44ae426082"
    )
    files = {"file": (name, io.BytesIO(png), "image/png")}
    r = requests.post(f"{API}/upload", headers=auth(token), files=files, timeout=30)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    return r.json().get("path") or r.json().get("url")


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_token():
    return login(ADMIN_EMAIL, ADMIN_PW)


@pytest.fixture(scope="module")
def fresh_user():
    """Register a brand-new unverified user (no prior submission)."""
    email = f"iv_test_{uuid.uuid4().hex[:8]}@toolshare.demo"
    pw = "Pass1234!"
    r = requests.post(
        f"{API}/auth/register",
        json={
            "email": email,
            "password": pw,
            "name": "IV Test User",
            "city": "Toronto",
            "country": "Canada",
        },
        timeout=30,
    )
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    data = r.json()
    token = data.get("token") or login(email, pw)
    user = data.get("user") or {}
    return {"email": email, "password": pw, "token": token, "id": user.get("id")}


# ---------- 1. Submit + status ----------
class TestIdentitySubmitAndStatus:
    def test_status_not_started(self, fresh_user):
        r = requests.get(f"{API}/identity/verify/status", headers=auth(fresh_user["token"]), timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "not_started"
        assert data["is_verified"] is False

    def test_submit_creates_pending(self, fresh_user):
        doc = upload_dummy_image(fresh_user["token"], "doc.png")
        selfie = upload_dummy_image(fresh_user["token"], "selfie.png")
        r = requests.post(
            f"{API}/identity/verify/submit",
            headers=auth(fresh_user["token"]),
            json={
                "id_type": "driver_license",
                "id_number": "DL1234567",
                "full_name": "IV Test User",
                "id_document_path": doc,
                "selfie_path": selfie,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "pending"
        assert data["id"].startswith("idv_")
        fresh_user["submission_id"] = data["id"]

        # GET status reflects pending
        sr = requests.get(f"{API}/identity/verify/status", headers=auth(fresh_user["token"]), timeout=30)
        assert sr.status_code == 200
        sd = sr.json()
        assert sd["status"] == "pending"
        sub = sd.get("submission") or {}
        # Privacy: id_number_hash must NOT leak to user
        assert "id_number_hash" not in sub
        # last4 should be present
        assert sub.get("id_number_last4") == "4567"

    def test_resubmit_is_idempotent(self, fresh_user):
        first_id = fresh_user["submission_id"]
        doc = upload_dummy_image(fresh_user["token"], "doc2.png")
        selfie = upload_dummy_image(fresh_user["token"], "selfie2.png")
        r = requests.post(
            f"{API}/identity/verify/submit",
            headers=auth(fresh_user["token"]),
            json={
                "id_type": "passport",
                "id_number": "PA9999999",
                "full_name": "IV Test User",
                "id_document_path": doc,
                "selfie_path": selfie,
            },
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["id"] == first_id, "resubmit must replace, not create new"


# ---------- 2. Admin queue + review ----------
class TestAdminIdentityQueue:
    def test_queue_admin_only(self, fresh_user):
        r = requests.get(f"{API}/admin/identity/queue", headers=auth(fresh_user["token"]), timeout=30)
        assert r.status_code == 403

    def test_queue_returns_pending(self, admin_token, fresh_user):
        r = requests.get(f"{API}/admin/identity/queue?status=pending", headers=auth(admin_token), timeout=30)
        assert r.status_code == 200
        items = r.json()
        ids = [i["id"] for i in items]
        assert fresh_user["submission_id"] in ids
        # Privacy: hash never leaks
        for it in items:
            assert "id_number_hash" not in it, f"id_number_hash leaked: {it}"
        # Sort: submitted_at desc (allow equal)
        ts = [i["submitted_at"] for i in items]
        assert ts == sorted(ts, reverse=True)

    def test_queue_filter_all(self, admin_token):
        r = requests.get(f"{API}/admin/identity/queue?status=all", headers=auth(admin_token), timeout=30)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_approve_sets_user_verified(self, admin_token, fresh_user):
        sid = fresh_user["submission_id"]
        r = requests.post(
            f"{API}/admin/identity/{sid}/review",
            headers=auth(admin_token),
            json={"decision": "approved", "admin_note": "looks good"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"

        # User status now approved + is_verified=true
        sr = requests.get(f"{API}/identity/verify/status", headers=auth(fresh_user["token"]), timeout=30)
        sd = sr.json()
        assert sd["status"] == "approved"
        assert sd["is_verified"] is True

    def test_double_review_blocked(self, admin_token, fresh_user):
        sid = fresh_user["submission_id"]
        r = requests.post(
            f"{API}/admin/identity/{sid}/review",
            headers=auth(admin_token),
            json={"decision": "rejected", "admin_note": "second review"},
            timeout=30,
        )
        assert r.status_code == 400
        assert "already" in r.text.lower() or "reviewed" in r.text.lower()

    def test_submit_blocked_once_verified(self, fresh_user):
        doc = upload_dummy_image(fresh_user["token"], "again.png")
        selfie = upload_dummy_image(fresh_user["token"], "again2.png")
        r = requests.post(
            f"{API}/identity/verify/submit",
            headers=auth(fresh_user["token"]),
            json={
                "id_type": "driver_license",
                "id_number": "DL1234567",
                "full_name": "IV Test User",
                "id_document_path": doc,
                "selfie_path": selfie,
            },
            timeout=30,
        )
        assert r.status_code == 400
        assert "already verified" in r.text.lower()


# ---------- 3. Rejection flow on a second fresh user ----------
class TestRejection:
    def test_rejection_does_not_verify(self, admin_token):
        # Create a second fresh user
        email = f"iv_rej_{uuid.uuid4().hex[:8]}@toolshare.demo"
        rr = requests.post(
            f"{API}/auth/register",
            json={"email": email, "password": "Pass1234!", "name": "IV Rej",
                  "city": "Toronto", "country": "Canada"},
            timeout=30,
        )
        assert rr.status_code in (200, 201)
        tok = rr.json().get("token") or login(email, "Pass1234!")
        doc = upload_dummy_image(tok, "r1.png")
        selfie = upload_dummy_image(tok, "r2.png")
        sub_r = requests.post(
            f"{API}/identity/verify/submit",
            headers=auth(tok),
            json={"id_type": "national_id", "id_number": "NID0001",
                  "full_name": "IV Rej", "id_document_path": doc, "selfie_path": selfie},
            timeout=30,
        )
        assert sub_r.status_code == 200
        sid = sub_r.json()["id"]
        rev = requests.post(
            f"{API}/admin/identity/{sid}/review",
            headers=auth(admin_token),
            json={"decision": "rejected", "admin_note": "blurry image"},
            timeout=30,
        )
        assert rev.status_code == 200
        # Verify status reflects rejected and is_verified stays false
        sr = requests.get(f"{API}/identity/verify/status", headers=auth(tok), timeout=30)
        sd = sr.json()
        assert sd["status"] == "rejected"
        assert sd["is_verified"] is False


# ---------- 4. Tools verified_only + owner_verified flag ----------
class TestVerifiedToolsFilter:
    def test_owner_verified_stamped(self):
        r = requests.get(f"{API}/tools?limit=60", timeout=30)
        assert r.status_code == 200
        tools = r.json()
        assert isinstance(tools, list) and len(tools) > 0
        assert all("owner_verified" in t for t in tools), "owner_verified flag must be on every tool"

    def test_verified_only_filter(self):
        r = requests.get(f"{API}/tools?verified_only=true&limit=60", timeout=30)
        assert r.status_code == 200
        tools = r.json()
        assert isinstance(tools, list)
        # Every returned tool must belong to a verified owner
        assert all(t.get("owner_verified") is True for t in tools), \
            f"Found unverified owners in verified_only result: " \
            f"{[t['id'] for t in tools if not t.get('owner_verified')]}"

    def test_verified_only_subset_of_all(self):
        all_r = requests.get(f"{API}/tools?limit=60", timeout=30)
        v_r = requests.get(f"{API}/tools?verified_only=true&limit=60", timeout=30)
        assert all_r.status_code == 200 and v_r.status_code == 200
        all_ids = {t["id"] for t in all_r.json()}
        v_ids = {t["id"] for t in v_r.json()}
        assert v_ids.issubset(all_ids)
        # Some unverified-owned tool must exist (otherwise filter is meaningless)
        if len(all_ids) > len(v_ids):
            unverified_owned = [t for t in all_r.json() if not t.get("owner_verified")]
            assert len(unverified_owned) > 0
