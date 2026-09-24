# PostTheDoc

Notifiche email sui nuovi bandi delle università e degli enti di ricerca italiani.
Ogni utente sceglie:

- **ruoli**: dottorato, incarico di ricerca, incarico post-doc, contratto di ricerca, assegno,
  ricercatore (RTD/RTT), tecnologo, professore associato/ordinario;
- **settori**: uno o più gruppi scientifico-disciplinari (G.S.D., DM 639/2024, es. `INFO-01`);
- **luogo**: tutta Italia, una o più regioni, uno o più atenei/enti.

Nessun server da gestire: tutto gira sui piani gratuiti di GitHub Actions, Cloudflare e Brevo.

## Architettura

```
                 ┌──────────────── Cloudflare Worker (worker/) ───────────────┐
utente ──HTTPS──▶│ pagine statiche + API iscrizione/preferenze/disiscrizione  │
                 │                  D1 (users, deliveries)                    │
                 └──────────────▲─────────────────────────────┬───────────────┘
                                │ API REST D1                 │ email di conferma
GitHub Actions (cron) ──────────┘                             ▼
  postthedoc run: bandi.mur.gov.it → nuovi bandi → matching → Brevo → digest
                  data/seen.json committato nel repo
```

- **Fonte**: [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR/Cineca), dove confluiscono i
  bandi di tutte le sezioni: dottorati, incarichi di ricerca e post-doc, contratti di ricerca,
  assegni, RTD/RTT, tecnologi, chiamate di professori.
- **Autenticazione senza password**: i link nelle email contengono token firmati HMAC
  (`TOKEN_SECRET`, condiviso tra Worker e pipeline). Nessun token è salvato nel database.
- **Privacy**: la disiscrizione cancella la riga dell'utente e il suo storico invii.

## Struttura

| Percorso | Contenuto |
|---|---|
| `src/postthedoc/` | pipeline Python: scraping, matching, digest, client D1 |
| `worker/` | Worker Cloudflare (Hono + D1) e pagine statiche in `worker/public/` |
| `data/reference/` | ruoli, regioni, G.S.D. e strutture (ateneo → regione), condivisi dai due lati |
| `data/seen.json` | bandi già visti, aggiornato dal job giornaliero |
| `.github/workflows/` | `daily.yml` (notifiche), `ci.yml`, `deploy-worker.yml` |

## Sviluppo locale

Pipeline Python (serve [uv](https://docs.astral.sh/uv/)):

```sh
uv sync
uv run pytest
# Digest su file in out/, utenti finti, tutti i bandi aperti trattati come nuovi:
uv run postthedoc run --dry-run --all --users tests/fixtures/users.json --seen /tmp/seen.json
```

Worker (serve Node 22):

```sh
cd worker
npm install
cp .dev.vars.example .dev.vars        # EMAIL_MODE=log: le email finiscono nei log
npm run db:migrate:local
npm run dev                          # http://localhost:8787
npm test && npm run typecheck
```

## Messa in produzione

1. **Cloudflare**
   - `cd worker && npx wrangler d1 create postthedoc`, poi copiare il `database_id` in
     `worker/wrangler.jsonc`.
   - Creare un widget [Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) e mettere
     la site key in `TURNSTILE_SITE_KEY` (`wrangler.jsonc`).
   - Impostare i secret del Worker: `npx wrangler secret put TOKEN_SECRET` (stringa casuale lunga,
     es. `openssl rand -base64 32`), `BREVO_API_KEY`, `TURNSTILE_SECRET`.
   - Creare un API token con permessi *Workers Scripts: Edit* e *D1: Edit*.
2. **Brevo**: creare un account, verificare il dominio mittente (SPF/DKIM) e creare una API key.
   Impostare `SENDER_EMAIL` in `wrangler.jsonc`.
3. **GitHub** (Settings → Secrets and variables → Actions):
   - secret: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `BREVO_API_KEY`,
     `TOKEN_SECRET` (lo stesso del Worker);
   - variabili: `SENDER_EMAIL`, `SITE_URL` (URL pubblico del Worker, es.
     `https://postthedoc.<account>.workers.dev`).
4. Push su `main`: `deploy-worker.yml` applica le migrazioni e pubblica il Worker.
5. Lanciare a mano `daily.yml`: al primo avvio registra i bandi già aperti in `data/seen.json`
   senza inviare email; dal giorno dopo si ricevono solo i bandi nuovi.

Limiti gratuiti da tenere d'occhio: Brevo 300 email al giorno (un digest per utente al giorno),
Workers 100.000 richieste al giorno, D1 5 GB.

## Aggiornare i dati di riferimento

```sh
uv run postthedoc sync-reference
```

Aggiunge nuove strutture e nuovi G.S.D. letti dal portale MUR ed elenca le strutture senza regione,
che vanno completate a mano in `data/reference/strutture.json`. Gli istituti CNR e gli enti con più
sedi non hanno una regione: i loro bandi arrivano solo a chi non filtra per luogo o li seleziona
esplicitamente.
