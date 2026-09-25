from postthedoc import tokens
from postthedoc.config import LinkSettings
from postthedoc.contract import Contract
from postthedoc.links import LinkBuilder
from tests.factories import make_user

SETTINGS = LinkSettings(
    site_url="https://site.example/app/", api_url="https://api.example", token_secret="s3cret"
)
NOW = 1_800_000_000


def test_digest_links(contract: Contract):
    user = make_user("u-alice", locale="en", token_version=2)
    links = LinkBuilder(SETTINGS, contract).digest_links(user, now=NOW)

    manage_prefix = "https://site.example/app/en/manage/#t="
    assert links.manage.startswith(manage_prefix)
    manage = tokens.verify("s3cret", links.manage.removeprefix(manage_prefix), {"manage"}, now=NOW)
    assert manage == tokens.TokenData("manage", "u-alice", 2, NOW + 30 * 24 * 3600)

    unsubscribe_prefix = "https://api.example/unsubscribe?t="
    assert links.unsubscribe.startswith(unsubscribe_prefix)
    token = links.unsubscribe.removeprefix(unsubscribe_prefix)
    unsubscribe = tokens.verify("s3cret", token, {"unsubscribe"}, now=NOW)
    assert unsubscribe == tokens.TokenData("unsubscribe", "u-alice", 2, 0)

    assert links.privacy == "https://site.example/app/en/privacy/"
    assert links.support == "https://site.example/app/en/#support"
    assert links.issues == "https://github.com/Herbrant/PostTheDoc/issues"
