import type { Strings } from "./types";

export const en: Strings = {
  meta: {
    ogLocale: "en_US",
    tagline: "Notifications about new Italian academic job calls",
    brandTagline: "Academic job calls",
    description:
      "Get an email when a new PhD, fellowship, postdoc, tenure-track or professor call opens in " +
      "your field and where you want to work in Italy. Free, no account, open source.",
  },
  nav: {
    menu: "Menu",
    home: "Home",
    philosophy: "Why this exists",
    subscribe: "Subscribe",
    manage: "Manage subscription",
    skip: "Skip to content",
    switchLanguage: "Leggi in italiano",
    theme: "Toggle light/dark theme",
    back: "Back to the home page",
    privacy: "Privacy",
  },
  footer: {
    label: "Footer",
    source: "Calls are collected from",
    disclaimer:
      "PostTheDoc is not an official service of the Italian Ministry (MUR): always check the " +
      "details in the original call.",
    code: "Source code on GitHub",
    links: "Explore",
    tagline: "The right call, without searching for it every day.",
  },
  support: {
    kicker: "Support",
    title: "Free for everyone, thanks to *those who can*.",
    lead:
      "PostTheDoc is and will stay free. If it helps you, a donation covers the domain, email " +
      "delivery and development time. It is entirely optional: nothing changes if you do not donate.",
    sponsors: "GitHub Sponsors",
    coffee: "Buy Me a Coffee",
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
      cookies: "cookies",
    },
    howKicker: "How it works",
    howTitle: "Four steps, *zero* hassle.",
    howLead: "The first two take less than a minute; I take care of the rest, every morning.",
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
    filtersLead:
      "Every filter is optional except the position: with no filters you get everything.",
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
          "I only keep your email, your preferences and the list of calls already sent to you. When " +
          "you unsubscribe, they are deleted entirely.",
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
      "You will receive an email to confirm your subscription: by confirming it you agree to the " +
      "processing of your data described in the {link}. You can unsubscribe at any time from the " +
      "link in every email: your data will be deleted.",
    privacyLink: "privacy notice",
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
    export: "Download my data",
    linkTitle: "Manage your *subscription*.",
    linkLead:
      "Enter your email: if it is subscribed, I will send you a link to change your preferences or " +
      "unsubscribe.",
    sendLink: "Send link",
  },
  captcha: {
    title: "Anti-bot check",
    hint: "One last check to confirm you are not a bot.",
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
    pickerSelectAll: "Select all",
    pickerSelected: "Selected",
    pickerClear: "Clear all",
    pickerNoResults: "No results.",
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
  privacy: {
    kicker: "Privacy",
    title: "Privacy *notice*.",
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
    remove: "Remove {label}",
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
    errorCaptchaUnavailable:
      "The anti-bot check did not load: disable any content blocker and reload the page.",
    errorFields: "Please check: {fields}.",
    fields: {
      email: "email",
      locale: "email language",
      roles: "positions",
      sectors: "fields",
      regions: "regions",
      institutions: "universities and institutes",
      include_unspecified: "calls without a field",
    },
  },
};
