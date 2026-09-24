// Logic shared by the subscribe page (index.html) and the manage page (manage.html).

const STRINGS = {
  it: {
    title_subscribe: "PostTheDoc · Notifiche sui bandi universitari",
    title_manage: "Le tue preferenze · PostTheDoc",
    lead:
      "Ricevi un'email quando esce un nuovo bando per la tua posizione, nel tuo settore e dove vuoi " +
      "lavorare. I bandi arrivano ogni giorno da bandi.mur.gov.it.",
    email: "Email",
    email_placeholder: "nome@esempio.it",
    subscribe: "Iscriviti",
    subscribe_note:
      "Riceverai un'email per confermare l'iscrizione. Usiamo il tuo indirizzo solo per inviarti " +
      "le notifiche; puoi cancellarti in qualsiasi momento dal link presente in ogni email.",
    loading: "Caricamento…",
    preferences_for: "Preferenze per",
    save: "Salva preferenze",
    unsubscribe: "Disiscriviti",
    new_link: "Richiedi un nuovo link",
    send_link: "Invia link",
    roles: "Ruoli",
    roles_hint: "Per quali posizioni vuoi ricevere notifiche? Scegline almeno una.",
    sectors: "Settori (G.S.D.)",
    sectors_hint:
      "Nessuna selezione = tutti i settori. I codici sono quelli del DM 639/2024 (es. INF/01 → INFO-01).",
    sectors_search: "Cerca settore (es. INFO-01, informatica)…",
    include_unspecified: "Includi anche i bandi che non indicano il settore",
    location: "Luogo",
    location_hint: "Nessuna selezione = tutta Italia. Puoi combinare regioni e singoli atenei.",
    regions: "Regioni",
    institutions: "Atenei ed enti",
    institutions_search: "Cerca ateneo o ente…",
    selected: (n) => (n === 1 ? "1 selezionato" : `${n} selezionati`),
    none_selected: "Nessuna selezione",
    type_university: "Università",
    type_online_university: "Università telematiche",
    type_research_institute: "Enti di ricerca",
    type_afam: "AFAM (accademie e conservatori)",
    subscribed:
      "Fatto! Controlla la tua casella: ti abbiamo inviato un link per confermare l'iscrizione " +
      "(se eri già iscritto, riceverai invece il link per gestire le preferenze).",
    welcome: "Iscrizione confermata! Puoi rivedere qui le tue preferenze.",
    saved: "Preferenze salvate.",
    confirm_delete: "Vuoi davvero disiscriverti? I tuoi dati verranno cancellati.",
    deleted: "Disiscrizione completata: i tuoi dati sono stati cancellati.",
    link_sent: "Se l'indirizzo è iscritto, riceverai a breve un nuovo link.",
    error_invalid: "Controlla i campi del modulo.",
    error_captcha: "Verifica anti-bot non superata, riprova.",
    error_email: "Non è stato possibile inviare l'email, riprova più tardi.",
    error_unauthorized: "Il link non è valido o è scaduto.",
    error_unexpected: (status) => `Errore inatteso (${status}).`,
  },
  en: {
    title_subscribe: "PostTheDoc · Notifications about Italian academic job calls",
    title_manage: "Your preferences · PostTheDoc",
    lead:
      "Get an email when a new call opens for your position, in your field and where you want to " +
      "work. Calls are collected daily from bandi.mur.gov.it.",
    email: "Email",
    email_placeholder: "name@example.com",
    subscribe: "Subscribe",
    subscribe_note:
      "You will receive an email to confirm your subscription. We only use your address to send " +
      "you notifications; you can unsubscribe at any time from the link in every email.",
    loading: "Loading…",
    preferences_for: "Preferences for",
    save: "Save preferences",
    unsubscribe: "Unsubscribe",
    new_link: "Request a new link",
    send_link: "Send link",
    roles: "Roles",
    roles_hint: "Which positions do you want to be notified about? Pick at least one.",
    sectors: "Fields (G.S.D.)",
    sectors_hint:
      "No selection = all fields. Codes follow Italian DM 639/2024 (e.g. INF/01 → INFO-01).",
    sectors_search: "Search field (e.g. INFO-01, informatica)…",
    include_unspecified: "Also include calls that do not state a field",
    location: "Location",
    location_hint: "No selection = all of Italy. You can combine regions and single institutions.",
    regions: "Regions",
    institutions: "Universities and institutes",
    institutions_search: "Search university or institute…",
    selected: (n) => `${n} selected`,
    none_selected: "Nothing selected",
    type_university: "Universities",
    type_online_university: "Online universities",
    type_research_institute: "Research institutes",
    type_afam: "AFAM (fine arts and music academies)",
    subscribed:
      "Done! Check your inbox: we sent you a link to confirm your subscription " +
      "(if you were already subscribed, you will get a link to manage your preferences instead).",
    welcome: "Subscription confirmed! You can review your preferences here.",
    saved: "Preferences saved.",
    confirm_delete: "Do you really want to unsubscribe? Your data will be deleted.",
    deleted: "Unsubscribed: your data has been deleted.",
    link_sent: "If the address is subscribed, you will receive a new link shortly.",
    error_invalid: "Please check the form fields.",
    error_captcha: "Anti-bot check failed, please try again.",
    error_email: "The email could not be sent, please try again later.",
    error_unauthorized: "The link is invalid or has expired.",
    error_unexpected: (status) => `Unexpected error (${status}).`,
  },
};

const INSTITUTION_TYPES = ["university", "online_university", "research_institute", "afam"];
const LOCALE_KEY = "postthedoc-locale";

let locale = localStorage.getItem(LOCALE_KEY) ?? (navigator.language.startsWith("it") ? "it" : "en");
let onLocaleChange = () => {};
const t = (key, ...args) => {
  const value = STRINGS[locale][key];
  return typeof value === "function" ? value(...args) : value;
};

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    node.append(child instanceof Node ? child : document.createTextNode(child));
  }
  return node;
}

/** Apply the current locale to static text marked with data-i18n attributes. */
function applyLocale() {
  document.documentElement.lang = locale;
  document.title = t(`title_${document.body.dataset.page}`);
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
  for (const button of document.querySelectorAll("[data-lang]")) {
    button.setAttribute("aria-pressed", String(button.dataset.lang === locale));
  }
}

function setLocale(value) {
  locale = value;
  localStorage.setItem(LOCALE_KEY, value);
  applyLocale();
  onLocaleChange();
}

for (const button of document.querySelectorAll("[data-lang]")) {
  button.addEventListener("click", () => setLocale(button.dataset.lang));
}
applyLocale();

/** A list of checkboxes, optionally grouped and searchable. */
function picker(items, { searchable = false, placeholder = "", columns = false } = {}) {
  const root = el("div", { class: "picker" });
  const list = el("div", { class: columns ? "picker-list columns" : "picker-list" });
  const counter = el("p", { class: "picker-count" });
  const inputs = [];
  const groups = new Map();

  for (const item of items) {
    const input = el("input", { type: "checkbox", value: item.value });
    const label = el("label", {}, [input, " ", item.label]);
    label.dataset.search = `${item.value} ${item.label}`.toLowerCase();
    if (item.group) {
      if (!groups.has(item.group)) {
        const header = el("div", { class: "picker-group" }, item.group);
        groups.set(item.group, { header, labels: [] });
        list.append(header);
      }
      groups.get(item.group).labels.push(label);
    }
    list.append(label);
    inputs.push(input);
  }

  const updateCount = () => {
    const n = inputs.filter((i) => i.checked).length;
    counter.textContent = n ? t("selected", n) : t("none_selected");
  };
  list.addEventListener("change", updateCount);

  if (searchable) {
    const search = el("input", { type: "search", placeholder, "aria-label": placeholder });
    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      for (const input of inputs) {
        input.parentElement.hidden = q !== "" && !input.parentElement.dataset.search.includes(q);
      }
      for (const { header, labels } of groups.values()) {
        header.hidden = labels.every((l) => l.hidden);
      }
    });
    root.append(search);
  }
  root.append(list, counter);
  updateCount();

  return {
    root,
    get: () => inputs.filter((i) => i.checked).map((i) => i.value),
    set: (values) => {
      const wanted = new Set(values);
      for (const input of inputs) input.checked = wanted.has(input.value);
      updateCount();
    },
  };
}

function fieldset(legend, hint, content) {
  return el("fieldset", {}, [el("legend", {}, legend), el("p", { class: "hint" }, hint), content]);
}

/** Build the preference fields inside `container`; rebuilt with the same values on locale change. */
function preferencesForm(container, config) {
  let fields;

  const build = () => {
    const areaNames = new Map(config.sectors.areas.map((a) => [a.code, a.name[locale]]));
    const roles = picker(
      config.roles.map((r) => ({ value: r.code, label: `${r.name[locale]} — ${r.description[locale]}` })),
    );
    const sectors = picker(
      config.sectors.groups.map((g) => ({
        value: g.code,
        label: `${g.code} ${g.name}`,
        group: areaNames.get(g.area) ?? g.area,
      })),
      { searchable: true, placeholder: t("sectors_search") },
    );
    const unspecified = el("input", { type: "checkbox", checked: "" });
    const regions = picker(
      config.regions.map((r) => ({ value: r.code, label: r.name[locale] })),
      { columns: true },
    );
    const institutions = picker(
      [...config.institutions]
        .sort(
          (a, b) =>
            INSTITUTION_TYPES.indexOf(a.type) - INSTITUTION_TYPES.indexOf(b.type) ||
            a.name.localeCompare(b.name, "it"),
        )
        .map((i) => ({ value: i.code, label: i.name, group: t(`type_${i.type}`) })),
      { searchable: true, placeholder: t("institutions_search") },
    );

    container.replaceChildren(
      fieldset(t("roles"), t("roles_hint"), roles.root),
      fieldset(
        t("sectors"),
        t("sectors_hint"),
        el("div", {}, [
          sectors.root,
          el("label", { class: "inline" }, [unspecified, " ", t("include_unspecified")]),
        ]),
      ),
      fieldset(
        t("location"),
        t("location_hint"),
        el("div", {}, [
          el("h4", {}, t("regions")),
          regions.root,
          el("h4", {}, t("institutions")),
          institutions.root,
        ]),
      ),
    );

    return {
      get: () => ({
        locale,
        roles: roles.get(),
        sectors: sectors.get(),
        regions: regions.get(),
        institutions: institutions.get(),
        include_unspecified: unspecified.checked,
      }),
      set: (p) => {
        roles.set(p.roles);
        sectors.set(p.sectors);
        regions.set(p.regions);
        institutions.set(p.institutions);
        unspecified.checked = p.include_unspecified;
      },
    };
  };

  fields = build();
  return {
    get: () => fields.get(),
    set: (p) => fields.set(p),
    rebuild: () => {
      const values = fields.get();
      fields = build();
      fields.set(values);
    },
  };
}

function showMessage(node, key, kind = "info") {
  node.dataset.i18n = key; // re-translated if the locale changes
  node.textContent = t(key);
  node.className = `message ${kind}`;
  node.hidden = false;
}

function showError(node, text) {
  delete node.dataset.i18n;
  node.textContent = text;
  node.className = "message error";
  node.hidden = false;
}

async function errorText(resp) {
  const body = await resp.json().catch(() => ({}));
  const issue = body.issues?.[0];
  if (issue) return `${t("error_invalid")} (${issue.path.join(".")}: ${issue.message})`;
  return STRINGS[locale][`error_${body.error}`] ?? t("error_unexpected", resp.status);
}

async function turnstileWidget(container, sitekey) {
  while (!window.turnstile) await new Promise((r) => setTimeout(r, 50));
  let token = "";
  const id = window.turnstile.render(container, {
    sitekey,
    language: "auto",
    callback: (value) => (token = value),
    "expired-callback": () => (token = ""),
  });
  return {
    token: () => token,
    reset: () => {
      token = "";
      window.turnstile.reset(id);
    },
  };
}

function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function initSubscribe(config) {
  const form = document.getElementById("subscribe");
  const message = document.getElementById("message");
  const prefs = preferencesForm(document.getElementById("prefs"), config);
  onLocaleChange = prefs.rebuild;
  const captcha = await turnstileWidget(document.getElementById("turnstile"), config.turnstileSiteKey);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const resp = await postJson("/api/subscribe", {
        email: form.email.value,
        turnstileToken: captcha.token(),
        ...prefs.get(),
      });
      if (resp.ok) {
        showMessage(message, "subscribed", "success");
        form.hidden = true;
      } else {
        showError(message, await errorText(resp));
      }
    } finally {
      captcha.reset();
      button.disabled = false;
    }
  });
}

async function initManage(config) {
  const message = document.getElementById("message");
  const token = new URLSearchParams(location.hash.slice(1)).get("t") ?? "";
  const auth = { Authorization: `Bearer ${token}` };

  const resp = await fetch("/api/preferences", { headers: auth });
  if (!resp.ok) {
    showError(message, await errorText(resp));
    return initManageLink(config);
  }
  const current = await resp.json();
  if (current.locale !== locale) setLocale(current.locale);

  const form = document.getElementById("manage");
  document.getElementById("email").textContent = current.email;
  if (new URLSearchParams(location.search).has("welcome")) {
    showMessage(message, "welcome", "success");
  }
  const prefs = preferencesForm(document.getElementById("prefs"), config);
  prefs.set(current);
  onLocaleChange = prefs.rebuild;
  form.hidden = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const save = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json", ...auth },
      body: JSON.stringify(prefs.get()),
    });
    if (save.ok) showMessage(message, "saved", "success");
    else showError(message, await errorText(save));
  });

  document.getElementById("delete").addEventListener("click", async () => {
    if (!confirm(t("confirm_delete"))) return;
    const del = await fetch("/api/preferences", { method: "DELETE", headers: auth });
    if (del.ok) {
      form.hidden = true;
      showMessage(message, "deleted", "success");
    } else {
      showError(message, await errorText(del));
    }
  });
}

async function initManageLink(config) {
  const form = document.getElementById("manage-link");
  form.hidden = false;
  const captcha = await turnstileWidget(
    document.getElementById("turnstile-link"),
    config.turnstileSiteKey,
  );
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const resp = await postJson("/api/manage-link", {
      email: form.email.value,
      turnstileToken: captcha.token(),
    });
    captcha.reset();
    const message = document.getElementById("message");
    if (resp.ok) {
      showMessage(message, "link_sent", "success");
      form.hidden = true;
    } else {
      showError(message, await errorText(resp));
    }
  });
}

const config = await (await fetch("/api/config")).json();
if (document.body.dataset.page === "subscribe") await initSubscribe(config);
else await initManage(config);
