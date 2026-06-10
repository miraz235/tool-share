import uuid
from dataclasses import dataclass
from typing import Any, Dict

@dataclass
class CheckoutSessionRequest:
    amount: float
    currency: str
    success_url: str
    cancel_url: str
    metadata: Dict[str, Any]

class CheckoutSessionResponse:
    def __init__(self, url: str, session_id: str, payment_status: str = "open", status: str = "open", amount_total: float = 0.0):
        self.url = url
        self.session_id = session_id
        self.payment_status = payment_status
        self.status = status
        self.amount_total = amount_total

class WebhookEvent:
    def __init__(self, event_type: str, payment_status: str, session_id: str):
        self.event_type = event_type
        self.payment_status = payment_status
        self.session_id = session_id

class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: str):
        self.api_key = api_key
        self.webhook_url = webhook_url

    async def create_checkout_session(self, request: CheckoutSessionRequest) -> CheckoutSessionResponse:
        session_id = f"cs_{uuid.uuid4().hex[:24]}"
        return CheckoutSessionResponse(
            url=f"https://checkout.example.com/{session_id}",
            session_id=session_id,
            payment_status="open",
            status="open",
            amount_total=float(request.amount),
        )

    async def get_checkout_status(self, session_id: str) -> CheckoutSessionResponse:
        paid = session_id.endswith("paid")
        return CheckoutSessionResponse(
            url=f"https://checkout.example.com/{session_id}",
            session_id=session_id,
            payment_status="paid" if paid else "open",
            status="paid" if paid else "open",
            amount_total=0.0,
        )

    async def handle_webhook(self, body: bytes, signature: str) -> WebhookEvent:
        try:
            payload = body.decode('utf-8')
        except Exception:
            payload = ''
        session_id = 'unknown'
        if 'session_id' in payload:
            # crude extraction; not a full parser
            idx = payload.find('session_id')
            if idx != -1:
                start = payload.find(':', idx)
                if start != -1:
                    raw = payload[start+1:].strip().strip('"').strip('} ')
                    session_id = raw.split(',')[0].strip().strip('"')
        return WebhookEvent(event_type="checkout.session.completed", payment_status="paid", session_id=session_id)
