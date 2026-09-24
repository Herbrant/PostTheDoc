"""Sections of bandi.mur.gov.it: one per kind of position."""

from dataclasses import dataclass
from typing import Literal

BASE_URL = "https://bandi.mur.gov.it"

ANY = "%"  # the search forms' "any value" option
OPEN_CALLS = "2-3"  # status filter of the search forms: calls still open


@dataclass(frozen=True)
class Section:
    key: str  # path prefix, e.g. "jobs" -> /jobs.php/...
    kind: Literal["job", "fellowship"]  # the two search engines of the portal
    role: str | None  # None: the role depends on each call's qualification

    @property
    def search_url(self) -> str:
        page = "cercaJobs" if self.kind == "job" else "cercaFellowship"
        return f"{BASE_URL}/{self.key}.php/public/{page}"

    @property
    def search_params(self) -> dict[str, str]:
        status = "jv_comp_status_id" if self.kind == "job" else "jf_comp_status_id"
        return {status: OPEN_CALLS, "bb_type_code": ANY, "azione": "cerca"}


SECTIONS = (
    Section("doctorate", "fellowship", "phd"),
    Section("incarichidiricerca", "fellowship", "research_fellowship"),
    Section("incarichipostdoc", "fellowship", "postdoc_fellowship"),
    Section("contrattidiricerca", "fellowship", "research_contract"),
    Section("bandi", "fellowship", "research_grant"),
    Section("jobs", "job", "researcher"),
    Section("tecno", "job", "technologist"),
    Section("profcalls", "job", None),
)

SECTIONS_BY_KEY = {section.key: section for section in SECTIONS}
