"""Configuration read from the environment, in one place.

Every environment variable the pipeline reads is listed here; the rest of the code receives
plain settings objects.
"""

import os
from dataclasses import dataclass
from pathlib import Path

REPOSITORY_URL = "https://github.com/Herbrant/PostTheDoc"
DATA_DIR_VARIABLE = "POSTTHEDOC_DATA"

# Dry runs work out of the box against the local development servers.
DEV_SITE_URL = "http://localhost:4321/PostTheDoc"
DEV_API_URL = "http://localhost:8787"
DEV_TOKEN_SECRET = "dev-secret"  # noqa: S105 (local development only)


class ConfigError(Exception):
    """The environment lacks a required setting."""


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise ConfigError(f"Missing environment variable: {name}")
    return value


def data_dir() -> Path:
    """The repository's data/ directory: $POSTTHEDOC_DATA, or found next to the source tree."""
    if configured := os.environ.get(DATA_DIR_VARIABLE):
        return Path(configured)
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "data"
        if (candidate / "contract.json").is_file():
            return candidate
    raise ConfigError(f"data/ directory not found: set {DATA_DIR_VARIABLE}")


@dataclass(frozen=True)
class LinkSettings:
    site_url: str  # web app (GitHub Pages): preference management
    api_url: str  # Worker: one-click unsubscribe
    token_secret: str  # shared with the Worker

    @classmethod
    def from_env(cls, *, dry_run: bool) -> "LinkSettings":
        if dry_run:
            return cls(
                site_url=os.environ.get("SITE_URL", DEV_SITE_URL),
                api_url=os.environ.get("API_URL", DEV_API_URL),
                token_secret=os.environ.get("TOKEN_SECRET", DEV_TOKEN_SECRET),
            )
        return cls(
            site_url=require_env("SITE_URL"),
            api_url=require_env("API_URL"),
            token_secret=require_env("TOKEN_SECRET"),
        )


@dataclass(frozen=True)
class D1Settings:
    account_id: str
    database_id: str
    api_token: str

    @classmethod
    def from_env(cls) -> "D1Settings":
        return cls(
            account_id=require_env("CLOUDFLARE_ACCOUNT_ID"),
            database_id=require_env("D1_DATABASE_ID"),
            api_token=require_env("CLOUDFLARE_API_TOKEN"),
        )


@dataclass(frozen=True)
class BrevoSettings:
    api_key: str
    sender_email: str
    sender_name: str

    @classmethod
    def from_env(cls) -> "BrevoSettings":
        return cls(
            api_key=require_env("BREVO_API_KEY"),
            sender_email=require_env("SENDER_EMAIL"),
            sender_name=os.environ.get("SENDER_NAME", "PostTheDoc"),
        )
