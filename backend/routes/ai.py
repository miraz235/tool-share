"""AI Tool Assistant routes — quota tracking + project-to-tools recommender."""
import json
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException

from emergentintegrations.llm.chat import LlmChat, UserMessage

from core import (
    AIRecommendIn, AI_DAILY_LIMIT, AI_WINDOW_HOURS, EMERGENT_LLM_KEY,
    current_user, db, haversine_km, logger, now_iso,
)

router = APIRouter()


AI_SYSTEM_PROMPT = """You are ToolShare's AI Tool Assistant. The user describes a home/DIY task in natural language; you respond with a structured JSON listing the tools they need to complete the task.

Respond ONLY with valid JSON of this exact shape — no markdown, no commentary:
{
  "summary": "Short 1-2 sentence overview of the project",
  "difficulty": "Easy" | "Moderate" | "Advanced",
  "estimated_time": "e.g. 2-4 hours, 1 weekend",
  "tools": [
    {"name": "Circular saw", "category": "power-tools", "why": "to make straight cuts in lumber", "essential": true},
    {"name": "Tape measure", "category": "hand-tools", "why": "for accurate measurements", "essential": true}
  ],
  "safety_tips": ["Wear safety glasses", "..."]
}

Valid categories: power-tools, hand-tools, gardening, lawn-care, painting, plumbing, automotive, carpentry, electrical, cleaning, ladders, heavy-equipment, outdoor.
Pick 4-8 tools. Keep names concise (1-3 words). Map each tool to the BEST-FIT category from the list above."""


async def _ai_quota_check(user: dict) -> dict:
    """Returns dict with remaining/total. Raises 429 when exceeded."""
    if user.get("is_admin"):
        return {"remaining": -1, "total": -1, "unlimited": True}
    cutoff = datetime.now(timezone.utc) - timedelta(hours=AI_WINDOW_HOURS)
    used = await db.ai_usage.count_documents({
        "user_id": user["id"],
        "created_at": {"$gte": cutoff.isoformat()},
    })
    remaining = max(0, AI_DAILY_LIMIT - used)
    if remaining <= 0:
        raise HTTPException(
            429,
            detail={
                "code": "ai_quota_exceeded",
                "message": f"AI Assistant limit reached. Try again later (max {AI_DAILY_LIMIT}/24h).",
                "remaining": 0,
                "total": AI_DAILY_LIMIT,
            },
        )
    return {"remaining": remaining, "total": AI_DAILY_LIMIT, "unlimited": False}


@router.get("/ai/quota")
async def ai_quota(user: dict = Depends(current_user)):
    if user.get("is_admin"):
        return {"remaining": -1, "total": -1, "unlimited": True}
    cutoff = datetime.now(timezone.utc) - timedelta(hours=AI_WINDOW_HOURS)
    used = await db.ai_usage.count_documents({
        "user_id": user["id"],
        "created_at": {"$gte": cutoff.isoformat()},
    })
    return {
        "remaining": max(0, AI_DAILY_LIMIT - used),
        "total": AI_DAILY_LIMIT,
        "unlimited": False,
    }


@router.post("/ai/recommend")
async def ai_recommend(payload: AIRecommendIn, user: dict = Depends(current_user)):
    # Anonymous users are blocked by current_user (returns 401). Logged-in users
    # are rate-limited; admins are unlimited.
    quota = await _ai_quota_check(user)
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "LLM not configured")
    session_id = f"toolshare_{uuid.uuid4().hex[:8]}"
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=AI_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4o-mini")

    user_msg = UserMessage(text=f"Task: {payload.task}")
    try:
        raw = await chat.send_message(user_msg)
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(500, "AI service error")

    # extract JSON
    text = raw if isinstance(raw, str) else getattr(raw, "content", str(raw))
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:].strip()
    try:
        parsed = json.loads(text)
    except Exception:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            try:
                parsed = json.loads(text[start:end + 1])
            except Exception:
                raise HTTPException(500, "AI returned unparseable response")
        else:
            raise HTTPException(500, "AI returned unparseable response")

    # For each suggested tool, find matching listings
    tools_recs = parsed.get("tools", [])
    for t in tools_recs:
        cat = t.get("category")
        name = t.get("name", "")
        filt = {"is_available": True}
        if cat:
            filt["category"] = cat
        cur = db.tools.find(filt, {"_id": 0}).limit(50)
        matches = await cur.to_list(length=50)
        # filter by name fuzzy: lower-case contains any word from name
        words = [w.lower() for w in name.split() if len(w) > 2]
        scored = []
        for m in matches:
            title = (m.get("title") or "").lower()
            desc = (m.get("description") or "").lower()
            score = sum(1 for w in words if w in title or w in desc)
            if score > 0 or not words:
                m_copy = dict(m)
                m_copy["match_score"] = score
                scored.append(m_copy)
        # distance filter
        if payload.lat is not None and payload.lng is not None:
            filtered = []
            for m in scored:
                tl = m.get("location", {})
                try:
                    d = haversine_km(payload.lat, payload.lng, tl["lat"], tl["lng"])
                except Exception:
                    continue
                if d <= payload.radius_km:
                    m["distance_km"] = round(d, 1)
                    filtered.append(m)
            scored = filtered
        scored.sort(key=lambda x: (-x.get("match_score", 0), x.get("distance_km", 999)))
        t["available_listings"] = scored[:3]

    parsed["tools"] = tools_recs
    # Record usage and attach remaining quota so frontend updates without an extra round-trip.
    try:
        await db.ai_usage.insert_one({
            "user_id": user["id"],
            "task": payload.task[:300] if payload.task else "",
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.error(f"ai_usage write failed: {e}")
    if quota.get("unlimited"):
        parsed["quota"] = {"remaining": -1, "total": -1, "unlimited": True}
    else:
        parsed["quota"] = {
            "remaining": max(0, quota["remaining"] - 1),
            "total": quota["total"],
            "unlimited": False,
        }
    return parsed
