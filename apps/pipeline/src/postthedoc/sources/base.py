from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Protocol

from postthedoc.models import Call


@dataclass
class FetchResult:
    calls: list[Call] = field(default_factory=list)
    # Parts of the source that could not be read (e.g. a section of the portal that was down).
    failures: list[str] = field(default_factory=list)


class Source(Protocol):
    """A website that publishes calls."""

    @property
    def name(self) -> str:
        """Value of Call.source for the calls it returns."""
        ...

    def fetch(self) -> FetchResult:
        """The currently open calls."""
        ...

    def enrich(self, calls: Sequence[Call]) -> None:
        """Fill in missing data in place (e.g. from the detail pages). Called on new calls only."""
        ...
