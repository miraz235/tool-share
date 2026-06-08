"""Seed demo data for ToolShare - creates a few users and tool listings."""
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
import asyncio
import uuid
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path
import bcrypt

load_dotenv(Path(__file__).parent / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

def now_iso(): return datetime.now(timezone.utc).isoformat()

DEMO_USERS = [
    {"name": "Marcus Chen", "email": "marcus@toolshare.demo", "city": "Toronto", "bio": "Weekend woodworker. Happy to lend!", "picture": "https://images.unsplash.com/photo-1598966739654-5e9a252d8c32?w=300&q=80"},
    {"name": "Sara Patel", "email": "sara@toolshare.demo", "city": "Toronto", "bio": "Renovation enthusiast. I take care of my tools.", "picture": "https://images.unsplash.com/photo-1548213238-0da7521bd6e0?w=300&q=80"},
    {"name": "Diego Ramirez", "email": "diego@toolshare.demo", "city": "Mississauga", "bio": "Landscaping pro. Most gardening gear available.", "picture": None},
]

DEMO_TOOLS = [
    {"title": "DeWalt 20V Cordless Drill", "description": "Powerful 20V cordless drill with two batteries and charger. Perfect for furniture assembly, drywall, decks. Includes a bit set.", "category": "power-tools", "daily_price": 18, "security_deposit": 80, "condition": "Like New", "img": "https://images.unsplash.com/photo-1426927308491-6380b6a9936f?w=1200&q=80", "lat": 43.6532, "lng": -79.3832, "city": "Toronto", "postal": "M5V 2A8"},
    {"title": "Bosch Circular Saw", "description": "7-1/4\" 15-amp circular saw with laser guide. Cuts wood, plywood, MDF. Two extra blades included.", "category": "power-tools", "daily_price": 22, "security_deposit": 100, "condition": "Good", "img": "https://images.unsplash.com/photo-1559295758-d77a698a2dff?w=1200&q=80", "lat": 43.6629, "lng": -79.3957, "city": "Toronto", "postal": "M5R 2P5"},
    {"title": "8ft A-Frame Ladder", "description": "Sturdy aluminum 8ft ladder. Lightweight, easy to transport.", "category": "ladders", "daily_price": 12, "security_deposit": 40, "condition": "Good", "img": "https://images.unsplash.com/photo-1632832840916-d4ddb1ef4f53?w=1200&q=80", "lat": 43.6488, "lng": -79.3835, "city": "Toronto", "postal": "M5T 2C7"},
    {"title": "Pressure Washer 2000 PSI", "description": "Karcher electric pressure washer. Great for decks, driveways, siding. Two nozzles included.", "category": "cleaning", "daily_price": 28, "security_deposit": 120, "condition": "Like New", "img": "https://images.unsplash.com/photo-1593696954577-ab3d39317b97?w=1200&q=80", "lat": 43.5890, "lng": -79.6441, "city": "Mississauga", "postal": "L5B 4M2"},
    {"title": "Tile Cutter Wet Saw", "description": "Professional wet tile saw. Up to 24\" cuts. Comes with diamond blade and water reservoir.", "category": "carpentry", "daily_price": 35, "security_deposit": 150, "condition": "Good", "img": "https://images.unsplash.com/photo-1503642551022-c011aafb3c88?w=1200&q=80", "lat": 43.7001, "lng": -79.4163, "city": "Toronto", "postal": "M6B 2L7"},
    {"title": "Hedge Trimmer Cordless", "description": "Battery-powered 22\" hedge trimmer. Two batteries, lightweight design.", "category": "gardening", "daily_price": 15, "security_deposit": 50, "condition": "Good", "img": "https://images.pexels.com/photos/4503269/pexels-photo-4503269.jpeg?w=1200", "lat": 43.5890, "lng": -79.6441, "city": "Mississauga", "postal": "L5B 4M2"},
    {"title": "Lawn Mower Self-Propelled", "description": "Honda self-propelled gas mower. Recently serviced. Mulches and bags.", "category": "lawn-care", "daily_price": 25, "security_deposit": 100, "condition": "Good", "img": "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=1200&q=80", "lat": 43.5890, "lng": -79.6441, "city": "Mississauga", "postal": "L5B 4M2"},
    {"title": "Paint Sprayer HVLP", "description": "Graco HVLP paint sprayer. Perfect for cabinets, furniture, doors. Manual included.", "category": "painting", "daily_price": 30, "security_deposit": 120, "condition": "Like New", "img": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=1200&q=80", "lat": 43.6629, "lng": -79.3957, "city": "Toronto", "postal": "M5R 2P5"},
    {"title": "Stud Finder + Level Set", "description": "Pro-grade stud finder, 4ft and 2ft levels, laser level. Everything for hanging shelves and TVs.", "category": "hand-tools", "daily_price": 6, "security_deposit": 25, "condition": "Like New", "img": "https://images.unsplash.com/photo-1563440205176-c565cd7302e4?w=1200&q=80", "lat": 43.6532, "lng": -79.3832, "city": "Toronto", "postal": "M5V 2A8"},
    {"title": "Air Compressor 6 Gal", "description": "Portable 6-gallon air compressor with 50ft hose. For nail guns, tire inflation, blowing dust.", "category": "power-tools", "daily_price": 20, "security_deposit": 90, "condition": "Good", "img": "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1200&q=80", "lat": 43.7001, "lng": -79.4163, "city": "Toronto", "postal": "M6B 2L7"},
    {"title": "Wheelbarrow Heavy Duty", "description": "Steel-tray 6 cu ft wheelbarrow. Perfect for landscaping, concrete, mulch.", "category": "gardening", "daily_price": 8, "security_deposit": 30, "condition": "Good", "img": "https://images.pexels.com/photos/4503269/pexels-photo-4503269.jpeg?w=1200", "lat": 43.5890, "lng": -79.6441, "city": "Mississauga", "postal": "L5B 4M2"},
    {"title": "Socket Wrench Set", "description": "150-piece socket set, SAE and metric. Includes ratchets and extension bars.", "category": "hand-tools", "daily_price": 7, "security_deposit": 40, "condition": "Like New", "img": "https://images.unsplash.com/photo-1563440205176-c565cd7302e4?w=1200&q=80", "lat": 43.6629, "lng": -79.3957, "city": "Toronto", "postal": "M5R 2P5"},
]


async def main():
    user_ids = []
    for u in DEMO_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            user_ids.append(existing["id"])
            continue
        uid = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "id": uid,
            "email": u["email"],
            "password_hash": bcrypt.hashpw(b"demo1234", bcrypt.gensalt()).decode(),
            "name": u["name"],
            "picture": u["picture"],
            "city": u["city"],
            "bio": u["bio"],
            "auth_provider": "email",
            "rating_avg": 4.8,
            "rating_count": 12,
            "is_verified": True,
            "created_at": now_iso(),
        })
        user_ids.append(uid)
        print(f"Created user {u['name']} -> {uid}")

    # Clear existing demo tools
    await db.tools.delete_many({"title": {"$in": [t["title"] for t in DEMO_TOOLS]}})

    for i, t in enumerate(DEMO_TOOLS):
        owner = user_ids[i % len(user_ids)]
        tid = f"tool_{uuid.uuid4().hex[:12]}"
        await db.tools.insert_one({
            "id": tid,
            "owner_id": owner,
            "title": t["title"],
            "description": t["description"],
            "category": t["category"],
            "daily_price": t["daily_price"],
            "security_deposit": t["security_deposit"],
            "condition": t["condition"],
            "images": [t["img"]],
            "location": {"address": None, "city": t["city"], "postal_code": t["postal"], "lat": t["lat"], "lng": t["lng"]},
            "pickup_available": True,
            "delivery_available": i % 3 == 0,
            "delivery_radius_km": 10 if i % 3 == 0 else 0,
            "unavailable_dates": [],
            "is_available": True,
            "view_count": 0,
            "rating_avg": 4.7 if i % 2 == 0 else 4.5,
            "rating_count": 3 + i,
            "created_at": now_iso(),
        })
    print(f"Created {len(DEMO_TOOLS)} tools")

if __name__ == "__main__":
    asyncio.run(main())
