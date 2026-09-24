"""User-facing strings of the daily digest, in Italian and English."""

from postthedoc.models import Locale

STRINGS: dict[Locale, dict[str, str]] = {
    "it": {
        "subject_one": "PostTheDoc: 1 nuovo bando ({date})",
        "subject_many": "PostTheDoc: {count} nuovi bandi ({date})",
        "intro_one": "1 nuovo bando corrisponde alle tue preferenze ({date}).",
        "intro_many": "{count} nuovi bandi corrispondono alle tue preferenze ({date}).",
        "sector": "Settore",
        "sector_unspecified": "non indicato",
        "positions": "Posti",
        "deadline": "Scadenza",
        "not_available": "n.d.",
        "footer": "Ricevi questa email perché sei iscritto a PostTheDoc. Fonte: bandi.mur.gov.it.",
        "manage": "Modifica preferenze",
        "unsubscribe": "Disiscriviti",
        "privacy": "Informativa privacy",
    },
    "en": {
        "subject_one": "PostTheDoc: 1 new call ({date})",
        "subject_many": "PostTheDoc: {count} new calls ({date})",
        "intro_one": "1 new call matches your preferences ({date}).",
        "intro_many": "{count} new calls match your preferences ({date}).",
        "sector": "Sector",
        "sector_unspecified": "not specified",
        "positions": "Positions",
        "deadline": "Deadline",
        "not_available": "n/a",
        "footer": "You receive this email because you subscribed to PostTheDoc. "
        "Source: bandi.mur.gov.it.",
        "manage": "Manage preferences",
        "unsubscribe": "Unsubscribe",
        "privacy": "Privacy notice",
    },
}
