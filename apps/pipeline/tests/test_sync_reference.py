import json
import shutil
from pathlib import Path

import httpx
import respx

from postthedoc.config import data_dir
from postthedoc.maintenance.sync_reference import sync_reference
from postthedoc.sources.mur import SECTIONS

MENUS = """<form>
<select name="bb_type_code">
  <option value="%">Tutti</option>
  <option value="UNICT">Univ.   CATANIA</option>
  <option value="NEWU">Univ. NUOVA</option>
</select>
<select name="idgsd24">
  <option value="%">Tutti</option>
  <option value="01/INFO-01">INFO-01 - INFORMATICA</option>
  <option value="99/NEWS-01">NEWS-01 - NUOVO SETTORE</option>
  <option value="broken">broken</option>
</select>
</form>"""


@respx.mock
def test_sync_reference(tmp_path: Path):
    reference_dir = tmp_path / "reference"
    shutil.copytree(data_dir() / "reference", reference_dir)
    for section in SECTIONS:
        respx.get(section.search_url).mock(return_value=httpx.Response(200, text=MENUS))

    missing = sync_reference(httpx.Client(), reference_dir)

    assert "NEWU" in {i.code for i in missing}
    institutions = json.loads((reference_dir / "institutions.json").read_text())
    new = next(i for i in institutions if i["code"] == "NEWU")
    assert new == {"code": "NEWU", "name": "Univ. NUOVA", "type": "university", "region": None}
    sectors = json.loads((reference_dir / "sectors.json").read_text())
    assert {"code": "NEWS-01", "area": "99", "name": "Nuovo settore"} in sectors["groups"]
    assert "99" in {a["code"] for a in sectors["areas"]}


@respx.mock
def test_sync_keeps_files_byte_identical_when_nothing_changes(tmp_path: Path):
    reference_dir = tmp_path / "reference"
    shutil.copytree(data_dir() / "reference", reference_dir)
    for section in SECTIONS:
        respx.get(section.search_url).mock(return_value=httpx.Response(200, text="<form></form>"))

    sync_reference(httpx.Client(), reference_dir)

    for name in ("institutions.json", "sectors.json"):
        assert (reference_dir / name).read_bytes() == (data_dir() / "reference" / name).read_bytes()
