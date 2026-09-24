// User-facing text of the frontend, in Italian and English.
// `client` holds the strings used by the browser scripts (serialized into every page).
// In titles, *word* marks the words set in serif italic (see components/Emph.astro).

export const LOCALES = ["it", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** getStaticPaths() of the pages under [lang]/. */
export const localePaths = () => LOCALES.map((lang) => ({ params: { lang } }));

const it = {
  meta: {
    tagline: "Notifiche sui nuovi bandi accademici italiani",
    brandTagline: "Bandi accademici",
    description:
      "Ricevi un'email quando esce un nuovo bando di dottorato, assegno, post-doc, RTT o professore " +
      "nel tuo settore e dove vuoi lavorare. Gratis, senza account, open source.",
  },
  nav: {
    home: "Home",
    philosophy: "Perché esiste",
    subscribe: "Iscriviti",
    manage: "Gestisci iscrizione",
    skip: "Vai al contenuto",
    switchLanguage: "Read in English",
    theme: "Cambia tema chiaro/scuro",
    back: "Torna alla home",
  },
  footer: {
    source: "I bandi provengono da",
    disclaimer:
      "PostTheDoc non è un servizio ufficiale del MUR: verifica sempre i dettagli sul bando originale.",
    code: "Codice sorgente su GitHub",
    links: "Esplora",
    tagline: "Il bando giusto, senza cercarlo ogni giorno.",
  },
  home: {
    eyebrow: "Bandi di università ed enti di ricerca italiani",
    title: "Il bando giusto, *dritto* nella tua email.",
    subtitle:
      "Dimmi che posizione cerchi, in quale settore e dove vuoi lavorare. Ogni mattina controllo i " +
      "nuovi bandi e ti scrivo solo quando ce n'è uno per te.",
    emailLabel: "La tua email",
    emailPlaceholder: "nome@universita.it",
    start: "Inizia",
    perks: ["Gratis", "Nessun account né password", "Ti cancelli con un clic"],
    demo: {
      file: "digest.eml",
      live: "ogni mattina",
      pipeline: [
        { title: "MUR", text: "nuovi bandi" },
        { title: "Filtri", text: "le tue scelte" },
        { title: "Match", text: "solo i tuoi" },
        { title: "Email", text: "un riepilogo" },
      ],
    },
    stamp: "GRATIS · OPEN SOURCE · ",
    proof: {
      roles: "posizioni",
      sectors: "settori G.S.D.",
      institutions: "enti monitorati",
      regions: "regioni",
      emails: "email al giorno, al massimo",
      trackers: "tracker",
    },
    howKicker: "Come funziona",
    howTitle: "Quattro passi, *zero* fatica.",
    howLead: "Il primo richiede meno di un minuto; al resto penso io, ogni mattina.",
    steps: [
      {
        title: "Dimmi cosa cerchi",
        text:
          "Scegli le posizioni che ti interessano, i settori scientifico-disciplinari e le regioni " +
          "o gli atenei dove vorresti lavorare.",
      },
      {
        title: "Conferma l'email",
        text: "Ti arriva un link: un clic e l'iscrizione è attiva. Nessuna password da ricordare.",
      },
      {
        title: "Ogni mattina leggo i bandi",
        text:
          "Controllo i nuovi bandi pubblicati su bandi.mur.gov.it, il portale del Ministero che " +
          "raccoglie quelli di università ed enti di ricerca.",
      },
      {
        title: "Ricevi solo quelli giusti",
        text:
          "Un'unica email riassuntiva, solo nei giorni in cui c'è qualcosa per te: ente, settore, " +
          "scadenza e link al bando ufficiale.",
      },
    ],
    filtersKicker: "Filtri",
    filtersTitle: "Scegli tu cosa *ricevere*.",
    filtersLead: "Ogni filtro è facoltativo, tranne la posizione: senza filtri ricevi tutto.",
    filters: {
      rolesTitle: "Posizioni",
      sectorsTitle: "Settori",
      sectorsText:
        "{n} gruppi scientifico-disciplinari (G.S.D.) del DM 639/2024, ad esempio INFO-01 " +
        "Informatica. Oppure tutti.",
      locationTitle: "Luogo",
      locationText:
        "Tutta Italia, alcune regioni o singoli enti: {n} tra università, università telematiche, " +
        "enti di ricerca e istituzioni AFAM.",
      languageTitle: "Lingua",
      languageText: "Email e pagine in italiano o in inglese, come preferisci.",
    },
    previewLabel: "Esempio di email",
    preview: {
      subject: "PostTheDoc: 2 nuovi bandi (24/09/2026)",
      intro: "2 nuovi bandi corrispondono alle tue preferenze (24/09/2026).",
      calls: [
        {
          role: "Ricercatore",
          title: "Procedura per 1 posto di ricercatore in tenure track",
          meta: "Univ. CATANIA · Sicilia · Settore: INFO-01",
          deadline: "Scadenza: 15/10/2026 13:00",
        },
        {
          role: "Incarico post-doc",
          title: "Incarico post-doc su metodi formali per sistemi distribuiti",
          meta: "Univ. PISA · Toscana · Settore: INFO-01",
          deadline: "Scadenza: 22/10/2026 12:00",
        },
      ],
      footer: "Gestisci preferenze · Disiscriviti",
    },
    trustKicker: "Principi",
    trustTitle: "Pensato per essere *affidabile*.",
    trust: [
      {
        title: "Gratis",
        text: "Nessun abbonamento, nessun piano a pagamento: PostTheDoc è e resterà gratuito per tutti.",
      },
      {
        title: "Niente password",
        text: "Ogni email contiene link firmati per modificare le preferenze o disiscriverti.",
      },
      {
        title: "Dati minimi",
        text:
          "Conservo solo la tua email e le tue preferenze. Quando ti disiscrivi, vengono cancellate " +
          "del tutto.",
      },
      {
        title: "Open source",
        text: "Il codice è pubblico: puoi leggerlo, verificarlo e contribuire.",
      },
    ],
    faqKicker: "FAQ",
    faqTitle: "Domande *frequenti*.",
    faq: [
      {
        q: "Da dove arrivano i bandi?",
        a:
          "Da bandi.mur.gov.it, il portale del Ministero dell'Università e della Ricerca che raccoglie i " +
          "bandi di dottorato, incarichi di ricerca e post-doc, contratti e assegni di ricerca, " +
          "posizioni da ricercatore, tecnologo e professore.",
      },
      {
        q: "Quante email riceverò?",
        a:
          "Al massimo una al giorno, e solo se ci sono nuovi bandi adatti a te. Nei giorni senza " +
          "novità non ricevi nulla.",
      },
      {
        q: "Posso cambiare le preferenze in seguito?",
        a:
          "Sì: ogni email contiene un link per modificarle. Se l'hai persa, puoi richiederne uno nuovo " +
          "dalla pagina «Gestisci iscrizione».",
      },
      {
        q: "Alcuni bandi non indicano il settore: li riceverò?",
        a:
          "Di default sì, per non farti perdere nulla. Puoi escluderli con un'opzione nella sezione " +
          "Settori.",
      },
      {
        q: "È un servizio ufficiale?",
        a:
          "No, è un progetto indipendente. Le informazioni sono riprese dal portale del MUR, ma fa " +
          "sempre fede il bando pubblicato dall'ente.",
      },
    ],
    ctaKicker: "Iscriviti",
    ctaTitle: "Il prossimo bando potrebbe uscire *domani*.",
    ctaText: "Iscriviti ora: ci vuole meno di un minuto.",
    ctaButton: "Iscriviti gratis",
  },
  subscribe: {
    title: "Iscriviti",
    kicker: "Iscrizione",
    stepLabels: ["Email", "Preferenze", "Conferma"],
    emailTitle: "Dove ti *scrivo*?",
    emailLead: "Userò il tuo indirizzo solo per inviarti le notifiche sui bandi.",
    continue: "Continua",
    prefsTitle: "Cosa ti *interessa*?",
    prefsLead:
      "Scegli almeno una posizione. Settori e luogo sono facoltativi: senza filtri ricevi i bandi di " +
      "tutti i settori, in tutta Italia.",
    emailFor: "Iscrizione per",
    change: "Modifica",
    submit: "Invia email di conferma",
    privacy:
      "Riceverai un'email per confermare l'iscrizione. Puoi disiscriverti in qualsiasi momento dal " +
      "link presente in ogni email: i tuoi dati verranno cancellati.",
    doneTitle: "Controlla la tua *casella*.",
    doneText:
      "Ho inviato un link di conferma a {email}. Aprilo entro 48 ore per attivare le notifiche.",
    doneHint:
      "Non la trovi? Guarda nello spam o nelle promozioni. Se eri già iscritto, riceverai invece il " +
      "link per gestire le preferenze.",
    backHome: "Torna alla home",
    noscript: "Per iscriverti serve JavaScript attivo nel browser.",
  },
  manage: {
    title: "Le tue *preferenze*.",
    kicker: "Gestione",
    preferencesFor: "Preferenze per",
    save: "Salva preferenze",
    unsubscribe: "Disiscriviti",
    linkTitle: "Gestisci la tua *iscrizione*.",
    linkLead:
      "Inserisci la tua email: se è iscritta, ti invio un link per modificare le preferenze o " +
      "disiscriverti.",
    sendLink: "Invia link",
  },
  prefs: {
    roles: "Posizioni",
    rolesHint: "Per quali posizioni vuoi ricevere notifiche? Scegline almeno una.",
    sectors: "Settori (G.S.D.)",
    sectorsHint:
      "Nessuna selezione = tutti i settori. I codici sono quelli del DM 639/2024 (es. INF/01 → INFO-01).",
    sectorsSearch: "Cerca settore (es. INFO-01, informatica)…",
    includeUnspecified: "Includi anche i bandi che non indicano il settore",
    location: "Luogo",
    locationHint: "Nessuna selezione = tutta Italia. Puoi combinare regioni e singoli enti.",
    regions: "Regioni",
    institutions: "Università ed enti",
    institutionsSearch: "Cerca università o ente…",
    language: "Lingua delle email",
    optional: "facoltativo",
    institutionTypes: {
      university: "Università",
      online_university: "Università telematiche",
      research_institute: "Enti di ricerca",
      afam: "AFAM (accademie e conservatori)",
    },
    languages: { it: "Italiano", en: "English" },
  },
  philosophy: {
    kicker: "Philosophy",
    title: "Perché *esiste*.",
  },
  notFound: {
    title: "Pagina non *trovata*.",
    text: "La pagina che cerchi non esiste o è stata spostata.",
  },
  client: {
    allSectors: "Tutti i settori",
    allItaly: "Tutta Italia",
    selectedOne: "1 selezionato",
    selectedMany: "{n} selezionati",
    sending: "Invio in corso…",
    welcome: "Iscrizione confermata! Da ora riceverai i nuovi bandi. Puoi rivedere qui le tue preferenze.",
    saved: "Preferenze salvate.",
    confirmDelete: "Vuoi davvero disiscriverti? I tuoi dati verranno cancellati.",
    deleted: "Disiscrizione completata: i tuoi dati sono stati cancellati.",
    linkSent: "Se l'indirizzo è iscritto, riceverai a breve un nuovo link.",
    errorRoles: "Scegli almeno una posizione.",
    errorEmailFormat: "Inserisci un indirizzo email valido.",
    errorCaptchaPending: "Attendi il completamento della verifica anti-bot e riprova.",
    errorInvalid: "Controlla i campi del modulo.",
    errorCaptcha: "Verifica anti-bot non superata, riprova.",
    errorEmail: "Non è stato possibile inviare l'email, riprova più tardi.",
    errorUnauthorized: "Il link non è valido o è scaduto: richiedine uno nuovo qui sotto.",
    errorNetwork: "Impossibile contattare il server. Controlla la connessione e riprova.",
    errorUnexpected: "Errore inatteso ({status}).",
  },
};

export type Strings = typeof it;
export type ClientStrings = Strings["client"];

const en: Strings = {
  meta: {
    tagline: "Notifications about new Italian academic job calls",
    brandTagline: "Academic job calls",
    description:
      "Get an email when a new PhD, fellowship, postdoc, tenure-track or professor call opens in " +
      "your field and where you want to work in Italy. Free, no account, open source.",
  },
  nav: {
    home: "Home",
    philosophy: "Why this exists",
    subscribe: "Subscribe",
    manage: "Manage subscription",
    skip: "Skip to content",
    switchLanguage: "Leggi in italiano",
    theme: "Toggle light/dark theme",
    back: "Back to the home page",
  },
  footer: {
    source: "Calls are collected from",
    disclaimer:
      "PostTheDoc is not an official service of the Italian Ministry (MUR): always check the " +
      "details in the original call.",
    code: "Source code on GitHub",
    links: "Explore",
    tagline: "The right call, without searching for it every day.",
  },
  home: {
    eyebrow: "Calls from Italian universities and research institutes",
    title: "The right call, *straight* to your inbox.",
    subtitle:
      "Tell me which position you are after, in which field and where you want to work. Every " +
      "morning I check the new calls and write to you only when there is one for you.",
    emailLabel: "Your email",
    emailPlaceholder: "name@university.edu",
    start: "Get started",
    perks: ["Free", "No account, no password", "Unsubscribe in one click"],
    demo: {
      file: "digest.eml",
      live: "every morning",
      pipeline: [
        { title: "MUR", text: "new calls" },
        { title: "Filters", text: "your choices" },
        { title: "Match", text: "only yours" },
        { title: "Email", text: "one digest" },
      ],
    },
    stamp: "FREE · OPEN SOURCE · ",
    proof: {
      roles: "positions",
      sectors: "G.S.D. fields",
      institutions: "institutions tracked",
      regions: "regions",
      emails: "email a day, at most",
      trackers: "trackers",
    },
    howKicker: "How it works",
    howTitle: "Four steps, *zero* hassle.",
    howLead: "The first one takes less than a minute; I take care of the rest, every morning.",
    steps: [
      {
        title: "Tell me what you are looking for",
        text:
          "Pick the positions you care about, your scientific fields and the regions or " +
          "universities where you would like to work.",
      },
      {
        title: "Confirm your email",
        text: "You get a link: one click and you are in. No password to remember.",
      },
      {
        title: "Every morning I read the calls",
        text:
          "I check the new calls published on bandi.mur.gov.it, the Ministry portal that collects " +
          "those of Italian universities and research institutes.",
      },
      {
        title: "Get only the relevant ones",
        text:
          "One digest email, only on the days when there is something for you: institution, field, " +
          "deadline and a link to the official call.",
      },
    ],
    filtersKicker: "Filters",
    filtersTitle: "You choose what you *get*.",
    filtersLead: "Every filter is optional except the position: with no filters you get everything.",
    filters: {
      rolesTitle: "Positions",
      sectorsTitle: "Fields",
      sectorsText:
        "{n} scientific-disciplinary groups (G.S.D.) from Italian DM 639/2024, e.g. INFO-01 " +
        "Computer science. Or all of them.",
      locationTitle: "Location",
      locationText:
        "All of Italy, some regions or single institutions: {n} universities, online universities, " +
        "research institutes and fine arts and music academies.",
      languageTitle: "Language",
      languageText: "Emails and pages in English or Italian, as you prefer.",
    },
    previewLabel: "Sample email",
    preview: {
      subject: "PostTheDoc: 2 new calls (24/09/2026)",
      intro: "2 new calls match your preferences (24/09/2026).",
      calls: [
        {
          role: "Researcher",
          title: "Call for 1 tenure-track researcher position",
          meta: "Univ. CATANIA · Sicily · Field: INFO-01",
          deadline: "Deadline: 15/10/2026 13:00",
        },
        {
          role: "Postdoc fellowship",
          title: "Postdoc fellowship on formal methods for distributed systems",
          meta: "Univ. PISA · Tuscany · Field: INFO-01",
          deadline: "Deadline: 22/10/2026 12:00",
        },
      ],
      footer: "Manage preferences · Unsubscribe",
    },
    trustKicker: "Principles",
    trustTitle: "Built to be *trustworthy*.",
    trust: [
      {
        title: "Free",
        text: "No subscriptions, no paid plans: PostTheDoc is and will stay free for everyone.",
      },
      {
        title: "No password",
        text: "Every email carries signed links to change your preferences or unsubscribe.",
      },
      {
        title: "Minimal data",
        text:
          "I only keep your email and your preferences. When you unsubscribe, they are deleted " +
          "entirely.",
      },
      {
        title: "Open source",
        text: "The code is public: you can read it, check it and contribute.",
      },
    ],
    faqKicker: "FAQ",
    faqTitle: "Frequently asked *questions*.",
    faq: [
      {
        q: "Where do the calls come from?",
        a:
          "From bandi.mur.gov.it, the portal of the Italian Ministry of University and Research that " +
          "collects calls for PhDs, research and postdoc fellowships, research contracts and grants, " +
          "researcher, technologist and professor positions.",
      },
      {
        q: "How many emails will I get?",
        a:
          "At most one a day, and only if there are new calls that fit you. On days with nothing new " +
          "you get nothing.",
      },
      {
        q: "Can I change my preferences later?",
        a:
          "Yes: every email has a link to change them. If you lost it, you can request a new one from " +
          "the “Manage subscription” page.",
      },
      {
        q: "Some calls do not state a field: will I get them?",
        a:
          "By default yes, so that you do not miss anything. You can exclude them with an option in " +
          "the Fields section.",
      },
      {
        q: "Is this an official service?",
        a:
          "No, it is an independent project. The information comes from the Ministry portal, but the " +
          "call published by the institution is always the reference.",
      },
    ],
    ctaKicker: "Subscribe",
    ctaTitle: "The next call could open *tomorrow*.",
    ctaText: "Subscribe now: it takes less than a minute.",
    ctaButton: "Subscribe for free",
  },
  subscribe: {
    title: "Subscribe",
    kicker: "Subscription",
    stepLabels: ["Email", "Preferences", "Confirm"],
    emailTitle: "Where should I *write* to you?",
    emailLead: "I will only use your address to send you notifications about new calls.",
    continue: "Continue",
    prefsTitle: "What are you *interested* in?",
    prefsLead:
      "Pick at least one position. Fields and location are optional: with no filters you get calls " +
      "from every field, all over Italy.",
    emailFor: "Subscribing",
    change: "Change",
    submit: "Send confirmation email",
    privacy:
      "You will receive an email to confirm your subscription. You can unsubscribe at any time from " +
      "the link in every email: your data will be deleted.",
    doneTitle: "Check your *inbox*.",
    doneText:
      "I sent a confirmation link to {email}. Open it within 48 hours to turn on your notifications.",
    doneHint:
      "Can't find it? Look in your spam or promotions folder. If you were already subscribed, you " +
      "will get a link to manage your preferences instead.",
    backHome: "Back to the home page",
    noscript: "Subscribing requires JavaScript to be enabled in your browser.",
  },
  manage: {
    title: "Your *preferences*.",
    kicker: "Manage",
    preferencesFor: "Preferences for",
    save: "Save preferences",
    unsubscribe: "Unsubscribe",
    linkTitle: "Manage your *subscription*.",
    linkLead:
      "Enter your email: if it is subscribed, I will send you a link to change your preferences or " +
      "unsubscribe.",
    sendLink: "Send link",
  },
  prefs: {
    roles: "Positions",
    rolesHint: "Which positions do you want to be notified about? Pick at least one.",
    sectors: "Fields (G.S.D.)",
    sectorsHint:
      "No selection = all fields. Codes follow Italian DM 639/2024 (e.g. INF/01 → INFO-01).",
    sectorsSearch: "Search field (e.g. INFO-01, informatica)…",
    includeUnspecified: "Also include calls that do not state a field",
    location: "Location",
    locationHint: "No selection = all of Italy. You can combine regions and single institutions.",
    regions: "Regions",
    institutions: "Universities and institutes",
    institutionsSearch: "Search university or institute…",
    language: "Email language",
    optional: "optional",
    institutionTypes: {
      university: "Universities",
      online_university: "Online universities",
      research_institute: "Research institutes",
      afam: "AFAM (fine arts and music academies)",
    },
    languages: { it: "Italiano", en: "English" },
  },
  philosophy: {
    kicker: "Philosophy",
    title: "Why this *exists*.",
  },
  notFound: {
    title: "Page not *found*.",
    text: "The page you are looking for does not exist or has been moved.",
  },
  client: {
    allSectors: "All fields",
    allItaly: "All of Italy",
    selectedOne: "1 selected",
    selectedMany: "{n} selected",
    sending: "Sending…",
    welcome:
      "Subscription confirmed! From now on you will receive new calls. You can review your " +
      "preferences here.",
    saved: "Preferences saved.",
    confirmDelete: "Do you really want to unsubscribe? Your data will be deleted.",
    deleted: "Unsubscribed: your data has been deleted.",
    linkSent: "If the address is subscribed, you will receive a new link shortly.",
    errorRoles: "Pick at least one position.",
    errorEmailFormat: "Please enter a valid email address.",
    errorCaptchaPending: "Wait for the anti-bot check to complete and try again.",
    errorInvalid: "Please check the form fields.",
    errorCaptcha: "Anti-bot check failed, please try again.",
    errorEmail: "The email could not be sent, please try again later.",
    errorUnauthorized: "The link is invalid or has expired: request a new one below.",
    errorNetwork: "Could not reach the server. Check your connection and try again.",
    errorUnexpected: "Unexpected error ({status}).",
  },
};

export const strings: Record<Locale, Strings> = { it, en };

/** Remove the *emphasis* markers, e.g. for <title>. */
export const plain = (text: string) => text.replace(/\*/g, "");

/** Replace {name} placeholders, e.g. format("{n} selected", { n: 3 }). */
export function format(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => String(values[key] ?? match));
}
