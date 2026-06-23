"""Seed admin user for ShareMyKit.

Reads credentials from env vars to avoid hard-coding secrets in source.
Set ADMIN_EMAIL + ADMIN_PASSWORD in /app/backend/.env before running.
"""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
import asyncio
import uuid
import bcrypt
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')
db = AsyncIOMotorClient(os.environ['MONGO_URL'])[os.environ['DB_NAME']]

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@toolshare.demo")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_PASSWORD:
    # Fail loud at boot rather than silently shipping a default.
    raise SystemExit(
        "ADMIN_PASSWORD env var is required. "
        "Set it in /app/backend/.env, then re-run: python seed_admin.py"
    )


async def main():
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing:
        await db.users.update_one({"email": ADMIN_EMAIL}, {"$set": {"is_admin": True, "is_verified": True}})
        print(f"Admin already exists, ensured flags: {ADMIN_EMAIL}")
        return
    uid = f"user_{uuid.uuid4().hex[:12]}"
    await db.users.insert_one({
        "id": uid,
        "email": ADMIN_EMAIL,
        "password_hash": bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode(),
        "name": "ShareMyKit Admin",
        "picture": None,
        "city": None,
        "bio": "Platform administrator",
        "auth_provider": "email",
        "rating_avg": 0.0,
        "rating_count": 0,
        "is_verified": True,
        "is_admin": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    print(f"Created admin user: {ADMIN_EMAIL} (id={uid})")

if __name__ == "__main__":
    asyncio.run(main())
