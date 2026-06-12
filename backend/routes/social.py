"""Social routes — favorites, follows, reviews."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from core import (
    Review, ReviewIn,
    current_user, db, get_user_by_id, now_iso, serialize_user,
)

router = APIRouter()


# ---- Favorites -------------------------------------------------------------
@router.post("/favorites/{tool_id}")
async def add_favorite(tool_id: str, alerts: bool = False, user: dict = Depends(current_user)):
    existing = await db.favorites.find_one({"user_id": user["id"], "tool_id": tool_id})
    if existing:
        await db.favorites.update_one(
            {"user_id": user["id"], "tool_id": tool_id},
            {"$set": {"alerts_on": bool(alerts)}}
        )
        return {"ok": True, "alerts_on": bool(alerts)}
    await db.favorites.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "tool_id": tool_id,
        "alerts_on": bool(alerts),
        "created_at": now_iso(),
    })
    return {"ok": True, "alerts_on": bool(alerts)}


@router.delete("/favorites/{tool_id}")
async def remove_favorite(tool_id: str, user: dict = Depends(current_user)):
    await db.favorites.delete_one({"user_id": user["id"], "tool_id": tool_id})
    return {"ok": True}


@router.get("/favorites")
async def list_favorites(user: dict = Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=200)
    tool_ids = [f["tool_id"] for f in favs]
    tools = await db.tools.find({"id": {"$in": tool_ids}}, {"_id": 0}).to_list(length=200)
    alerts_map = {f["tool_id"]: bool(f.get("alerts_on", False)) for f in favs}
    for t in tools:
        t["alerts_on"] = alerts_map.get(t["id"], False)
    return tools


# ---- Follows (owners) ------------------------------------------------------
@router.post("/follows/{owner_id}")
async def follow_owner(owner_id: str, user: dict = Depends(current_user)):
    if owner_id == user["id"]:
        raise HTTPException(400, "Cannot follow yourself")
    owner = await get_user_by_id(owner_id)
    if not owner:
        raise HTTPException(404, "Owner not found")
    existing = await db.owner_follows.find_one({"user_id": user["id"], "owner_id": owner_id})
    if existing:
        return {"ok": True, "following": True}
    await db.owner_follows.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "owner_id": owner_id,
        "created_at": now_iso(),
    })
    return {"ok": True, "following": True}


@router.delete("/follows/{owner_id}")
async def unfollow_owner(owner_id: str, user: dict = Depends(current_user)):
    await db.owner_follows.delete_one({"user_id": user["id"], "owner_id": owner_id})
    return {"ok": True, "following": False}


@router.get("/follows")
async def list_follows(user: dict = Depends(current_user)):
    follows = await db.owner_follows.find({"user_id": user["id"]}, {"_id": 0}).to_list(length=200)
    owner_ids = [f["owner_id"] for f in follows]
    owners = []
    for oid in owner_ids:
        u = await get_user_by_id(oid)
        if u:
            pub = serialize_user(u)
            pub["tool_count"] = await db.tools.count_documents({"owner_id": oid, "is_available": True})
            owners.append(pub)
    return owners


@router.get("/follows/check/{owner_id}")
async def check_follow(owner_id: str, user: dict = Depends(current_user)):
    existing = await db.owner_follows.find_one({"user_id": user["id"], "owner_id": owner_id})
    return {"following": bool(existing)}


# ---- Reviews ---------------------------------------------------------------
@router.post("/reviews", response_model=Review)
async def create_review(payload: ReviewIn, user: dict = Depends(current_user)):
    booking = await db.bookings.find_one({"id": payload.booking_id})
    if not booking:
        raise HTTPException(404, "Booking not found")
    if user["id"] not in (booking["renter_id"], booking["owner_id"]):
        raise HTTPException(403, "Forbidden")
    dupe = await db.reviews.find_one({
        "booking_id": payload.booking_id,
        "reviewer_id": user["id"],
        "target_type": payload.target_type,
    })
    if dupe:
        raise HTTPException(409, "You already submitted this review")
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
        "condition_tag": payload.condition_tag,
        "hidden": False,
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc)

    # Update aggregate ratings (only count non-hidden)
    if payload.target_type == "tool":
        agg = await db.reviews.aggregate([
            {"$match": {"tool_id": booking["tool_id"], "target_type": "tool", "hidden": {"$ne": True}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]).to_list(length=1)
        if agg:
            await db.tools.update_one(
                {"id": booking["tool_id"]},
                {"$set": {"rating_avg": round(agg[0]["avg"], 2), "rating_count": agg[0]["count"]}}
            )
    elif target_user_id:
        agg = await db.reviews.aggregate([
            {"$match": {"target_user_id": target_user_id, "target_type": {"$in": ["owner", "renter"]}, "hidden": {"$ne": True}}},
            {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}}
        ]).to_list(length=1)
        if agg:
            await db.users.update_one(
                {"id": target_user_id},
                {"$set": {"rating_avg": round(agg[0]["avg"], 2), "rating_count": agg[0]["count"]}}
            )
    doc.pop("_id", None)
    return doc


@router.get("/reviews")
async def list_reviews(tool_id: Optional[str] = None, user_id: Optional[str] = None):
    filt = {"hidden": {"$ne": True}}
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
