"""Seed demo data for ToolShare - creates a few users and tool listings across regions
so the multi-currency story (CAD / USD / EUR / GBP / MXN / AUD) is visible end-to-end."""
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

# City → currency mapping. Used to stamp `price_currency` on each demo listing
# so the marketplace shows real cross-currency listings (the converter then
# displays them all in the viewer's currency).
CITY_CURRENCY = {
    "Toronto": "CAD",
    "Mississauga": "CAD",
    "Hamilton": "CAD",
    "New York": "USD",
    "Miami": "USD",
    "Mexico City": "MXN",
    "London": "GBP",
    "Paris": "EUR",
    "Sydney": "AUD",
}

# City → state/province/region. Used to populate `location.state` so the new
# Browse "State / Province" filter has data to search against.
CITY_STATE = {
    "Toronto": "Ontario",
    "Mississauga": "Ontario",
    "Hamilton": "Ontario",
    "New York": "New York",
    "Miami": "Florida",
    "Mexico City": "CDMX",
    "London": "Greater London",
    "Paris": "Île-de-France",
    "Sydney": "New South Wales",
}

DEMO_USERS = [
    {"name": "Marcus Chen", "email": "marcus@toolshare.demo", "city": "Toronto", "bio": "Weekend woodworker. Happy to lend!", "picture": "https://images.unsplash.com/photo-1598966739654-5e9a252d8c32?w=300&q=80"},
    {"name": "Sara Patel", "email": "sara@toolshare.demo", "city": "Toronto", "bio": "Renovation enthusiast. I take care of my tools.", "picture": "https://images.unsplash.com/photo-1548213238-0da7521bd6e0?w=300&q=80"},
    {"name": "Diego Ramirez", "email": "diego@toolshare.demo", "city": "Mississauga", "bio": "Landscaping pro. Most gardening gear available.", "picture": None},
    {"name": "Emma Wright", "email": "emma@toolshare.demo", "city": "London", "bio": "Flat renovator. UK tools, metric & imperial.", "picture": "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&q=80"},
    {"name": "Luca Moretti", "email": "luca@toolshare.demo", "city": "Paris", "bio": "DIY enthusiast. Outils impeccables.", "picture": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&q=80"},
    {"name": "Jake Sullivan", "email": "jake@toolshare.demo", "city": "New York", "bio": "Brooklyn maker. Power tools always ready.", "picture": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&q=80"},
    {"name": "Mariana López", "email": "mariana@toolshare.demo", "city": "Mexico City", "bio": "Carpintera. Herramientas confiables y bien cuidadas.", "picture": None},
]

# `daily_price` is in the listing's CITY currency (per CITY_CURRENCY). Sale price (when
# listing_type == "both") is roughly 25× the daily — same currency.
DEMO_TOOLS = [
    # Toronto (CAD)
    {"title": "DeWalt 20V Cordless Drill", "description": "Powerful 20V cordless drill with two batteries and charger. Perfect for furniture assembly, drywall, decks. Includes a bit set.", "category": "power-tools", "daily_price": 25, "security_deposit": 110, "condition": "Like New", "img": "https://images.unsplash.com/photo-1426927308491-6380b6a9936f?w=1200&q=80", "lat": 43.6532, "lng": -79.3832, "city": "Toronto", "postal": "M5V 2A8"},
    {"title": "Bosch Circular Saw", "description": "7-1/4\" 15-amp circular saw with laser guide. Cuts wood, plywood, MDF. Two extra blades included.", "category": "power-tools", "daily_price": 30, "security_deposit": 140, "condition": "Good", "img": "https://images.unsplash.com/photo-1559295758-d77a698a2dff?w=1200&q=80", "lat": 43.6629, "lng": -79.3957, "city": "Toronto", "postal": "M5R 2P5"},
    {"title": "8ft A-Frame Ladder", "description": "Sturdy aluminum 8ft ladder. Lightweight, easy to transport.", "category": "ladders", "daily_price": 16, "security_deposit": 55, "condition": "Good", "img": "https://images.unsplash.com/photo-1632832840916-d4ddb1ef4f53?w=1200&q=80", "lat": 43.6488, "lng": -79.3835, "city": "Toronto", "postal": "M5T 2C7"},
    {"title": "Tile Cutter Wet Saw", "description": "Professional wet tile saw. Up to 24\" cuts. Comes with diamond blade and water reservoir.", "category": "carpentry", "daily_price": 48, "security_deposit": 200, "condition": "Good", "img": "https://images.unsplash.com/photo-1503642551022-c011aafb3c88?w=1200&q=80", "lat": 43.7001, "lng": -79.4163, "city": "Toronto", "postal": "M6B 2L7"},
    {"title": "Stud Finder + Level Set", "description": "Pro-grade stud finder, 4ft and 2ft levels, laser level. Everything for hanging shelves and TVs.", "category": "hand-tools", "daily_price": 8, "security_deposit": 35, "condition": "Like New", "img": "https://images.unsplash.com/photo-1563440205176-c565cd7302e4?w=1200&q=80", "lat": 43.6532, "lng": -79.3832, "city": "Toronto", "postal": "M5V 2A8"},
    # Mississauga (CAD)
    {"title": "Pressure Washer 2000 PSI", "description": "Karcher electric pressure washer. Great for decks, driveways, siding. Two nozzles included.", "category": "cleaning", "daily_price": 38, "security_deposit": 165, "condition": "Like New", "img": "https://images.unsplash.com/photo-1593696954577-ab3d39317b97?w=1200&q=80", "lat": 43.5890, "lng": -79.6441, "city": "Mississauga", "postal": "L5B 4M2"},
    {"title": "Lawn Mower Self-Propelled", "description": "Honda self-propelled gas mower. Recently serviced. Mulches and bags.", "category": "lawn-care", "daily_price": 34, "security_deposit": 140, "condition": "Good", "img": "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=1200&q=80", "lat": 43.5890, "lng": -79.6441, "city": "Mississauga", "postal": "L5B 4M2"},
    {"title": "Wheelbarrow Heavy Duty", "description": "Steel-tray 6 cu ft wheelbarrow. Perfect for landscaping, concrete, mulch.", "category": "gardening", "daily_price": 11, "security_deposit": 40, "condition": "Good", "img": "https://images.pexels.com/photos/4503269/pexels-photo-4503269.jpeg?w=1200", "lat": 43.5890, "lng": -79.6441, "city": "Mississauga", "postal": "L5B 4M2"},
    # New York (USD)
    {"title": "Hedge Trimmer Cordless", "description": "Battery-powered 22\" hedge trimmer. Two batteries, lightweight design.", "category": "gardening", "daily_price": 14, "security_deposit": 45, "condition": "Good", "img": "https://images.pexels.com/photos/4503269/pexels-photo-4503269.jpeg?w=1200", "lat": 40.7128, "lng": -74.0060, "city": "New York", "postal": "10003"},
    {"title": "Paint Sprayer HVLP", "description": "Graco HVLP paint sprayer. Perfect for cabinets, furniture, doors. Manual included.", "category": "painting", "daily_price": 28, "security_deposit": 110, "condition": "Like New", "img": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=1200&q=80", "lat": 40.7308, "lng": -73.9973, "city": "New York", "postal": "10012"},
    {"title": "Air Compressor 6 Gal", "description": "Portable 6-gallon air compressor with 50ft hose. For nail guns, tire inflation, blowing dust.", "category": "power-tools", "daily_price": 22, "security_deposit": 90, "condition": "Good", "img": "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=1200&q=80", "lat": 40.7128, "lng": -74.0060, "city": "New York", "postal": "10003"},
    # London (GBP)
    {"title": "Makita Impact Driver", "description": "18V brushless impact driver. Perfect for decking, fencing, heavy fixings.", "category": "power-tools", "daily_price": 14, "security_deposit": 60, "condition": "Like New", "img": "https://images.unsplash.com/photo-1581147036324-c47a03a81d48?w=1200&q=80", "lat": 51.5074, "lng": -0.1278, "city": "London", "postal": "EC1A 1BB"},
    {"title": "Socket Wrench Set (Metric)", "description": "150-piece socket set, mostly metric. Includes ratchets and extension bars.", "category": "hand-tools", "daily_price": 6, "security_deposit": 30, "condition": "Like New", "img": "https://images.unsplash.com/photo-1563440205176-c565cd7302e4?w=1200&q=80", "lat": 51.5155, "lng": -0.0922, "city": "London", "postal": "EC2A 4NE"},
    # Paris (EUR)
    {"title": "Festool Plunge Saw", "description": "Track saw with 1.4m guide rail. Studio-quality straight cuts.", "category": "carpentry", "daily_price": 30, "security_deposit": 180, "condition": "Like New", "img": "https://images.unsplash.com/photo-1503642551022-c011aafb3c88?w=1200&q=80", "lat": 48.8566, "lng": 2.3522, "city": "Paris", "postal": "75003"},
    {"title": "Échafaudage Pliant 2m", "description": "Petite échafaudage roulante. Idéal pour peinture et plafonds.", "category": "ladders", "daily_price": 12, "security_deposit": 50, "condition": "Good", "img": "https://images.unsplash.com/photo-1632832840916-d4ddb1ef4f53?w=1200&q=80", "lat": 48.8738, "lng": 2.2950, "city": "Paris", "postal": "75017"},
    # Mexico City (MXN)
    {"title": "Taladro Inalámbrico DeWalt", "description": "Taladro de 20V con dos baterías. Listo para muebles y proyectos del hogar.", "category": "power-tools", "daily_price": 320, "security_deposit": 1500, "condition": "Good", "img": "https://images.unsplash.com/photo-1426927308491-6380b6a9936f?w=1200&q=80", "lat": 19.4326, "lng": -99.1332, "city": "Mexico City", "postal": "06700"},
    {"title": "Pulidora Bosch", "description": "Pulidora de ángulo de 4½″. Discos de corte y desbaste incluidos.", "category": "power-tools", "daily_price": 240, "security_deposit": 900, "condition": "Like New", "img": "https://images.unsplash.com/photo-1559295758-d77a698a2dff?w=1200&q=80", "lat": 19.4220, "lng": -99.1605, "city": "Mexico City", "postal": "06140"},
]


async def main():
    user_by_city: dict[str, str] = {}
    for u in DEMO_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if existing:
            user_by_city.setdefault(u["city"], existing["id"])
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
        user_by_city.setdefault(u["city"], uid)
        print(f"Created user {u['name']} ({u['city']}) -> {uid}")

    # Clear existing demo tools so we re-seed cleanly with currency stamps
    await db.tools.delete_many({"title": {"$in": [t["title"] for t in DEMO_TOOLS]}})

    for i, t in enumerate(DEMO_TOOLS):
        # Match tool city to an owner from that city; fall back to any owner.
        owner = user_by_city.get(t["city"]) or next(iter(user_by_city.values()))
        currency = CITY_CURRENCY.get(t["city"], "USD")
        state = CITY_STATE.get(t["city"])
        tid = f"tool_{uuid.uuid4().hex[:12]}"
        # A handful of tools get multi-unit stock so the quantity feature is
        # visible end-to-end without manual edits.
        explicit_qty = t.get("quantity_total")
        quantity_total = int(explicit_qty) if explicit_qty else (5 if i % 4 == 1 else 1)
        await db.tools.insert_one({
            "id": tid,
            "owner_id": owner,
            "title": t["title"],
            "description": t["description"],
            "category": t["category"],
            "daily_price": t["daily_price"],
            "security_deposit": t["security_deposit"],
            "price_currency": currency,
            "condition": t["condition"],
            "images": [t["img"]],
            "location": {
                "address": None,
                "city": t["city"],
                "state": state,
                "postal_code": t["postal"],
                "lat": t["lat"],
                "lng": t["lng"],
            },
            "pickup_available": True,
            "delivery_available": i % 3 == 0,
            "delivery_radius_km": 10 if i % 3 == 0 else 0,
            "unavailable_dates": [],
            "quantity_total": quantity_total,
            "is_available": True,
            "is_sold": False,
            "is_featured": i < 3,  # First 3 tools are featured for demo
            "listing_type": "both" if i % 4 == 0 else "rent",  # ~25% also for sale
            "sale_price": round(t["daily_price"] * 25, 2) if i % 4 == 0 else 0,  # roughly 25× rental, in same currency
            "view_count": 0,
            "rating_avg": 4.7 if i % 2 == 0 else 4.5,
            "rating_count": 3 + i,
            "created_at": now_iso(),
        })
    print(f"Created {len(DEMO_TOOLS)} tools across {len(set(t['city'] for t in DEMO_TOOLS))} cities / {len(set(CITY_CURRENCY[t['city']] for t in DEMO_TOOLS))} currencies")

if __name__ == "__main__":
    asyncio.run(main())
