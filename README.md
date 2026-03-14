# Quayboard

Quayboard is a web control plane for managing software projects and orchestrating agentic coding runs with governance, auditability, and PR-first delivery.

## Status

This repository is in pre-development. The product vision, target architecture, and roadmap are defined, but the monorepo scaffold and application code have not been built yet.

The active implementation target is M0: Repository and Toolchain Foundations.

## Source Of Truth

Use these documents in this order:

1. [docs/planning/current-milestone.md](docs/planning/current-milestone.md) for what may be built right now.
2. [AGENTS.md](AGENTS.md) for mandatory agent behavior in this repo.
3. [docs/planning/quayboard-project-outline.md](docs/planning/quayboard-project-outline.md) for the target product, architecture, and full roadmap.
4. [docs/adr/README.md](docs/adr/README.md) for decisions that override or refine the outline.
5. [CONTRIBUTING.md](CONTRIBUTING.md) for human workflow and Definition of Done.

## Current Repository State

Current contents are documentation only:

- `docs/planning/quayboard-project-outline.md` defines the full project outline.
- `docs/planning/current-milestone.md` defines the current build target.
- `docs/adr/` contains the decision log scaffold.
- `docs/user/` and `docs/architecture/` are placeholders for milestone documentation.

There are no runnable workspace commands yet. Do not document setup or development commands until they exist in the repo.

## Active Milestone

M0 establishes the repository foundation only. It includes:

- pnpm workspace scaffold for `apps/api`, `apps/web`, `apps/mcp`, and `packages/shared`
- shared TypeScript configuration
- Tailwind and design token setup
- Docker Compose for local Postgres
- `.env.example`
- initial CI, test, and build baseline
- initial `docs/user/` and `docs/architecture/` scaffolding

M0 does not include product features, API endpoints, database schema beyond what is needed for the foundation, or speculative scaffolding for later milestones.

## Planned System Snapshot

The target system described in the outline is a TypeScript monorepo with:

- `apps/api` for the Fastify backend
- `apps/web` for the React frontend
- `apps/mcp` for the MCP server
- `packages/shared` for shared Zod schemas and TypeScript types

Planned core tooling includes pnpm workspaces, React, Vite, Tailwind CSS, Fastify, Drizzle ORM, PostgreSQL, Vitest, Playwright, and Docker Compose.

Treat this as planned architecture, not as implemented reality.

## Working Model

Development in this repo is milestone-gated:

- Build only the active milestone unless the request explicitly expands scope.
- Prefer the smallest vertical slice that satisfies milestone acceptance criteria.
- Do not add future-milestone routes, tables, components, or abstractions "for later."
- Do work on a dedicated git branch per cycle and push that branch at cycle end.
- Record meaningful architectural deviations as ADRs before implementing them.

## Documentation Map

- [Project outline](docs/planning/quayboard-project-outline.md)
- [Current milestone](docs/planning/current-milestone.md)
- [Agent contract](AGENTS.md)
- [Contributor guide](CONTRIBUTING.md)
- [ADR guide](docs/adr/README.md)
- [User docs scaffold](docs/user/README.md)
- [Architecture docs scaffold](docs/architecture/README.md)

## Contribution Expectations

Every non-trivial change should:

- align to the active milestone
- keep the README honest about current repo state
- update docs when behavior or structure changes
- add or update tests when executable behavior is introduced
- explain any unverified assumptions in the final handoff
