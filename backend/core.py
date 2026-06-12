"""ToolShare shared infrastructure.

Every router module imports from this file. Lives outside `routes/` to avoid
the routes package importing itself.

Contains: env config, Mongo client + `db`, FastAPI auth deps (`current_user`,
`optional_user`), Pydantic models, helpers (hashing, JWT, geo, currency math,
booking-stock math, location obfuscation), object-storage helpers, and the
shared LLM prompt + quota constants.
"""
import os
import math
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Literal, Tuple

import bcrypt
import jwt
import requests
from dotenv import load_dotenv
from fastapi import HTTPException, Header, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

# -----------------------------------------------------------------------------
# Env / clients
# -----------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
JWT_SECRET = os.environ.get('JWT_SECRET', 'change_me')
JWT_ALGO = "HS256"
JWT_EXPIRE_DAYS = 30
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
APP_NAME = "toolshare"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client[DB_NAME]

logger = logging.getLogger("toolshare")

# -----------------------------------------------------------------------------
# Storage helpers
# -----------------------------------------------------------------------------
_storage_key: Optional[str] = None


def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    try:
        r = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_LLM_KEY}, timeout=30)
        r.raise_for_status()
        _storage_key = r.json()["storage_key"]
        logger.info("Storage initialized")
        return _storage_key
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
        return None


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not initialized")
    r = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    r.raise_for_status()
    return r.json()


def get_object(path: str) -> Tuple[bytes, str]:
    key = init_storage()
    if not key:
        raise HTTPException(500, "Storage not initialized")
    r = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60
    )
    r.raise_for_status()
    return r.content, r.headers.get("Content-Type", "application/octet-stream")


# -----------------------------------------------------------------------------
# Pydantic models
# -----------------------------------------------------------------------------
class UserPublic(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    auth_provider: str = "email"
    rating_avg: float = 0.0
    rating_count: int = 0
    is_verified: bool = False
    created_at: str


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class UpdateProfileIn(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    city: Optional[str] = None
    picture: Optional[str] = None


class ToolLocation(BaseModel):
    address: Optional[str] = None
    city: str
    # State, province, region, or department (e.g., "CA", "California", "Île-de-France")
    state: Optional[str] = None
    postal_code: Optional[str] = None
    lat: float
    lng: float


class ToolIn(BaseModel):
    title: str
    description: str
    category: str
    daily_price: float
    security_deposit: float = 0
    condition: Literal["Like New", "Good", "Fair"] = "Good"
    images: List[str] = []
    location: ToolLocation
    pickup_available: bool = True
    delivery_available: bool = False
    delivery_radius_km: float = 0
    unavailable_dates: List[str] = []
    # Buying / selling
    listing_type: Literal["rent", "sell", "both"] = "rent"
    sale_price: float = 0
    # Currency the owner authored the price in. Display layer converts to viewer currency.
    price_currency: Literal["USD", "CAD", "EUR", "GBP", "MXN", "AUD"] = "USD"
    # Stock — number of identical units the owner has of this tool. 1 = one-of-a-kind.
    # Multiple lets renters book a quantity; we decrement the running availability.
    quantity_total: int = 1


class Tool(ToolIn):
    id: str
    owner_id: str
    is_available: bool = True
    is_sold: bool = False
    is_featured: bool = False
    view_count: int = 0
    rating_avg: float = 0.0
    rating_count: int = 0
    created_at: str


class BookingIn(BaseModel):
    tool_id: str
    start_date: str  # ISO date
    end_date: str
    pickup_method: Literal["pickup", "delivery"] = "pickup"
    delivery_address: Optional[str] = None
    message_to_owner: Optional[str] = None
    insurance_tier: Literal["none", "basic", "premium"] = "none"
    # Number of identical units the renter wants to book.
    # Must satisfy 1 <= quantity <= remaining stock on every day in the range.
    quantity: int = Field(default=1, ge=1)


class Booking(BaseModel):
    id: str
    tool_id: str
    renter_id: str
    owner_id: str
    start_date: str
    end_date: str
    total_price: float
    deposit: float
    quantity: int = 1
    status: Literal["pending", "approved", "declined", "cancelled", "completed"] = "pending"
    pickup_method: str
    delivery_address: Optional[str] = None
    message_to_owner: Optional[str] = None
    created_at: str
    updated_at: str


class BookingStatusIn(BaseModel):
    status: Literal["approved", "declined", "cancelled", "completed"]


class ReviewIn(BaseModel):
    booking_id: str
    rating: int = Field(ge=1, le=5)
    comment: str = ""
    target_type: Literal["owner", "renter", "tool"]
    condition_tag: Optional[Literal["like_new", "good", "fair", "poor"]] = None


class Review(BaseModel):
    id: str
    booking_id: str
    tool_id: str
    reviewer_id: str
    target_user_id: Optional[str] = None
    target_type: str
    rating: int
    comment: str
    condition_tag: Optional[str] = None
    hidden: bool = False
    created_at: str


class AIRecommendIn(BaseModel):
    task: str
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: float = 50.0


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_jwt(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload.get("sub")
    except Exception:
        return None


async def get_user_by_id(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


async def current_user(request: Request, authorization: Optional[str] = Header(None)) -> dict:
    # Try cookie first (Google session_token), then Authorization header (JWT)
    session_token = request.cookies.get("session_token")
    if session_token:
        session = await db.sessions.find_one({"session_token": session_token}, {"_id": 0})
        if session:
            expires_at = session["expires_at"]
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at >= datetime.now(timezone.utc):
                user = await get_user_by_id(session["user_id"])
                if user:
                    return user
    # JWT
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1]
        user_id = decode_jwt(token)
        if user_id:
            user = await get_user_by_id(user_id)
            if user:
                return user
    raise HTTPException(status_code=401, detail="Not authenticated")


async def optional_user(request: Request, authorization: Optional[str] = Header(None)) -> Optional[dict]:
    try:
        return await current_user(request, authorization)
    except HTTPException:
        return None


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(a))


def serialize_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "picture": user.get("picture"),
        "bio": user.get("bio"),
        "city": user.get("city"),
        "auth_provider": user.get("auth_provider", "email"),
        "rating_avg": user.get("rating_avg", 0.0),
        "rating_count": user.get("rating_count", 0),
        "is_verified": user.get("is_verified", False),
        "is_admin": user.get("is_admin", False),
        "is_suspended": user.get("is_suspended", False),
        "created_at": user.get("created_at", ""),
    }


# -----------------------------------------------------------------------------
# Constants
# -----------------------------------------------------------------------------
CATEGORIES = [
    {"slug": "power-tools", "name": "Power Tools", "icon": "Drill"},
    {"slug": "hand-tools", "name": "Hand Tools", "icon": "Wrench"},
    {"slug": "gardening", "name": "Gardening", "icon": "Sprout"},
    {"slug": "lawn-care", "name": "Lawn Care", "icon": "Trees"},
    {"slug": "painting", "name": "Painting", "icon": "PaintRoller"},
    {"slug": "plumbing", "name": "Plumbing", "icon": "Pipette"},
    {"slug": "automotive", "name": "Automotive", "icon": "Car"},
    {"slug": "carpentry", "name": "Carpentry", "icon": "Hammer"},
    {"slug": "electrical", "name": "Electrical", "icon": "Zap"},
    {"slug": "cleaning", "name": "Cleaning", "icon": "SprayCan"},
    {"slug": "ladders", "name": "Ladders & Scaffolding", "icon": "MoveVertical"},
    {"slug": "heavy-equipment", "name": "Heavy Equipment", "icon": "Truck"},
    {"slug": "outdoor", "name": "Outdoor & Camping", "icon": "Tent"},
]

INSURANCE_TIERS = {
    "none": {"daily_fee": 0.0, "label": "No protection"},
    "basic": {"daily_fee": 8.0, "label": "Basic — $1,000 coverage"},
    "premium": {"daily_fee": 20.0, "label": "Premium — $5,000 coverage + theft"},
}

SUPPORTED_CURRENCIES = ["USD", "CAD", "EUR", "GBP", "MXN", "AUD"]
_DEFAULT_RATES = {"USD": 1.0, "CAD": 1.37, "EUR": 0.92, "GBP": 0.79, "MXN": 17.4, "AUD": 1.52}

AI_DAILY_LIMIT = 15  # logged-in users; admins unlimited
AI_WINDOW_HOURS = 24


# -----------------------------------------------------------------------------
# Booking / stock math
# -----------------------------------------------------------------------------
def _days_between(start: str, end: str) -> int:
    s = datetime.fromisoformat(start).date()
    e = datetime.fromisoformat(end).date()
    return max(1, (e - s).days + 1)


async def _booked_qty_by_date(tool_id: str, start: str, end: str,
                               exclude_booking_id: Optional[str] = None) -> dict:
    """Return {iso_date: total_qty_booked} for [start, end] inclusive.

    Counts pending + approved bookings (these hold inventory). Declined/cancelled
    bookings free their stock back.
    """
    try:
        s = datetime.fromisoformat(start).date()
        e = datetime.fromisoformat(end).date()
    except Exception:
        return {}
    q = {
        "tool_id": tool_id,
        "status": {"$in": ["pending", "approved"]},
        "start_date": {"$lte": end},
        "end_date": {"$gte": start},
    }
    if exclude_booking_id:
        q["id"] = {"$ne": exclude_booking_id}
    cur = db.bookings.find(q, {"_id": 0, "start_date": 1, "end_date": 1, "quantity": 1})
    bookings = await cur.to_list(length=1000)
    out: dict[str, int] = {}
    cur_d = s
    while cur_d <= e:
        out[cur_d.isoformat()] = 0
        cur_d = cur_d + timedelta(days=1)
    for b in bookings:
        try:
            bs = datetime.fromisoformat(b["start_date"]).date()
            be = datetime.fromisoformat(b["end_date"]).date()
        except Exception:
            continue
        qty = int(b.get("quantity") or 1)
        overlap_start = max(bs, s)
        overlap_end = min(be, e)
        d = overlap_start
        while d <= overlap_end:
            iso = d.isoformat()
            out[iso] = out.get(iso, 0) + qty
            d = d + timedelta(days=1)
    return out


async def _max_booked_qty_in_range(tool_id: str, start: str, end: str,
                                    exclude_booking_id: Optional[str] = None) -> int:
    """Peak concurrent booked quantity across the requested range."""
    by_date = await _booked_qty_by_date(tool_id, start, end, exclude_booking_id)
    return max(by_date.values()) if by_date else 0


def _obfuscate_location(loc: dict) -> dict:
    """Hide precise address and round coords to ~1km accuracy for unpaid viewers."""
    if not loc:
        return loc
    lat = loc.get("lat")
    lng = loc.get("lng")
    safe_lat = round(lat, 2) if lat is not None else None
    safe_lng = round(lng, 2) if lng is not None else None
    return {
        "city": loc.get("city"),
        "state": loc.get("state"),
        "lat": safe_lat,
        "lng": safe_lng,
        "address": None,
        "postal_code": None,
        "is_approximate": True,
    }


async def _user_has_paid_booking(user_id: str, tool_id: str) -> bool:
    booking = await db.bookings.find_one({
        "tool_id": tool_id,
        "renter_id": user_id,
        "paid": True,
        "status": {"$in": ["approved", "completed"]},
    })
    return booking is not None
