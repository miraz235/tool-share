"""Seed admin user for ToolShare."""
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

ADMIN_EMAIL = "admin@toolshare.demo"
ADMIN_PASSWORD = "Admin1234!"

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
        "name": "ToolShare Admin",
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
    print(f"Created admin user: {ADMIN_EMAIL} / {ADMIN_PASSWORD} (id={uid})")

if __name__ == "__main__":
    asyncio.run(main())
