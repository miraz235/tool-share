"""Tool listing routes — categories, CRUD, search, availability."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from core import (
    CATEGORIES, _DEFAULT_RATES,
    Tool, ToolIn,
    _obfuscate_location, _user_has_paid_booking,
    current_user, db, get_user_by_id, haversine_km, logger, now_iso,
    optional_user, serialize_user,
)
from p1_features import send_email_mocked

router = APIRouter()


@router.get("/categories")
async def get_categories():
    return CATEGORIES


@router.post("/tools", response_model=Tool)
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
    # Notify followers of this owner about the new listing (MOCKED email)
    try:
        follows = await db.owner_follows.find({"owner_id": user["id"]}, {"_id": 0}).to_list(length=500)
        for f in follows:
            follower = await get_user_by_id(f["user_id"])
            if follower:
                await send_email_mocked(
                    follower["email"],
                    f"{user.get('name','An owner')} just listed: {doc['title']}",
                    "A tool you might like is now available on ToolShare. Open the app to view it.",
                    db=db,
                )
    except Exception as e:
        logger.error(f"Follower notify failed: {e}")
    doc.pop("_id", None)
    return doc


@router.get("/tools")
async def list_tools(
    q: Optional[str] = None,
    category: Optional[str] = None,
    listing_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    city: Optional[str] = None,
    state: Optional[str] = None,
    postal_code: Optional[str] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 50.0,
    owner_id: Optional[str] = None,
    featured_only: bool = False,
    verified_only: bool = False,
    viewer_currency: Optional[str] = None,
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
        filt["listing_type"] = {"$in": [listing_type, "both"]}
    # Currency-aware price filter happens in Python below; otherwise DB filter is fine.
    apply_price_filter_in_db = viewer_currency is None
    if apply_price_filter_in_db:
        if min_price is not None:
            filt["daily_price"] = {"$gte": min_price}
        if max_price is not None:
            filt.setdefault("daily_price", {})["$lte"] = max_price
    if city:
        filt["location.city"] = {"$regex": f"^{city}$", "$options": "i"}
    if state:
        filt["location.state"] = {"$regex": f"^{state}", "$options": "i"}
    if postal_code:
        filt["location.postal_code"] = {"$regex": f"^{postal_code}", "$options": "i"}
    if owner_id:
        filt["owner_id"] = owner_id
    if featured_only:
        filt["is_featured"] = True
    if verified_only:
        # Restrict to tools owned by verified users.
        verified_owner_ids = await db.users.distinct("id", {"is_verified": True})
        filt["owner_id"] = {"$in": verified_owner_ids}

    cur = db.tools.find(filt, {"_id": 0}).sort([("is_featured", -1), ("created_at", -1)]).limit(limit)
    tools = await cur.to_list(length=limit)

    # Stamp a quick verified flag on each tool for card-level rendering.
    owner_ids_in_results = list({t.get("owner_id") for t in tools if t.get("owner_id")})
    if owner_ids_in_results:
        verified_ids = set(await db.users.distinct(
            "id", {"id": {"$in": owner_ids_in_results}, "is_verified": True}
        ))
        for t in tools:
            t["owner_verified"] = t.get("owner_id") in verified_ids

    if viewer_currency and (min_price is not None or max_price is not None):
        vc = viewer_currency.upper()
        viewer_rate = _DEFAULT_RATES.get(vc, 1.0)
        filtered: List[dict] = []
        for tool in tools:
            tc = (tool.get("price_currency") or "USD").upper()
            tool_rate = _DEFAULT_RATES.get(tc, 1.0)
            price_in_viewer = float(tool.get("daily_price", 0)) * (viewer_rate / tool_rate)
            if min_price is not None and price_in_viewer < min_price:
                continue
            if max_price is not None and price_in_viewer > max_price:
                continue
            filtered.append(tool)
        tools = filtered

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
        result.sort(key=lambda x: (not x.get("is_featured", False), x.get("distance_km", 999)))
        return result
    return tools


@router.get("/tools/{tool_id}")
async def get_tool(tool_id: str, request: Request, authorization: Optional[str] = Header(None)):
    tool = await db.tools.find_one({"id": tool_id}, {"_id": 0})
    if not tool:
        raise HTTPException(404, "Tool not found")
    await db.tools.update_one({"id": tool_id}, {"$inc": {"view_count": 1}})

    viewer = await optional_user(request, authorization)
    is_owner = viewer and viewer["id"] == tool["owner_id"]
    has_paid = viewer and await _user_has_paid_booking(viewer["id"], tool_id)
    if not is_owner and not has_paid:
        tool["location"] = _obfuscate_location(tool.get("location", {}))
    else:
        tool["location"] = {**tool.get("location", {}), "is_approximate": False}

    owner = await get_user_by_id(tool["owner_id"])
    tool["owner"] = serialize_user(owner) if owner else None
    return tool


@router.get("/tools/{tool_id}/unavailable_dates")
async def get_unavailable_dates(tool_id: str):
    """Return dates that are fully sold-out, plus per-date remaining stock.

    A date is included in `dates` only when the total booked quantity on that
    day has reached the tool's `quantity_total`. The frontend uses
    `availability` to render partial-stock badges in the calendar.
    """
    tool = await db.tools.find_one(
        {"id": tool_id},
        {"_id": 0, "unavailable_dates": 1, "quantity_total": 1}
    )
    if not tool:
        raise HTTPException(404, "Tool not found")
    quantity_total = int(tool.get("quantity_total") or 1)

    today = datetime.now(timezone.utc).date()
    horizon_end = (today + timedelta(days=365)).isoformat()
    bookings = await db.bookings.find(
        {
            "tool_id": tool_id,
            "status": {"$in": ["pending", "approved"]},
            "end_date": {"$gte": today.isoformat()},
            "start_date": {"$lte": horizon_end},
        },
        {"_id": 0, "start_date": 1, "end_date": 1, "quantity": 1}
    ).to_list(length=1000)

    booked_by_date: dict[str, int] = {}
    for b in bookings:
        try:
            s = datetime.fromisoformat(b["start_date"]).date()
            e = datetime.fromisoformat(b["end_date"]).date()
        except Exception:
            continue
        qty = int(b.get("quantity") or 1)
        d = max(s, today)
        while d <= e:
            iso = d.isoformat()
            booked_by_date[iso] = booked_by_date.get(iso, 0) + qty
            d = d + timedelta(days=1)

    owner_blocked = set(tool.get("unavailable_dates", []) or [])
    sold_out = {iso for iso, taken in booked_by_date.items() if taken >= quantity_total}
    blocked = sorted(owner_blocked | sold_out)

    availability = {
        iso: max(0, quantity_total - taken)
        for iso, taken in booked_by_date.items()
    }
    return {
        "dates": blocked,
        "quantity_total": quantity_total,
        "availability": availability,
    }


@router.put("/tools/{tool_id}")
async def update_tool(tool_id: str, payload: ToolIn, user: dict = Depends(current_user)):
    tool = await db.tools.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] != user["id"]:
        raise HTTPException(403, "Not the owner")
    await db.tools.update_one({"id": tool_id}, {"$set": payload.model_dump()})
    updated = await db.tools.find_one({"id": tool_id}, {"_id": 0})
    return updated


@router.delete("/tools/{tool_id}")
async def delete_tool(tool_id: str, user: dict = Depends(current_user)):
    tool = await db.tools.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] != user["id"]:
        raise HTTPException(403, "Not the owner")
    await db.tools.delete_one({"id": tool_id})
    return {"ok": True}


@router.get("/my/tools")
async def my_tools(user: dict = Depends(current_user)):
    cur = db.tools.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=200)


@router.get("/my/inventory")
async def my_inventory(days: int = 30, user: dict = Depends(current_user)):
    """Per-day stock heatmap for every tool the owner has.

    Returns a list of {tool_id, title, quantity_total, days: [{date, booked, remaining}]}.
    Used by the owner inventory dashboard to spot bottlenecks.
    """
    days = max(7, min(90, days))
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=days - 1)
    tools = await db.tools.find(
        {"owner_id": user["id"]},
        {"_id": 0, "id": 1, "title": 1, "images": 1, "quantity_total": 1, "is_available": 1, "unavailable_dates": 1, "daily_price": 1, "price_currency": 1}
    ).sort("created_at", -1).to_list(length=200)

    if not tools:
        return {"days": [d.isoformat() for d in (today + timedelta(days=i) for i in range(days))], "tools": []}

    tool_ids = [t["id"] for t in tools]
    bookings = await db.bookings.find(
        {
            "tool_id": {"$in": tool_ids},
            "status": {"$in": ["pending", "approved"]},
            "end_date": {"$gte": today.isoformat()},
            "start_date": {"$lte": horizon.isoformat()},
        },
        {"_id": 0, "tool_id": 1, "start_date": 1, "end_date": 1, "quantity": 1, "status": 1}
    ).to_list(length=2000)

    # Build per-tool booked map
    by_tool: dict[str, dict[str, int]] = {tid: {} for tid in tool_ids}
    for b in bookings:
        try:
            s = datetime.fromisoformat(b["start_date"]).date()
            e = datetime.fromisoformat(b["end_date"]).date()
        except Exception:
            continue
        qty = int(b.get("quantity") or 1)
        d = max(s, today)
        end = min(e, horizon)
        while d <= end:
            iso = d.isoformat()
            by_tool[b["tool_id"]][iso] = by_tool[b["tool_id"]].get(iso, 0) + qty
            d = d + timedelta(days=1)

    date_seq = [(today + timedelta(days=i)).isoformat() for i in range(days)]
    result_tools = []
    for t in tools:
        qty_total = int(t.get("quantity_total") or 1)
        owner_blocked = set(t.get("unavailable_dates", []) or [])
        rows = []
        for iso in date_seq:
            booked = by_tool[t["id"]].get(iso, 0)
            owner_block = iso in owner_blocked
            remaining = 0 if owner_block else max(0, qty_total - booked)
            rows.append({
                "date": iso,
                "booked": booked,
                "remaining": remaining,
                "owner_blocked": owner_block,
            })
        result_tools.append({
            "id": t["id"],
            "title": t["title"],
            "image": (t.get("images") or [None])[0],
            "quantity_total": qty_total,
            "is_available": t.get("is_available", True),
            "daily_price": t.get("daily_price"),
            "price_currency": t.get("price_currency", "USD"),
            "days": rows,
        })

    return {"days": date_seq, "tools": result_tools}


@router.post("/tools/{tool_id}/block_dates")
async def block_dates(
    tool_id: str,
    dates: list[str],
    user: dict = Depends(current_user)
):
    """Owner toggles stock-out for a list of ISO dates (additive merge)."""
    tool = await db.tools.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] != user["id"]:
        raise HTTPException(403, "Not the owner")
    current = set(tool.get("unavailable_dates", []) or [])
    incoming = set(dates)
    # Symmetric toggle: dates already blocked get unblocked; new dates get added.
    next_blocked = sorted((current - incoming) | (incoming - current))
    await db.tools.update_one(
        {"id": tool_id},
        {"$set": {"unavailable_dates": next_blocked}}
    )
    return {"ok": True, "unavailable_dates": next_blocked}


@router.put("/tools/{tool_id}/availability")
async def toggle_availability(
    tool_id: str,
    user: dict = Depends(current_user),
    is_available: bool = True,
):
    """Quick on/off switch — hides the tool from browse without deleting it."""
    tool = await db.tools.find_one({"id": tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] != user["id"]:
        raise HTTPException(403, "Not the owner")
    await db.tools.update_one(
        {"id": tool_id},
        {"$set": {"is_available": bool(is_available)}}
    )
    return {"ok": True, "is_available": bool(is_available)}
