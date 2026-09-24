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
        sys.exit(f"Variabile d'ambiente mancante: {name}")
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
    log.info("%d utenti attivi", len(users))

    if args.dry_run:
        mailer = FileMailer(Path(args.out))
        settings = Settings(
            site_url=os.environ.get("SITE_URL", "http://localhost:8787"),
            token_secret=os.environ.get("TOKEN_SECRET", "dev-secret"),
        )
        d1 = None  # in dry-run non si registrano invii
    else:
        mailer = BrevoMailer(
            client,
            _env("BREVO_API_KEY"),
            _env("SENDER_EMAIL"),
            os.environ.get("SENDER_NAME", "PostTheDoc"),
        )
        settings = Settings(site_url=_env("SITE_URL"), token_secret=_env("TOKEN_SECRET"))

    store = SeenStore(Path(args.seen))
    report = run(
        [MurSource(client, sections)], store, users, mailer, settings, d1=d1, all_open=args.all
    )
    log.info("Esito: %s", report)

    if report.failures:
        # seen.json non si aggiorna: al prossimo giro si ritenta, "deliveries" evita i doppioni.
        log.error("%d invii falliti: seen.json non aggiornato", report.failures)
        return 1
    if not args.dry_run:
        store.save()
    return 0


def cmd_sync_reference(args: argparse.Namespace) -> int:
    missing = sync_reference(_http_client(), reference.REFERENCE_DIR)
    for s in missing:
        print(f"Regione mancante: {s['code']}\t{s['name']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="postthedoc")
    parser.add_argument("-v", "--verbose", action="store_true")
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="scarica i bandi e invia i digest")
    p_run.add_argument("--dry-run", action="store_true", help="salva i digest in --out")
    p_run.add_argument("--users", help="file JSON di utenti al posto di D1")
    p_run.add_argument("--out", default="out", help="cartella per i digest in dry-run")
    p_run.add_argument("--all", action="store_true", help="tratta come nuovi tutti i bandi aperti")
    p_run.add_argument("--sections", help="sezioni MUR separate da virgola (default: tutte)")
    p_run.add_argument("--seen", default=str(reference.DATA_DIR / "seen.json"))
    p_run.set_defaults(func=cmd_run)

    p_sync = sub.add_parser("sync-reference", help="aggiorna strutture e settori dal portale MUR")
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
