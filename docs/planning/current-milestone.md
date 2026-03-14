# Current Milestone

## Active Target

M1: Database, API Skeleton, and Auth Foundation

This is the active implementation target. Work beyond M1 requires an explicit request.

## Goal

Stand up the authenticated API foundation: core tables, session-based auth, protected `/api` routing, project-scoped secrets, and the minimal frontend auth shell. No LLM execution or M2 product workflows should be built in this milestone.

## In Scope

- Drizzle schema and initial SQL migration for foundation tables only:
  `projects`, `project_counters`, `repos`, `users`, `sessions`, `jobs`, `llm_runs`, `settings`, `encrypted_secrets`
- Email/password auth foundation with session cookies:
  `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Session middleware on all `/api/*` routes
- `GET /api/events` SSE endpoint with authenticated connection handling
- Project-scoped secrets API and internal secret-to-environment resolver
- Minimal authenticated project foundation routes needed to support project-scoped secrets:
  `POST /api/projects`, `GET /api/projects`, `GET /api/projects/:id`
- Full API route-module skeleton for later resource areas, returning typed `501` stubs
- Minimal frontend auth shell using DS primitives:
  `/login`, `/register`, protected `/`
- Shared schemas for auth, users, sessions, projects, settings, secrets, and SSE events
- Internal architecture docs, a user auth guide, and the SSE ADR referenced by the outline

## Out Of Scope

- overview document, user-flow, blueprint, milestone, feature, and sandbox product workflows
- LLM provider integration, jobs scheduler execution, and any live `llm_runs` usage
- OAuth, RBAC, API keys, or other M12 auth extensions
- frontend project setup, Mission Control, or other M2 screens
- later-milestone schema columns and tables
- speculative abstractions that are not required by the M1 acceptance criteria

## Acceptance Criteria

The milestone is complete when the repo can support the following:

- `pnpm db:migrate` runs cleanly on a fresh Postgres instance and can be rerun idempotently
- `GET /healthz` returns `{ "status": "ok" }` with `200`
- `GET /api/events` returns `text/event-stream` for authenticated clients and `401` for unauthenticated clients
- A user can register, log in, call `/auth/me`, and access protected `/api/*` routes with a valid session cookie
- Unauthenticated requests to `/api/*` return `401`
- Secrets can be written and rotated via API, but only metadata is ever returned
- Shared schema imports resolve across the workspace without TypeScript errors
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass; `pnpm test:e2e` passes when browser dependencies are available
- Internal architecture documentation exists for the new schema, auth/session behavior, route skeleton, SSE, and secrets flow

## Relevant ADRs

- [ADR 001: Branch and Verification Policy](../adr/001-branch-and-verification-policy.md)
- [ADR 007: SSE Realtime Updates](../adr/007-sse-realtime-updates.md)

## Working Rules

- Prefer the smallest vertical slice that satisfies the authenticated API foundation.
- Keep later-milestone endpoints clearly marked as typed `501` scaffolding.
- Do not build M2 product flows early to "save time later."
- If implementation needs to deviate from the outline’s cookie-session, SSE, or project-scoped secret model, capture that in an ADR first.
