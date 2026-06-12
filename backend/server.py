"""
ToolShare Backend API — thin app shell.

Route handlers live in `routes/*`; shared models/helpers/db client live in
`core.py`. This file only wires routers, registers startup hooks, and applies
middleware.
"""
from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from core import current_user, db, get_user_by_id, init_storage, mongo_client
from p1_features import build_p1_router
from routes import auth as auth_routes
from routes import bookings as booking_routes
from routes import fx as fx_routes
from routes import ai as ai_routes
from routes import social as social_routes
from routes import tools as tool_routes

app = FastAPI(title="ToolShare API")
api = APIRouter(prefix="/api")

# Feature routers
api.include_router(auth_routes.router)
api.include_router(tool_routes.router)
api.include_router(booking_routes.router)
api.include_router(fx_routes.router)
api.include_router(social_routes.router)
api.include_router(ai_routes.router)

# P1 router (messaging, payments, identity, admin) takes a few injected deps.
api.include_router(
    build_p1_router(db=db, current_user_dep=current_user, get_user_by_id=get_user_by_id)
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.tools.create_index("id", unique=True)
    await db.tools.create_index("owner_id")
    await db.tools.create_index("category")
    await db.bookings.create_index("id", unique=True)
    await db.bookings.create_index("tool_id")
    await db.sessions.create_index("session_token", unique=True)
    await db.favorites.create_index([("user_id", 1), ("tool_id", 1)], unique=True)
    await db.owner_follows.create_index([("user_id", 1), ("owner_id", 1)], unique=True)
    await db.reviews.create_index(
        [("booking_id", 1), ("reviewer_id", 1), ("target_type", 1)], unique=True
    )
    await db.ai_usage.create_index([("user_id", 1), ("created_at", -1)])
    await db.messages.create_index("booking_id")
    await db.messages.create_index("recipient_id")
    await db.payment_transactions.create_index("session_id", unique=True)
    init_storage()


@app.on_event("shutdown")
async def on_shutdown():
    mongo_client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=r"https?://.*",
    allow_methods=["*"],
    allow_headers=["*"],
)
