"""Golden tests: the rendered digest must not change unless the templates are edited on purpose.

Regenerate the golden files with `UPDATE_GOLDEN=1 uv run pytest tests/test_digest.py`.
"""

import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from postthedoc.digest import DigestRenderer
from postthedoc.links import DigestLinks
from postthedoc.models import CallChange, CallUpdate
from postthedoc.reference import ReferenceData
from tests.factories import make_call

GOLDEN = Path(__file__).parent / "golden"
ROME = ZoneInfo("Europe/Rome")

CALLS = [
    make_call(
        "mur-jobs-2",
        title="RTT <INFO-01>",
        url="https://bandi.mur.gov.it/jobs.php/public/job/id_job/2",
        deadline=datetime(2026, 10, 20, 12, 0, tzinfo=ROME),
        positions=2,
    ),
    make_call(
        "mur-jobs-1",
        title="RTT & co",
        url="https://bandi.mur.gov.it/jobs.php/public/job/id_job/1",
        institution_name="Univ. BRESCIA",
        institution_code="UNIBS",
        region="IT-25",
        ssd=[],
        gsd=[],
        deadline=datetime(2026, 10, 1, 14, 0, tzinfo=ROME),
    ),
    make_call(
        "mur-doctorate-3",
        role="phd",
        title="Dottorato",
        url="https://bandi.mur.gov.it/doctorate.php/public/fellowship/id_fellow/3",
        institution_name="Ente sconosciuto",
        institution_code=None,
        region=None,
        ssd=[],
        gsd=["IINF-05"],
        deadline=None,
    ),
]


CHANGED = datetime(2026, 9, 24, 8, 0, tzinfo=ROME)
UPDATES = [
    CallUpdate(
        id="mur-jobs-4",
        title="RTT <IINF-05>",
        url="https://bandi.mur.gov.it/jobs.php/public/job/id_job/4",
        institution_name="Univ. CATANIA",
        region="IT-82",
        deadline=datetime(2026, 10, 30, 12, 0, tzinfo=ROME),
        changes=[
            CallChange(
                at=CHANGED,
                field="deadline",
                old="2026-10-15T12:00:00+02:00",
                new="2026-10-30T12:00:00+01:00",
            ),
            CallChange(at=CHANGED, field="title", old="RTT & IINF-05", new="RTT <IINF-05>"),
            CallChange(at=CHANGED, field="positions", old=1, new=2),
        ],
    ),
    CallUpdate(
        id="mur-doctorate-5",
        title="Dottorato",
        url="https://bandi.mur.gov.it/doctorate.php/public/fellowship/id_fellow/5",
        institution_name="Ente sconosciuto",
        changes=[
            CallChange(
                at=CHANGED,
                field="deadline",
                old="2026-10-15T12:00:00+02:00",
                new="2026-10-10T12:00:00+02:00",
            ),
            CallChange(at=CHANGED, field="status", old="open", new="withdrawn"),
        ],
    ),
    CallUpdate(
        id="mur-tecno-6",
        title="Tecnologo",
        url="https://bandi.mur.gov.it/tecno.php/public/job/id_job/6",
        institution_name="Univ. BRESCIA",
        region="IT-25",
        deadline=datetime(2026, 10, 20, 12, 0, tzinfo=ROME),
        changes=[CallChange(at=CHANGED, field="status", old="withdrawn", new="open")],
    ),
]


def links(locale: str) -> DigestLinks:
    return DigestLinks(
        manage=f"https://site.example/{locale}/manage/#t=MANAGE",
        unsubscribe="https://api.example/unsubscribe?t=UNSUB",
        privacy=f"https://site.example/{locale}/privacy/",
        support=f"https://site.example/{locale}/#support",
        donate="https://buymeacoffee.com/PostTheDoc",
        issues="https://github.com/Herbrant/PostTheDoc/issues",
    )


@pytest.mark.parametrize("locale", ["it", "en"])
@pytest.mark.parametrize(
    ("name", "calls", "updates"),
    [("digest", CALLS, []), ("digest_updates", [], UPDATES), ("digest_mixed", CALLS[:1], UPDATES)],
)
def test_digest_matches_golden(reference: ReferenceData, locale, name, calls, updates):
    email = DigestRenderer(reference).render(
        "alice@example.org", calls, locale, links(locale), date(2026, 9, 24), updates
    )
    assert email.to == "alice@example.org"
    rendered = {
        "html": email.html,
        "txt": f"Subject: {email.subject}\n{email.headers}\n\n{email.text}",
    }
    for ext, text in rendered.items():
        path = GOLDEN / f"{name}_{locale}.{ext}"
        if os.environ.get("UPDATE_GOLDEN"):
            path.write_text(text, encoding="utf-8")
        assert text == path.read_text(encoding="utf-8")


def test_single_call_subject(reference: ReferenceData):
    email = DigestRenderer(reference).render(
        "a@example.org", CALLS[:1], "it", links("it"), date(2026, 9, 24)
    )
    assert email.subject == "PostTheDoc: 1 nuovo bando (24/09/2026)"


@pytest.mark.parametrize(
    ("calls", "updates", "subject"),
    [
        (0, 1, "PostTheDoc: 1 bando aggiornato (24/09/2026)"),
        (2, 1, "PostTheDoc: 2 nuovi bandi e 1 bando aggiornato (24/09/2026)"),
        (1, 3, "PostTheDoc: 1 nuovo bando e 3 bandi aggiornati (24/09/2026)"),
    ],
)
def test_subject_counts_new_and_updated_calls(reference: ReferenceData, calls, updates, subject):
    email = DigestRenderer(reference).render(
        "a@example.org", CALLS[:calls], "it", links("it"), date(2026, 9, 24), UPDATES[:updates]
    )
    assert email.subject == subject
