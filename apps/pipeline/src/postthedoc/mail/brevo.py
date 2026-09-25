"""Delivery through Brevo's transactional email API (the same one the Worker uses)."""

import httpx

from postthedoc.config import BrevoSettings
from postthedoc.mail.message import Email, MailError, MailerUnavailableError

BREVO_URL = "https://api.brevo.com/v3/smtp/email"
# Answers that every other email would get too: bad API key, no credits left, rate limited.
UNAVAILABLE_STATUSES = frozenset({401, 402, 403, 429})


def _error_code(resp: httpx.Response) -> str:
    """Brevo's error code, e.g. "unauthorized": its message may quote the recipient, and the
    daily job's logs are public."""
    try:
        body = resp.json()
    except ValueError:
        return ""
    code = body.get("code") if isinstance(body, dict) else None
    return code if isinstance(code, str) else ""


class BrevoMailer:
    def __init__(self, client: httpx.Client, settings: BrevoSettings) -> None:
        self._client = client
        self._api_key = settings.api_key
        self._sender = {"email": settings.sender_email, "name": settings.sender_name}
        self._reply_to = {"email": settings.reply_to} if settings.reply_to else None

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
        if self._reply_to:
            payload["replyTo"] = self._reply_to
        try:
            resp = self._client.post(BREVO_URL, headers={"api-key": self._api_key}, json=payload)
        except httpx.HTTPError as exc:
            raise MailError(f"Brevo: {exc!r}") from exc
        if resp.is_success:
            return
        error = MailerUnavailableError if resp.status_code in UNAVAILABLE_STATUSES else MailError
        raise error(f"Brevo: HTTP {resp.status_code} {_error_code(resp)}".rstrip())
