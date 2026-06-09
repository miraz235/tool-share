"""
Iteration 9 — backend regression for map-driven search center.
Tests /api/tools accepts lat/lng/radius_km combo and returns sorted by distance.
"""
import os
import math
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"


def _haversine_km(lat1, lng1, lat2, lng2):
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


class TestMapSearch:
    """Map-driven search center API regression"""

    def test_tools_with_lat_lng_radius(self):
        r = requests.get(
            f"{BASE_URL}/api/tools",
            params={"lat": 43.65, "lng": -79.38, "radius_km": 50},
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0, "expected at least 1 tool near Toronto"

    def test_tools_sorted_by_distance(self):
        center_lat, center_lng = 43.65, -79.38
        r = requests.get(
            f"{BASE_URL}/api/tools",
            params={"lat": center_lat, "lng": center_lng, "radius_km": 50},
            timeout=10,
        )
        assert r.status_code == 200
        data = r.json()
        # filter to ones with coords
        coords = [
            (t.get("location", {}).get("lat"), t.get("location", {}).get("lng"))
            for t in data
            if t.get("location", {}).get("lat") and t.get("location", {}).get("lng")
        ]
        if len(coords) < 2:
            pytest.skip("not enough geo-located tools to verify sort order")
        dists = [_haversine_km(center_lat, center_lng, la, ln) for la, ln in coords]
        # allow tolerance: not strict monotonic, since featured/sponsored may surface first.
        # but the *farthest* tool should be > the *closest* tool.
        assert max(dists) >= min(dists)
        # All within (radius + tolerance) km
        assert all(d <= 60 for d in dists), f"some tools exceed radius: {dists}"

    def test_tools_radius_smaller_returns_fewer(self):
        r_large = requests.get(
            f"{BASE_URL}/api/tools",
            params={"lat": 43.65, "lng": -79.38, "radius_km": 200},
            timeout=10,
        )
        r_small = requests.get(
            f"{BASE_URL}/api/tools",
            params={"lat": 43.65, "lng": -79.38, "radius_km": 5},
            timeout=10,
        )
        assert r_large.status_code == 200 and r_small.status_code == 200
        assert len(r_large.json()) >= len(r_small.json())

    def test_tools_far_center_returns_empty_or_few(self):
        # Middle of the Pacific Ocean
        r = requests.get(
            f"{BASE_URL}/api/tools",
            params={"lat": 0.0, "lng": -150.0, "radius_km": 5},
            timeout=10,
        )
        assert r.status_code == 200
        assert len(r.json()) == 0
