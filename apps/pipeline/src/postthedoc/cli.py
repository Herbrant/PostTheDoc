"""Command line entry point: `postthedoc run` (the daily job) and `postthedoc sync-reference`."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

import httpx
from pydantic import TypeAdapter

from postthedoc import __version__
from postthedoc.config import (
    REPOSITORY_URL,
    BrevoSettings,
    ConfigError,
    D1Settings,
    LinkSettings,
    data_dir,
)
from postthedoc.contract import Contract
from postthedoc.digest import DigestRenderer
from postthedoc.links import LinkBuilder
from postthedoc.mail import BrevoMailer, FileMailer, Mailer
from postthedoc.maintenance.sync_reference import sync_reference
from postthedoc.models import User
from postthedoc.pipeline import Pipeline
from postthedoc.reference import ReferenceData
from postthedoc.sources import MurSource
from postthedoc.sources.mur import SECTIONS, SECTIONS_BY_KEY, Section
from postthedoc.storage import D1Client, D1Error, SeenStore

log = logging.getLogger("postthedoc")

USER_AGENT = f"PostTheDoc/{__version__} (+{REPOSITORY_URL})"


def _http_client() -> httpx.Client:
    return httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(120, connect=20),
        transport=httpx.HTTPTransport(retries=3),
        follow_redirects=True,
    )


def _sections(arg: str | None) -> tuple[Section, ...]:
    if not arg:
        return SECTIONS
    return tuple(SECTIONS_BY_KEY[key] for key in arg.split(",") if key in SECTIONS_BY_KEY)


def _users_from_file(path: str) -> list[User]:
    return TypeAdapter(list[User]).validate_json(Path(path).read_bytes())


def cmd_run(args: argparse.Namespace) -> int:
    data = data_dir()
    contract = Contract.load(data / "contract.json")
    reference = ReferenceData.load(data / "reference")
    links = LinkBuilder(LinkSettings.from_env(dry_run=args.dry_run), contract)

    with _http_client() as client:
        d1: D1Client | None = None
        if args.users:
            users = _users_from_file(args.users)
        else:
            d1 = D1Client(client, D1Settings.from_env())
            users = d1.active_users()
        log.info("%d active users", len(users))

        mailer: Mailer
        if args.dry_run:
            mailer = FileMailer(Path(args.out))
            d1 = None  # a dry run records no deliveries
        else:
            mailer = BrevoMailer(client, BrevoSettings.from_env())

        if d1:
            d1.purge_pending(contract.pending_retention_days)

        store = SeenStore(Path(args.seen) if args.seen else data / "seen.json")
        pipeline = Pipeline(
            sources=[MurSource(client, reference, _sections(args.sections))],
            store=store,
            mailer=mailer,
            links=links,
            renderer=DigestRenderer(reference),
            deliveries=d1,
        )
        report = pipeline.run(users, all_open=args.all)

    log.info("Result: %s", report)
    if not report.seen_updated:
        log.error("seen.json not updated: the next run retries")
    elif not args.dry_run:
        store.save()
    return 0 if report.ok else 1


def cmd_sync_reference(_args: argparse.Namespace) -> int:
    with _http_client() as client:
        missing = sync_reference(client, data_dir() / "reference")
    for institution in missing:
        log.warning("Missing region: %s\t%s", institution.code, institution.name)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="postthedoc", description=__doc__)
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true", help="log debug messages")
    sub = parser.add_subparsers(dest="command", required=True)

    run = sub.add_parser("run", help="fetch calls and send the digests")
    run.add_argument("--dry-run", action="store_true", help="write digests to --out, send nothing")
    run.add_argument("--users", metavar="FILE", help="JSON file of users to use instead of D1")
    run.add_argument("--out", default="out", help="output directory for --dry-run")
    run.add_argument("--all", action="store_true", help="treat every open call as new")
    run.add_argument("--sections", help="comma-separated MUR sections (default: all)")
    run.add_argument("--seen", metavar="FILE", help="seen calls registry (default: data/seen.json)")
    run.set_defaults(handler=cmd_run)

    sync = sub.add_parser("sync-reference", help="update institutions and sectors from MUR")
    sync.set_defaults(handler=cmd_sync_reference)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)
    try:
        code: int = args.handler(args)
    except ConfigError as exc:
        log.error("%s", exc)
        return 2
    except D1Error as exc:
        log.error("%s", exc)
        return 1
    return code


if __name__ == "__main__":
    sys.exit(main())
