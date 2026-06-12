"""Auth + user profile + file upload routes."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests
from fastapi import APIRouter, Depends, File, HTTPException, Header, Request, Response, UploadFile

from core import (
    APP_NAME, EMERGENT_AUTH_URL,
    GoogleSessionIn, LoginIn, RegisterIn, UpdateProfileIn,
    current_user, db, get_object, get_user_by_id, hash_password, logger,
    make_jwt, now_iso, put_object, serialize_user, verify_password,
)

router = APIRouter()


@router.get("/")
async def root():
    return {"name": "ToolShare API", "status": "ok"}


@router.post("/auth/register")
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


@router.post("/auth/login")
async def login(payload: LoginIn):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = make_jwt(user["id"])
    return {"token": token, "user": serialize_user(user)}


@router.post("/auth/google/session")
async def google_session(payload: GoogleSessionIn, response: Response):
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

    jwt_token = make_jwt(user_id)
    user = await get_user_by_id(user_id)
    return {"token": jwt_token, "user": serialize_user(user)}


@router.get("/auth/me")
async def auth_me(user: dict = Depends(current_user)):
    return serialize_user(user)


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.sessions.delete_one({"session_token": session_token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@router.put("/auth/profile")
async def update_profile(payload: UpdateProfileIn, user: dict = Depends(current_user)):
    update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await get_user_by_id(user["id"])
    return serialize_user(updated)


# ---- Uploads ---------------------------------------------------------------
@router.post("/upload")
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


@router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(404, "File not found")
    data, content_type = get_object(path)
    return Response(content=data, media_type=record.get("content_type") or content_type)


# ---- Public user profile ---------------------------------------------------
@router.get("/users/{user_id}")
async def get_user_public(user_id: str):
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(404, "Not found")
    return serialize_user(user)
