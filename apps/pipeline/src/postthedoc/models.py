"""The two entities the pipeline works with: calls for applications and subscribers."""

from datetime import datetime

from pydantic import BaseModel, Field

from postthedoc.contract import Locale


class Call(BaseModel):
    """A call for applications (a "bando")."""

    id: str  # e.g. "mur-jobs-152404", stable across runs
    source: str  # name of the Source that found it
    role: str  # code from data/reference/roles.json
    title: str
    url: str
    institution_name: str
    institution_code: str | None = None
    region: str | None = None  # ISO 3166-2 code, e.g. "IT-82"
    ssd: list[str] = Field(default_factory=list)  # e.g. ["IINF-05/A"]
    gsd: list[str] = Field(default_factory=list)  # e.g. ["IINF-05"]
    deadline: datetime | None = None
    positions: int | None = None


class User(BaseModel):
    """An active subscriber and their preferences."""

    id: str
    email: str
    locale: Locale = "it"
    token_version: int = 0
    roles: list[str] = Field(default_factory=list)
    sectors: list[str] = Field(default_factory=list)  # G.S.D. codes
    regions: list[str] = Field(default_factory=list)
    institutions: list[str] = Field(default_factory=list)  # MUR institution codes
    include_unspecified: bool = False  # calls without a sector match any sector filter
