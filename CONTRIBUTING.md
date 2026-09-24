# Contributing to PostTheDoc

Thanks for wanting to help. PostTheDoc is a free, independent project built to make looking for a
place in academia a little less exhausting (the [README](README.md) explains why it exists). Every
contribution counts, from a one-line bug report to a pull request.

## Reporting issues

[Open an issue](https://github.com/Herbrant/PostTheDoc/issues) and include what helps reproduce it:

- **A missing or wrong call**: the link to the call on [bandi.mur.gov.it](https://bandi.mur.gov.it),
  the kind of position and the publication date.
- **An institution with a missing or wrong region, or a missing G.S.D.**: the name exactly as it
  appears on the MUR portal.
- **A bug in the site or in the emails**: the page URL, the language (IT/EN), the browser and the
  steps to reproduce it.
- **A translation that reads badly** in Italian or English: where it appears and your suggestion.

> [!WARNING]
> Never paste the links from your emails (confirm, manage preferences, unsubscribe) in an issue:
> they carry signed tokens that give access to your subscription.

### Security

Please do not open a public issue for security vulnerabilities. Write to
**herbrant@protonmail.com** instead, with a description of the problem and how to reproduce it.

## Before you start

Small fixes (typos, translations, obvious bugs) can go straight to a pull request. For larger
changes or new features, open an issue first so we can agree on the approach before you spend time
on it.

## Development setup

The project has three parts, plus what they share:

| Path | Contents |
|---|---|
| `apps/pipeline/` | Python pipeline: scraping, matching, digests, D1 client |
| `apps/worker/` | Cloudflare Worker API (Hono + D1) |
| `apps/web/` | Astro site published on GitHub Pages |
| `packages/shared/` | TypeScript contract, reference tables and API types used by the Worker and the web app |
| `data/` | `contract.json` and the reference tables, shared by every part |

[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#local-development) explains how to run each of them
locally, with no real emails sent and no external account needed.

## Checks

CI runs the same commands below; please run the ones for the parts you touched before opening a
pull request.

```sh
# Python pipeline
cd apps/pipeline
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest

# Worker and web (from the repository root)
npm run typecheck
npm test
npm run build --workspace @postthedoc/web
```

Changes in behavior should come with tests: `apps/pipeline/tests/` for the pipeline,
`apps/worker/test/` for the Worker, `apps/web/test/` for the web app's scripts and
`packages/shared/test/` for the shared package.

## Conventions

- **Language**: code, comments, docs and commit messages are in English. User-facing text is always
  in **both Italian and English**: `apps/pipeline/src/postthedoc/digest/strings.py` (digest),
  `apps/worker/src/i18n/` (Worker emails and pages), `apps/web/src/i18n/` (web UI) and
  `apps/web/src/content/` (philosophy and privacy pages). Official G.S.D. and institution names
  stay in Italian.
- **Style**: Python is formatted and linted with ruff and type-checked with mypy in strict mode
  (`apps/pipeline/pyproject.toml`); TypeScript, Astro, CSS and JSON with Biome (`biome.json`).
  `pre-commit install` runs them before every commit.
- **Shared values**: anything two parts must agree on (locales, link lifetimes and paths,
  API shapes) goes in `data/contract.json` or `packages/shared`, not in copies.
- **Reference data**: `uv run postthedoc sync-reference` adds new institutions and G.S.D. from the
  MUR portal; regions of new institutions are filled in by hand in
  `data/reference/institutions.json`. Do not edit `data/seen.json`: the daily job owns it.
- **Database**: schema changes go in a new migration in `apps/worker/migrations/`; never edit a
  migration that has already been applied.
- **Privacy**: the principles in the README are constraints, not goals. No cookies, no per-user
  tracking, no data beyond the email address and the preferences. If you change the privacy
  notice, bump `PRIVACY_VERSION` in `apps/worker/src/config.ts` to the notice's new date.
- **Commits**: [Conventional Commits](https://www.conventionalcommits.org), as
  `type(scope): subject`, e.g. `fix(worker): ...`, `feat(web): ...`, `docs: ...`.

## Pull requests

- Branch from `main` and keep each pull request focused on one change.
- Describe what changes and why; link the issue it addresses, if any.
- For UI changes, add screenshots in both languages and, where it matters, in light and dark
  theme.
- Make sure CI is green.

## License

PostTheDoc is licensed under the [GNU General Public License v3.0 or later](LICENSE). By
contributing, you agree that your contributions are licensed under the same terms.
