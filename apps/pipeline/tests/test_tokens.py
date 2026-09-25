import json

import pytest

from postthedoc import tokens
from tests.factories import REPO_ROOT

VECTORS = json.loads(
    (REPO_ROOT / "packages" / "shared" / "fixtures" / "tokens.json").read_text(encoding="utf-8")
)
SECRET: str = VECTORS["secret"]
USER = "00000000-0000-4000-8000-000000000000"
NOW = 1_800_000_000


@pytest.mark.parametrize("vector", VECTORS["vectors"], ids=lambda v: v["purpose"])
def test_shared_vectors(vector):
    """The Worker checks the same vectors: both implementations must stay compatible."""
    if vector["exp"] == 0:
        token = tokens.sign(SECRET, vector["purpose"], vector["userId"], vector["version"])
        assert token == vector["token"]
    data = tokens.verify(SECRET, vector["token"], {vector["purpose"]})
    expected = (vector["purpose"], vector["userId"], vector["version"], vector["exp"])
    assert data == tokens.TokenData(*expected)


@pytest.mark.parametrize("vector", VECTORS["invalid"], ids=lambda v: v["reason"])
def test_shared_invalid_tokens(vector):
    assert tokens.verify(SECRET, vector["token"], set(vector["purposes"])) is None


def test_rejects_wrong_purpose_secret_and_tampering():
    token = tokens.sign(SECRET, "manage", USER, 3)
    assert tokens.verify(SECRET, token, {"unsubscribe"}) is None
    assert tokens.verify("other", token, {"manage"}) is None
    payload, signature = token.split(".")
    assert tokens.verify(SECRET, f"{payload}.{signature[:-2]}AA", {"manage"}) is None
    assert tokens.verify(SECRET, "garbage", {"manage"}) is None
    assert tokens.verify(SECRET, "!!!.???", {"manage"}) is None
    assert tokens.verify(SECRET, f"{token}.extra", {"manage"}) is None


def test_expiry():
    token = tokens.sign(SECRET, "confirm", USER, 0, ttl=60, now=NOW)
    data = tokens.verify(SECRET, token, {"confirm"}, now=NOW + 59)
    assert data is not None
    assert data.exp == NOW + 60
    assert tokens.verify(SECRET, token, {"confirm"}, now=NOW + 61) is None


def test_zero_ttl_never_expires():
    token = tokens.sign(SECRET, "unsubscribe", USER, 0, now=NOW)
    assert tokens.verify(SECRET, token, {"unsubscribe"}, now=NOW * 10) is not None
