# Quayboard

Quayboard is a web control plane for managing software projects and orchestrating agentic coding runs with governance, auditability, and PR-first delivery.

## Status

The repository now contains the M0 foundation scaffold:

- pnpm workspace for `apps/api`, `apps/web`, `apps/mcp`, and `packages/shared`
- Fastify API with a `GET /healthz` endpoint
- Vite + React web app with Tailwind Harbor Night design tokens
- Drizzle/Postgres migration wiring for the local development database
- Vitest, Playwright, and GitHub Actions baseline verification

The active implementation target remains M0: Repository and Toolchain Foundations. No product features are implemented yet.

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

- `DATABASE_URL` for Drizzle migrations and Postgres-backed integration tests
- `API_PORT` for the Fastify server port
- `CORS_ORIGIN` for the allowed frontend origin

## Repository Layout

```text
apps/
  api/      Fastify service, health route, migration harness, API tests
  web/      Vite + React app, Tailwind tokens, Playwright smoke test
  mcp/      Buildable placeholder package for the future MCP server
packages/
  shared/   Shared schemas and types used across the workspace
docs/
  adr/            Architecture decisions
  architecture/   Monorepo, toolchain, and CI/local-dev documentation
  planning/       Active milestone and long-range project outline
  user/           User-facing docs scaffold
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
