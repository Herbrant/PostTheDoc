import time

from postthedoc import tokens

SECRET = "test-secret"
USER = "00000000-0000-4000-8000-000000000000"

# Test vector shared with worker/test/tokens.test.ts: both sides must stay compatible.
MANAGE_V3 = (
    "bWFuYWdlLjAwMDAwMDAwLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDAwMC4zLjA"
    ".Uz-jBzlVguii2gd0cwK5QASrYBTGnZA8YkRQXtnKEDk"
)


def test_shared_vector():
    assert tokens.sign(SECRET, "manage", USER, 3) == MANAGE_V3
    assert tokens.verify(SECRET, MANAGE_V3, {"manage"}) == tokens.TokenData("manage", USER, 3, 0)


def test_rejects_wrong_purpose_secret_and_tampering():
    assert tokens.verify(SECRET, MANAGE_V3, {"unsubscribe"}) is None
    assert tokens.verify("other", MANAGE_V3, {"manage"}) is None
    payload, sig = MANAGE_V3.split(".")
    assert tokens.verify(SECRET, f"{payload}.{sig[:-2]}AA", {"manage"}) is None
    assert tokens.verify(SECRET, "garbage", {"manage"}) is None


def test_expiry():
    token = tokens.sign(SECRET, "confirm", USER, 0, ttl=60)
    data = tokens.verify(SECRET, token, {"confirm"})
    assert data and data.exp > time.time()

    expired = tokens.sign(SECRET, "confirm", USER, 0, ttl=-10)
    assert tokens.verify(SECRET, expired, {"confirm"}) is None
