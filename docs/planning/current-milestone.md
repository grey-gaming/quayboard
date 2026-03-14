# Current Milestone

## Active Target

M0: Repository and Toolchain Foundations

This is the only milestone that may be implemented by default. Any work beyond M0 requires an explicit request.

## Goal

Establish the Quayboard monorepo, toolchain, local development environment, and baseline documentation. No product functionality should be built in this milestone.

## In Scope

- pnpm workspace scaffold for `apps/api`, `apps/web`, `apps/mcp`, and `packages/shared`
- shared TypeScript configuration
- Tailwind CSS and design-token setup
- Docker Compose for local Postgres
- `.env.example`
- initial build, typecheck, and test wiring
- CI baseline
- initial `docs/user/` and `docs/architecture/` scaffolding

## Out Of Scope

- product features
- API routes beyond foundation scaffolding
- database tables and migrations for later milestones
- authentication flows
- LLM provider integration
- sandbox execution logic
- speculative abstractions for future milestones

## Acceptance Criteria

The milestone is complete when the repo can support the following:

- `pnpm install && pnpm build` succeeds on a clean checkout
- `docker compose up -d && pnpm db:migrate` runs on a fresh Postgres instance
- `pnpm dev` starts the API and web servers
- `GET /healthz` returns `200`
- `pnpm typecheck && pnpm test && pnpm build` pass in CI
- architecture documentation exists for monorepo structure, toolchain choices, and CI configuration

## Working Rules

- Prefer the smallest scaffold that satisfies the acceptance criteria.
- Keep placeholders clearly marked as scaffolding.
- Do not build M1 features early to "save time later."
- If M0 forces a design choice that changes the outline, capture it in an ADR.
