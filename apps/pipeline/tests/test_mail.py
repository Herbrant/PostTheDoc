import json
from pathlib import Path

import httpx
import pytest
import respx

from postthedoc.config import BrevoSettings
from postthedoc.mail import BrevoMailer, Email, FileMailer, MailError, MailerUnavailableError
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
    body = {"code": "invalid_parameter", "message": "alice@example.org is not valid"}
    respx.post(BREVO_URL).mock(return_value=httpx.Response(400, json=body))
    with pytest.raises(MailError) as info:
        BrevoMailer(httpx.Client(), SETTINGS).send(EMAIL)
    assert not isinstance(info.value, MailerUnavailableError)
    # Only the code: the message may quote the recipient, and the daily job's logs are public.
    assert str(info.value) == "Brevo: HTTP 400 invalid_parameter"


@pytest.mark.parametrize("status", [401, 402, 403, 429])
@respx.mock
def test_brevo_refusing_every_email_stops_sending(status: int):
    respx.post(BREVO_URL).mock(return_value=httpx.Response(status, text="not json"))
    with pytest.raises(MailerUnavailableError, match=f"^Brevo: HTTP {status}$"):
        BrevoMailer(httpx.Client(), SETTINGS).send(EMAIL)


@respx.mock
def test_brevo_network_errors_become_mail_errors():
    respx.post(BREVO_URL).mock(side_effect=httpx.ReadTimeout("timed out"))
    with pytest.raises(MailError, match="ReadTimeout"):
        BrevoMailer(httpx.Client(), SETTINGS).send(EMAIL)


@respx.mock
def test_brevo_reply_to():
    route = respx.post(BREVO_URL).mock(return_value=httpx.Response(201))
    settings = BrevoSettings("key", "from@example.org", "PostTheDoc", reply_to="me@example.org")

    BrevoMailer(httpx.Client(), settings).send(EMAIL)

    assert json.loads(route.calls.last.request.content)["replyTo"] == {"email": "me@example.org"}


def test_file_mailer_writes_both_parts(tmp_path: Path):
    FileMailer(tmp_path / "out").send(EMAIL)
    assert (tmp_path / "out" / "alice_example.org.html").read_text() == "<p>Hi</p>"
    text = (tmp_path / "out" / "alice_example.org.txt").read_text()
    assert text.startswith("To: alice@example.org\nSubject: Subject\n\nHi")
