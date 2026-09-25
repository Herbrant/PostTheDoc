# postthedoc (pipeline)

The daily job of [PostTheDoc](../../README.md): it reads the new calls published on
[bandi.mur.gov.it](https://bandi.mur.gov.it), matches them against the subscribers' preferences
and sends one digest per subscriber.

```sh
uv sync
uv run postthedoc run --dry-run --all --users tests/fixtures/users.json --seen /tmp/seen.json
uv run postthedoc stats   # aggregate figures on users, digests and calls (needs the D1 settings)
uv run pytest
```

See [docs/DEVELOPMENT.md](../../docs/DEVELOPMENT.md) for configuration and deployment.
