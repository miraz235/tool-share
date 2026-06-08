"""
ToolShare P1 features:
- Anti-double-booking guard
- In-app messaging
- Stripe Checkout for bookings + commission tracking
- Stripe Identity verification
- Admin dashboard endpoints
- Email notifications (MOCKED — logs only since no Resend key was provided)
"""
import os
import uuid
import logging
import stripe
from datetime import datetime, timezone, date
from typing import Optional, List, Literal
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

logger = logging.getLogger("toolshare.p1")

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
stripe.api_key = STRIPE_API_KEY

# Platform fee percentage on each rental (held by ToolShare; owner gets the rest)
PLATFORM_FEE_PCT = 0.10


# -----------------------------------------------------------------------------
# Pydantic models
# -----------------------------------------------------------------------------
class MessageIn(BaseModel):
    booking_id: str
    content: str = Field(min_length=1, max_length=2000)


class CheckoutIn(BaseModel):
    booking_id: str
    origin_url: str


class IdentityStartIn(BaseModel):
    return_url: str


class AdminUserUpdate(BaseModel):
    is_verified: Optional[bool] = None
    is_admin: Optional[bool] = None
    is_suspended: Optional[bool] = None


# -----------------------------------------------------------------------------
# Email service (MOCKED)
# -----------------------------------------------------------------------------
async def send_email_mocked(to: str, subject: str, body: str, db=None):
    """MOCKED EMAIL SENDER — logs to console + stores in db.email_log for visibility."""
    logger.info(f"[EMAIL MOCKED] to={to} subject={subject!r}")
    if db is not None:
        try:
            await db.email_log.insert_one({
                "id": str(uuid.uuid4()),
                "to": to,
                "subject": subject,
                "body": body,
                "sent_at": datetime.now(timezone.utc).isoformat(),
                "mocked": True,
            })
        except Exception as e:
            logger.warning(f"email_log insert failed: {e}")


# -----------------------------------------------------------------------------
# Anti-double-booking helper
# -----------------------------------------------------------------------------
async def has_booking_conflict(db, tool_id: str, start_date: str, end_date: str,
                                exclude_booking_id: Optional[str] = None) -> bool:
    """Return True if any approved/pending booking on this tool overlaps the date range."""
    q = {
        "tool_id": tool_id,
        "status": {"$in": ["approved", "pending"]},
        # overlap: existing.start <= new.end AND existing.end >= new.start
        "start_date": {"$lte": end_date},
        "end_date": {"$gte": start_date},
    }
    if exclude_booking_id:
        q["id"] = {"$ne": exclude_booking_id}
    existing = await db.bookings.find_one(q)
    return existing is not None


# -----------------------------------------------------------------------------
# Build P1 router (attached to main api router with /api prefix)
# -----------------------------------------------------------------------------
def build_p1_router(db, current_user_dep, get_user_by_id) -> APIRouter:
    r = APIRouter()

    # ---------------------------- Admin guard ----------------------------
    async def admin_required(user: dict = Depends(current_user_dep)) -> dict:
        if not user.get("is_admin"):
            raise HTTPException(403, "Admin required")
        return user

    # ---------------------------- Messaging ------------------------------
    @r.post("/messages")
    async def post_message(payload: MessageIn, user: dict = Depends(current_user_dep)):
        booking = await db.bookings.find_one({"id": payload.booking_id})
        if not booking:
            raise HTTPException(404, "Booking not found")
        if user["id"] not in (booking["renter_id"], booking["owner_id"]):
            raise HTTPException(403, "Not a participant")
        recipient_id = booking["owner_id"] if user["id"] == booking["renter_id"] else booking["renter_id"]
        msg = {
            "id": f"msg_{uuid.uuid4().hex[:12]}",
            "booking_id": payload.booking_id,
            "sender_id": user["id"],
            "recipient_id": recipient_id,
            "content": payload.content,
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.messages.insert_one(msg)
        recipient = await get_user_by_id(recipient_id)
        if recipient:
            await send_email_mocked(
                recipient["email"],
                f"New message from {user.get('name')} on ToolShare",
                f"{user.get('name')} sent you a message about booking {payload.booking_id}: {payload.content[:140]}",
                db=db
            )
        msg.pop("_id", None)
        return msg

    @r.get("/messages/threads")
    async def list_threads(user: dict = Depends(current_user_dep)):
        # Find all bookings the user participates in, then get last message per booking
        bookings = await db.bookings.find(
            {"$or": [{"renter_id": user["id"]}, {"owner_id": user["id"]}]},
            {"_id": 0, "id": 1, "tool_id": 1, "renter_id": 1, "owner_id": 1, "status": 1}
        ).to_list(length=200)

        threads = []
        for b in bookings:
            last = await db.messages.find_one(
                {"booking_id": b["id"]}, {"_id": 0},
                sort=[("created_at", -1)]
            )
            if not last:
                continue
            unread = await db.messages.count_documents({
                "booking_id": b["id"], "recipient_id": user["id"], "read": False
            })
            counterparty_id = b["owner_id"] if user["id"] == b["renter_id"] else b["renter_id"]
            counterparty = await get_user_by_id(counterparty_id)
            tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0, "title": 1, "images": 1})
            threads.append({
                "booking_id": b["id"],
                "status": b["status"],
                "tool": tool,
                "counterparty": counterparty,
                "last_message": last,
                "unread_count": unread,
            })
        threads.sort(key=lambda t: t["last_message"]["created_at"], reverse=True)
        return threads

    @r.get("/messages/{booking_id}")
    async def list_messages(booking_id: str, user: dict = Depends(current_user_dep)):
        booking = await db.bookings.find_one({"id": booking_id})
        if not booking:
            raise HTTPException(404, "Not found")
        if user["id"] not in (booking["renter_id"], booking["owner_id"]):
            raise HTTPException(403, "Not a participant")
        # Mark messages addressed to user as read
        await db.messages.update_many(
            {"booking_id": booking_id, "recipient_id": user["id"], "read": False},
            {"$set": {"read": True}}
        )
        msgs = await db.messages.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", 1).to_list(length=500)
        return msgs

    @r.get("/messages/unread/count")
    async def unread_count(user: dict = Depends(current_user_dep)):
        n = await db.messages.count_documents({"recipient_id": user["id"], "read": False})
        return {"count": n}

    # ---------------------------- Identity verification ------------------
    @r.post("/identity/verify/start")
    async def identity_start(payload: IdentityStartIn, user: dict = Depends(current_user_dep)):
        try:
            session = stripe.identity.VerificationSession.create(
                type="document",
                metadata={"user_id": user["id"]},
                options={"document": {"require_matching_selfie": True}},
                return_url=payload.return_url,
            )
            await db.identity_sessions.insert_one({
                "id": session.id,
                "user_id": user["id"],
                "status": session.status,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            return {"url": session.url, "session_id": session.id}
        except stripe.error.StripeError as e:
            logger.error(f"Stripe Identity error: {e}")
            raise HTTPException(500, f"Stripe error: {str(e)}")

    @r.get("/identity/verify/status")
    async def identity_status(user: dict = Depends(current_user_dep)):
        rec = await db.identity_sessions.find_one(
            {"user_id": user["id"]},
            {"_id": 0},
            sort=[("created_at", -1)]
        )
        if not rec:
            return {"status": "not_started", "is_verified": user.get("is_verified", False)}
        # Refresh from stripe
        try:
            session = stripe.identity.VerificationSession.retrieve(rec["id"])
            if session.status == "verified" and not user.get("is_verified"):
                await db.users.update_one({"id": user["id"]}, {"$set": {"is_verified": True}})
            return {"status": session.status, "is_verified": session.status == "verified"}
        except stripe.error.StripeError:
            return {"status": rec.get("status", "unknown"), "is_verified": user.get("is_verified", False)}

    # ---------------------------- Payments (Stripe Checkout) -------------
    @r.post("/bookings/checkout")
    async def create_checkout(payload: CheckoutIn, request: Request, user: dict = Depends(current_user_dep)):
        booking = await db.bookings.find_one({"id": payload.booking_id})
        if not booking:
            raise HTTPException(404, "Booking not found")
        if booking["renter_id"] != user["id"]:
            raise HTTPException(403, "Only the renter can pay")
        if booking["status"] != "approved":
            raise HTTPException(400, "Booking must be approved before payment")
        if booking.get("paid"):
            raise HTTPException(400, "Already paid")

        # Server-side amount (NEVER trust frontend)
        amount = float(booking["total_price"]) + float(booking.get("deposit", 0))
        platform_fee = round(float(booking["total_price"]) * PLATFORM_FEE_PCT, 2)
        owner_payout = round(float(booking["total_price"]) - platform_fee, 2)

        # Use the emergentintegrations StripeCheckout helper (configured at app level)
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        host_url = payload.origin_url.rstrip("/")
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
        sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

        success_url = f"{host_url}/bookings/{booking['id']}?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{host_url}/bookings/{booking['id']}"

        req = CheckoutSessionRequest(
            amount=amount, currency="usd",
            success_url=success_url, cancel_url=cancel_url,
            metadata={
                "booking_id": booking["id"],
                "renter_id": booking["renter_id"],
                "owner_id": booking["owner_id"],
                "platform_fee": str(platform_fee),
                "owner_payout": str(owner_payout),
            },
        )
        session = await sc.create_checkout_session(req)

        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.session_id,
            "booking_id": booking["id"],
            "user_id": user["id"],
            "amount": amount,
            "currency": "usd",
            "platform_fee": platform_fee,
            "owner_payout": owner_payout,
            "payment_status": "initiated",
            "status": "open",
            "metadata": req.metadata,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"url": session.url, "session_id": session.session_id}

    @r.get("/payments/status/{session_id}")
    async def payment_status(session_id: str, request: Request, user: dict = Depends(current_user_dep)):
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
        sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

        try:
            status_resp = await sc.get_checkout_status(session_id)
        except Exception as e:
            logger.error(f"Stripe status error: {e}")
            raise HTTPException(500, "Status check failed")

        tx = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        if not tx:
            raise HTTPException(404, "Transaction not found")
        if tx["user_id"] != user["id"]:
            raise HTTPException(403, "Forbidden")

        if tx["payment_status"] != "paid" and status_resp.payment_status == "paid":
            # Idempotent: only mark once
            await db.payment_transactions.update_one(
                {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                {"$set": {"payment_status": "paid", "status": status_resp.status, "paid_at": datetime.now(timezone.utc).isoformat()}}
            )
            # mark booking paid + owner payout owed
            await db.bookings.update_one(
                {"id": tx["booking_id"]},
                {"$set": {"paid": True, "payout_owed": tx["owner_payout"], "platform_fee_collected": tx["platform_fee"]}}
            )
            # email notifications (mocked)
            booking = await db.bookings.find_one({"id": tx["booking_id"]})
            owner = await get_user_by_id(booking["owner_id"])
            renter = await get_user_by_id(booking["renter_id"])
            if owner:
                await send_email_mocked(owner["email"], "Payment received for your tool booking",
                    f"You'll receive ${tx['owner_payout']} for booking {booking['id']}.", db=db)
            if renter:
                await send_email_mocked(renter["email"], "Payment confirmed",
                    f"Your payment of ${tx['amount']} for booking {booking['id']} is confirmed.", db=db)

        return {
            "session_id": session_id,
            "payment_status": status_resp.payment_status,
            "status": status_resp.status,
            "amount_total": status_resp.amount_total,
        }

    @r.post("/webhook/stripe")
    async def stripe_webhook(request: Request):
        body = await request.body()
        signature = request.headers.get("Stripe-Signature")
        from emergentintegrations.payments.stripe.checkout import StripeCheckout
        webhook_url = f"{str(request.base_url).rstrip('/')}/api/webhook/stripe"
        sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
        try:
            evt = await sc.handle_webhook(body, signature)
        except Exception as e:
            logger.warning(f"webhook parse failed: {e}")
            return {"received": False}

        if evt.event_type == "checkout.session.completed" and evt.payment_status == "paid":
            tx = await db.payment_transactions.find_one({"session_id": evt.session_id})
            if tx and tx["payment_status"] != "paid":
                await db.payment_transactions.update_one(
                    {"session_id": evt.session_id},
                    {"$set": {"payment_status": "paid", "status": "complete",
                              "paid_at": datetime.now(timezone.utc).isoformat()}}
                )
                await db.bookings.update_one(
                    {"id": tx["booking_id"]},
                    {"$set": {"paid": True, "payout_owed": tx["owner_payout"],
                              "platform_fee_collected": tx["platform_fee"]}}
                )
        return {"received": True}

    # ---------------------------- Admin ---------------------------------
    @r.get("/admin/stats")
    async def admin_stats(_: dict = Depends(admin_required)):
        users = await db.users.count_documents({})
        verified = await db.users.count_documents({"is_verified": True})
        tools = await db.tools.count_documents({})
        bookings_total = await db.bookings.count_documents({})
        approved_bookings = await db.bookings.count_documents({"status": "approved"})
        completed_bookings = await db.bookings.count_documents({"status": "completed"})
        # Revenue: sum of platform_fee_collected on paid bookings
        revenue_agg = await db.bookings.aggregate([
            {"$match": {"paid": True}},
            {"$group": {"_id": None, "total": {"$sum": "$platform_fee_collected"},
                        "owed": {"$sum": "$payout_owed"}}}
        ]).to_list(length=1)
        revenue = revenue_agg[0]["total"] if revenue_agg else 0
        owed = revenue_agg[0]["owed"] if revenue_agg else 0
        disputes_open = await db.bookings.count_documents({"dispute_open": True})

        return {
            "users": users,
            "verified_users": verified,
            "tools": tools,
            "bookings_total": bookings_total,
            "approved_bookings": approved_bookings,
            "completed_bookings": completed_bookings,
            "revenue": round(revenue, 2),
            "pending_payouts": round(owed, 2),
            "disputes_open": disputes_open,
        }

    @r.get("/admin/users")
    async def admin_users(q: Optional[str] = None, _: dict = Depends(admin_required)):
        filt = {}
        if q:
            filt["$or"] = [
                {"email": {"$regex": q, "$options": "i"}},
                {"name": {"$regex": q, "$options": "i"}}
            ]
        users = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(200).to_list(length=200)
        return users

    @r.put("/admin/users/{user_id}")
    async def admin_update_user(user_id: str, payload: AdminUserUpdate, _: dict = Depends(admin_required)):
        update = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
        if not update:
            return {"ok": True}
        await db.users.update_one({"id": user_id}, {"$set": update})
        u = await get_user_by_id(user_id)
        return u

    @r.get("/admin/bookings")
    async def admin_bookings(_: dict = Depends(admin_required)):
        bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(length=200)
        for b in bookings:
            tool = await db.tools.find_one({"id": b["tool_id"]}, {"_id": 0, "title": 1})
            b["tool_title"] = tool["title"] if tool else "(deleted)"
            renter = await get_user_by_id(b["renter_id"])
            owner = await get_user_by_id(b["owner_id"])
            b["renter_name"] = renter["name"] if renter else "?"
            b["owner_name"] = owner["name"] if owner else "?"
        return bookings

    @r.get("/admin/tools")
    async def admin_tools(_: dict = Depends(admin_required)):
        tools = await db.tools.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(length=500)
        return tools

    @r.put("/admin/bookings/{booking_id}/dispute")
    async def admin_toggle_dispute(booking_id: str, _: dict = Depends(admin_required)):
        booking = await db.bookings.find_one({"id": booking_id})
        if not booking:
            raise HTTPException(404, "Not found")
        new_val = not booking.get("dispute_open", False)
        await db.bookings.update_one({"id": booking_id}, {"$set": {"dispute_open": new_val}})
        return {"dispute_open": new_val}

    @r.get("/admin/email_log")
    async def admin_email_log(_: dict = Depends(admin_required)):
        logs = await db.email_log.find({}, {"_id": 0}).sort("sent_at", -1).limit(100).to_list(length=100)
        return logs

    return r
