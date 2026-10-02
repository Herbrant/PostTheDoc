"""The entities the pipeline works with: calls for applications, their changes, subscribers."""

from collections.abc import Iterable
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from postthedoc.contract import Locale

type ChangeField = Literal["deadline", "title", "positions", "status"]
# Values of a "status" change.
OPEN = "open"
WITHDRAWN = "withdrawn"  # no longer among the open calls, before its deadline


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
    published: date | None = None  # "Data del bando", from the detail page
    details: bool = False  # whether its detail page was read


class CallChange(BaseModel):
    """Something that changed in a call already seen, found by comparing two daily runs."""

    model_config = ConfigDict(frozen=True)

    at: datetime  # the run that found it
    field: ChangeField
    old: str | int | None  # deadlines as ISO 8601 strings
    new: str | int | None


def is_withdrawn(changes: Iterable[CallChange]) -> bool:
    """Whether the last change to a call's status took it out of the open calls."""
    status = [c.new for c in changes if c.field == "status"]
    return bool(status) and status[-1] == WITHDRAWN


class CallUpdate(BaseModel):
    """A call already sent to someone, as it is now, and what changed since."""

    id: str
    title: str
    url: str
    institution_name: str
    region: str | None = None
    deadline: datetime | None = None
    changes: list[CallChange]


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
