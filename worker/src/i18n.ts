// User-facing strings served by the Worker (emails and HTML pages), in Italian and English.

export const LOCALES = ["it", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const strings = {
  it: {
    confirmSubject: "Conferma la tua iscrizione a PostTheDoc",
    confirmBody: "Conferma l'iscrizione per ricevere le notifiche sui nuovi bandi.",
    confirmCta: "Conferma iscrizione",
    confirmNote: "Il link scade tra 48 ore. Se non hai richiesto l'iscrizione, ignora questa email.",
    confirmText: "Conferma l'iscrizione a PostTheDoc aprendo questo link:",
    manageSubject: "Il tuo link per gestire PostTheDoc",
    manageBody: "Ecco il link per modificare le tue preferenze o disiscriverti.",
    manageCta: "Gestisci preferenze",
    manageNote: "Se non hai richiesto tu questo link, ignora questa email.",
    manageText: "Modifica le tue preferenze PostTheDoc da questo link:",
    invalidLinkTitle: "Link non valido",
    invalidConfirm: "Il link di conferma non è valido o è scaduto.",
    subscribeAgain: "Iscriviti di nuovo",
    invalidUnsubscribe: "Il link di disiscrizione non è valido.",
    alreadyUnsubscribedTitle: "Già disiscritto",
    alreadyUnsubscribed: "Questo indirizzo non riceve più notifiche.",
    unsubscribeTitle: "Disiscrizione",
    unsubscribeQuestion:
      "Vuoi smettere di ricevere le notifiche di PostTheDoc? I tuoi dati verranno cancellati.",
    unsubscribeButton: "Disiscrivimi",
    unsubscribedTitle: "Disiscrizione completata",
    unsubscribed: "Non riceverai più email e i tuoi dati sono stati cancellati.",
  },
  en: {
    confirmSubject: "Confirm your PostTheDoc subscription",
    confirmBody: "Confirm your subscription to get notified about new calls.",
    confirmCta: "Confirm subscription",
    confirmNote:
      "The link expires in 48 hours. If you did not ask to subscribe, ignore this email.",
    confirmText: "Confirm your PostTheDoc subscription by opening this link:",
    manageSubject: "Your link to manage PostTheDoc",
    manageBody: "Here is the link to change your preferences or unsubscribe.",
    manageCta: "Manage preferences",
    manageNote: "If you did not request this link, ignore this email.",
    manageText: "Change your PostTheDoc preferences from this link:",
    invalidLinkTitle: "Invalid link",
    invalidConfirm: "The confirmation link is invalid or has expired.",
    subscribeAgain: "Subscribe again",
    invalidUnsubscribe: "The unsubscribe link is invalid.",
    alreadyUnsubscribedTitle: "Already unsubscribed",
    alreadyUnsubscribed: "This address no longer receives notifications.",
    unsubscribeTitle: "Unsubscribe",
    unsubscribeQuestion:
      "Do you want to stop receiving PostTheDoc notifications? Your data will be deleted.",
    unsubscribeButton: "Unsubscribe me",
    unsubscribedTitle: "Unsubscribed",
    unsubscribed: "You will not receive any more emails and your data has been deleted.",
  },
} satisfies Record<Locale, Record<string, string>>;

export type Strings = (typeof strings)[Locale];

export function isLocale(value: unknown): value is Locale {
  return LOCALES.includes(value as Locale);
}

/** Pick a locale from an Accept-Language header: Italian if preferred, English otherwise. */
export function pickLocale(acceptLanguage: string | undefined): Locale {
  const first = (acceptLanguage ?? "").split(",")[0].trim().toLowerCase();
  return first.startsWith("it") ? "it" : "en";
}
