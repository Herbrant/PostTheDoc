from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Protocol

from postthedoc.models import Call


@dataclass
class FetchResult:
    calls: list[Call] = field(default_factory=list)
    # Parts of the source that could not be read (e.g. a section of the portal that was down).
    failures: list[str] = field(default_factory=list)
    # Id prefixes of the parts read in full: a seen call of theirs missing from `calls` is no
    # longer open.
    scopes: list[str] = field(default_factory=list)


class Source(Protocol):
    """A website that publishes calls."""

    @property
    def name(self) -> str:
        """Value of Call.source for the calls it returns."""
        ...

    def fetch(self) -> FetchResult:
        """The currently open calls."""
        ...

    def enrich(self, calls: Sequence[Call]) -> list[str]:
        """Fill in missing data in place (e.g. from the detail pages), setting `details` on the
        calls it read. Return the ids of the calls missing data needed to send them: they wait
        for the next run."""
        ...
