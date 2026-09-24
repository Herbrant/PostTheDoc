from abc import ABC, abstractmethod

from postthedoc.models import Bando


class Source(ABC):
    name: str

    @abstractmethod
    def fetch(self) -> list[Bando]:
        """Restituisce i bandi attualmente aperti."""

    def enrich(self, bandi: list[Bando]) -> None:  # noqa: B027
        """Completa i dati mancanti (es. dalla pagina di dettaglio). Solo sui bandi nuovi."""
