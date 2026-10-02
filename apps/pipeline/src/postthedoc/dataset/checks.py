"""Guard against publishing personal data: the open dataset is about calls, not people.

Call titles are written by the institutions and may, rarely, name someone (a supervisor, a
contact). A title that looks like it does stops the export until a maintainer reviews it in
data/archive/reviewed.json: "keep" (a false alarm) or "omit-title" (left out of the dataset).
"""

import re
from collections.abc import Iterable, Mapping
from pathlib import Path
from typing import Literal

from pydantic import TypeAdapter

from postthedoc.archive import ArchivedCall

type Review = Literal["keep", "omit-title"]

# What a person's name or contact tends to look like in a title. Broad on purpose: a false alarm
# costs one line in reviewed.json, a miss publishes someone's name in a permanent record.
PATTERNS = {
    "email": re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),
    "phone": re.compile(r"(?<![\w./-])(?:\+39[\s.]?)?(?:0\d{1,3}|3\d{2})[\s./-]?\d{5,8}(?![\w])"),
    # Abbreviations only: "Professore Associato" is a role, "Prof. Rossi" a person.
    "title": re.compile(r"\b(?:Prof|Dott|Dr|Ing|Avv)(?:\.ssa|ssa\.|\.)\s*[A-ZÀ-Ý][a-zà-ÿ']+"),
    "supervisor": re.compile(
        r"\b(?:responsabile scientific[oa]|tutor|supervisor[e]?)\s*:", re.IGNORECASE
    ),
}

_REVIEWS = TypeAdapter(dict[str, Review])


def load_reviews(path: Path) -> dict[str, Review]:
    if not path.exists():
        return {}
    return _REVIEWS.validate_json(path.read_bytes())


def flagged(calls: Iterable[ArchivedCall]) -> dict[str, list[str]]:
    """Call id -> why its title may hold personal data, for the calls that look like it."""
    found = {}
    for call in calls:
        kinds = [kind for kind, pattern in PATTERNS.items() if pattern.search(call.title)]
        if kinds:
            found[call.id] = kinds
    return found


def unreviewed(
    calls: Iterable[ArchivedCall], reviews: Mapping[str, Review]
) -> dict[str, list[str]]:
    return {call_id: why for call_id, why in flagged(calls).items() if call_id not in reviews}
