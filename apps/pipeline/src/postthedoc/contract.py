"""Values shared with the Worker and the web app, read from data/contract.json.

The literal types below mirror the lists in the JSON file: loading a contract that does not
match them fails validation, so the two cannot drift apart silently.
"""

from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

Locale = Literal["it", "en"]
TokenPurpose = Literal["confirm", "manage", "unsubscribe"]
InstitutionType = Literal["university", "online_university", "research_institute", "afam"]
SitePage = Literal["home", "subscribe", "manage", "privacy", "support"]


class _Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, frozen=True, extra="forbid")


class TokenTtl(_Model):
    confirm: int
    manage: int
    unsubscribe: int  # 0: one-click unsubscribe links in old digests keep working

    def seconds(self, purpose: TokenPurpose) -> int:
        match purpose:
            case "confirm":
                return self.confirm
            case "manage":
                return self.manage
            case "unsubscribe":
                return self.unsubscribe


class SitePaths(_Model):
    home: str
    subscribe: str
    manage: str
    privacy: str
    support: str


class ApiPaths(_Model):
    confirm: str
    unsubscribe: str


class LinkParams(_Model):
    token: str
    welcome: str


class DailyEmails(_Model):
    provider: int  # the email provider's daily quota
    worker: int  # the Worker's share: confirmations and manage links

    @property
    def digests(self) -> int:
        """What is left for the daily digests, one per user."""
        return self.provider - self.worker


class Contract(_Model):
    model_config = ConfigDict(alias_generator=to_camel, frozen=True, extra="ignore")

    locales: tuple[Locale, ...]
    token_ttl_seconds: TokenTtl
    pending_retention_days: int
    daily_emails: DailyEmails
    site_paths: SitePaths
    api_paths: ApiPaths
    link_params: LinkParams
    issues_url: str
    institution_types: tuple[InstitutionType, ...]

    @classmethod
    def load(cls, path: Path) -> "Contract":
        return cls.model_validate_json(path.read_text(encoding="utf-8"))

    def site_path(self, page: SitePage, locale: Locale) -> str:
        """Path of a web app page relative to its base URL, e.g. "/it/manage/"."""
        path: str = getattr(self.site_paths, page)
        return path.replace("{locale}", locale)
