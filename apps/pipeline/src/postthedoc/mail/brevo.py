"""Delivery through Brevo's transactional email API (the same one the Worker uses)."""

import httpx

from postthedoc.config import BrevoSettings
from postthedoc.mail.message import Email, MailError

BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class BrevoMailer:
    def __init__(self, client: httpx.Client, settings: BrevoSettings) -> None:
        self._client = client
        self._api_key = settings.api_key
        self._sender = {"email": settings.sender_email, "name": settings.sender_name}

    def send(self, email: Email) -> None:
        payload = {
            "sender": self._sender,
            # No per-recipient open/click tracking: Brevo only counts them in aggregate.
            "to": [{"email": email.to, "contactPixelTrackingConsent": False}],
            "subject": email.subject,
            "htmlContent": email.html,
            "textContent": email.text,
            "headers": email.headers,
        }
        try:
            resp = self._client.post(BREVO_URL, headers={"api-key": self._api_key}, json=payload)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            raise MailError(f"Brevo: {exc}") from exc
