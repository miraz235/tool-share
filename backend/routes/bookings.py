"""Booking + purchase + insurance routes."""
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException

from core import (
    INSURANCE_TIERS,
    Booking, BookingIn, BookingStatusIn,
    _days_between, _max_booked_qty_in_range,
    current_user, db, get_user_by_id, logger, now_iso, serialize_user,
)
from p1_features import send_email_mocked

router = APIRouter()


@router.get("/insurance/tiers")
async def insurance_tiers():
    return INSURANCE_TIERS


@router.post("/purchases")
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


@router.get("/purchases")
async def list_purchases(role: Literal["buyer", "owner"] = "buyer", user: dict = Depends(current_user)):
    key = "buyer_id" if role == "buyer" else "owner_id"
    cur = db.purchases.find({key: user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=200)


@router.post("/bookings", response_model=Booking)
async def create_booking(payload: BookingIn, user: dict = Depends(current_user)):
    tool = await db.tools.find_one({"id": payload.tool_id})
    if not tool:
        raise HTTPException(404, "Tool not found")
    if tool["owner_id"] == user["id"]:
        raise HTTPException(400, "Cannot book your own tool")
    if payload.start_date > payload.end_date:
        raise HTTPException(400, "End date must be after start date")
    quantity_total = int(tool.get("quantity_total") or 1)
    qty = max(1, int(payload.quantity or 1))
    if qty > quantity_total:
        raise HTTPException(400, f"Only {quantity_total} unit(s) available for this tool")
    # Stock-aware availability check: peak overlap across the requested date range.
    peak = await _max_booked_qty_in_range(payload.tool_id, payload.start_date, payload.end_date)
    if peak + qty > quantity_total:
        remaining = max(0, quantity_total - peak)
        raise HTTPException(409, f"Not enough units available — {remaining} of {quantity_total} left for those dates")
    days = _days_between(payload.start_date, payload.end_date)
    rental = days * float(tool["daily_price"]) * qty
    insurance_fee = days * INSURANCE_TIERS.get(payload.insurance_tier, INSURANCE_TIERS["none"])["daily_fee"] * qty
    total = rental + insurance_fee
    deposit = float(tool.get("security_deposit", 0)) * qty
    booking_id = f"bk_{uuid.uuid4().hex[:12]}"
    doc = {
        "id": booking_id,
        "tool_id": payload.tool_id,
        "renter_id": user["id"],
        "owner_id": tool["owner_id"],
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "quantity": qty,
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
            f"{user['name']} requested {qty}× {tool['title']} from {payload.start_date} to {payload.end_date}.",
            db=db
        )
    doc.pop("_id", None)
    return doc


@router.get("/bookings")
async def list_bookings(role: Literal["renter", "owner"] = "renter", user: dict = Depends(current_user)):
    key = "renter_id" if role == "renter" else "owner_id"
    cur = db.bookings.find({key: user["id"]}, {"_id": 0}).sort("created_at", -1)
    bookings = await cur.to_list(length=200)
    for b in bookings:
        tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0, "title": 1, "images": 1, "daily_price": 1})
        b["tool"] = tool
        other_id = b["owner_id"] if role == "renter" else b["renter_id"]
        other = await get_user_by_id(other_id)
        b["counterparty"] = serialize_user(other) if other else None
    return bookings


@router.get("/bookings/{booking_id}")
async def get_booking(booking_id: str, user: dict = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Not found")
    if user["id"] not in (b["renter_id"], b["owner_id"]):
        raise HTTPException(403, "Forbidden")
    tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0})
    b["tool"] = tool
    return b


@router.put("/bookings/{booking_id}/status")
async def update_booking_status(booking_id: str, payload: BookingStatusIn, user: dict = Depends(current_user)):
    b = await db.bookings.find_one({"id": booking_id})
    if not b:
        raise HTTPException(404, "Not found")
    if payload.status in ("approved", "declined") and b["owner_id"] != user["id"]:
        raise HTTPException(403, "Only owner can approve/decline")
    if payload.status == "cancelled" and user["id"] not in (b["renter_id"], b["owner_id"]):
        raise HTTPException(403, "Forbidden")
    # Re-check stock before approving — another booking may have been approved meanwhile.
    if payload.status == "approved":
        tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0, "quantity_total": 1})
        quantity_total = int((tool or {}).get("quantity_total") or 1)
        qty = int(b.get("quantity") or 1)
        peak = await _max_booked_qty_in_range(
            b["tool_id"], b["start_date"], b["end_date"], exclude_booking_id=booking_id
        )
        if peak + qty > quantity_total:
            remaining = max(0, quantity_total - peak)
            raise HTTPException(
                409,
                f"Cannot approve — only {remaining} of {quantity_total} units free for these dates"
            )
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
    # Availability alerts: when a booking ends (completed/cancelled), tool may be free again
    if payload.status in ("completed", "cancelled"):
        try:
            alert_subs = await db.favorites.find(
                {"tool_id": b["tool_id"], "alerts_on": True, "user_id": {"$ne": user["id"]}},
                {"_id": 0}
            ).to_list(length=500)
            tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0})
            for sub in alert_subs:
                subscriber = await get_user_by_id(sub["user_id"])
                if subscriber and tool:
                    await send_email_mocked(
                        subscriber["email"],
                        f"Now available: {tool.get('title','a saved tool')}",
                        "A tool you saved is available again. Open ToolShare to book it.",
                        db=db,
                    )
        except Exception as e:
            logger.error(f"Availability alert failed: {e}")
    return {"ok": True, "status": payload.status}
