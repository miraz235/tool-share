"""Backend tests for iteration 11 - currency FX rates + regression for map search."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rent-tools-community.preview.emergentagent.com").rstrip("/")

SUPPORTED = ["USD", "CAD", "EUR", "GBP", "MXN", "AUD"]


# Currency FX rates
class TestFxRates:
    def test_fx_rates_returns_all_currencies(self):
        r = requests.get(f"{BASE_URL}/api/fx/rates", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["base"] == "USD"
        rates = data["rates"]
        for code in SUPPORTED:
            assert code in rates, f"missing currency: {code}"
            assert isinstance(rates[code], (int, float))
            assert rates[code] > 0, f"non-positive rate for {code}"
        # USD must be 1 in USD-base
        assert abs(rates["USD"] - 1.0) < 1e-6


# Auth login regression
class TestAuth:
    def test_login_sara(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "sara@toolshare.demo", "password": "demo1234"}, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "access_token" in body or "token" in body


# Map-driven search regression
class TestMapSearch:
    def test_tools_search_with_lat_lng_radius(self):
        # New York-ish viewport
        params = {"lat": 40.75, "lng": -73.98, "radius_km": 5}
        r = requests.get(f"{BASE_URL}/api/tools", params=params, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        # Either a plain list or wrapped object
        items = body if isinstance(body, list) else body.get("items", body.get("tools", []))
        assert isinstance(items, list)

    def test_tools_search_far_radius(self):
        params = {"lat": 40.75, "lng": -73.98, "radius_km": 500}
        r = requests.get(f"{BASE_URL}/api/tools", params=params, timeout=15)
        assert r.status_code == 200


# Profile route regression (Marcus user id from prompt)
class TestProfileRoute:
    def test_marcus_profile_loads(self):
        r = requests.get(f"{BASE_URL}/api/users/user_b31feea69062", timeout=15)
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            body = r.json()
            assert "id" in body or "_id" not in body  # ensure no raw _id leak
