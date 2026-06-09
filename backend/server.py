"""
ToolShare Backend API
FastAPI + MongoDB + JWT/Google Auth + Emergent Object Storage + OpenAI Tool Assistant
"""
import os
import uuid
import logging
import math
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List, Literal, Tuple

import jwt
import bcrypt
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Header, Query, Response, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from emergentintegrations.llm.chat import LlmChat, UserMessage

from p1_features import (
    build_p1_router,
    has_booking_conflict,
    send_email_mocked,
)

# -----------------------------------------------------------------------------
# Setup
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

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="ToolShare API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("toolshare")

# -----------------------------------------------------------------------------
# Storage helper
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
# Models
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


class Booking(BaseModel):
    id: str
    tool_id: str
    renter_id: str
    owner_id: str
    start_date: str
    end_date: str
    total_price: float
    deposit: float
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


class Review(BaseModel):
    id: str
    booking_id: str
    tool_id: str
    reviewer_id: str
    target_user_id: Optional[str] = None
    target_type: str
    rating: int
    comment: str
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
# Categories (static)
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


# -----------------------------------------------------------------------------
# Routes - Auth
# -----------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"name": "ToolShare API", "status": "ok"}


@api.get("/categories")
async def get_categories():
    return CATEGORIES


@api.post("/auth/register")
async def register(payload: RegisterIn):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(400, "Email already registered")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "id": user_id,
        "email": payload.email.lower(),
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "picture": None,
        "bio": None,
        "city": None,
        "auth_provider": "email",
        "rating_avg": 0.0,
        "rating_count": 0,
        "is_verified": False,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = make_jwt(user_id)
    return {"token": token, "user": serialize_user(user_doc)}


@api.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_jwt(user["id"])
    return {"token": token, "user": serialize_user(user)}


@api.post("/auth/google/session")
async def google_session(payload: GoogleSessionIn, response: Response):
    # Exchange session_id via Emergent
    try:
        r = requests.get(EMERGENT_AUTH_URL, headers={"X-Session-ID": payload.session_id}, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Google session exchange failed: {e}")
        raise HTTPException(401, "Invalid session")

    email = data["email"].lower()
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture")
    session_token = data["session_token"]

    # Find or create user
    user = await db.users.find_one({"email": email})
    if not user:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "id": user_id,
            "email": email,
            "password_hash": None,
            "name": name,
            "picture": picture,
            "bio": None,
            "city": None,
            "auth_provider": "google",
            "rating_avg": 0.0,
            "rating_count": 0,
            "is_verified": True,
            "created_at": now_iso(),
        }
        await db.users.insert_one(user_doc)
        user = user_doc
    else:
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"picture": picture or user.get("picture"), "name": user.get("name") or name}}
        )
        user_id = user["id"]

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at.isoformat(),
        "created_at": now_iso(),
    })

    # Also issue a JWT for header-based auth (simpler than cookies through ingress)
    jwt_token = make_jwt(user_id)

    user = await get_user_by_id(user_id)
    return {"token": jwt_token, "user": serialize_user(user)}


@api.get("/auth/me")
async def auth_me(user: dict = Depends(current_user)):
    return serialize_user(user)


@api.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api.put("/auth/profile")
async def update_profile(payload: UpdateProfileIn, user: dict = Depends(current_user)):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await get_user_by_id(user["id"])
    return serialize_user(updated)


# -----------------------------------------------------------------------------
# Routes - Uploads
# -----------------------------------------------------------------------------
@api.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(current_user)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(400, "Only images allowed")
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "jpg"
    path = f"{APP_NAME}/uploads/{user['id']}/{uuid.uuid4().hex}.{ext}"
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Max 10 MB")
    result = put_object(path, data, file.content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "owner_id": user["id"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": now_iso(),
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type") or content_type)


# -----------------------------------------------------------------------------
# Routes - Tools
# -----------------------------------------------------------------------------
@api.post("/tools", response_model=Tool)
async def create_tool(payload: ToolIn, user: dict = Depends(current_user)):
    tool_id = f"tool_{uuid.uuid4().hex[:12]}"
    doc = payload.model_dump()
    doc.update({
        "id": tool_id,
        "owner_id": user["id"],
        "is_available": True,
        "is_sold": False,
        "is_featured": False,
        "view_count": 0,
        "rating_avg": 0.0,
        "rating_count": 0,
        "created_at": now_iso(),
    })
    await db.tools.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.get("/tools")
async def list_tools(
    q: Optional[str] = None,
    category: Optional[str] = None,
    listing_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    city: Optional[str] = None,
    postal_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 50.0,
    owner_id: Optional[str] = None,
    featured_only: bool = False,
    limit: int = 60,
):
    filt = {"is_available": True, "is_sold": {"$ne": True}}
    if q:
        filt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"description": {"$regex": q, "$options": "i"}},
        ]
    if category:
        filt["category"] = category
    if listing_type and listing_type in ("rent", "sell"):
        # tools with listing_type == filter OR == "both"
        filt["listing_type"] = {"$in": [listing_type, "both"]}
    if min_price is not None:
        filt["daily_price"] = {"$gte": min_price}
    if max_price is not None:
        filt.setdefault("daily_price", {})["$lte"] = max_price
    if city:
        filt["location.city"] = {"$regex": f"^{city}$", "$options": "i"}
    if postal_code:
        filt["location.postal_code"] = {"$regex": f"^{postal_code}", "$options": "i"}
    if owner_id:
        filt["owner_id"] = owner_id
    if featured_only:
        filt["is_featured"] = True

    # Featured first, then by recency
    cur = db.tools.find(filt, {"_id": 0}).sort([("is_featured", -1), ("created_at", -1)]).limit(limit)
    tools = await cur.to_list(length=limit)

    if lat is not None and lng is not None:
        result = []
        for tool in tools:
            tl = tool.get("location", {})
            try:
                d = haversine_km(lat, lng, tl["lat"], tl["lng"])
            except Exception:
                d = 99999
            if d <= radius_km:
                tool["distance_km"] = round(d, 1)
                result.append(tool)
        # keep featured-first sort
        result.sort(key=lambda x: (not x.get("is_featured", False), x.get("distance_km", 999)))
        return result
    return tools


def _obfuscate_location(loc: dict) -> dict:
    """Hide precise address and round coords to ~1km accuracy for unpaid viewers."""
    if not loc:
        return loc
    lat = loc.get("lat")
    lng = loc.get("lng")
    # Round to 2 decimals = ~1.1km accuracy. Deterministic per tool (no random jitter).
    safe_lat = round(lat, 2) if lat is not None else None
    safe_lng = round(lng, 2) if lng is not None else None
    return {
        "city": loc.get("city"),
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


@api.get("/tools/{tool_id}")
async def get_tool(tool_id: str, request: Request, authorization: Optional[str] = Header(None)):
    tool = await db.tools.find_one({"id": tool_id}, {"_id": 0})
    if not tool:
        raise HTTPException(404, "Tool not found")
    await db.tools.update_one({"id": tool_id}, {"$inc": {"view_count": 1}})

    # Determine viewer
    viewer = await optional_user(request, authorization)
    is_owner = viewer and viewer["id"] == tool["owner_id"]
    has_paid = viewer and await _user_has_paid_booking(viewer["id"], tool_id)
    # Hide precise location unless owner or paid renter
    if not is_owner and not has_paid:
        tool["location"] = _obfuscate_location(tool.get("location", {}))
    else:
        tool["location"] = {**tool.get("location", {}), "is_approximate": False}

    # attach owner
    owner = await get_user_by_id(tool["owner_id"])
    tool["owner"] = serialize_user(owner) if owner else None
    return tool


@api.get("/tools/{tool_id}/unavailable_dates")
async def get_unavailable_dates(tool_id: str):
    """Return a list of ISO date strings that are blocked due to existing bookings.

    Includes any approved or paid (regardless of pending) range, plus tool.unavailable_dates.
    """
    tool = await db.tools.find_one({"id": tool_id}, {"_id": 0, "unavailable_dates": 1})
    if not tool:
        raise HTTPException(404, "Tool not found")

    bookings = await db.bookings.find(
        {"tool_id": tool_id, "status": {"$in": ["approved", "completed"]}},
        {"_id": 0, "start_date": 1, "end_date": 1}
    ).to_list(length=500)

    blocked = set(tool.get("unavailable_dates", []) or [])
    for b in bookings:
        try:
            s = datetime.fromisoformat(b["start_date"]).date()
            e = datetime.fromisoformat(b["end_date"]).date()
        except Exception:
            continue
        cur = s
        while cur <= e:
            blocked.add(cur.isoformat())
            cur = cur + timedelta(days=1)
    return {"dates": sorted(blocked)}


@api.put("/tools/{tool_id}")
async def update_tool(tool_id: str, payload: ToolIn, user: dict = Depends(current_user)):
    tool = await db.tools.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] != user["id"]:
        raise HTTPException(403, "Not the owner")
    await db.tools.update_one({"id": tool_id}, {"$set": payload.model_dump()})
    updated = await db.tools.find_one({"id": tool_id}, {"_id": 0})
    return updated


@api.delete("/tools/{tool_id}")
async def delete_tool(tool_id: str, user: dict = Depends(current_user)):
    tool = await db.tools.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] != user["id"]:
        raise HTTPException(403, "Not the owner")
    await db.tools.delete_one({"id": tool_id})
    return {"ok": True}


@api.get("/my/tools")
async def my_tools(user: dict = Depends(current_user)):
    cur = db.tools.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=200)


# -----------------------------------------------------------------------------
# Routes - Bookings
# -----------------------------------------------------------------------------
def _days_between(start: str, end: str) -> int:
    s = datetime.fromisoformat(start).date()
    e = datetime.fromisoformat(end).date()
    return max(1, (e - s).days + 1)


INSURANCE_TIERS = {
    "none": {"daily_fee": 0.0, "label": "No protection"},
    "basic": {"daily_fee": 8.0, "label": "Basic — $1,000 coverage"},
    "premium": {"daily_fee": 20.0, "label": "Premium — $5,000 coverage + theft"},
}


# -----------------------------------------------------------------------------
# FX rates (USD base) — cached for 1 hour. Falls back to a sensible default.
# -----------------------------------------------------------------------------
SUPPORTED_CURRENCIES = ["USD", "CAD"]
_DEFAULT_RATES = {"USD": 1.0, "CAD": 1.37}


@api.get("/fx/rates")
async def fx_rates():
    """Return current USD-base FX rates. Cached for 1 hour in db.fx_cache."""
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    cached = await db.fx_cache.find_one({"id": "rates_usd"}, {"_id": 0})
    if cached and cached.get("fetched_at", "") > one_hour_ago:
        return {"base": "USD", "rates": cached["rates"], "fetched_at": cached["fetched_at"], "source": "cache"}
    rates = dict(_DEFAULT_RATES)
    source = "fallback"
    try:
        r = requests.get(
            "https://api.exchangerate.host/latest",
            params={"base": "USD", "symbols": ",".join(SUPPORTED_CURRENCIES)},
            timeout=6
        )
        if r.ok:
            data = r.json()
            fetched = data.get("rates") or {}
            # only keep our supported currencies and ensure USD=1
            for c in SUPPORTED_CURRENCIES:
                if c in fetched and fetched[c] > 0:
                    rates[c] = float(fetched[c])
            rates["USD"] = 1.0
            source = "exchangerate.host"
    except Exception as e:
        logger.warning(f"FX fetch failed, using fallback: {e}")
    now = now_iso()
    await db.fx_cache.update_one(
        {"id": "rates_usd"},
        {"$set": {"id": "rates_usd", "rates": rates, "fetched_at": now}},
        upsert=True
    )
    return {"base": "USD", "rates": rates, "fetched_at": now, "source": source}


@api.get("/insurance/tiers")
async def insurance_tiers():
    return INSURANCE_TIERS


@api.post("/purchases")
async def create_purchase(tool_id: str, user: dict = Depends(current_user)):
    """Reserve a tool for outright purchase. Payment is handled via the same Stripe checkout flow (use the returned purchase_id in place of booking_id)."""
    tool = await db.tools.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] == user["id"]:
        raise HTTPException(400, "Cannot buy your own tool")
    if tool.get("listing_type") not in ("sell", "both"):
        raise HTTPException(400, "This tool is not for sale")
    if tool.get("is_sold"):
        raise HTTPException(409, "Already sold")
    if not tool.get("sale_price") or tool["sale_price"] <= 0:
        raise HTTPException(400, "Tool has no sale price set")
    purchase_id = f"pur_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": purchase_id,
        "tool_id": tool_id,
        "buyer_id": user["id"],
        "owner_id": tool["owner_id"],
        "amount": float(tool["sale_price"]),
        "paid": False,
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.purchases.insert_one(doc)
    # mark tool reserved so it stops appearing in active listings
    await db.tools.update_one({"id": tool_id}, {"$set": {"is_sold": True}})
    owner = await get_user_by_id(tool["owner_id"])
    if owner:
        await send_email_mocked(owner["email"], f"Your tool '{tool['title']}' has been purchased",
            f"{user['name']} bought your tool for ${tool['sale_price']}. Confirm pickup details.", db=db)
    doc.pop("_id", None)
    return doc


@api.get("/purchases")
async def list_purchases(role: Literal["buyer", "owner"] = "buyer", user: dict = Depends(current_user)):
    key = "buyer_id" if role == "buyer" else "owner_id"
    cur = db.purchases.find({key: user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=200)


@api.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingIn, user: dict = Depends(current_user)):
    tool = await db.tools.find_one({"id": payload.tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] == user["id"]:
        raise HTTPException(400, "Cannot book your own tool")
    if payload.start_date > payload.end_date:
        raise HTTPException(400, "End date must be after start date")
    if await has_booking_conflict(db, payload.tool_id, payload.start_date, payload.end_date):
        raise HTTPException(409, "Tool already booked for these dates")
    days = _days_between(payload.start_date, payload.end_date)
    rental = days * float(tool["daily_price"])
    insurance_fee = days * INSURANCE_TIERS.get(payload.insurance_tier, INSURANCE_TIERS["none"])["daily_fee"]
    total = rental + insurance_fee
    deposit = float(tool.get("security_deposit", 0))
    booking_id = f"bk_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": booking_id,
        "tool_id": payload.tool_id,
        "renter_id": user["id"],
        "owner_id": tool["owner_id"],
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "total_price": total,
        "deposit": deposit,
        "rental_price": rental,
        "insurance_tier": payload.insurance_tier,
        "insurance_fee": insurance_fee,
        "status": "pending",
        "pickup_method": payload.pickup_method,
        "delivery_address": payload.delivery_address,
        "message_to_owner": payload.message_to_owner,
        "paid": False,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.bookings.insert_one(doc)
    owner = await get_user_by_id(tool["owner_id"])
    if owner:
        await send_email_mocked(
            owner["email"],
            f"New booking request for {tool['title']}",
            f"{user['name']} requested {tool['title']} from {payload.start_date} to {payload.end_date}.",
            db=db
        )
    doc.pop("_id", None)
    return doc


@api.get("/bookings")
async def list_bookings(role: Literal["renter", "owner"] = "renter", user: dict = Depends(current_user)):
    key = "renter_id" if role == "renter" else "owner_id"
    cur = db.bookings.find({key: user["id"]}, {"_id": 0}).sort("created_at", -1)
    bookings = await cur.to_list(length=200)
    # enrich
    for b in bookings:
        tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0, "title": 1, "images": 1, "daily_price": 1})
        b["tool"] = tool
        other_id = b["owner_id"] if role == "renter" else b["renter_id"]
        other = await get_user_by_id(other_id)
        b["counterparty"] = serialize_user(other) if other else None
    return bookings


@api.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    if user["id"] not in (b["renter_id"], b["owner_id"]):
        raise HTTPException(403, "Forbidden")
    tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0})
    b["tool"] = tool
    return b


@api.put("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, payload: BookingStatusIn, user: dict = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Not found")
    if payload.status in ("approved", "declined") and b["owner_id"] != user["id"]:
        raise HTTPException(403, "Only owner can approve/decline")
    if payload.status == "cancelled" and user["id"] not in (b["renter_id"], b["owner_id"]):
        raise HTTPException(403, "Forbidden")
    # Re-check overlap before approving (a different request may have been approved meanwhile)
    if payload.status == "approved":
        if await has_booking_conflict(db, b["tool_id"], b["start_date"], b["end_date"], exclude_booking_id=booking_id):
            raise HTTPException(409, "Another approved booking conflicts with these dates")
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"status": payload.status, "updated_at": now_iso()}}
    )
    # Notify counterparty (MOCKED)
    renter = await get_user_by_id(b["renter_id"])
    owner = await get_user_by_id(b["owner_id"])
    if payload.status == "approved" and renter:
        await send_email_mocked(renter["email"], "Your booking was approved!",
            f"Your booking {booking_id} was approved. Pay to confirm.", db=db)
    elif payload.status == "declined" and renter:
        await send_email_mocked(renter["email"], "Your booking was declined",
            f"Your booking {booking_id} was declined.", db=db)
    elif payload.status == "cancelled":
        other = owner if user["id"] == b["renter_id"] else renter
        if other:
            await send_email_mocked(other["email"], "Booking cancelled",
                f"Booking {booking_id} was cancelled by the {'renter' if user['id']==b['renter_id'] else 'owner'}.", db=db)
    return {"ok": True, "status": payload.status}


# -----------------------------------------------------------------------------
# Routes - Favorites
# -----------------------------------------------------------------------------
@api.post("/favorites/{tool_id}")
async def add_favorite(tool_id: str, user: dict = Depends(current_user)):
    existing = await db.favorites.find_one({"user_id": user["id"], "tool_id": tool_id})
    if existing:
        return {"ok": True}
    await db.favorites.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "tool_id": tool_id,
        "created_at": now_iso(),
    })
    return {"ok": True}


@api.delete("/favorites/{tool_id}")
async def remove_favorite(tool_id: str, user: dict = Depends(current_user)):
    await db.favorites.delete_one({"user_id": user["id"], "tool_id": tool_id})
    return {"ok": True}


@api.get("/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=200)
    tool_ids = [f["tool_id"] for f in favs]
    tools = await db.tools.find({"id": {"$in": tool_ids}}, {"_id": 0}).to_list(length=200)
    return tools


# -----------------------------------------------------------------------------
# Routes - Reviews
# -----------------------------------------------------------------------------
@api.post("/reviews", response_model=Review)
async def create_review(payload: ReviewIn, user: dict = Depends(current_user)):
    booking = await db.bookings.find_one({"id": payload.booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if user["id"] not in (booking["renter_id"], booking["owner_id"]):
        raise HTTPException(403, "Forbidden")
    target_user_id = None
    if payload.target_type == "owner":
        target_user_id = booking["owner_id"]
    elif payload.target_type == "renter":
        target_user_id = booking["renter_id"]

    review_id = f"rev_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": review_id,
        "booking_id": payload.booking_id,
        "tool_id": booking["tool_id"],
        "reviewer_id": user["id"],
        "target_user_id": target_user_id,
        "target_type": payload.target_type,
        "rating": payload.rating,
        "comment": payload.comment,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc)

    # Update aggregate ratings
    if payload.target_type == "tool":
        agg = await db.reviews.aggregate([
            {"$match": {"tool_id": booking["tool_id"], "target_type": "tool"}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]).to_list(length=1)
        if agg:
            await db.tools.update_one(
                {"id": booking["tool_id"]},
                {"$set": {"rating_avg": round(agg[0]["avg"], 2), "rating_count": agg[0]["count"]}}
            )
    elif target_user_id:
        agg = await db.reviews.aggregate([
            {"$match": {"target_user_id": target_user_id, "target_type": {"$in": ["owner", "renter"]}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]).to_list(length=1)
        if agg:
            await db.users.update_one(
                {"id": target_user_id},
                {"$set": {"rating_avg": round(agg[0]["avg"], 2), "rating_count": agg[0]["count"]}}
            )
    doc.pop("_id", None)
    return doc


@api.get("/reviews")
async def list_reviews(tool_id: Optional[str] = None, user_id: Optional[str] = None):
    filt = {}
    if tool_id:
        filt["tool_id"] = tool_id
    if user_id:
        filt["target_user_id"] = user_id
    cur = db.reviews.find(filt, {"_id": 0}).sort("created_at", -1).limit(100)
    reviews = await cur.to_list(length=100)
    for r in reviews:
        reviewer = await get_user_by_id(r["reviewer_id"])
        r["reviewer"] = serialize_user(reviewer) if reviewer else None
    return reviews


# -----------------------------------------------------------------------------
# Routes - Users (public profile)
# -----------------------------------------------------------------------------
@api.get("/users/{user_id}")
async def get_user_public(user_id: str):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "Not found")
    return serialize_user(user)


# -----------------------------------------------------------------------------
# Routes - AI Tool Assistant
# -----------------------------------------------------------------------------
AI_SYSTEM_PROMPT = """You are ToolShare's AI Tool Assistant. The user describes a home/DIY task in natural language; you respond with a structured JSON listing the tools they need to complete the task.

Respond ONLY with valid JSON of this exact shape — no markdown, no commentary:
{
  "summary": "Short 1-2 sentence overview of the project",
  "difficulty": "Easy" | "Moderate" | "Advanced",
  "estimated_time": "e.g. 2-4 hours, 1 weekend",
  "tools": [
    {"name": "Circular saw", "category": "power-tools", "why": "to make straight cuts in lumber", "essential": true},
    {"name": "Tape measure", "category": "hand-tools", "why": "for accurate measurements", "essential": true}
  ],
  "safety_tips": ["Wear safety glasses", "..."]
}

Valid categories: power-tools, hand-tools, gardening, lawn-care, painting, plumbing, automotive, carpentry, electrical, cleaning, ladders, heavy-equipment, outdoor.
Pick 4-8 tools. Keep names concise (1-3 words). Map each tool to the BEST-FIT category from the list above."""


@api.post("/ai/recommend")
async def ai_recommend(payload: AIRecommendIn):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM not configured")
    session_id = f"toolshare_{uuid.uuid4().hex[:8]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=AI_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4o-mini")

    user_msg = UserMessage(text=f"Task: {payload.task}")
    try:
        raw = await chat.send_message(user_msg)
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(500, "AI service error")

    # extract JSON
    text = raw if isinstance(raw, str) else getattr(raw, "content", str(raw))
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        parsed = json.loads(text)
    except Exception:
        # try to find JSON block
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                parsed = json.loads(text[start:end + 1])
            except Exception:
                raise HTTPException(500, "AI returned unparseable response")
        else:
            raise HTTPException(500, "AI returned unparseable response")

    # For each suggested tool, find matching listings
    tools_recs = parsed.get("tools", [])
    for t in tools_recs:
        cat = t.get("category")
        name = t.get("name", "")
        filt = {"is_available": True}
        if cat:
            filt["category"] = cat
        # also try name match
        cur = db.tools.find(filt, {"_id": 0}).limit(50)
        matches = await cur.to_list(length=50)
        # filter by name fuzzy: lower-case contains any word from name
        words = [w.lower() for w in name.split() if len(w) > 2]
        scored = []
        for m in matches:
            title = (m.get("title") or "").lower()
            desc = (m.get("description") or "").lower()
            score = sum(1 for w in words if w in title or w in desc)
            if score > 0 or not words:
                m_copy = dict(m)
                m_copy["match_score"] = score
                scored.append(m_copy)
        # distance filter
        if payload.lat is not None and payload.lng is not None:
            filtered = []
            for m in scored:
                tl = m.get("location", {})
                try:
                    d = haversine_km(payload.lat, payload.lng, tl["lat"], tl["lng"])
                except Exception:
                    continue
                if d <= payload.radius_km:
                    m["distance_km"] = round(d, 1)
                    filtered.append(m)
            scored = filtered
        scored.sort(key=lambda x: (-x.get("match_score", 0), x.get("distance_km", 999)))
        t["available_listings"] = scored[:3]

    parsed["tools"] = tools_recs
    return parsed


# -----------------------------------------------------------------------------
# Mount P1 router (messaging, payments, identity, admin)
# -----------------------------------------------------------------------------
p1_router = build_p1_router(db=db, current_user_dep=current_user, get_user_by_id=get_user_by_id)
api.include_router(p1_router)


# -----------------------------------------------------------------------------
# Startup / Shutdown
# -----------------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
    # Index for fast lookups
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tools.create_index("id", unique=True)
    await db.tools.create_index("owner_id")
    await db.tools.create_index("category")
    await db.bookings.create_index("id", unique=True)
    await db.bookings.create_index("tool_id")
    await db.sessions.create_index("session_token", unique=True)
    await db.favorites.create_index([("user_id", 1), ("tool_id", 1)], unique=True)
    await db.messages.create_index("booking_id")
    await db.messages.create_index("recipient_id")
    await db.payment_transactions.create_index("session_id", unique=True)
    init_storage()


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# -----------------------------------------------------------------------------
# Mount
# -----------------------------------------------------------------------------
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=r"https?://.*",
    allow_methods=["*"],
    allow_headers=["*"],
)
