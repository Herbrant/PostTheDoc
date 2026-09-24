from datetime import timedelta
from pathlib import Path

from postthedoc.storage import SeenStore
from tests.factories import NOW, make_call


def test_round_trip(tmp_path: Path):
    path = tmp_path / "data" / "seen.json"
    store = SeenStore(path)
    assert not store.exists
    store.add([make_call("a"), make_call("b", deadline=None)])
    store.save()

    reloaded = SeenStore(path)
    assert reloaded.exists
    assert "a" in reloaded
    assert "b" in reloaded
    assert len(reloaded) == 2


def test_prune_forgets_long_expired(tmp_path: Path):
    store = SeenStore(tmp_path / "seen.json")
    store.add([make_call("stale", deadline=NOW - timedelta(days=90)), make_call("fresh")])
    store.prune(NOW)
    assert "stale" not in store
    assert "fresh" in store
