"""Small text and collection helpers used by the scrapers."""

from collections.abc import Hashable, Iterable


def squash_whitespace(text: str) -> str:
    """Collapse runs of whitespace (including newlines) into single spaces."""
    return " ".join(text.split())


def unique[T: Hashable](items: Iterable[T]) -> list[T]:
    """Remove duplicates, keeping the first occurrence of each item."""
    return list(dict.fromkeys(items))
