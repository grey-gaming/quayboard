# Quayboard

Quayboard is a web control plane for managing software projects and orchestrating agentic coding runs with governance, auditability, and PR-first delivery.

## Status

The repository now contains the active M5 planning workflow:

- Fastify API with auth/session cookies, authenticated SSE, project-scoped secrets, system readiness, project setup, questionnaire persistence, overview document versioning, Product Spec APIs, user-flow APIs, UX/Technical Spec APIs, direct artifact approval routes, and project/job status endpoints
- Drizzle/Postgres schema and migrations covering the M1 foundation plus M2-M5 planning tables, including milestones, feature catalogue data, and feature workstream revision tables
- Vite + React UI for project list/create, instance readiness, project setup, Mission Control, questionnaire/overview, Product Spec, UX Spec, Technical Spec, user flows, milestones, feature builder, the Feature Editor, and a public `/docs` guide sourced from `docs/user`
- Shared schemas for planning-phase resources across API and web

M5: Feature Workstream Specifications is the current repo target.

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

   `SECRETS_ENCRYPTION_KEY` must decode to 32 bytes. If it is missing, the API still boots so `/setup/instance` can report the failing readiness check, but secret-backed setup actions stay unavailable until the key is configured and the API is restarted.
   `ARTIFACT_STORAGE_PATH` should point to a writable directory.

3. Start Postgres:

   ```bash
   docker compose up -d
   ```

4. Run the migration harness:

   ```bash
   pnpm db:migrate
   ```

   To reset the local Postgres database from scratch and reapply migrations:

   ```bash
   pnpm db:reset
   ```

5. Ensure the artifact storage directory exists:

   ```bash
   mkdir -p /tmp/quayboard-artifacts
   ```

6. Start the API and web apps:

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
- `pnpm db:reset` recreates the local Docker Postgres volume and reapplies migrations

`pnpm test:e2e` assumes the host machine has the browser dependencies Playwright needs to launch Chromium.

## Environment

Documented runtime variables live in `.env.example`:

- `DATABASE_URL` for Drizzle migrations, API runtime, and Postgres-backed integration tests
- `TEST_DATABASE_URL` for API integration tests; if omitted, the test suite derives a sibling database name by appending `_test` to `DATABASE_URL`
- `API_PORT` for the Fastify server port
- `CORS_ORIGIN` for the allowed frontend origin
- `SECRETS_ENCRYPTION_KEY` for application-level encryption of stored credentials
- `ARTIFACT_STORAGE_PATH` for readiness checks and future artifact persistence
- `DOCKER_HOST` to target a non-default Docker daemon for sandbox verification
- `LLM_MAX_OUTPUT_TOKENS` for the API-side Ollama output-token cap used on generation requests
- `LLM_REQUEST_TIMEOUT_MS` for the API-side timeout applied to Ollama and OpenAI-compatible generation requests
- `OLLAMA_HOST` for the Ollama adapter base URL
- `OPENAI_BASE_URL` for the OpenAI-compatible adapter base URL; the API key itself is stored per project through the UI

## Repository Layout

```text
apps/
  api/      Fastify service, auth/session middleware, SSE, setup/planning APIs, migrations, API tests
  web/      Vite + React planning UI, DS primitives, Playwright smoke test
  mcp/      Buildable placeholder package for the future MCP server
packages/
  shared/   Shared schemas and types used across the workspace
docs/
  adr/            Architecture decisions
  architecture/   Monorepo, toolchain, API foundation, and local-dev documentation
  planning/       Active milestone and long-range project outline
  user/           User-facing guides rendered by the public `/docs` experience
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
- [User docs guide source](docs/user/README.md)
- [Contributor guide](CONTRIBUTING.md)
