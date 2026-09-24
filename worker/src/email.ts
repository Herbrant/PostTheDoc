const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function sendEmail(env: Env, email: Email): Promise<void> {
  if (env.EMAIL_MODE === "log") {
    console.log(`[email] a ${email.to}: ${email.subject}\n${email.text}`);
    return;
  }
  const resp = await fetch(BREVO_URL, {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify({
      sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME },
      to: [{ email: email.to }],
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
    }),
  });
  if (!resp.ok) {
    throw new Error(`Brevo ha risposto ${resp.status}: ${await resp.text()}`);
  }
}

function layout(paragraph: string, url: string, cta: string, note: string): string {
  return `<!DOCTYPE html><html lang="it"><body style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2933;max-width:560px;margin:0 auto;padding:24px;">
<h1 style="font-size:20px;">PostTheDoc</h1>
<p>${paragraph}</p>
<p><a href="${url}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;">${cta}</a></p>
<p style="font-size:13px;color:#52606d;">${note}</p>
</body></html>`;
}

export function confirmEmail(to: string, url: string): Email {
  const note = "Il link scade tra 48 ore. Se non hai richiesto l'iscrizione, ignora questa email.";
  return {
    to,
    subject: "Conferma la tua iscrizione a PostTheDoc",
    html: layout(
      "Conferma l'iscrizione per ricevere le notifiche sui nuovi bandi.",
      url,
      "Conferma iscrizione",
      note,
    ),
    text: `Conferma l'iscrizione a PostTheDoc aprendo questo link:\n${url}\n\n${note}`,
  };
}

export function manageLinkEmail(to: string, url: string): Email {
  const note = "Se non hai richiesto tu questo link, ignora questa email.";
  return {
    to,
    subject: "Il tuo link per gestire PostTheDoc",
    html: layout(
      "Ecco il link per modificare le tue preferenze o disiscriverti.",
      url,
      "Gestisci preferenze",
      note,
    ),
    text: `Modifica le tue preferenze PostTheDoc da questo link:\n${url}\n\n${note}`,
  };
}
