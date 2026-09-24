import json
from pathlib import Path

import httpx
import pytest
import respx

from postthedoc.config import BrevoSettings
from postthedoc.mail import BrevoMailer, Email, FileMailer, MailError
from postthedoc.mail.brevo import BREVO_URL

EMAIL = Email(
    to="alice@example.org",
    subject="Subject",
    html="<p>Hi</p>",
    text="Hi",
    headers={"List-Unsubscribe": "<https://api.example/unsubscribe?t=x>"},
)
SETTINGS = BrevoSettings(api_key="key", sender_email="from@example.org", sender_name="PostTheDoc")


@respx.mock
def test_brevo_payload():
    route = respx.post(BREVO_URL).mock(return_value=httpx.Response(201))

    BrevoMailer(httpx.Client(), SETTINGS).send(EMAIL)

    request = route.calls.last.request
    assert request.headers["api-key"] == "key"
    assert json.loads(request.content) == {
        "sender": {"email": "from@example.org", "name": "PostTheDoc"},
        "to": [{"email": "alice@example.org", "contactPixelTrackingConsent": False}],
        "subject": "Subject",
        "htmlContent": "<p>Hi</p>",
        "textContent": "Hi",
        "headers": {"List-Unsubscribe": "<https://api.example/unsubscribe?t=x>"},
    }


@respx.mock
def test_brevo_errors_become_mail_errors():
    respx.post(BREVO_URL).mock(return_value=httpx.Response(400, json={"message": "bad"}))
    with pytest.raises(MailError):
        BrevoMailer(httpx.Client(), SETTINGS).send(EMAIL)


def test_file_mailer_writes_both_parts(tmp_path: Path):
    FileMailer(tmp_path / "out").send(EMAIL)
    assert (tmp_path / "out" / "alice_example.org.html").read_text() == "<p>Hi</p>"
    text = (tmp_path / "out" / "alice_example.org.txt").read_text()
    assert text.startswith("To: alice@example.org\nSubject: Subject\n\nHi")
