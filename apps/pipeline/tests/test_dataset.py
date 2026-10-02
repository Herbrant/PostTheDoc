"""The open dataset. Golden files: regenerate with `UPDATE_GOLDEN=1 uv run pytest
tests/test_dataset.py` and review the diff."""

import csv
import json
import os
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest

from postthedoc.archive import ArchivedCall
from postthedoc.dataset import Dataset, PersonalDataError, load_reviews
from postthedoc.models import CallChange
from postthedoc.reference import ReferenceData
from tests.factories import NOW

GOLDEN = Path(__file__).parent / "golden" / "dataset"
SNAPSHOT = date(2026, 10, 1)
LATER = NOW + timedelta(days=2)


def archived(call_id: str, **fields) -> ArchivedCall:
    base = {
        "id": call_id,
        "deadline": NOW + timedelta(days=10),
        "first_seen": NOW,
        "role": "researcher",
        "title": f"Call {call_id}",
        "url": f"https://bandi.mur.gov.it/{call_id}",
        "institution_name": "Univ. CATANIA",
        "institution_code": "UNICT",
        "region": "IT-82",
        "gsd": ["INFO-01", "IINF-05"],
        "positions": 2,
        "published": date(2026, 9, 20),
    }
    return ArchivedCall(**(base | fields))


CALLS = [
    archived(
        "mur-jobs-2",
        title='RTT, "rettificato"',
        deadline=NOW + timedelta(days=20),
        changes=(
            CallChange(
                at=LATER,
                field="deadline",
                old="2026-10-04T06:00:00Z",
                new="2026-10-14T06:00:00Z",
            ),
            CallChange(at=LATER, field="title", old="RTT", new='RTT, "rettificato"'),
        ),
    ),
    archived(
        "mur-doctorate-1",
        role="phd",
        deadline=None,
        institution_name="Ente sconosciuto",
        institution_code=None,
        region=None,
        gsd=[],
        positions=None,
    ),
    archived("mur-tecno-3", role="technologist", deadline=NOW - timedelta(days=1)),
    archived(
        "mur-jobs-4",
        changes=(CallChange(at=LATER, field="status", old="open", new="withdrawn"),),
    ),
    archived("mur-jobs-5", first_seen=datetime(2026, 10, 1, 6, tzinfo=UTC)),  # after the snapshot
]


@pytest.fixture
def dataset(reference: ReferenceData) -> Dataset:
    return Dataset(reference)


def rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def test_export_matches_golden(dataset: Dataset, tmp_path: Path):
    files = dataset.export(CALLS, {}, tmp_path, SNAPSHOT)

    assert sorted(f.name for f in files) == [
        "LICENSE",
        "README.md",
        "calls.csv",
        "changes.csv",
        "datapackage.json",
        "regions.csv",
        "roles.csv",
    ]
    for name in ("calls.csv", "changes.csv", "datapackage.json", "README.md", "LICENSE"):
        text = (tmp_path / name).read_text(encoding="utf-8")
        golden = GOLDEN / name
        if os.environ.get("UPDATE_GOLDEN"):
            golden.parent.mkdir(parents=True, exist_ok=True)
            golden.write_text(text, encoding="utf-8")
        assert text == golden.read_text(encoding="utf-8")


def test_status_on_the_snapshot_date(dataset: Dataset, tmp_path: Path):
    dataset.export(CALLS, {}, tmp_path, SNAPSHOT)
    status = {row["id"]: row["status"] for row in rows(tmp_path / "calls.csv")}
    assert status == {
        "mur-doctorate-1": "open",
        "mur-jobs-2": "open",
        "mur-jobs-4": "withdrawn",
        "mur-tecno-3": "closed",
    }


def test_earlier_snapshots_leave_out_later_changes(dataset: Dataset, tmp_path: Path):
    dataset.export(CALLS, {}, tmp_path, NOW.date() + timedelta(days=1))
    calls = {row["id"]: row for row in rows(tmp_path / "calls.csv")}
    assert calls["mur-jobs-4"]["status"] == "open"
    assert calls["mur-jobs-2"]["changes"] == "0"
    assert rows(tmp_path / "changes.csv") == []


def test_every_column_is_described_with_its_origin(dataset: Dataset, tmp_path: Path):
    dataset.export(CALLS, {}, tmp_path, SNAPSHOT)
    descriptor = json.loads((tmp_path / "datapackage.json").read_text())
    for resource in descriptor["resources"]:
        header = next(csv.reader((tmp_path / resource["path"]).open(encoding="utf-8")))
        fields = resource["schema"]["fields"]
        assert [f["name"] for f in fields] == header
        assert all(f["origin"] in {"source", "derived"} and f["description"] for f in fields)
    origins = {f["name"]: f["origin"] for f in descriptor["resources"][0]["schema"]["fields"]}
    assert origins["title"] == "source"
    assert origins["region"] == "derived"


def test_titles_that_may_name_someone_stop_the_export(dataset: Dataset, tmp_path: Path):
    calls = [*CALLS, archived("mur-jobs-9", title="Assegno, responsabile Prof. Rossi")]

    with pytest.raises(PersonalDataError) as info:
        dataset.export(calls, {}, tmp_path, SNAPSHOT)

    assert info.value.flagged == {"mur-jobs-9": ["title"]}
    assert "reviewed.json" in str(info.value)
    assert not (tmp_path / "calls.csv").exists()


def test_reviewed_titles_are_kept_or_omitted(dataset: Dataset, tmp_path: Path):
    calls = [
        archived("mur-jobs-8", title="Ing. Gestionale"),
        archived(
            "mur-jobs-9",
            title="Tutor: Prof. Rossi",
            changes=(
                CallChange(
                    at=LATER, field="title", old="Tutor: Prof. R.", new="Tutor: Prof. Rossi"
                ),
            ),
        ),
    ]

    dataset.export(calls, {"mur-jobs-8": "keep", "mur-jobs-9": "omit-title"}, tmp_path, SNAPSHOT)

    titles = {row["id"]: row["title"] for row in rows(tmp_path / "calls.csv")}
    assert titles == {"mur-jobs-8": "Ing. Gestionale", "mur-jobs-9": "[omesso / omitted]"}
    [change] = rows(tmp_path / "changes.csv")
    assert (change["old"], change["new"]) == ("[omesso / omitted]", "[omesso / omitted]")
    assert "Rossi" not in "".join(p.read_text() for p in tmp_path.iterdir())


@pytest.mark.parametrize(
    "title",
    [
        "Contatti: mario.rossi@unict.it",
        "Info al 095 7382000",
        "Responsabile scientifico: Mario Rossi",
        "Dott.ssa Bianchi",
    ],
)
def test_personal_data_patterns(dataset: Dataset, tmp_path: Path, title):
    with pytest.raises(PersonalDataError):
        dataset.export([archived("mur-jobs-1", title=title)], {}, tmp_path, SNAPSHOT)


@pytest.mark.parametrize(
    "title",
    [
        "1 posto di Professore Associato - G.S.D. 06/MEDS-22",
        "BANDO IR N.04 NANO PI - DFM.AD005.558 CUP B53C25006470002",
        "n. 3 contratti di ricerca art. 22 L. 240/2010 - 2026CR11",
    ],
)
def test_roles_and_codes_are_not_personal_data(dataset: Dataset, tmp_path: Path, title):
    dataset.export([archived("mur-jobs-1", title=title)], {}, tmp_path, SNAPSHOT)


def test_load_reviews(tmp_path: Path):
    assert load_reviews(tmp_path / "missing.json") == {}
    path = tmp_path / "reviewed.json"
    path.write_text('{"mur-jobs-1": "keep"}')
    assert load_reviews(path) == {"mur-jobs-1": "keep"}
