# API Foundation

This document describes the M1 Quayboard backend foundation as it exists in the repository.

## Scope

M1 establishes the authenticated API shell and the minimum frontend needed to exercise it. It does not add overview-document generation, user flows, blueprints, milestone planning, or sandbox execution.

## Database Foundation

The API now owns a single initial migration covering the M1 foundation tables:

- `users` and `sessions` for local email/password auth
- `projects` and `project_counters` for the minimum project identity needed by project-scoped secrets
- `repos`, `jobs`, `llm_runs`, and `settings` as storage foundations for later milestones
- `encrypted_secrets` for write-only credential storage

Implementation choices:

- IDs are application-generated UUID strings rather than database-generated IDs.
- Enumerated values are stored as text with check constraints in SQL, which keeps the migration simple and avoids coupling the application to PostgreSQL enum migrations.
- The migration is intentionally limited to M1 fields only. Later milestones must add their own columns and tables through new migrations.

## Auth And Session Model

Authentication uses local email/password accounts only in M1.

- Passwords are hashed with Argon2id before storage.
- Session cookies are stored in the browser as `qb_session`.
- The raw session token is never stored in the database; only its SHA-256 hash is persisted.
- Session cookies are HTTP-only, `SameSite=Lax`, and use the secure flag only outside local development.
- `/auth/register` and `/auth/login` both issue a fresh session cookie.
- `/auth/logout` revokes the stored session and clears the cookie.

All `/api/*` routes share the same pre-handler, which resolves the cookie into a known user. `/healthz` and `/auth/*` remain public.

## API Skeleton

The route layer is split into one Fastify module per major resource area from the project outline.

M1 implements real behavior for:

- `GET /healthz`
- `/auth/*`
- `GET /api/events`
- `POST /api/projects`
- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects/:id/secrets`
- `GET /api/projects/:id/secrets`
- `PATCH /api/secrets/:id`

All other route modules return a typed `501 not_implemented` response. This keeps the API shape visible without pulling later milestone behavior forward.

## SSE

Realtime updates use Server-Sent Events from `GET /api/events`.

- connections are scoped to the authenticated user
- the server sends an immediate `connected` event
- the server sends periodic `heartbeat` events to keep the stream alive
- the SSE hub is in-process for now; multi-node fan-out is out of scope for M1

## Secrets

Secrets are stored encrypted at rest and never returned through the API.

- the `SECRETS_ENCRYPTION_KEY` environment variable provides the application-level encryption key
- encryption uses AES-256-GCM with a per-secret random IV
- API responses expose only metadata: type, timestamps, and a masked identifier
- revocation hard-deletes the secret row
- the backend also exposes an internal secret-to-environment resolver for later sandbox injection
