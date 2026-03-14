# Quayboard

Quayboard is a web control plane for managing software projects and orchestrating agentic coding runs with governance, auditability, and PR-first delivery.

## Status

The repository now contains the M1 authenticated foundation:

- Fastify API with:
  `GET /healthz`, cookie-session auth, protected `/api/*`, authenticated SSE, and project-scoped secrets
- Drizzle/Postgres foundation schema and initial SQL migration
- Minimal Vite + React auth UI at `/login`, `/register`, and an authenticated placeholder at `/`
- Shared schemas for auth, users, sessions, projects, secrets, settings, and SSE events
- Typed `501` route scaffolds for later milestone API areas

The active implementation target is now M1: Database, API Skeleton, and Auth Foundation. M2 product workflows are not implemented yet.

## Prerequisites

- Node.js 20.x
- pnpm 9 or newer
- Docker and Docker Compose

## Quick Start

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy the environment file and adjust values if needed:

   ```bash
   cp .env.example .env
   ```

   `SECRETS_ENCRYPTION_KEY` must decode to 32 bytes. The example value is a local placeholder and should be replaced for real use.

3. Start Postgres:

   ```bash
   docker compose up -d
   ```

4. Run the migration harness:

   ```bash
   pnpm db:migrate
   ```

5. Start the API and web apps:

   ```bash
   pnpm dev
   ```

The web app runs on `http://localhost:3000` and the API runs on `http://localhost:3001`. The health check is available at `http://localhost:3001/healthz`.
The web dev server proxies `/auth/*` and `/api/*` to the API so session-cookie auth works during local development.

## Workspace Commands

- `pnpm dev` starts the API and web dev servers in parallel
- `pnpm build` builds all workspace packages
- `pnpm typecheck` runs TypeScript checks across the workspace
- `pnpm test` runs the unit and integration test baseline
- `pnpm test:unit` runs the fast unit suite only
- `pnpm test:integration` runs the Postgres-backed migration test
- `pnpm test:e2e` runs the Playwright smoke test for the web app
- `pnpm db:migrate` runs the API migration harness against `DATABASE_URL`

`pnpm test:e2e` assumes the host machine has the browser dependencies Playwright needs to launch Chromium.

## Environment

Documented runtime variables live in `.env.example`:

- `DATABASE_URL` for Drizzle migrations, API runtime, and Postgres-backed integration tests
- `API_PORT` for the Fastify server port
- `CORS_ORIGIN` for the allowed frontend origin
- `SECRETS_ENCRYPTION_KEY` for application-level encryption of stored credentials

## Repository Layout

```text
apps/
  api/      Fastify service, auth/session middleware, SSE, secrets, migrations, API tests
  web/      Vite + React auth shell, DS primitives, Playwright smoke test
  mcp/      Buildable placeholder package for the future MCP server
packages/
  shared/   Shared schemas and types used across the workspace
docs/
  adr/            Architecture decisions
  architecture/   Monorepo, toolchain, API foundation, and local-dev documentation
  planning/       Active milestone and long-range project outline
  user/           User-facing auth and future product documentation
```

## Source Of Truth

Use these documents in this order:

1. [docs/planning/current-milestone.md](docs/planning/current-milestone.md)
2. [AGENTS.md](AGENTS.md)
3. [docs/planning/quayboard-project-outline.md](docs/planning/quayboard-project-outline.md)
4. [docs/adr/README.md](docs/adr/README.md)
5. [CONTRIBUTING.md](CONTRIBUTING.md)

## Documentation Map

- [Current milestone](docs/planning/current-milestone.md)
- [Project outline](docs/planning/quayboard-project-outline.md)
- [ADR guide](docs/adr/README.md)
- [Architecture docs](docs/architecture/README.md)
- [User docs scaffold](docs/user/README.md)
- [Contributor guide](CONTRIBUTING.md)
