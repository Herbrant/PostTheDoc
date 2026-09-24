"""Golden tests: the rendered digest must not change unless the templates are edited on purpose.

Regenerate the golden files with `UPDATE_GOLDEN=1 uv run pytest tests/test_digest.py`.
"""

import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from postthedoc.mailer import render_digest
from postthedoc.models import Call

GOLDEN = Path(__file__).parent / "golden"
ROME = ZoneInfo("Europe/Rome")

CALLS = [
    Call(
        id="mur-jobs-2",
        source="mur",
        role="researcher",
        title="RTT <INFO-01>",
        url="https://bandi.mur.gov.it/jobs.php/public/job/id_job/2",
        institution_name="Univ. CATANIA",
        institution_code="UNICT",
        region="IT-82",
        ssd=["INFO-01/A"],
        gsd=["INFO-01"],
        deadline=datetime(2026, 10, 20, 12, 0, tzinfo=ROME),
        positions=2,
    ),
    Call(
        id="mur-jobs-1",
        source="mur",
        role="researcher",
        title="RTT & co",
        url="https://bandi.mur.gov.it/jobs.php/public/job/id_job/1",
        institution_name="Univ. BRESCIA",
        institution_code="UNIBS",
        region="IT-25",
        deadline=datetime(2026, 10, 1, 14, 0, tzinfo=ROME),
    ),
    Call(
        id="mur-doctorate-3",
        source="mur",
        role="phd",
        title="Dottorato",
        url="https://bandi.mur.gov.it/doctorate.php/public/fellowship/id_fellow/3",
        institution_name="Ente sconosciuto",
        gsd=["IINF-05"],
    ),
]


@pytest.mark.parametrize("locale", ["it", "en"])
def test_digest_matches_golden(locale):
    email = render_digest(
        CALLS,
        locale,
        manage_url=f"https://site.example/{locale}/manage/#t=MANAGE",
        unsubscribe_url="https://api.example/unsubscribe?t=UNSUB",
        privacy_url=f"https://site.example/{locale}/privacy/",
        support_url=f"https://site.example/{locale}/#support",
        today=date(2026, 9, 24),
    )
    rendered = {
        "html": email.html,
        "txt": f"Subject: {email.subject}\n{email.headers}\n\n{email.text}",
    }
    for ext, text in rendered.items():
        path = GOLDEN / f"digest_{locale}.{ext}"
        if os.environ.get("UPDATE_GOLDEN"):
            path.write_text(text, encoding="utf-8")
        assert text == path.read_text(encoding="utf-8")
