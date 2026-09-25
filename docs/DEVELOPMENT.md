# PostTheDoc — development and deployment

Technical notes for running, developing and self-hosting PostTheDoc. For what the project is and why it exists, see the [README](../README.md).

No server to run: everything fits in the free tiers of GitHub Actions, Cloudflare and Brevo.

## Architecture

```
                 ┌──── GitHub Pages (apps/web/) ────┐
user ───HTTPS───▶│ welcome, philosophy, subscribe,  │
                 │ manage preferences (Astro)       │
                 └────────────────┬─────────────────┘
                                  │ fetch (CORS)
                 ┌────────────────▼──── Cloudflare Worker (apps/worker/) ─────┐
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
- **Privacy (GDPR)**: the privacy notice lives in `apps/web/src/content/privacy/` and names the
  controller set at build time. Confirming a subscription records `confirmed_at` and the notice
  version (`PRIVACY_VERSION` in `apps/worker/src/config.ts`, to be bumped together with the notice's
  date) as proof of consent. The manage page lets users edit, export (JSON) and delete their data;
  unsubscribing deletes the user's row and delivery history; the daily job deletes addresses left
  unconfirmed for 7 days. Emails ask Brevo not to track opens and clicks per recipient
  (`contactPixelTrackingConsent: false`).
- **Languages**: the codebase is in English; user-facing text lives in
  `apps/pipeline/src/postthedoc/digest/strings.py` (digest), `apps/worker/src/i18n/` (Worker
  emails and pages), `apps/web/src/i18n/` (web UI) and `apps/web/src/content/` (the philosophy
  and privacy pages), always in both Italian and English. Official G.S.D. and institution names
  stay in Italian.
- **Shared contract**: the values every part must agree on (locales, link lifetimes and paths,
  institution types) live in `data/contract.json`. The pipeline validates it against its types;
  the Worker and the web app read it through `packages/shared`, which also holds the API types,
  the request schemas and the token test vectors.

## Layout

| Path | Contents |
|---|---|
| `apps/pipeline/` | Python pipeline (uv project): `sources/` (MUR scraper), `digest/`, `mail/`, `storage/` (seen.json, D1), `pipeline.py`, `cli.py` |
| `apps/worker/` | Cloudflare Worker (Hono + D1): `routes/`, `middleware/`, `services/`, `db/`, `email/`, `pages/`, `migrations/` |
| `apps/web/` | Astro site for GitHub Pages: `pages/`, `layouts/`, `components/`, browser logic in `scripts/`, `styles/` |
| `packages/shared/` | TypeScript package used by the Worker and the web app: contract, reference tables, API types and schemas |
| `data/contract.json` | values shared by every part (see above) |
| `data/reference/` | roles, regions (ISO 3166-2), G.S.D. and institutions (→ region), shared by every part |
| `data/seen.json` | calls already seen, updated by the daily job |
| `.github/workflows/` | `daily.yml` (notifications), `ci.yml`, `deploy-worker.yml`, `pages.yml` (web app) |

The JavaScript projects are npm workspaces of the root `package.json`; Biome lints and formats
them all (`biome.json`).

## Local development

Python pipeline (requires [uv](https://docs.astral.sh/uv/)):

```sh
cd apps/pipeline
uv sync
uv run pytest                        # also checks coverage
uv run ruff check . && uv run ruff format --check . && uv run mypy
# Digests written to out/, fake users, every open call treated as new:
uv run postthedoc run --dry-run --all --users tests/fixtures/users.json --seen /tmp/seen.json
```

JavaScript projects (require Node 22): install every workspace once, from the repository root,
where the checks run for all of them.

```sh
npm install
npm run lint                          # Biome; `npm run format` fixes what it can
npm run typecheck
npm test
```

Worker:

```sh
cd apps/worker
cp .dev.vars.example .dev.vars        # development mode: emails in the logs, Turnstile test keys
npm run db:migrate:local
npm run dev                           # http://localhost:8787
```

Web app (with the Worker running as above):

```sh
cd apps/web
cp .env.example .env                  # Worker URL and Turnstile test key
npm run dev                           # http://localhost:4321/PostTheDoc/
npm run build                         # fails if a required PUBLIC_* variable is missing
```

Optionally, `pre-commit install` runs the linters and formatters before every commit
(`.pre-commit-config.yaml`).

## Deployment

1. **Cloudflare**
   - `cd apps/worker && npx wrangler d1 create postthedoc --jurisdiction eu` (subscriber data stays in
     the EU), and keep the `database_id` it prints for the `D1_DATABASE_ID` secret below
     (`deploy-worker.yml` writes it into `wrangler.jsonc`, which only holds a placeholder).
   - Create a [Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) widget (mode
     *Managed*, pre-clearance off: it would set a cookie); its site key goes in the
     `TURNSTILE_SITE_KEY` GitHub variable below, its secret key in `TURNSTILE_SECRET`.
   - Add the hostname of the frontend (the `SITE_URL` GitHub variable below) to the Turnstile
     widget's domains.
   - Set the Worker secrets: `npx wrangler secret put TOKEN_SECRET` (a long random string, e.g.
     `openssl rand -base64 32`), `BREVO_API_KEY`, `TURNSTILE_SECRET`. Unless `ENVIRONMENT` is
     `development` (local only), the Worker rejects every captcha if `TURNSTILE_SECRET` is one of Cloudflare's test keys, and
     accepts only challenges solved on the `SITE_URL` hostname.
   - Create an API token with *Workers Scripts: Edit* and *D1: Edit* permissions.
2. **Brevo**: create an account, verify the sender domain (SPF/DKIM) and create an API key.
   The sender address goes in the `SENDER_EMAIL` GitHub variable below.
3. **GitHub** (Settings → Secrets and variables → Actions):
   - secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `BREVO_API_KEY`,
     `TOKEN_SECRET` (the same as the Worker's); optionally `CLOUDFLARE_D1_API_TOKEN`, a second
     token with only *D1: Edit*, used by `daily.yml` instead of the deploy token;
   - variables: `CONTROLLER_NAME` and `CONTROLLER_EMAIL` (data controller named in the privacy
     notice: the frontend build fails without them), `SENDER_EMAIL` (sender verified on Brevo,
     used by `daily.yml` and passed to the Worker by `deploy-worker.yml`), `SITE_URL` (public URL of
     the frontend, e.g. `https://<user>.github.io/PostTheDoc`: used by `daily.yml` and
     `pages.yml`, and passed to the Worker as `FRONTEND_URL`, the only origin allowed by CORS and
     the target of the links in the emails), `API_URL` (public URL of the Worker, e.g.
     `https://postthedoc.<account>.workers.dev`), `TURNSTILE_SITE_KEY` (the widget's public site
     key, built into the frontend); optionally `UMAMI_WEBSITE_ID`, the
     website ID from [Umami Cloud](https://cloud.umami.is) for cookieless visit statistics
     (unset: no analytics script);
   - Settings → Pages → Source: *GitHub Actions*. For a custom domain, configure it there and set
     `SITE_URL` to it, e.g. `https://postthedoc.example`.
4. Push to `main`: `deploy-worker.yml` applies the migrations and deploys the Worker, `pages.yml`
   builds and publishes the frontend.
5. Run `daily.yml` manually: the first run records the calls already open in `data/seen.json`
   without sending emails; from the next day on, only new calls are sent.

GDPR paperwork on the operator's side: the data processing agreements of Cloudflare, Brevo,
GitHub and Umami are part of their terms (keep a copy); in Umami Cloud pick the EU region if
available; update the "Who processes it" section of the privacy notice if providers change, and
notify a data breach to the Garante within 72 hours (Art. 33).

Free-tier limits to keep an eye on: Brevo 300 emails/day (one digest per user per day),
Workers 100,000 requests/day, D1 5 GB.

## Monitoring

```sh
cd apps/pipeline
git pull                              # the daily job's copy of data/seen.json
export CLOUDFLARE_ACCOUNT_ID=... D1_DATABASE_ID=... CLOUDFLARE_API_TOKEN=...
uv run postthedoc stats               # or --json
```

Prints aggregate figures only, read with SELECT queries: active and pending users, new
subscriptions, users per locale, role, sector area, G.S.D. and region, digests sent in the last
1/7/30 days and per day (to keep an eye on the Brevo daily limit), and the calls in
`data/seen.json` per MUR section. Set `CLOUDFLARE_API_TOKEN` to the D1-only token, not the
deploy token. It is a snapshot, not a history: unsubscribing deletes the user and their deliveries,
and the sectors and regions of the calls are not stored. For an ad-hoc query:
`npx wrangler d1 execute postthedoc --remote --command "SELECT status, COUNT(*) FROM users GROUP BY status"`
(from `apps/worker`).

## Updating the reference data

```sh
cd apps/pipeline
uv run postthedoc sync-reference
```

Adds new institutions and G.S.D. read from the MUR portal and lists institutions without a region,
which must be completed by hand in `data/reference/institutions.json`. CNR institutes and other
multi-site institutes have no region: their calls reach only users who do not filter by location
or who select them explicitly.
