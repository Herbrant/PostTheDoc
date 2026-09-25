"""User-facing strings of the daily digest, in Italian and English."""

from typing import TypedDict

from postthedoc.contract import Locale


class DigestStrings(TypedDict):
    tagline: str
    subject_one: str
    subject_many: str
    intro_one: str
    intro_many: str
    sector: str
    sector_unspecified: str
    positions: str
    deadline: str
    not_available: str
    footer: str
    disclaimer: str
    manage: str
    unsubscribe: str
    privacy: str
    support: str


STRINGS: dict[Locale, DigestStrings] = {
    "it": {
        "tagline": "Bandi accademici",
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
        "disclaimer": "PostTheDoc non è un servizio ufficiale del MUR: verifica sempre i dettagli "
        "sul bando originale.",
        "manage": "Modifica preferenze",
        "unsubscribe": "Disiscriviti",
        "privacy": "Informativa privacy",
        "support": "Sostieni PostTheDoc",
    },
    "en": {
        "tagline": "Academic job calls",
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
        "disclaimer": "PostTheDoc is not an official service of the Italian Ministry (MUR): "
        "always check the details in the original call.",
        "manage": "Manage preferences",
        "unsubscribe": "Unsubscribe",
        "privacy": "Privacy notice",
        "support": "Support PostTheDoc",
    },
}
