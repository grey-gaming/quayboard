# CI And Local Development

## Local Development Flow

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env`.
3. Start Postgres with `docker compose up -d`.
4. Run `pnpm db:migrate` to verify database connectivity and migration wiring.
5. Run `pnpm dev` to start the API on port `3001` and the web app on port `3000`.

## Verification Commands

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

`pnpm test` is the CI-oriented aggregate. It includes the Postgres-backed migration test and therefore expects `DATABASE_URL` to point at a running database.

`pnpm test:e2e` is a local smoke check and depends on the host machine having Playwright's required browser libraries available.

## CI Baseline

The GitHub Actions workflow runs on pull requests and manual dispatch. It:

- checks out the repository
- installs pnpm and Node.js
- starts a Postgres service container
- runs `pnpm db:migrate`
- runs `pnpm typecheck`
- runs `pnpm test`
- runs `pnpm build`

Playwright is configured in the repo but is not part of the default CI command set for M0.
