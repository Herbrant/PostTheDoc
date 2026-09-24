// Logica condivisa tra la pagina di iscrizione (index.html) e quella di gestione (manage.html).

const TIPI = {
  universita: "Università",
  universita_telematica: "Università telematiche",
  ente_ricerca: "Enti di ricerca",
  afam: "AFAM (accademie e conservatori)",
};

const ERRORS = {
  invalid: "Controlla i campi del modulo.",
  captcha: "Verifica anti-bot non superata, riprova.",
  email: "Non è stato possibile inviare l'email, riprova più tardi.",
  unauthorized: "Il link non è valido o è scaduto.",
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

/** Lista di checkbox, opzionalmente raggruppata e filtrabile. */
function picker(items, { searchable = false, placeholder = "Cerca…", columns = false } = {}) {
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
    counter.textContent = n ? `${n} selezionati` : "Nessuna selezione";
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

/** Costruisce i campi delle preferenze dentro `container` e restituisce get/set. */
function preferencesForm(container, config) {
  const roles = picker(
    config.ruoli.map((r) => ({ value: r.code, label: `${r.name} — ${r.description}` })),
  );
  const sectors = picker(
    config.settori.gsd.map((g) => ({
      value: g.code,
      label: `${g.code} ${g.name}`,
      group: config.settori.aree.find((a) => a.code === g.area)?.name ?? g.area,
    })),
    { searchable: true, placeholder: "Cerca settore (es. INFO-01, informatica)…" },
  );
  const unspecified = el("input", { type: "checkbox", checked: "" });
  const regions = picker(
    config.regioni.map((r) => ({ value: r.code, label: r.name })),
    { columns: true },
  );
  const strutture = [...config.strutture].sort(
    (a, b) =>
      Object.keys(TIPI).indexOf(a.tipo) - Object.keys(TIPI).indexOf(b.tipo) ||
      a.name.localeCompare(b.name, "it"),
  );
  const universities = picker(
    strutture.map((s) => ({ value: s.code, label: s.name, group: TIPI[s.tipo] })),
    { searchable: true, placeholder: "Cerca ateneo o ente…" },
  );

  container.replaceChildren(
    fieldset("Ruoli", "Per quali posizioni vuoi ricevere notifiche? Scegline almeno una.", roles.root),
    fieldset(
      "Settori (G.S.D.)",
      "Nessuna selezione = tutti i settori. I codici sono quelli del DM 639/2024 (es. INF/01 → INFO-01).",
      el("div", {}, [
        sectors.root,
        el("label", { class: "inline" }, [
          unspecified,
          " Includi anche i bandi che non indicano il settore",
        ]),
      ]),
    ),
    fieldset(
      "Luogo",
      "Nessuna selezione = tutta Italia. Puoi combinare regioni e singoli atenei.",
      el("div", {}, [el("h4", {}, "Regioni"), regions.root, el("h4", {}, "Atenei ed enti"), universities.root]),
    ),
  );

  return {
    get: () => ({
      roles: roles.get(),
      sectors: sectors.get(),
      regions: regions.get(),
      universities: universities.get(),
      include_unspecified: unspecified.checked,
    }),
    set: (p) => {
      roles.set(p.roles);
      sectors.set(p.sectors);
      regions.set(p.regions);
      universities.set(p.universities);
      unspecified.checked = p.include_unspecified;
    },
  };
}

function showMessage(node, text, kind = "info") {
  node.textContent = text;
  node.className = `message ${kind}`;
  node.hidden = false;
}

async function errorText(resp) {
  const body = await resp.json().catch(() => ({}));
  const issue = body.issues?.[0];
  if (issue) return `${ERRORS.invalid} (${issue.path.join(".")}: ${issue.message})`;
  return ERRORS[body.error] ?? `Errore inatteso (${resp.status}).`;
}

async function turnstileWidget(container, sitekey) {
  while (!window.turnstile) await new Promise((r) => setTimeout(r, 50));
  let token = "";
  const id = window.turnstile.render(container, {
    sitekey,
    language: "it",
    callback: (t) => (token = t),
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
        showMessage(
          message,
          "Fatto! Controlla la tua casella: ti abbiamo inviato un link per confermare l'iscrizione " +
            "(se eri già iscritto, riceverai invece il link per gestire le preferenze).",
          "success",
        );
        form.hidden = true;
      } else {
        showMessage(message, await errorText(resp), "error");
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
    showMessage(message, await errorText(resp), "error");
    return initManageLink(config);
  }
  const current = await resp.json();

  const form = document.getElementById("manage");
  document.getElementById("email").textContent = current.email;
  if (new URLSearchParams(location.search).has("benvenuto")) {
    showMessage(message, "Iscrizione confermata! Puoi rivedere qui le tue preferenze.", "success");
  }
  const prefs = preferencesForm(document.getElementById("prefs"), config);
  prefs.set(current);
  form.hidden = false;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const save = await fetch("/api/preferences", {
      method: "PUT",
      headers: { "content-type": "application/json", ...auth },
      body: JSON.stringify(prefs.get()),
    });
    if (save.ok) showMessage(message, "Preferenze salvate.", "success");
    else showMessage(message, await errorText(save), "error");
  });

  document.getElementById("delete").addEventListener("click", async () => {
    if (!confirm("Vuoi davvero disiscriverti? I tuoi dati verranno cancellati.")) return;
    const del = await fetch("/api/preferences", { method: "DELETE", headers: auth });
    if (del.ok) {
      form.hidden = true;
      showMessage(message, "Disiscrizione completata: i tuoi dati sono stati cancellati.", "success");
    } else {
      showMessage(message, await errorText(del), "error");
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
      showMessage(message, "Se l'indirizzo è iscritto, riceverai a breve un nuovo link.", "success");
      form.hidden = true;
    } else {
      showMessage(message, await errorText(resp), "error");
    }
  });
}

const config = await (await fetch("/api/config")).json();
if (document.body.dataset.page === "subscribe") await initSubscribe(config);
else await initManage(config);
