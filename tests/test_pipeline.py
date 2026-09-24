from datetime import UTC, datetime, timedelta

import httpx

from postthedoc import tokens
from postthedoc.mailer import Email
from postthedoc.models import Call, User
from postthedoc.pipeline import Settings, run
from postthedoc.sources import Source
from postthedoc.store import SeenStore

NOW = datetime(2026, 9, 24, 6, 0, tzinfo=UTC)
SETTINGS = Settings(site_url="https://postthedoc.example", token_secret="s3cret")


def call(id: str, **kw) -> Call:
    base = dict(
        id=id,
        source="fake",
        role="researcher",
        title=f"Call {id}",
        url=f"https://example.org/{id}",
        institution_name="Univ. CATANIA",
        institution_code="UNICT",
        region="IT-82",
        gsd=["INFO-01"],
        deadline=NOW + timedelta(days=10),
    )
    return Call(**(base | kw))


class FakeSource(Source):
    name = "fake"

    def __init__(self, calls):
        self.calls = calls
        self.enriched: list[str] = []

    def fetch(self):
        return [c.model_copy() for c in self.calls]

    def enrich(self, calls):
        self.enriched.extend(c.id for c in calls)


class FakeMailer:
    def __init__(self, fail_for: set[str] = frozenset()):
        self.sent: list[Email] = []
        self.fail_for = fail_for

    def send(self, email):
        if email.to in self.fail_for:
            raise httpx.HTTPStatusError("boom", request=None, response=None)
        self.sent.append(email)


class FakeD1:
    def __init__(self, delivered=()):
        self.rows = set(delivered)

    def delivered(self, call_ids):
        return {r for r in self.rows if r[1] in call_ids}

    def record_deliveries(self, user_id, call_ids):
        self.rows.update((user_id, c) for c in call_ids)


ALICE = User(id="u-alice", email="alice@example.org", roles=["researcher"], sectors=["INFO-01"])
BOB = User(id="u-bob", email="bob@example.org", locale="en", roles=["phd"])


def seen_store(tmp_path, ids=()):
    store = SeenStore(tmp_path / "seen.json")
    store.add([call(i) for i in ids])
    store.save()
    return SeenStore(tmp_path / "seen.json")


def test_bootstrap_does_not_send(tmp_path):
    store = SeenStore(tmp_path / "seen.json")
    mailer = FakeMailer()

    report = run([FakeSource([call("a")])], store, [ALICE], mailer, SETTINGS, now=NOW)

    assert report.bootstrap
    assert mailer.sent == []
    assert "a" in store


def test_sends_only_new_matching_calls(tmp_path):
    source = FakeSource([call("old"), call("new"), call("phd", role="phd")])
    store = seen_store(tmp_path, ["old"])
    mailer = FakeMailer()

    report = run([source], store, [ALICE, BOB], mailer, SETTINGS, now=NOW)

    assert report.new == 2
    assert source.enriched == ["new", "phd"]
    by_user = {e.to: e for e in mailer.sent}
    assert "Call new" in by_user["alice@example.org"].text
    assert "Call old" not in by_user["alice@example.org"].text
    assert "Call phd" in by_user["bob@example.org"].text
    assert "new" in store and "phd" in store


def test_digest_uses_user_locale(tmp_path):
    mailer = FakeMailer()
    source = FakeSource([call("r1"), call("p1", role="phd")])

    run([source], seen_store(tmp_path), [ALICE, BOB], mailer, SETTINGS, now=NOW)

    by_user = {e.to: e for e in mailer.sent}
    italian, english = by_user["alice@example.org"], by_user["bob@example.org"]
    assert italian.subject == "PostTheDoc: 1 nuovo bando (24/09/2026)"
    assert "Scadenza" in italian.text and "Sicilia" in italian.text
    assert '<html lang="it">' in italian.html
    assert english.subject == "PostTheDoc: 1 new call (24/09/2026)"
    assert "Deadline" in english.text and "Sicily" in english.text
    assert "PhD" in english.html and "Unsubscribe" in english.html


def test_links_carry_valid_tokens(tmp_path):
    mailer = FakeMailer()
    run([FakeSource([call("new")])], seen_store(tmp_path), [ALICE], mailer, SETTINGS, now=NOW)

    email = mailer.sent[0]
    unsubscribe = email.headers["List-Unsubscribe"].strip("<>")
    assert unsubscribe.startswith("https://postthedoc.example/unsubscribe?t=")
    token = unsubscribe.split("t=", 1)[1]
    data = tokens.verify(SETTINGS.token_secret, token, {"unsubscribe"})
    assert data and data.user_id == ALICE.id


def test_skips_already_delivered_and_records(tmp_path):
    d1 = FakeD1(delivered={("u-alice", "a")})
    mailer = FakeMailer()
    source = FakeSource([call("a"), call("b")])

    run([source], seen_store(tmp_path), [ALICE], mailer, SETTINGS, d1=d1, now=NOW)

    assert len(mailer.sent) == 1
    assert "Call b" in mailer.sent[0].text and "Call a" not in mailer.sent[0].text
    assert ("u-alice", "b") in d1.rows


def test_failure_is_reported_and_not_recorded(tmp_path):
    d1 = FakeD1()
    mailer = FakeMailer(fail_for={"alice@example.org"})

    report = run(
        [FakeSource([call("a")])], seen_store(tmp_path), [ALICE], mailer, SETTINGS, d1=d1, now=NOW
    )

    assert report.failures == 1
    assert d1.rows == set()


def test_prune_forgets_long_expired(tmp_path):
    store = SeenStore(tmp_path / "seen.json")
    store.add([call("stale", deadline=NOW - timedelta(days=90)), call("fresh")])
    store.prune(NOW)
    assert "stale" not in store and "fresh" in store
