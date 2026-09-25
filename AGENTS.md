# AGENTS.md

Instructions for coding agents (Claude Code, Codex, Cursor, Copilot, ...) working on PostTheDoc.
Humans: [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) say the
same things at more length; if this file and those disagree, they win.

## The project

PostTheDoc emails researchers the new academic job calls published on
[bandi.mur.gov.it](https://bandi.mur.gov.it) that match their preferences (position, G.S.D.,
region or institution). No accounts, no passwords, no cookies: only an email address and its
preferences, managed through HMAC-signed links. Everything runs on free tiers (GitHub Actions and
Pages, Cloudflare Workers and D1, Brevo).

| Path | What it is |
|---|---|
| `apps/pipeline/` | Python 3.12 (uv): scrapes MUR, matches calls to users, renders and sends digests. Runs daily in `.github/workflows/daily.yml` |
| `apps/worker/` | Cloudflare Worker (Hono + D1): subscribe/preferences API, `/confirm`, `/unsubscribe`, confirmation emails |
| `apps/web/` | Astro static site on GitHub Pages; browser logic in `src/scripts/`, talks to the Worker via CORS |
| `packages/shared/` | TypeScript used by Worker and web: contract, reference tables, API types, zod request schemas |
| `data/contract.json` | Values all three apps must agree on (locales, token lifetimes, link paths) |
| `data/reference/` | Roles, regions, G.S.D. and institutions, shared by every app |
| `data/seen.json` | Calls already processed; owned by the daily job |

The pipeline reads and writes D1 through its REST API; the Worker and the pipeline share
`TOKEN_SECRET` and the token format.

## Commands

Python pipeline, from `apps/pipeline/`:

```sh
uv sync
uv run ruff check .            # `--fix` to apply fixes
uv run ruff format --check .   # drop `--check` to format
uv run mypy                    # strict
uv run pytest                  # fails under 90% coverage
uv run pytest --no-cov tests/test_matching.py -k skips_users  # one test, no coverage gate
# End to end, no emails sent: fake users, every open call treated as new, digests written to out/
uv run postthedoc run --dry-run --all --users tests/fixtures/users.json --seen /tmp/seen.json
```

TypeScript (npm workspaces), from the repository root:

```sh
npm install
npm run lint                   # Biome, same as CI; `npm run format` fixes what it can
npm run typecheck
npm test
npm test --workspace @postthedoc/worker -- tokens  # one workspace, one file
npm run build --workspace @postthedoc/web          # needs apps/web/.env (copy .env.example)
```

Before saying a task is done, run the checks of every part you touched: these are exactly what CI
(`.github/workflows/ci.yml`) runs. Running the Worker and site locally is in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#local-development).

## Rules that are easy to break

- **Two languages, always.** Every user-facing string exists in Italian and English:
  `apps/pipeline/src/postthedoc/digest/strings.py` (digests), `apps/worker/src/i18n/` (Worker
  emails and pages), `apps/web/src/i18n/` (site; the types are derived from `it.ts`),
  `apps/web/src/content/` (philosophy and privacy pages). Official G.S.D. and institution names
  stay in Italian. Code, comments, docs and commits are in English.
- **One source for shared values.** Anything two apps must agree on goes in `data/contract.json`
  or `packages/shared`, never copied. Contract values are baked into links already emailed:
  changing them can break those links.
- **Tokens are shared between Python and TypeScript.** `packages/shared/fixtures/tokens.json`
  holds test vectors checked by `apps/pipeline/tests/test_tokens.py` and
  `apps/worker/test/tokens.test.ts`: change both implementations together.
- **Privacy notice ⇒ `PRIVACY_VERSION`.** Editing `apps/web/src/content/privacy/*.md` means
  updating its "last updated" date and `PRIVACY_VERSION` in `apps/worker/src/config.ts` to the
  same day (`apps/web/test/privacy.test.ts` enforces it). Users consent to that version.
- **Privacy principles are constraints.** No cookies, no per-user tracking, no personal data
  beyond the email address and preferences, no new third party without discussion.
- **Digest templates ⇒ golden files.** After changing `digest/templates/` or `strings.py`, run
  `UPDATE_GOLDEN=1 uv run pytest tests/test_digest.py` and check the diff in `tests/golden/`.
- **Database changes are new migrations.** Add `apps/worker/migrations/000N_<name>.sql`; never
  edit a migration that exists already, it is applied in production.
- **Do not edit `data/seen.json`.** The daily job commits it. Reference data is updated with
  `uv run postthedoc sync-reference`; regions of new institutions are filled in by hand in
  `data/reference/institutions.json`.
- **Content-Security-Policy.** A new script, frame or API origin must be allowed in
  `apps/worker/src/middleware/security.ts` (Worker) and/or `security.csp` in
  `apps/web/astro.config.mjs` (site). Inline `style` attributes are blocked. Astro applies the
  CSP to `build`/`preview`, not `dev`, so check with a build.
- **No live services in tests.** Tests never reach MUR, Brevo or a remote D1: use the HTML
  fixtures in `apps/pipeline/tests/fixtures/`, the fakes in `tests/fakes.py`, `respx` for HTTP,
  and `EMAIL_MODE=log` for the Worker. Behavior changes come with tests.
- **No secrets in the repo.** `.env` and `.dev.vars` are gitignored; `wrangler.jsonc` keeps a
  placeholder `database_id` that the deploy workflow fills in.
- **GitHub Actions are pinned** to a full commit SHA with the version in a comment
  (`uses: actions/checkout@<sha> # v7.0.1`).

## Style

- Python: ruff (rules in `apps/pipeline/pyproject.toml`), mypy strict, line length 100, typed
  everywhere except tests.
- TypeScript/Astro/CSS/JSON: Biome (`biome.json`): 2 spaces, double quotes, semicolons, trailing
  commas, line length 100, no `any`, no non-null `!`, `import type` for types. ESM only.
- Comments explain *why*, not what, and are sparse; module and function docstrings are short.
  Match the code around you rather than introducing new patterns or dependencies.
- `pre-commit install` runs the same linters before each commit (`.pre-commit-config.yaml`).

## Commits and pull requests

- [Conventional Commits](https://www.conventionalcommits.org): `type(scope): subject`, subject in
  lowercase and imperative, e.g. `fix(worker): bind captchas to their form`. Scopes in use:
  `pipeline`, `worker`, `web`, `email`, `db`, `privacy`, `deps`, `ci`.
- One focused change per pull request, branched from `main`; describe what and why and link the
  issue. UI changes need screenshots in Italian and English (light and dark theme where it
  matters). Larger changes: open an issue first to agree on the approach.
- Never paste links from PostTheDoc emails (confirm, manage, unsubscribe) in issues, PRs or
  logs: they carry signed tokens.
