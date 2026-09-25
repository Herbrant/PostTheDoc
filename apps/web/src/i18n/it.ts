// Italian text of the web app: the reference for the other locales (see types.ts).
// `client` holds the strings used by the browser scripts (serialized into every page).
// In titles, *word* marks the words set in serif italic (see components/ui/Emph.astro).

export const it = {
  meta: {
    ogLocale: "it_IT",
    tagline: "Notifiche sui nuovi bandi accademici italiani",
    brandTagline: "Bandi accademici",
    description:
      "Ricevi un'email quando esce un nuovo bando di dottorato, assegno, post-doc, RTT o professore " +
      "nel tuo settore e dove vuoi lavorare. Gratis, senza account, open source.",
  },
  nav: {
    menu: "Menu",
    home: "Home",
    philosophy: "Perché esiste",
    subscribe: "Iscriviti",
    manage: "Gestisci iscrizione",
    skip: "Vai al contenuto",
    switchLanguage: "Read in English",
    theme: "Cambia tema chiaro/scuro",
    back: "Torna alla home",
    privacy: "Privacy",
  },
  footer: {
    label: "Piè di pagina",
    source: "I bandi provengono da",
    disclaimer:
      "PostTheDoc non è un servizio ufficiale del MUR: verifica sempre i dettagli sul bando originale.",
    code: "Codice sorgente su GitHub",
    links: "Esplora",
    tagline: "Il bando giusto, senza cercarlo ogni giorno.",
  },
  support: {
    kicker: "Sostieni",
    title: "Gratis per tutti, grazie a *chi può*.",
    lead:
      "PostTheDoc è e resterà gratuito. Se ti è utile, una donazione aiuta a coprire dominio, invio " +
      "delle email e tempo di sviluppo. È del tutto facoltativa: per chi non dona non cambia nulla.",
    coffee: "Buy Me a Coffee",
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
      cookies: "cookie",
    },
    howKicker: "Come funziona",
    howTitle: "Quattro passi, *zero* fatica.",
    howLead: "I primi due richiedono meno di un minuto; al resto penso io, ogni mattina.",
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
    filtersLead:
      "Scegli almeno una posizione e un settore; il luogo è facoltativo: senza filtri ricevi i " +
      "bandi di tutta Italia.",
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
          "Conservo solo la tua email, le tue preferenze e l'elenco dei bandi già inviati. Quando ti " +
          "disiscrivi, vengono cancellati del tutto.",
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
          "Di default no, perché potrebbero non riguardare il tuo settore. Se vuoi riceverli comunque, " +
          "attiva l'opzione nella sezione Settori.",
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
      "Scegli almeno una posizione e un settore. Il luogo è facoltativo: senza filtri ricevi i bandi " +
      "di tutta Italia.",
    emailFor: "Iscrizione per",
    change: "Modifica",
    submit: "Invia email di conferma",
    // {link} becomes a link to the privacy notice, with privacyLink as its text.
    privacy:
      "Riceverai un'email per confermare l'iscrizione: confermandola acconsenti al trattamento dei " +
      "tuoi dati descritto nell'{link}. Puoi disiscriverti in qualsiasi momento dal link presente " +
      "in ogni email: i tuoi dati verranno cancellati.",
    privacyLink: "informativa privacy",
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
    noscript:
      "Per gestire le preferenze serve JavaScript attivo nel browser. Per disiscriverti senza, usa il link in fondo a ogni email.",
    preferencesFor: "Preferenze per",
    save: "Salva preferenze",
    unsubscribe: "Disiscriviti",
    export: "Scarica i miei dati",
    linkTitle: "Gestisci la tua *iscrizione*.",
    linkLead:
      "Inserisci la tua email: se è iscritta, ti invio un link per modificare le preferenze o " +
      "disiscriverti.",
    sendLink: "Invia link",
  },
  captcha: {
    title: "Verifica anti-bot",
    hint: "Un ultimo controllo per confermare che non sei un bot.",
  },
  prefs: {
    roles: "Posizioni",
    rolesHint: "Per quali posizioni vuoi ricevere notifiche? Scegline almeno una.",
    sectors: "Settori (G.S.D.)",
    sectorsHint:
      "Scegline almeno uno, o selezionali tutti. I codici sono quelli del DM 639/2024 (es. INF/01 → " +
      "INFO-01).",
    sectorsSearch: "Cerca settore (es. INFO-01, informatica)…",
    includeUnspecified: "Includi anche i bandi che non indicano il settore",
    location: "Luogo",
    locationHint: "Nessuna selezione = tutta Italia. Puoi combinare regioni e singoli enti.",
    regions: "Regioni",
    institutions: "Università ed enti",
    institutionsSearch: "Cerca università o ente…",
    pickerSelectAll: "Seleziona tutto",
    pickerSelected: "Selezionati",
    pickerClear: "Rimuovi tutti",
    pickerNoResults: "Nessun risultato.",
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
  privacy: {
    kicker: "Privacy",
    title: "Informativa *privacy*.",
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
    remove: "Rimuovi {label}",
    welcome:
      "Iscrizione confermata! Da ora riceverai i nuovi bandi. Puoi rivedere qui le tue preferenze.",
    saved: "Preferenze salvate.",
    confirmDelete: "Vuoi davvero disiscriverti? I tuoi dati verranno cancellati.",
    deleted: "Disiscrizione completata: i tuoi dati sono stati cancellati.",
    linkSent: "Se l'indirizzo è iscritto, riceverai a breve un nuovo link.",
    errorRoles: "Scegli almeno una posizione.",
    errorSectors: "Scegli almeno un settore.",
    errorEmailFormat: "Inserisci un indirizzo email valido.",
    errorCaptchaPending: "Attendi il completamento della verifica anti-bot e riprova.",
    errorInvalid: "Controlla i campi del modulo.",
    errorCaptcha: "Verifica anti-bot non superata, riprova.",
    errorEmail: "Non è stato possibile inviare l'email, riprova più tardi.",
    errorRateLimited: "Troppe richieste in questo momento: riprova più tardi.",
    errorUnauthorized: "Il link non è valido o è scaduto: richiedine uno nuovo qui sotto.",
    errorNetwork: "Impossibile contattare il server. Controlla la connessione e riprova.",
    errorUnexpected: "Errore inatteso ({status}).",
    errorCaptchaUnavailable:
      "La verifica anti-bot non si è caricata: disattiva eventuali blocchi dei contenuti e ricarica la pagina.",
    errorFields: "Controlla: {fields}.",
    fields: {
      email: "email",
      locale: "lingua delle email",
      roles: "posizioni",
      sectors: "settori",
      regions: "regioni",
      institutions: "università ed enti",
      include_unspecified: "bandi senza settore",
    },
  },
};
