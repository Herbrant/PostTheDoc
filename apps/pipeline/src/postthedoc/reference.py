"""Reference tables shared with the Worker and the web app (data/reference/*.json)."""

from collections.abc import Sequence
from pathlib import Path

from pydantic import BaseModel, ConfigDict, TypeAdapter

from postthedoc.contract import InstitutionType, Locale
from postthedoc.text import squash_whitespace


class _Model(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")


class LocalizedText(_Model):
    it: str
    en: str

    def get(self, locale: Locale) -> str:
        return self.it if locale == "it" else self.en


class Role(_Model):
    code: str
    name: LocalizedText
    description: LocalizedText


class Region(_Model):
    code: str  # ISO 3166-2, e.g. "IT-82"
    name: LocalizedText


class Institution(_Model):
    code: str  # MUR code, e.g. "UNICT"
    name: str  # as written on bandi.mur.gov.it
    type: InstitutionType
    region: str | None  # None for institutes spread over several regions


class SectorArea(_Model):
    code: str
    name: LocalizedText


class SectorGroup(_Model):
    """A G.S.D. (gruppo scientifico-disciplinare), e.g. INFO-01."""

    code: str
    area: str
    name: str


class Sectors(_Model):
    areas: list[SectorArea]
    groups: list[SectorGroup]


def _normalize(name: str) -> str:
    return squash_whitespace(name).casefold()


class ReferenceData:
    """The loaded tables, with the lookups the pipeline needs."""

    def __init__(
        self,
        roles: Sequence[Role],
        regions: Sequence[Region],
        institutions: Sequence[Institution],
        sectors: Sectors,
    ) -> None:
        self.roles = tuple(roles)
        self.regions = tuple(regions)
        self.institutions = tuple(institutions)
        self.sectors = sectors
        self._institutions_by_name = {_normalize(i.name): i for i in self.institutions}

    @classmethod
    def load(cls, directory: Path) -> "ReferenceData":
        def read[T](name: str, adapter: TypeAdapter[T]) -> T:
            return adapter.validate_json((directory / name).read_bytes())

        return cls(
            roles=read("roles.json", TypeAdapter(list[Role])),
            regions=read("regions.json", TypeAdapter(list[Region])),
            institutions=read("institutions.json", TypeAdapter(list[Institution])),
            sectors=read("sectors.json", TypeAdapter(Sectors)),
        )

    def find_institution(self, name: str) -> Institution | None:
        """Look up an institution by name, as it appears in bandi.mur.gov.it results."""
        return self._institutions_by_name.get(_normalize(name))

    def role_names(self, locale: Locale) -> dict[str, str]:
        """Role code -> localized name, in display order."""
        return {role.code: role.name.get(locale) for role in self.roles}

    def region_names(self, locale: Locale) -> dict[str, str]:
        return {region.code: region.name.get(locale) for region in self.regions}
