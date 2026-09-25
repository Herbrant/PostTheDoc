import json
from typing import get_args

from postthedoc.contract import Contract, InstitutionType, Locale, TokenPurpose
from tests.factories import REPO_ROOT


def test_literal_types_match_the_contract(contract: Contract):
    assert contract.locales == get_args(Locale)
    assert contract.institution_types == get_args(InstitutionType)
    raw = json.loads((REPO_ROOT / "data" / "contract.json").read_text(encoding="utf-8"))
    assert tuple(raw["tokenTtlSeconds"]) == get_args(TokenPurpose)


def test_site_paths(contract: Contract):
    assert contract.site_path("manage", "it") == "/it/manage/"
    assert contract.site_path("support", "en") == "/en/#support"


def test_token_lifetimes(contract: Contract):
    assert contract.token_ttl_seconds.seconds("confirm") == 48 * 3600
    assert contract.token_ttl_seconds.seconds("manage") == 30 * 24 * 3600
    assert contract.token_ttl_seconds.seconds("unsubscribe") == 0


def test_daily_emails(contract: Contract):
    assert contract.daily_emails.digests == 200
