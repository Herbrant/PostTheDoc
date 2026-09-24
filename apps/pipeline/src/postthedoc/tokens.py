"""Signed tokens for email links, in the same format as apps/worker/src/lib/tokens.ts.

token = base64url("{purpose}.{user_id}.{version}.{exp}") + "." + base64url(HMAC-SHA256)

exp is a Unix timestamp; 0 means the token never expires. No token is stored anywhere: bumping
the user's token_version invalidates every token issued before.
"""

import base64
import hashlib
import hmac
import time
from collections.abc import Collection
from dataclasses import dataclass
from typing import TypeGuard, get_args

from postthedoc.contract import TokenPurpose

_PURPOSES: frozenset[str] = frozenset(get_args(TokenPurpose))


@dataclass(frozen=True)
class TokenData:
    purpose: TokenPurpose
    user_id: str
    version: int
    exp: int


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _mac(secret: str, payload: str) -> bytes:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest()


def _is_purpose(value: str) -> TypeGuard[TokenPurpose]:
    return value in _PURPOSES


def sign(
    secret: str,
    purpose: TokenPurpose,
    user_id: str,
    version: int,
    ttl: int = 0,
    now: float | None = None,
) -> str:
    """Sign a token; `ttl` in seconds, 0 for a token that never expires."""
    exp = int(time.time() if now is None else now) + ttl if ttl else 0
    payload = f"{purpose}.{user_id}.{version}.{exp}"
    return f"{_b64encode(payload.encode())}.{_b64encode(_mac(secret, payload))}"


def verify(
    secret: str,
    token: str,
    purposes: Collection[TokenPurpose],
    now: float | None = None,
) -> TokenData | None:
    """The token's data if it is authentic, unexpired and for one of `purposes`; None otherwise."""
    try:
        encoded, signature = token.split(".")
        payload = _b64decode(encoded).decode()
        if not hmac.compare_digest(_b64decode(signature), _mac(secret, payload)):
            return None
        purpose, user_id, version, exp = payload.split(".")
        data_version, data_exp = int(version), int(exp)
    except ValueError:  # wrong number of parts, invalid base64, UTF-8 or integers
        return None
    if not _is_purpose(purpose) or purpose not in purposes:
        return None
    if data_exp and data_exp < (time.time() if now is None else now):
        return None
    return TokenData(purpose, user_id, data_version, data_exp)
