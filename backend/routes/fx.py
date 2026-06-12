"""FX rates route — currency conversion data for the frontend."""
from datetime import datetime, timezone, timedelta

import requests
from fastapi import APIRouter

from core import _DEFAULT_RATES, SUPPORTED_CURRENCIES, db, logger, now_iso

router = APIRouter()


@router.get("/fx/rates")
async def fx_rates():
    """Return current USD-base FX rates. Cached for 1 hour in db.fx_cache."""
    one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    cached = await db.fx_cache.find_one({"id": "rates_usd"}, {"_id": 0})
    if cached and cached.get("fetched_at", "") > one_hour_ago:
        return {"base": "USD", "rates": cached["rates"], "fetched_at": cached["fetched_at"], "source": "cache"}
    rates = dict(_DEFAULT_RATES)
    source = "fallback"
    try:
        r = requests.get(
            "https://api.exchangerate.host/latest",
            params={"base": "USD", "symbols": ",".join(SUPPORTED_CURRENCIES)},
            timeout=6
        )
        if r.ok:
            data = r.json()
            fetched = data.get("rates") or {}
            for c in SUPPORTED_CURRENCIES:
                if c in fetched and fetched[c] > 0:
                    rates[c] = float(fetched[c])
            rates["USD"] = 1.0
            source = "exchangerate.host"
    except Exception as e:
        logger.warning(f"FX fetch failed, using fallback: {e}")
    now = now_iso()
    await db.fx_cache.update_one(
        {"id": "rates_usd"},
        {"$set": {"id": "rates_usd", "rates": rates, "fetched_at": now}},
        upsert=True
    )
    return {"base": "USD", "rates": rates, "fetched_at": now, "source": source}
