# Quayboard

Quayboard is a web control plane for shaping software projects into reviewable delivery plans. The current product combines an authenticated web app, a Fastify API, shared runtime schemas, and background LLM jobs to guide a project from setup through planning, feature design, and task planning.

## What Exists Today

### Customer Workflow

- Local email/password authentication with session cookies
- Instance readiness checks for database connectivity, encryption key presence, Docker availability, artifact storage, and enabled provider adapters
- Project creation and a project-scoped setup flow for:
  - GitHub PAT validation and repository selection
  - LLM provider selection for Ollama or an OpenAI-compatible endpoint
  - sandbox defaults and readiness verification
  - evidence-policy requirements for user and architecture docs
- Mission Control as the main project landing page with:
  - phase-gate checklist
  - next actions
  - recent job activity
  - auto-advance session controls
  - workflow status banners and stats
- Planning editors for:
  - Questions
  - Overview
  - Product Spec
  - UX Spec
  - Technical Spec
  - User Flows
  - Milestones and milestone design docs
  - Feature Builder
  - Feature Editor workstreams: Product, UX, Tech, User Docs, Arch Docs, Tasks
- Implementation surfaces for:
  - project-level Develop runs and managed container inspection
  - milestone sandbox sessions
  - context pack and memory debugging
  - instance execution settings
- Task planning inside the Feature Editor:
  - clarification generation
  - manual and automatic clarification answers
  - delivery-task generation
  - manual task creation, editing, and deletion
  - implementation record tracking
- Public documentation pages at `/docs`, sourced from [`docs/user`](/home/mirdinj/quayboard/docs/user/README.md)

### Product Structure

- [`apps/web`](/home/mirdinj/quayboard/apps/web): Vite + React customer UI
- [`apps/api`](/home/mirdinj/quayboard/apps/api): Fastify API, Postgres-backed services, background jobs, SSE, and migrations
- [`packages/shared`](/home/mirdinj/quayboard/packages/shared): shared Zod schemas and cross-app types
- [`apps/mcp`](/home/mirdinj/quayboard/apps/mcp): placeholder package with no MCP protocol implementation yet

### Current Boundaries

- The import path at `/projects/:id/import` is a stub. The supported workflow starts from scratch.
- Bug-management routes and tool-policy routes are still registered but return `501 Not Implemented`.
- Workflow settings are present as a read-only UI surface; persisted workflow defaults are not implemented.
- The public docs under `docs/user` still need a wider consistency pass. Use the product and code as the source of truth where they disagree.

## Route Overview

### Public Routes

- `/docs`
- `/docs/:slug`
- `/login`
- `/register`

### Authenticated Routes

- `/`
- `/setup/instance`
- `/projects/new`
- `/settings`
- `/settings/workflow`
- `/settings/execution`
- `/projects/:id`
- `/projects/:id/setup`
- `/projects/:id/questions`
- `/projects/:id/one-pager`
- `/projects/:id/import`
- `/projects/:id/product-spec`
- `/projects/:id/ux-spec`
- `/projects/:id/technical-spec`
- `/projects/:id/user-flows`
- `/projects/:id/milestones`
- `/projects/:id/features`
- `/projects/:id/features/:featureId`
- `/projects/:id/features/:featureId/:tab`
- `/projects/:id/develop`
- `/projects/:id/develop/debug`

The web route map lives in [`apps/web/src/app.tsx`](/home/mirdinj/quayboard/apps/web/src/app.tsx). The API route registration lives in [`apps/api/src/server.ts`](/home/mirdinj/quayboard/apps/api/src/server.ts).

## API Surface

The authenticated API currently exposes project, setup, questionnaire, one-pager, product spec, blueprint, user-flow, milestone, feature, feature-workstream, task-planning, implementation-record, sandbox, execution-settings, debug, auto-advance, jobs, artifacts, secrets, events, and system-readiness routes.

Shared request and response contracts live in [`packages/shared/src`](/home/mirdinj/quayboard/packages/shared/src).

## Local Operation

### Prerequisites

- Node.js 20.x
- pnpm 9 or newer
- Docker and Docker Compose

### Environment

Copy `.env.example` to `.env` and adjust values as needed.

Runtime variables currently used by the app:

- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `API_PORT`
- `CORS_ORIGIN`
- `SECRETS_ENCRYPTION_KEY`
- `ARTIFACT_STORAGE_PATH`
- `DOCKER_HOST`
- `LLM_MAX_OUTPUT_TOKENS`
- `LLM_REQUEST_TIMEOUT_MS`
- `OLLAMA_HOST`
- `OPENAI_BASE_URL`

Notes:

- `SECRETS_ENCRYPTION_KEY` must decode to 32 bytes for secret-backed setup actions to work.
- `ARTIFACT_STORAGE_PATH` must point to a writable directory.
- At least one provider path must be reachable for meaningful LLM-backed generation.
- The first sandbox execution that uses `quayboard-agent-sandbox:latest` builds the local image from `docker/agent-sandbox/Dockerfile` if it is not already present.

### Start The Product Locally

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm db:migrate
mkdir -p /tmp/quayboard-artifacts
pnpm dev
```

Default local endpoints:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Health: `http://localhost:3001/healthz`

## Workspace Commands

- `pnpm dev`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:e2e`
- `pnpm db:migrate`
- `pnpm db:reset`

The current CI workflow runs `pnpm db:migrate`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.

## Repository Layout

```text
apps/
  api/      Fastify API, services, routes, migrations, tests
  web/      Vite + React web app, UI components, hooks, tests
  mcp/      Placeholder package
packages/
  shared/   Shared schemas and runtime contracts
docs/
  adr/            Accepted architecture and workflow decisions
  architecture/   Internal engineering documentation
  user/           Markdown source for the public /docs experience
```

## Documentation Map

- [`AGENTS.md`](/home/mirdinj/quayboard/AGENTS.md) for repo-specific agent instructions
- [`docs/architecture/README.md`](/home/mirdinj/quayboard/docs/architecture/README.md) for internal architecture docs
- [`docs/adr/README.md`](/home/mirdinj/quayboard/docs/adr/README.md) for ADR conventions and index
- [`docs/user/README.md`](/home/mirdinj/quayboard/docs/user/README.md) for the public docs source directory

## Current Source Of Truth

When repository docs disagree, prefer:

1. This README for current product and workspace shape
2. [`AGENTS.md`](/home/mirdinj/quayboard/AGENTS.md) for agent workflow rules
3. Relevant ADRs in [`docs/adr`](/home/mirdinj/quayboard/docs/adr/README.md)
4. Relevant implementation files and tests
