"""User-facing strings of the daily digest, in Italian and English."""

from typing import TypedDict

from postthedoc.contract import Locale


class DigestStrings(TypedDict):
    tagline: str
    subject: str
    new_one: str
    new_many: str
    updated_one: str
    updated_many: str
    new_and_updated: str
    intro_one: str
    intro_many: str
    intro_updates_one: str
    intro_updates_many: str
    updates_heading: str
    updates_note: str
    change_deadline_extended: str
    change_deadline_brought_forward: str
    change_title: str
    change_positions: str
    change_withdrawn: str
    change_reopened: str
    sector: str
    sector_unspecified: str
    positions: str
    deadline: str
    not_available: str
    footer: str
    disclaimer: str
    no_reply: str
    manage: str
    unsubscribe: str
    privacy: str
    support: str
    donate_text: str
    donate_cta: str
    issues: str


STRINGS: dict[Locale, DigestStrings] = {
    "it": {
        "tagline": "Bandi accademici",
        "subject": "PostTheDoc: {summary} ({date})",
        "new_one": "1 nuovo bando",
        "new_many": "{count} nuovi bandi",
        "updated_one": "1 bando aggiornato",
        "updated_many": "{count} bandi aggiornati",
        "new_and_updated": "{new} e {updated}",
        "intro_one": "1 nuovo bando corrisponde alle tue preferenze ({date}).",
        "intro_many": "{count} nuovi bandi corrispondono alle tue preferenze ({date}).",
        "intro_updates_one": "1 bando che ti abbiamo segnalato è cambiato ({date}).",
        "intro_updates_many": "{count} bandi che ti abbiamo segnalato sono cambiati ({date}).",
        "updates_heading": "Bandi aggiornati",
        "updates_note": "Bandi che ti abbiamo già segnalato e che sono cambiati sul portale del "
        "MUR.",
        "change_deadline_extended": "Scadenza prorogata: {old} → {new}",
        "change_deadline_brought_forward": "Scadenza anticipata: {old} → {new}",
        "change_title": "Titolo modificato, prima era: «{old}»",
        "change_positions": "Posti: {old} → {new}",
        "change_withdrawn": "Non è più tra i bandi aperti del portale del MUR, prima della "
        "scadenza: potrebbe essere stato revocato, sospeso o chiuso. Verifica sul sito dell'ente.",
        "change_reopened": "È di nuovo tra i bandi aperti del portale del MUR.",
        "sector": "Settore",
        "sector_unspecified": "non indicato",
        "positions": "Posti",
        "deadline": "Scadenza",
        "not_available": "n.d.",
        "footer": "Ricevi questa email perché sei iscritto a PostTheDoc. Fonte: bandi.mur.gov.it.",
        "disclaimer": "PostTheDoc non è un servizio ufficiale del MUR: verifica sempre i dettagli "
        "sul bando originale.",
        "no_reply": "Questa email è inviata in automatico: le risposte non vengono lette.",
        "manage": "Modifica preferenze",
        "unsubscribe": "Disiscriviti",
        "privacy": "Informativa privacy",
        "support": "Sostieni PostTheDoc",
        "donate_text": "PostTheDoc è gratuito e lo resterà. Se ti è utile, una donazione aiuta a "
        "coprire dominio, invio delle email e tempo di sviluppo.",
        "donate_cta": "Sostieni il progetto",
        "issues": "Segnalazioni su GitHub",
    },
    "en": {
        "tagline": "Academic job calls",
        "subject": "PostTheDoc: {summary} ({date})",
        "new_one": "1 new call",
        "new_many": "{count} new calls",
        "updated_one": "1 updated call",
        "updated_many": "{count} updated calls",
        "new_and_updated": "{new} and {updated}",
        "intro_one": "1 new call matches your preferences ({date}).",
        "intro_many": "{count} new calls match your preferences ({date}).",
        "intro_updates_one": "1 call we sent you has changed ({date}).",
        "intro_updates_many": "{count} calls we sent you have changed ({date}).",
        "updates_heading": "Updated calls",
        "updates_note": "Calls we already sent you that changed on the MUR portal.",
        "change_deadline_extended": "Deadline extended: {old} → {new}",
        "change_deadline_brought_forward": "Deadline brought forward: {old} → {new}",
        "change_title": "Title changed, it was: “{old}”",
        "change_positions": "Positions: {old} → {new}",
        "change_withdrawn": "No longer among the open calls on the MUR portal, before its "
        "deadline: it may have been withdrawn, suspended or closed. Check the institution's "
        "website.",
        "change_reopened": "Back among the open calls on the MUR portal.",
        "sector": "Sector",
        "sector_unspecified": "not specified",
        "positions": "Positions",
        "deadline": "Deadline",
        "not_available": "n/a",
        "footer": "You receive this email because you subscribed to PostTheDoc. "
        "Source: bandi.mur.gov.it.",
        "disclaimer": "PostTheDoc is not an official service of the Italian Ministry (MUR): "
        "always check the details in the original call.",
        "no_reply": "This email is sent automatically: replies are not read.",
        "manage": "Manage preferences",
        "unsubscribe": "Unsubscribe",
        "privacy": "Privacy notice",
        "support": "Support PostTheDoc",
        "donate_text": "PostTheDoc is free and will stay free. If it helps you, a donation covers "
        "the domain, email delivery and development time.",
        "donate_cta": "Support the project",
        "issues": "Report a problem on GitHub",
    },
}
