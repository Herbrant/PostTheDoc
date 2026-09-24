from collections.abc import Sequence
from pathlib import Path

import pytest

from postthedoc.config import LinkSettings
from postthedoc.contract import Contract
from postthedoc.digest import DigestRenderer
from postthedoc.links import LinkBuilder
from postthedoc.models import Call
from postthedoc.pipeline import DeliveryLog, Pipeline
from postthedoc.reference import ReferenceData
from postthedoc.sources import Source
from postthedoc.storage import SeenStore
from tests.factories import NOW, make_call, make_user
from tests.fakes import FakeDeliveryLog, FakeMailer, FakeSource

SETTINGS = LinkSettings(
    site_url="https://site.example/app", api_url="https://api.example", token_secret="s3cret"
)
ALICE = make_user("u-alice", email="alice@example.org", sectors=["INFO-01"])
BOB = make_user("u-bob", email="bob@example.org", locale="en", roles=["phd"])


@pytest.fixture
def seen_path(tmp_path: Path) -> Path:
    return tmp_path / "seen.json"


def seen_store(path: Path, ids: Sequence[str] = ()) -> SeenStore:
    store = SeenStore(path)
    store.add([make_call(i) for i in ids], NOW)
    store.save()
    return SeenStore(path)


@pytest.fixture
def make_pipeline(contract: Contract, reference: ReferenceData):
    def build(
        sources: Sequence[Source],
        store: SeenStore,
        mailer: FakeMailer,
        deliveries: DeliveryLog | None = None,
    ) -> Pipeline:
        return Pipeline(
            sources=sources,
            store=store,
            mailer=mailer,
            links=LinkBuilder(SETTINGS, contract),
            renderer=DigestRenderer(reference),
            deliveries=deliveries,
            clock=lambda: NOW,
            sleep=lambda _: None,
        )

    return build


def calls(*ids: str, **fields: object) -> list[Call]:
    return [make_call(i, **fields) for i in ids]


def test_bootstrap_does_not_send(make_pipeline, seen_path):
    store, mailer = SeenStore(seen_path), FakeMailer()

    report = make_pipeline([FakeSource(calls("a"))], store, mailer).run([ALICE])

    assert report.bootstrap
    assert report.seen_updated
    assert mailer.sent == []
    assert "a" in store


def test_no_bootstrap_when_a_source_failed(make_pipeline, seen_path):
    """Otherwise every open call of the failed source would be mailed on the next run."""
    store = SeenStore(seen_path)
    source = FakeSource(calls("a"), failures=["fake/jobs"])

    report = make_pipeline([source], store, FakeMailer()).run([ALICE])

    assert not report.bootstrap
    assert not report.seen_updated
    assert not report.ok
    assert len(store) == 0


def test_source_failures_do_not_stop_the_other_calls(make_pipeline, seen_path):
    mailer = FakeMailer()
    source = FakeSource(calls("a"), failures=["fake/jobs"])

    report = make_pipeline([source], seen_store(seen_path), mailer).run([ALICE])

    assert report.failed_sources == ["fake/jobs"]
    assert report.seen_updated
    assert len(mailer.sent) == 1


def test_sends_only_new_matching_calls(make_pipeline, seen_path):
    source = FakeSource([*calls("old", "new"), make_call("phd", role="phd")])
    store, mailer = seen_store(seen_path, ["old"]), FakeMailer()

    report = make_pipeline([source], store, mailer).run([ALICE, BOB])

    assert report.new == 2
    assert report.emails_sent == 2
    assert report.ok
    assert source.enriched == ["new", "phd"]
    by_user = {e.to: e for e in mailer.sent}
    assert "Call new" in by_user["alice@example.org"].text
    assert "Call old" not in by_user["alice@example.org"].text
    assert "Call phd" in by_user["bob@example.org"].text
    assert "new" in store
    assert "phd" in store


def test_all_open_treats_seen_calls_as_new(make_pipeline, seen_path):
    mailer = FakeMailer()
    report = make_pipeline([FakeSource(calls("old"))], seen_store(seen_path, ["old"]), mailer).run(
        [ALICE], all_open=True
    )
    assert report.new == 1
    assert len(mailer.sent) == 1


def test_enriches_only_calls_of_each_source(make_pipeline, seen_path):
    class OtherSource(FakeSource):
        name = "other"

    fake, other = FakeSource(calls("a")), OtherSource([make_call("b", source="other")])
    make_pipeline([fake, other], seen_store(seen_path), FakeMailer()).run([ALICE])
    assert fake.enriched == ["a"]
    assert other.enriched == ["b"]


def test_digest_uses_user_locale(make_pipeline, seen_path):
    mailer = FakeMailer()
    source = FakeSource([make_call("r1"), make_call("p1", role="phd")])

    make_pipeline([source], seen_store(seen_path), mailer).run([ALICE, BOB])

    by_user = {e.to: e for e in mailer.sent}
    italian, english = by_user["alice@example.org"], by_user["bob@example.org"]
    assert italian.subject == "PostTheDoc: 1 nuovo bando (24/09/2026)"
    assert "Scadenza" in italian.text
    assert "Sicilia" in italian.text
    assert english.subject == "PostTheDoc: 1 new call (24/09/2026)"
    assert "Sicily" in english.text


def test_digest_links_point_to_the_user(make_pipeline, seen_path):
    mailer = FakeMailer()
    make_pipeline([FakeSource(calls("new"))], seen_store(seen_path), mailer).run([ALICE])

    email = mailer.sent[0]
    assert email.headers["List-Unsubscribe"].startswith("<https://api.example/unsubscribe?t=")
    assert "https://site.example/app/it/manage/#t=" in email.text
    assert 'href="https://site.example/app/it/privacy/"' in email.html


def test_skips_already_delivered_and_records(make_pipeline, seen_path):
    deliveries, mailer = FakeDeliveryLog(delivered=[("u-alice", "a")]), FakeMailer()

    make_pipeline([FakeSource(calls("a", "b"))], seen_store(seen_path), mailer, deliveries).run(
        [ALICE]
    )

    assert len(mailer.sent) == 1
    assert "Call b" in mailer.sent[0].text
    assert "Call a" not in mailer.sent[0].text
    assert ("u-alice", "b") in deliveries.rows


def test_send_failure_is_reported_and_not_recorded(make_pipeline, seen_path):
    deliveries = FakeDeliveryLog()
    mailer = FakeMailer(fail_for=frozenset({"alice@example.org"}))

    report = make_pipeline([FakeSource(calls("a"))], seen_store(seen_path), mailer, deliveries).run(
        [ALICE, make_user("u-carol", email="carol@example.org")]
    )

    assert report.failed_deliveries == ["u-alice"]
    assert report.emails_sent == 1  # the others still get their digest
    assert not report.ok
    assert not report.seen_updated
    assert ("u-alice", "a") not in deliveries.rows


def test_recording_is_retried(make_pipeline, seen_path):
    deliveries, mailer = FakeDeliveryLog(failures=2), FakeMailer()

    report = make_pipeline([FakeSource(calls("a"))], seen_store(seen_path), mailer, deliveries).run(
        [ALICE]
    )

    assert report.ok
    assert ("u-alice", "a") in deliveries.rows


def test_stops_sending_when_deliveries_cannot_be_recorded(make_pipeline, seen_path):
    """A digest sent but not recorded goes out again: do not multiply that by every user."""
    deliveries, mailer = FakeDeliveryLog(failures=99), FakeMailer()
    carol = make_user("u-carol", email="carol@example.org")

    report = make_pipeline([FakeSource(calls("a"))], seen_store(seen_path), mailer, deliveries).run(
        [ALICE, carol]
    )

    assert [e.to for e in mailer.sent] == ["alice@example.org"]
    assert report.unrecorded_deliveries == ["u-alice"]
    assert not report.seen_updated
