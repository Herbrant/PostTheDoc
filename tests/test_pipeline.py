from datetime import UTC, datetime, timedelta

import httpx

from postthedoc import tokens
from postthedoc.mailer import Email
from postthedoc.models import Bando, User
from postthedoc.pipeline import Settings, run
from postthedoc.sources import Source
from postthedoc.store import SeenStore

NOW = datetime(2026, 9, 24, 6, 0, tzinfo=UTC)
SETTINGS = Settings(site_url="https://postthedoc.example", token_secret="s3cret")


def bando(id: str, **kw) -> Bando:
    base = dict(
        id=id,
        source="fake",
        role="ricercatore",
        title=f"Bando {id}",
        url=f"https://example.org/{id}",
        struttura_name="Univ. CATANIA",
        struttura_code="UNICT",
        regione="sicilia",
        gsd=["INFO-01"],
        deadline=NOW + timedelta(days=10),
    )
    return Bando(**(base | kw))


class FakeSource(Source):
    name = "fake"

    def __init__(self, bandi):
        self.bandi = bandi
        self.enriched: list[str] = []

    def fetch(self):
        return [b.model_copy() for b in self.bandi]

    def enrich(self, bandi):
        self.enriched.extend(b.id for b in bandi)


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

    def delivered(self, bando_ids):
        return {r for r in self.rows if r[1] in bando_ids}

    def record_deliveries(self, user_id, bando_ids):
        self.rows.update((user_id, b) for b in bando_ids)


ALICE = User(id="u-alice", email="alice@example.org", roles=["ricercatore"], sectors=["INFO-01"])
BOB = User(id="u-bob", email="bob@example.org", roles=["dottorato"])


def seen_store(tmp_path, ids=()):
    store = SeenStore(tmp_path / "seen.json")
    store.add([bando(i) for i in ids])
    store.save()
    return SeenStore(tmp_path / "seen.json")


def test_bootstrap_does_not_send(tmp_path):
    store = SeenStore(tmp_path / "seen.json")
    mailer = FakeMailer()

    report = run([FakeSource([bando("a")])], store, [ALICE], mailer, SETTINGS, now=NOW)

    assert report.bootstrap
    assert mailer.sent == []
    assert "a" in store


def test_sends_only_new_matching_bandi(tmp_path):
    source = FakeSource([bando("old"), bando("new"), bando("phd", role="dottorato")])
    store = seen_store(tmp_path, ["old"])
    mailer = FakeMailer()

    report = run([source], store, [ALICE, BOB], mailer, SETTINGS, now=NOW)

    assert report.new == 2
    assert source.enriched == ["new", "phd"]
    by_user = {e.to: e for e in mailer.sent}
    assert "Bando new" in by_user["alice@example.org"].text
    assert "Bando old" not in by_user["alice@example.org"].text
    assert "Bando phd" in by_user["bob@example.org"].text
    assert "new" in store and "phd" in store


def test_links_carry_valid_tokens(tmp_path):
    mailer = FakeMailer()
    run([FakeSource([bando("new")])], seen_store(tmp_path), [ALICE], mailer, SETTINGS, now=NOW)

    email = mailer.sent[0]
    unsubscribe = email.headers["List-Unsubscribe"].strip("<>")
    assert unsubscribe.startswith("https://postthedoc.example/unsubscribe?t=")
    token = unsubscribe.split("t=", 1)[1]
    data = tokens.verify(SETTINGS.token_secret, token, {"unsubscribe"})
    assert data and data.user_id == ALICE.id


def test_skips_already_delivered_and_records(tmp_path):
    d1 = FakeD1(delivered={("u-alice", "a")})
    mailer = FakeMailer()
    source = FakeSource([bando("a"), bando("b")])

    run([source], seen_store(tmp_path), [ALICE], mailer, SETTINGS, d1=d1, now=NOW)

    assert len(mailer.sent) == 1
    assert "Bando b" in mailer.sent[0].text and "Bando a" not in mailer.sent[0].text
    assert ("u-alice", "b") in d1.rows


def test_failure_is_reported_and_not_recorded(tmp_path):
    d1 = FakeD1()
    mailer = FakeMailer(fail_for={"alice@example.org"})

    report = run(
        [FakeSource([bando("a")])], seen_store(tmp_path), [ALICE], mailer, SETTINGS, d1=d1, now=NOW
    )

    assert report.failures == 1
    assert d1.rows == set()


def test_prune_forgets_long_expired(tmp_path):
    store = SeenStore(tmp_path / "seen.json")
    store.add([bando("stale", deadline=NOW - timedelta(days=90)), bando("fresh")])
    store.prune(NOW)
    assert "stale" not in store and "fresh" in store
