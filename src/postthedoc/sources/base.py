from abc import ABC, abstractmethod

from postthedoc.models import Call


class Source(ABC):
    name: str

    @abstractmethod
    def fetch(self) -> list[Call]:
        """Return the currently open calls."""

    def enrich(self, calls: list[Call]) -> None:  # noqa: B027
        """Fill in missing data (e.g. from the detail page). Called on new calls only."""
