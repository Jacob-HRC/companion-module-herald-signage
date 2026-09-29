# companion-module-herald-signage

A [Bitfocus Companion](https://bitfocus.io/companion) module for [Herald Signage](https://heraldsignage.com). Use it to switch screens, start live streams and run emergency overrides from a Stream Deck, with buttons that show what's happening.

User-facing help is in [companion/HELP.md](companion/HELP.md).

## How it works

The module talks to two Herald endpoints with a personal API token (`Authorization: Bearer hrd_pat_…`):

- `GET /api/v1/integrations/catalog` lists the actions the token's role can run, where each parameter goes, and the names behind every dropdown. The module re-reads it on connect and every five minutes.
- `GET /api/v1/integrations/state` returns the live override, each screen's online state, power and what it's showing (by id), and each stream's health. The module polls it every few seconds (3 by default) to drive feedbacks and variables.

It polls instead of taking webhooks because Companion usually sits on a venue LAN that a hosted Herald can't reach.

Actions are defined from a copy of catalog v1 bundled in `src/herald.ts`, so a saved button keeps its action even if Herald is unreachable at startup. The live catalog adds anything newer. `src/herald.test.ts` checks the bundled copy against `test/fixtures/catalog-v1.json`, which is generated from Herald's own catalog. Regenerate it when Herald's catalog changes.

## Development

Needs Node 22 and Yarn 4 (`corepack enable`).

```sh
yarn install
yarn build      # tsc → dist/
yarn test       # vitest
yarn lint
yarn package    # companion-module-build → herald-signage-<version>.tgz
```

To try it in Companion, point Companion's developer modules path at the folder containing this repo. With Docker, mount it at `/app/module-local-dev/herald-signage`:

```sh
docker run --network host \
  -v "$PWD":/app/module-local-dev/herald-signage \
  ghcr.io/bitfocus/companion/companion:latest
```

## Layout

- `src/herald.ts` has the catalog and state types, the bundled catalog, and the request-building and feedback logic. It's pure and fully unit-tested.
- `src/client.ts` is the HTTP client, with a 10s timeout and one idempotency key per press.
- `src/main.ts` holds the instance: config, polling, catalog refresh and status.
- `src/actions.ts`, `feedbacks.ts`, `variables.ts` and `presets.ts` are the Companion definitions.

## License

MIT
