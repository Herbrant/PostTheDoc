"""Signed tokens for email links. Same format as worker/src/tokens.ts.

token = base64url("{purpose}.{user_id}.{version}.{exp}") + "." + base64url(HMAC-SHA256)
exp = 0 means the token never expires.
"""

import base64
import hashlib
import hmac
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class TokenData:
    purpose: str
    user_id: str
    version: int
    exp: int


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _mac(secret: str, payload: str) -> bytes:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()


def sign(secret: str, purpose: str, user_id: str, version: int, ttl: int | None = None) -> str:
    exp = int(time.time()) + ttl if ttl else 0
    payload = f"{purpose}.{user_id}.{version}.{exp}"
    return f"{_b64(payload.encode())}.{_b64(_mac(secret, payload))}"


def verify(secret: str, token: str, purposes: set[str]) -> TokenData | None:
    try:
        encoded, signature = token.split(".")
        payload = _unb64(encoded).decode()
        if not hmac.compare_digest(_unb64(signature), _mac(secret, payload)):
            return None
        purpose, user_id, version, exp = payload.split(".")
        data = TokenData(purpose, user_id, int(version), int(exp))
    except ValueError:
        return None
    if data.purpose not in purposes or (data.exp and data.exp < time.time()):
        return None
    return data
