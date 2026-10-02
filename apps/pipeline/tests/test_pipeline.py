from collections.abc import Sequence
from datetime import date, datetime, timedelta
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
from tests.fakes import FakeDeliveryLog, FakeMailer, FakeSource, QuotaMailer

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
    store.add([make_call(i, details=True) for i in ids], NOW)
    store.save()
    return SeenStore(path)


@pytest.fixture
def make_pipeline(contract: Contract, reference: ReferenceData):
    def build(
        sources: Sequence[Source],
        store: SeenStore,
        mailer: FakeMailer,
        deliveries: DeliveryLog | None = None,
        now: datetime = NOW,
    ) -> Pipeline:
        return Pipeline(
            sources=sources,
            store=store,
            mailer=mailer,
            links=LinkBuilder(SETTINGS, contract),
            renderer=DigestRenderer(reference),
            deliveries=deliveries,
            clock=lambda: now,
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


def test_no_bootstrap_without_open_calls(make_pipeline, seen_path):
    """An empty seen.json would make every call open tomorrow look new."""
    store = SeenStore(seen_path)

    report = make_pipeline([FakeSource([])], store, FakeMailer()).run([ALICE])

    assert report.empty
    assert not report.bootstrap
    assert not report.seen_updated
    assert not report.ok


def test_no_open_calls_is_reported(make_pipeline, seen_path):
    report = make_pipeline([FakeSource([])], seen_store(seen_path, ["a"]), FakeMailer()).run(
        [ALICE]
    )

    assert not report.ok
    assert report.seen_updated


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

    [first] = mailer.sent
    by_email = {ALICE.email: ALICE.id, carol.email: carol.id}
    assert report.unrecorded_deliveries == [by_email[first.to]]
    assert report.skipped_deliveries == [
        uid for uid in by_email.values() if uid != by_email[first.to]
    ]
    assert not report.ok


def test_calls_someone_missed_are_sent_again_to_them_only(make_pipeline, seen_path):
    deliveries, carol = FakeDeliveryLog(), make_user("u-carol", email="carol@example.org")
    source = FakeSource(calls("a"))
    failing = FakeMailer(fail_for=frozenset({"alice@example.org"}))
    store = seen_store(seen_path)

    make_pipeline([source], store, failing, deliveries).run([ALICE, carol])
    store.save()
    assert SeenStore(seen_path).retries() == {"a": NOW}

    mailer, store = FakeMailer(), SeenStore(seen_path)
    tomorrow = NOW + timedelta(days=1)
    report = make_pipeline([source], store, mailer, deliveries, now=tomorrow).run([ALICE, carol])

    assert report.ok
    assert (report.new, report.retried) == (0, 1)
    assert [e.to for e in mailer.sent] == ["alice@example.org"]
    assert store.retries() == {}
    assert source.enriched == ["a", "a"]  # the details of a retried call are fetched again


def test_gives_up_on_a_call_after_the_retry_window(make_pipeline, seen_path):
    source = FakeSource(calls("a"))
    failing = FakeMailer(fail_for=frozenset({"alice@example.org"}))
    store = seen_store(seen_path)

    for day in range(5):
        now = NOW + timedelta(days=day)
        report = make_pipeline([source], store, failing, FakeDeliveryLog(), now=now).run([ALICE])
        assert report.seen_updated
        if day < 4:
            assert report.abandoned_calls == []

    assert report.abandoned_calls == ["a"]
    assert store.retries() == {}


def test_stops_sending_when_the_mailer_is_unavailable(make_pipeline, seen_path):
    """E.g. the provider's daily quota is used up: every other email would fail too."""
    users = [make_user(f"u-{i}", email=f"user{i}@example.org") for i in range(3)]
    mailer, store = QuotaMailer(), seen_store(seen_path)

    report = make_pipeline([FakeSource(calls("a"))], store, mailer).run(users)

    assert len(report.failed_deliveries) == 1
    assert len(report.skipped_deliveries) == 2
    assert mailer.attempts == 1
    assert report.seen_updated
    assert "a" in store
    assert store.retries() == {"a": NOW}


def test_user_order_changes_every_day(make_pipeline, seen_path):
    users = [make_user(f"u-{i}", email=f"user{i}@example.org") for i in range(8)]

    def order(now: datetime) -> list[str]:
        mailer = FakeMailer()
        make_pipeline([FakeSource(calls("a"))], seen_store(seen_path), mailer, now=now).run(users)
        return [e.to for e in mailer.sent]

    assert order(NOW) == order(NOW)
    assert order(NOW) != order(NOW + timedelta(days=1))
    assert sorted(order(NOW)) == sorted(u.email for u in users)


def test_incomplete_calls_wait_for_the_next_run(make_pipeline, seen_path):
    """E.g. a detail page with the sector failed to load: filtering users would miss the call."""
    store, mailer = seen_store(seen_path), FakeMailer()
    source = FakeSource(calls("a", "b"), incomplete=["b"])

    report = make_pipeline([source], store, mailer).run([ALICE])

    assert report.incomplete_calls == ["b"]
    assert report.ok
    assert "Call a" in mailer.sent[0].text
    assert "Call b" not in mailer.sent[0].text
    assert "a" in store
    assert "b" not in store  # new again next time


def test_a_digest_that_fails_to_render_does_not_stop_the_others(
    make_pipeline, seen_path, monkeypatch: pytest.MonkeyPatch
):
    mailer, store = FakeMailer(), seen_store(seen_path)
    pipeline = make_pipeline([FakeSource(calls("a"))], store, mailer)
    render = DigestRenderer.render

    def broken_for_alice(self, to, *args, **kwargs):
        if to == ALICE.email:
            raise KeyError("unknown code")
        return render(self, to, *args, **kwargs)

    monkeypatch.setattr(DigestRenderer, "render", broken_for_alice)
    carol = make_user("u-carol", email="carol@example.org")

    report = pipeline.run([ALICE, carol])

    assert report.failed_deliveries == ["u-alice"]
    assert [e.to for e in mailer.sent] == ["carol@example.org"]
    assert set(store.retries()) == {"a"}  # sent again to Alice once fixed


def test_seen_calls_keep_their_details(make_pipeline, seen_path):
    seen_path.write_text(
        '{"version": 2, "calls": {\n'
        '"old": {"deadline": null, "first_seen": "2026-09-01T06:00:00Z"}\n'
        "}}\n"
    )
    store = SeenStore(seen_path)
    make_pipeline([FakeSource(calls("old", "new"))], store, FakeMailer()).run([ALICE])

    entries = store.entries()
    assert entries["new"].call is not None
    assert entries["new"].call.title == "Call new"
    assert entries["old"].call is not None  # filled in from today's copy


TOMORROW = NOW + timedelta(days=1)


def test_changes_are_told_to_who_got_the_call(make_pipeline, seen_path):
    store, mailer = seen_store(seen_path, ["a", "b"]), FakeMailer()
    deliveries = FakeDeliveryLog(delivered=[("u-alice", "a"), ("u-gone", "a"), ("u-bob", "b")])
    source = FakeSource([*calls("a", title="Rettifica"), make_call("b")])

    report = make_pipeline([source], store, mailer, deliveries, now=TOMORROW).run([ALICE, BOB])

    assert report.ok
    assert (report.new, report.changed, report.withdrawn) == (0, 1, 0)
    [email] = mailer.sent
    assert email.to == ALICE.email
    assert email.subject == "PostTheDoc: 1 bando aggiornato (25/09/2026)"
    assert "Titolo modificato, prima era: «Call a»" in email.text
    assert deliveries.updates == {("u-alice", "a", TOMORROW)}

    mailer = FakeMailer()
    later = TOMORROW + timedelta(days=1)
    make_pipeline([source], store, mailer, deliveries, now=later).run([ALICE, BOB])
    assert mailer.sent == []  # told once


def test_changes_are_not_told_to_who_got_the_new_version(make_pipeline, seen_path):
    store, mailer = seen_store(seen_path, ["a"]), FakeMailer()
    deliveries = FakeDeliveryLog()
    deliveries.times[("u-alice", "a")] = TOMORROW + timedelta(minutes=5)

    make_pipeline(
        [FakeSource(calls("a", title="Rettifica"))], store, mailer, deliveries, now=TOMORROW
    ).run([ALICE])

    assert mailer.sent == []


def test_new_calls_and_changes_share_the_digest(make_pipeline, seen_path):
    store, mailer = seen_store(seen_path, ["a"]), FakeMailer()
    deliveries = FakeDeliveryLog(delivered=[("u-alice", "a")])
    deadline = NOW + timedelta(days=30)
    source = FakeSource([*calls("a", deadline=deadline), *calls("b")])

    make_pipeline([source], store, mailer, deliveries, now=TOMORROW).run([ALICE])

    [email] = mailer.sent
    assert email.subject == "PostTheDoc: 1 nuovo bando e 1 bando aggiornato (25/09/2026)"
    assert "Call b" in email.text
    assert "Scadenza prorogata: 04/10/2026 06:00 → 24/10/2026 06:00" in email.text
    assert ("u-alice", "b") in deliveries.rows
    assert deliveries.updates == {("u-alice", "a", TOMORROW)}


def test_changes_not_told_are_told_on_the_next_runs(make_pipeline, seen_path):
    store = seen_store(seen_path, ["a"])
    deliveries = FakeDeliveryLog(delivered=[("u-alice", "a")])
    source = FakeSource(calls("a", title="Rettifica"))

    report = make_pipeline([source], store, QuotaMailer(), deliveries, now=TOMORROW).run([ALICE])
    assert report.failed_deliveries == ["u-alice"]
    assert deliveries.updates == set()

    mailer = FakeMailer()
    later = TOMORROW + timedelta(days=1)
    make_pipeline([source], store, mailer, deliveries, now=later).run([ALICE])
    assert "Rettifica" in mailer.sent[0].text
    assert deliveries.updates == {("u-alice", "a", TOMORROW)}


def test_changes_are_dropped_after_the_retry_window(make_pipeline, seen_path):
    store = seen_store(seen_path, ["a"])
    deliveries = FakeDeliveryLog(delivered=[("u-alice", "a")])
    source = FakeSource(calls("a", title="Rettifica"))
    make_pipeline([source], store, QuotaMailer(), deliveries, now=TOMORROW).run([ALICE])

    mailer = FakeMailer()
    make_pipeline([source], store, mailer, deliveries, now=TOMORROW + timedelta(days=4)).run(
        [ALICE]
    )
    assert mailer.sent == []


def test_withdrawn_calls_are_told(make_pipeline, seen_path):
    ids = ["a", "b", "c", "d", "e"]
    store = seen_store(seen_path, ids)
    deliveries = FakeDeliveryLog(delivered=[("u-alice", "a")])
    source = FakeSource(calls(*ids[1:]), scopes=[""])

    make_pipeline([source], store, FakeMailer(), deliveries, now=NOW).run([ALICE])
    mailer = FakeMailer()
    report = make_pipeline([source], store, mailer, deliveries, now=TOMORROW).run([ALICE])

    assert (report.changed, report.withdrawn) == (1, 1)
    assert "Non è più tra i bandi aperti del portale del MUR" in mailer.sent[0].text


def test_changes_wait_when_the_update_log_is_unavailable(make_pipeline, seen_path):
    """E.g. the job runs before the migration that adds call_updates is applied."""
    store, mailer = seen_store(seen_path, ["a"]), FakeMailer()
    deliveries = FakeDeliveryLog(delivered=[("u-alice", "a")], updates_down=True)
    source = FakeSource([*calls("a", title="Rettifica"), *calls("b")])

    report = make_pipeline([source], store, mailer, deliveries, now=TOMORROW).run([ALICE])

    assert report.updates_unavailable
    assert not report.ok
    [email] = mailer.sent
    assert "Call b" in email.text
    assert "Rettifica" not in email.text
    assert store.recent_changes(TOMORROW)  # still to tell on the next runs


def test_changes_are_recorded_without_a_delivery_log(make_pipeline, seen_path):
    store, mailer = seen_store(seen_path, ["a"]), FakeMailer()

    report = make_pipeline(
        [FakeSource(calls("a", title="Rettifica"))], store, mailer, now=TOMORROW
    ).run([ALICE])

    assert report.changed == 1
    assert mailer.sent == []
    assert [c.field for c in store.entries()["a"].changes] == ["title"]


def test_previews_do_not_record_changes(make_pipeline, seen_path):
    store = seen_store(seen_path, ["a"])
    make_pipeline(
        [FakeSource(calls("a", title="Rettifica"))], store, FakeMailer(), now=TOMORROW
    ).run([ALICE], all_open=True)
    assert store.entries()["a"].changes == ()


def test_calls_seen_before_their_details_are_completed(
    make_pipeline, seen_path, monkeypatch: pytest.MonkeyPatch
):
    monkeypatch.setattr("postthedoc.pipeline.BACKFILL_PER_RUN", 1)
    store = SeenStore(seen_path)
    store.add([make_call("a"), make_call("b")], NOW)  # seen before details were read
    store.save()
    store = SeenStore(seen_path)
    source = FakeSource(calls("a", "b", "new"), published=date(2026, 9, 1))

    make_pipeline([source], store, FakeMailer()).run([ALICE])

    entries = store.entries()
    assert source.enriched[0] == "new"
    assert len(source.enriched) == 2  # the new call, then one seen call per run
    assert entries["new"].details
    assert entries["new"].call is not None
    assert entries["new"].call.published == date(2026, 9, 1)
    assert sum(entries[i].details for i in ("a", "b")) == 1
