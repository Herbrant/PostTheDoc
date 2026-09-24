"""Links included in each digest: they carry signed tokens for the user they are sent to."""

from dataclasses import dataclass

from postthedoc import tokens
from postthedoc.config import LinkSettings
from postthedoc.contract import Contract, SitePage, TokenPurpose
from postthedoc.models import User


@dataclass(frozen=True)
class DigestLinks:
    manage: str  # web app page to edit preferences; the token is in the URL fragment
    unsubscribe: str  # Worker endpoint, also used by one-click unsubscribe (RFC 8058)
    privacy: str
    support: str


class LinkBuilder:
    def __init__(self, settings: LinkSettings, contract: Contract) -> None:
        self._site = settings.site_url.rstrip("/")
        self._api = settings.api_url.rstrip("/")
        self._secret = settings.token_secret
        self._contract = contract

    def digest_links(self, user: User, now: float | None = None) -> DigestLinks:
        param = self._contract.link_params.token
        manage = self._token(user, "manage", now)
        unsubscribe = self._token(user, "unsubscribe", now)
        return DigestLinks(
            manage=f"{self._page(user, 'manage')}#{param}={manage}",
            unsubscribe=f"{self._api}{self._contract.api_paths.unsubscribe}?{param}={unsubscribe}",
            privacy=self._page(user, "privacy"),
            support=self._page(user, "support"),
        )

    def _page(self, user: User, page: SitePage) -> str:
        return self._site + self._contract.site_path(page, user.locale)

    def _token(self, user: User, purpose: TokenPurpose, now: float | None) -> str:
        # Tokens are base64url with a dot: safe in URLs as they are.
        ttl = self._contract.token_ttl_seconds.seconds(purpose)
        return tokens.sign(self._secret, purpose, user.id, user.token_version, ttl, now)
