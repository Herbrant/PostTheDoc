import argparse
import json
import logging
import os
import sys
from pathlib import Path

import httpx

from postthedoc import reference
from postthedoc.d1 import D1Client
from postthedoc.mailer import BrevoMailer, FileMailer
from postthedoc.models import User
from postthedoc.pipeline import Settings, run
from postthedoc.sources.mur import SECTIONS, MurSource
from postthedoc.store import SeenStore
from postthedoc.sync import sync_reference

log = logging.getLogger("postthedoc")

USER_AGENT = "PostTheDoc/0.1 (+https://github.com/Herbrant/PostTheDoc)"


def _env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Missing environment variable: {name}")
    return value


def _http_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(120, connect=20),
        transport=httpx.HTTPTransport(retries=3),
        follow_redirects=True,
    )


def cmd_run(args: argparse.Namespace) -> int:
    client = _http_client()
    sections = SECTIONS
    if args.sections:
        wanted = set(args.sections.split(","))
        sections = tuple(s for s in SECTIONS if s.key in wanted)

    d1 = None
    if args.users:
        users = [User(**u) for u in json.loads(Path(args.users).read_text(encoding="utf-8"))]
    else:
        d1 = D1Client(
            client,
            _env("CLOUDFLARE_ACCOUNT_ID"),
            _env("D1_DATABASE_ID"),
            _env("CLOUDFLARE_API_TOKEN"),
        )
        users = d1.active_users()
    log.info("%d active users", len(users))

    if args.dry_run:
        mailer = FileMailer(Path(args.out))
        settings = Settings(
            site_url=os.environ.get("SITE_URL", "http://localhost:4321/PostTheDoc"),
            api_url=os.environ.get("API_URL", "http://localhost:8787"),
            token_secret=os.environ.get("TOKEN_SECRET", "dev-secret"),
        )
        d1 = None  # a dry run records no deliveries
    else:
        mailer = BrevoMailer(
            client,
            _env("BREVO_API_KEY"),
            _env("SENDER_EMAIL"),
            os.environ.get("SENDER_NAME", "PostTheDoc"),
        )
        settings = Settings(
            site_url=_env("SITE_URL"), api_url=_env("API_URL"), token_secret=_env("TOKEN_SECRET")
        )

    if d1:
        d1.purge_pending()

    store = SeenStore(Path(args.seen))
    report = run(
        [MurSource(client, sections)], store, users, mailer, settings, d1=d1, all_open=args.all
    )
    log.info("Result: %s", report)

    if report.failures:
        # Keep seen.json as is: the next run retries, and "deliveries" prevents duplicates.
        log.error("%d deliveries failed: seen.json not updated", report.failures)
        return 1
    if not args.dry_run:
        store.save()
    return 0


def cmd_sync_reference(args: argparse.Namespace) -> int:
    missing = sync_reference(_http_client(), reference.REFERENCE_DIR)
    for i in missing:
        print(f"Missing region: {i['code']}\t{i['name']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="postthedoc")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="fetch calls and send the digests")
    p_run.add_argument("--dry-run", action="store_true", help="write digests to --out")
    p_run.add_argument("--users", help="JSON file of users to use instead of D1")
    p_run.add_argument("--out", default="out", help="output directory for --dry-run")
    p_run.add_argument("--all", action="store_true", help="treat every open call as new")
    p_run.add_argument("--sections", help="comma-separated MUR sections (default: all)")
    p_run.add_argument("--seen", default=str(reference.DATA_DIR / "seen.json"))
    p_run.set_defaults(func=cmd_run)

    p_sync = sub.add_parser(
        "sync-reference", help="update institutions and sectors from the MUR portal"
    )
    p_sync.set_defaults(func=cmd_sync_reference)

    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
