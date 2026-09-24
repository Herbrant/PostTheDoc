# PostTheDoc

Email notifications about new academic job calls in Italian universities and research institutes.
Each user picks:

- **roles**: PhD, research fellowship, postdoc fellowship, research contract, research grant,
  researcher (RTD/RTT), technologist, associate/full professor;
- **fields**: one or more scientific-disciplinary groups (G.S.D., DM 639/2024, e.g. `INFO-01`);
- **location**: all of Italy, one or more regions, one or more universities/institutes;
- **language**: Italian or English, used for the web pages and every email.

No server to run: everything fits in the free tiers of GitHub Actions, Cloudflare and Brevo.

## Architecture

```
                 ┌──── GitHub Pages (frontend/) ────┐
user ───HTTPS───▶│ welcome, philosophy, subscribe,  │
                 │ manage preferences (Astro)       │
                 └────────────────┬─────────────────┘
                                  │ fetch (CORS)
                 ┌────────────────▼──── Cloudflare Worker (worker/) ──────────┐
                 │ subscribe/preferences API, /confirm, /unsubscribe          │
                 │                  D1 (users, deliveries)                    │
                 └──────────────▲─────────────────────────────┬───────────────┘
                                │ D1 REST API                 │ confirmation emails
GitHub Actions (cron) ──────────┘                             ▼
  postthedoc run: bandi.mur.gov.it → new calls → matching → Brevo → digests
                  data/seen.json committed to the repo
```

- **Frontend**: static site built with [Astro](https://astro.build) and published on GitHub Pages
  (visual style adapted from [LatentFolio](https://github.com/Dharani-Eswaramurthi/latentfolio),
  MIT); it talks to the Worker API from the browser. Email links to manage preferences open the
  frontend, while confirmation and one-click unsubscribe links (RFC 8058) hit the Worker.

- **Source**: [bandi.mur.gov.it](https://bandi.mur.gov.it) (MUR/Cineca), which collects calls
  from every section: PhDs, research and postdoc fellowships, research contracts, research
  grants, RTD/RTT researchers, technologists, professor positions.
- **Passwordless**: email links carry HMAC-signed tokens (`TOKEN_SECRET`, shared by the Worker
  and the pipeline). No token is stored in the database. Confirmation links expire after 48
  hours and manage links after 30 days; one-click unsubscribe links never expire.
- **Privacy**: unsubscribing deletes the user's row and delivery history; the daily job deletes
  addresses left unconfirmed for 7 days.
- **Languages**: the codebase is in English; user-facing text lives in
  `src/postthedoc/i18n.py` (digest), `worker/src/i18n.ts` (Worker emails and pages),
  `frontend/src/i18n/strings.ts` (web UI) and `frontend/src/content/philosophy/` (the
  "Why this exists" page), always in both Italian and English. Official G.S.D. and
  institution names stay in Italian.

## Layout

| Path | Contents |
|---|---|
| `src/postthedoc/` | Python pipeline: scraping, matching, digests, D1 client |
| `frontend/` | Astro site for GitHub Pages: pages in `src/pages/[lang]/`, browser logic in `src/scripts/` |
| `worker/` | Cloudflare Worker API (Hono + D1) |
| `data/reference/` | roles, regions (ISO 3166-2), G.S.D. and institutions (→ region), shared by both sides |
| `data/seen.json` | calls already seen, updated by the daily job |
| `.github/workflows/` | `daily.yml` (notifications), `ci.yml`, `deploy-worker.yml`, `pages.yml` (frontend) |

## Local development

Python pipeline (requires [uv](https://docs.astral.sh/uv/)):

```sh
uv sync
uv run pytest
# Digests written to out/, fake users, every open call treated as new:
uv run postthedoc run --dry-run --all --users tests/fixtures/users.json --seen /tmp/seen.json
```

Worker (requires Node 22):

```sh
cd worker
npm install
cp .dev.vars.example .dev.vars        # EMAIL_MODE=log: emails are printed to the logs
npm run db:migrate:local
npm run dev                          # http://localhost:8787
npm test && npm run typecheck
```

Frontend (requires Node 22, with the Worker running as above):

```sh
cd frontend
npm install
cp .env.example .env                  # Worker URL and Turnstile test key
npm run dev                           # http://localhost:4321/PostTheDoc/
npm run check && npm run build
```

## Deployment

1. **Cloudflare**
   - `cd worker && npx wrangler d1 create postthedoc`, then copy the `database_id` into
     `worker/wrangler.jsonc`.
   - Create a [Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) widget and put its
     site key in `TURNSTILE_SITE_KEY` (`wrangler.jsonc`).
   - Set `FRONTEND_URL` in `wrangler.jsonc` to the public URL of the frontend (e.g.
     `https://<user>.github.io/PostTheDoc`): it is the only origin allowed by CORS and the target
     of the links in the emails. Add its hostname to the Turnstile widget's domains.
   - Set the Worker secrets: `npx wrangler secret put TOKEN_SECRET` (a long random string, e.g.
     `openssl rand -base64 32`), `BREVO_API_KEY`, `TURNSTILE_SECRET`. Outside `EMAIL_MODE=log`
     the Worker rejects every captcha if `TURNSTILE_SECRET` is one of Cloudflare's test keys, and
     accepts only challenges solved on the `FRONTEND_URL` hostname.
   - Create an API token with *Workers Scripts: Edit* and *D1: Edit* permissions.
2. **Brevo**: create an account, verify the sender domain (SPF/DKIM) and create an API key.
   Set `SENDER_EMAIL` in `wrangler.jsonc`.
3. **GitHub** (Settings → Secrets and variables → Actions):
   - secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `BREVO_API_KEY`,
     `TOKEN_SECRET` (the same as the Worker's); optionally `CLOUDFLARE_D1_API_TOKEN`, a second
     token with only *D1: Edit*, used by `daily.yml` instead of the deploy token;
   - variables: `SENDER_EMAIL`, `SITE_URL` (public URL of the frontend, same as `FRONTEND_URL`),
     `API_URL` (public URL of the Worker, e.g. `https://postthedoc.<account>.workers.dev`),
     `TURNSTILE_SITE_KEY` (same as in `wrangler.jsonc`); optionally `UMAMI_WEBSITE_ID`, the
     website ID from [Umami Cloud](https://cloud.umami.is) for cookieless visit statistics
     (unset: no analytics script);
   - Settings → Pages → Source: *GitHub Actions*. For a custom domain, configure it there and set
     `SITE_URL` (and `FRONTEND_URL`) to it, e.g. `https://postthedoc.example`.
4. Push to `main`: `deploy-worker.yml` applies the migrations and deploys the Worker, `pages.yml`
   builds and publishes the frontend.
5. Run `daily.yml` manually: the first run records the calls already open in `data/seen.json`
   without sending emails; from the next day on, only new calls are sent.

Free-tier limits to keep an eye on: Brevo 300 emails/day (one digest per user per day),
Workers 100,000 requests/day, D1 5 GB.

## Updating the reference data

```sh
uv run postthedoc sync-reference
```

Adds new institutions and G.S.D. read from the MUR portal and lists institutions without a region,
which must be completed by hand in `data/reference/institutions.json`. CNR institutes and other
multi-site institutes have no region: their calls reach only users who do not filter by location
or who select them explicitly.
