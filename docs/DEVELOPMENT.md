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
GitHub Actions ─────────────────┘                             ▼
  (started at 10:00 Italian time by the Worker's cron trigger)
  postthedoc run: bandi.mur.gov.it → new calls → matching → Brevo → digests
                  data/seen.json and data/archive/ committed to the repo
  (monthly) postthedoc export-dataset + publish-zenodo: open dataset on Zenodo
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
  hours and manage links after 30 days; one-click unsubscribe links never expire. A confirmation
  link used once shows "already confirmed" instead of a new manage link.
  To rotate `TOKEN_SECRET` (e.g. after a leak), set the old value as the Worker secret
  `TOKEN_SECRET_PREVIOUS` and the new one as `TOKEN_SECRET` on both the Worker and GitHub: the
  unsubscribe links of the digests already delivered keep working, every other link needs to be
  requested again.
- **Privacy (GDPR)**: the privacy notice lives in `apps/web/src/content/privacy/` and names the
  controller set at build time. Confirming a subscription records `confirmed_at` and the notice
  version (`PRIVACY_VERSION` in `apps/worker/src/config.ts`, to be bumped together with the notice's
  date) as proof of consent. The manage page lets users edit, export (JSON) and delete their data;
  unsubscribing deletes the user's row and delivery history; the daily job deletes addresses left
  unconfirmed for 7 days. Emails ask Brevo not to track opens per recipient
  (`contactPixelTrackingConsent: false`); link tracking is an account setting (see Brevo below).
- **Content-Security-Policy**: the Worker sends it as a header (`apps/worker/src/middleware/security.ts`);
  the static site gets a `<meta>` one from Astro (`security.csp` in `apps/web/astro.config.mjs`), with
  the hashes of its inline scripts. A new third-party script, frame or API origin must be added
  there, or the browser blocks it; inline `style` attributes are blocked too. Astro applies it to
  `build` and `preview` only, not `dev`.
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
| `data/archive/` | every call ever seen, for the open dataset: `calls.jsonl` (updated by the daily job), `reviewed.json` (titles checked for personal data) |
| `.github/workflows/` | `daily.yml` (notifications), `ci.yml`, `deploy-worker.yml`, `pages.yml` (web app), `dataset.yml` (open dataset) |

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

The open calls page (`/<lang>/calls/`) lists the calls of `data/seen.json` that are still open.
To preview it with today's calls without touching that file, update a copy, then point the site at it:

```sh
cp data/seen.json /tmp/seen.json
cd apps/pipeline
uv run postthedoc run --dry-run --save-seen --users tests/fixtures/users.json --seen /tmp/seen.json
cd ../web
SEEN_FILE=/tmp/seen.json npm run dev
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
     `openssl rand -base64 32`), `BREVO_API_KEY`, `TURNSTILE_SECRET`, `GITHUB_DISPATCH_TOKEN`. Unless `ENVIRONMENT` is
     `development` (local only), the Worker rejects every captcha if `TURNSTILE_SECRET` is one of Cloudflare's test keys, and
     accepts only challenges solved on the `SITE_URL` hostname.
   - `GITHUB_DISPATCH_TOKEN` lets the Worker's cron trigger start `daily.yml` every day at 10:00
     Italian time (`triggers` in `wrangler.jsonc`; GitHub's own schedule runs hours late or not at
     all): a fine-grained GitHub token for this repository only, with *Actions: Read and write*.
     It expires: renew it before its date, or the daily job stops. Forks set `DAILY_WORKFLOW_REPO`
     in `wrangler.jsonc` to their repository.
   - Create an API token with *Workers Scripts: Edit* and *D1: Edit* permissions.
2. **Brevo**: create an account, verify the sender domain (SPF/DKIM) and create an API key.
   The sender address goes in the `SENDER_EMAIL` GitHub variable below. Also:
   - publish a DMARC record for the domain (`_dmarc`, at least `v=DMARC1; p=none`): Gmail and
     Yahoo require it from bulk senders;
   - set *Anonymous email tracking* to Yes in the transactional tracking settings, as the privacy
     notice promises: transactional emails always get Brevo's open pixel and rewritten links
     (only Brevo's support can turn them off), this keeps opens and clicks aggregate;
   - leave *Authorised IPs* off, or the API calls from GitHub Actions and Cloudflare are refused;
   - send one digest to a Gmail address and check with "Show original" that SPF, DKIM and DMARC
     pass and that `List-Unsubscribe` and `List-Unsubscribe-Post` are there.
3. **GitHub** (Settings → Secrets and variables → Actions):
   - secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `BREVO_API_KEY`,
     `TOKEN_SECRET` (the same as the Worker's); optionally `CLOUDFLARE_D1_API_TOKEN`, a second
     token with only *D1: Edit*, used by `daily.yml` instead of the deploy token;
   - variables: `CONTROLLER_NAME` and `CONTROLLER_EMAIL` (data controller named in the privacy
     notice: the frontend build fails without them; optionally `CONTROLLER_ADDRESS`, the
     controller's postal address),
     `SENDER_EMAIL` (sender verified on Brevo,
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
   builds and publishes the frontend (again after every `daily.yml` run, for the open calls page).
5. Run `daily.yml` manually: the first run records the calls already open in `data/seen.json`
   without sending emails; from the next day on, only new calls are sent.

GDPR paperwork on the operator's side: the data processing agreements of Cloudflare, Brevo,
GitHub and Umami are part of their terms (keep a copy); in Umami Cloud pick the EU region if
available; update the "Who processes it" section of the privacy notice if providers change, and
notify a data breach to the Garante within 72 hours (Art. 33).

Free-tier limits to keep an eye on: Brevo 300 emails/day (one digest per user per day),
Workers 100,000 requests/day, D1 5 GB.

The Brevo quota is shared by the Worker (confirmations and manage links) and the daily digests:
`dailyEmails` in `data/contract.json`. The Worker keeps to its own share (100 per UTC day): past
it, and past 5 requests per minute from one IP (`RATE_LIMITS` in `apps/worker/src/config.ts`),
the forms answer "too many requests". A pending address gets at most
`MAX_CONFIRMATIONS` confirmation emails before the daily job purges it, 7 days after it was first
submitted. The daily job fails once the active users exceed 80% of the digests' share (160): time
to look for fake subscribers (many addresses on one domain) or to move to a larger Brevo plan.
Raise these values together with the Brevo plan.

The manage page's API has no captcha, so it is capped at 30 requests per minute from one IP: its
writes count against D1's daily limit, which the daily job needs to record deliveries. The limits
key IPv6 clients by their /64 and are counted exactly by a Durable Object per client
(`apps/worker/src/durable/rate-limiter.ts`; Cloudflare's rate limiting binding never refused
anything in production). They do not save Workers requests, which count even when refused: a flood of ~100,000 requests takes the Worker down until 00:00 UTC
(digests and the site keep working); only a WAF rule on a custom domain would stop it earlier.

When Brevo refuses a digest for a reason every other one would share (bad key, no credits, rate
limited) the daily job stops sending and fails; the users served come in an order that changes
every day. A call that did not reach every matching user (that stop, or a failed send) goes in
the `retry` list of `data/seen.json`: the next runs send it to whoever is still missing it, for up
to 3 days, and the delivery log keeps the others from getting it twice.

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

## Open dataset (Zenodo)

Every call seen is kept in `data/archive/calls.jsonl`, with the changes found in it: seen.json
forgets calls 60 days after their deadline, the archive never does. The daily job updates it
with seen.json. Once a month `dataset.yml` turns it into an open dataset (CSV files, a
[Frictionless Data Package](https://datapackage.org) descriptor, a README in English and
Italian, CC BY 4.0) and publishes it as a new version of a Zenodo record: each version has its
own DOI, the concept DOI always points to the latest one. The author is "PostTheDoc".

```sh
cd apps/pipeline
uv run postthedoc archive --seen ../../data/seen.json --archive /tmp/calls.jsonl  # a local copy
uv run postthedoc export-dataset --archive /tmp/calls.jsonl --out /tmp/dataset
uvx frictionless validate /tmp/dataset/datapackage.json
uv run postthedoc publish-zenodo --dir /tmp/dataset --dry-run   # files and metadata, no upload
```

**Personal data.** The dataset is about calls, not people, and a Zenodo record cannot really be
taken back. `export-dataset` fails when a title looks like it names someone (an honorific
followed by a name, an email address, a phone number, "responsabile scientifico:"), listing the
calls. Check each one on the portal and add it to `data/archive/reviewed.json`: `"keep"` for a
false alarm, `"omit-title"` to publish the call without its title.

**Trying it out.** Create an account and a token (scopes `deposit:write`, `deposit:actions`) on
[sandbox.zenodo.org](https://sandbox.zenodo.org): its DOIs are tests and it is wiped from time
to time. Locally, export `ZENODO_URL=https://sandbox.zenodo.org` and `ZENODO_TOKEN` in your shell
and run `publish-zenodo` without `--dry-run`: the first run creates the record (note its id),
the next ones with `ZENODO_RECORD_ID=<id>` add versions. On GitHub, set the secret
`ZENODO_SANDBOX_TOKEN` (and, after the first run, the variable `ZENODO_SANDBOX_RECORD_ID`) and run
`dataset.yml` by hand with target *sandbox*.

**First real publication**, once:

1. Get written confirmation from MUR / Cineca (via the [portal's support](https://bandi.mur.gov.it/support.php),
   or a formal re-use request under d.lgs. 36/2006) that the calls may be republished under CC BY
   4.0, with attribution. The legal grounds: open data by default (art. 52 c.2 CAD), official
   acts without copyright (art. 5 L. 633/1941), no database right against re-use for public
   bodies (directive 2019/1024).
2. Create a token on [zenodo.org](https://zenodo.org) (same scopes) and set it as the secret
   `ZENODO_TOKEN`.
3. Run `dataset.yml` by hand from `main` with target *zenodo*. It creates the record and logs its
   id and DOIs.
4. Set the variable `ZENODO_RECORD_ID` to that id: from then on the workflow publishes a new
   version on the 1st of every month (without it, scheduled runs do nothing).
5. Link the concept DOI from the philosophy page (it and en).

**Corrections and takedowns.** A published version cannot be changed, only followed by a new
one: fix the cause (e.g. `"omit-title"` in `reviewed.json`), run `dataset.yml` by hand, and for
personal data ask Zenodo's support to restrict the old versions.

## Observatory

`/<lang>/observatory/` compares universities and regions: positions advertised relative to their
teaching and research staff, students or residents, the share of precarious positions, the
application windows and the trend over the period the reader chooses. It is built from `data/archive/calls.jsonl` (see
"Open dataset" above) and two files in `data/reference/`:

- `denominators.json`, from `uv run postthedoc sync-denominators`: staff and enrolled students of
  each university (MUR, USTAT, IODL 2.0) and residents of each region (ISTAT through Eurostat,
  CC BY 4.0). Run it once a year, when USTAT publishes new figures. Universities are matched
  through their `ustat` code in `institutions.json`, checked by hand: the command fails if one has
  no staff figure. The special schools (Normale, SISSA, ...) have no enrolled students.
- `geometry.json`, from `uv run postthedoc sync-geometry`: region boundaries (openpolis, from
  ISTAT, CC BY 4.0), simplified, and the city of each university (OpenStreetMap's Nominatim,
  ODbL), geocoded once. A new university needs its city in `CITIES`
  (`maintenance/geometry.py`).

The statistics are in `apps/web/src/lib/observatory.ts`, the method the page states in
`apps/web/src/content/observatory/`: change them together. The page is built for the default
period (from the start of the collection to the day of the build); for any other period the
reader picks, its script fetches `/observatory/calls.json` and runs the same code
(`lib/observatory-figures.ts`) in the browser, so the figures cannot differ. Positions and the date of each call
come from its detail page; calls found before that are completed up to 100 per daily run.

To preview the page with real data, point the build at a copy of the archive:

```sh
cd apps/pipeline
uv run postthedoc archive --seen ../../data/seen.json --archive /tmp/calls.jsonl
cd ../web && ARCHIVE_FILE=/tmp/calls.jsonl npm run build && npm run preview
```

## Updating the reference data

```sh
cd apps/pipeline
uv run postthedoc sync-reference
```

Adds new institutions and G.S.D. read from the MUR portal and lists institutions without a region,
which must be completed by hand in `data/reference/institutions.json`. CNR institutes and other
multi-site institutes have no region: their calls reach only users who do not filter by location
or who select them explicitly.
