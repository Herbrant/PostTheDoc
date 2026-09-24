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


def links(locale: str) -> DigestLinks:
    return DigestLinks(
        manage=f"https://site.example/{locale}/manage/#t=MANAGE",
        unsubscribe="https://api.example/unsubscribe?t=UNSUB",
        privacy=f"https://site.example/{locale}/privacy/",
        support=f"https://site.example/{locale}/#support",
    )


@pytest.mark.parametrize("locale", ["it", "en"])
def test_digest_matches_golden(reference: ReferenceData, locale):
    email = DigestRenderer(reference).render(
        "alice@example.org", CALLS, locale, links(locale), date(2026, 9, 24)
    )
    assert email.to == "alice@example.org"
    rendered = {
        "html": email.html,
        "txt": f"Subject: {email.subject}\n{email.headers}\n\n{email.text}",
    }
    for ext, text in rendered.items():
        path = GOLDEN / f"digest_{locale}.{ext}"
        if os.environ.get("UPDATE_GOLDEN"):
            path.write_text(text, encoding="utf-8")
        assert text == path.read_text(encoding="utf-8")


def test_single_call_subject(reference: ReferenceData):
    email = DigestRenderer(reference).render(
        "a@example.org", CALLS[:1], "it", links("it"), date(2026, 9, 24)
    )
    assert email.subject == "PostTheDoc: 1 nuovo bando (24/09/2026)"
