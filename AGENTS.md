# AGENTS.md

This file defines repository-specific operating rules for any agent working in Quayboard.

## Mission

Keep the repository easy to reason about while extending or correcting the product that already exists. Work from current repo truth, preserve established boundaries, and do not invent undocumented behavior.

## Source Of Truth Order

Read these before making non-trivial changes:

1. `README.md`
2. `AGENTS.md`
3. relevant ADRs in `docs/adr/`
4. relevant architecture docs in `docs/architecture/`
5. local code and tests in the affected area

If these sources conflict, prefer the more specific and newer source. If the conflict is architectural and unresolved, stop and ask or add an ADR instead of guessing.

## Fast Start

Use these locations to build context quickly:

- `apps/web/src/app.tsx` for the route map and top-level UI structure
- `apps/api/src/server.ts` for the API route registration
- `apps/api/src/app-services.ts` for service wiring and product boundaries
- `packages/shared/src/` for shared runtime contracts and schemas
- `apps/web/src/pages/` for customer-visible screens
- `apps/api/src/routes/api/` for authenticated API surfaces
- `apps/api/src/services/` for business logic
- `docs/architecture/` for internal implementation docs
- `docs/user/` for markdown that powers the public `/docs` experience

## Current Product Boundaries

Treat these as current truth unless the user explicitly asks to change them:

- The supported project flow starts from scratch. The import path is stubbed.
- Mission Control, planning artefacts, milestones, feature workstreams, auto-advance, and task planning are implemented surfaces.
- The `Implementation` section in project navigation is intentionally disabled.
- Bug routes, sandbox routes, and tool-policy routes are registered but currently return `501 Not Implemented`.
- `apps/mcp` is placeholder scaffolding only.
- Workflow settings are present as a read-only surface; persisted workflow defaults are not implemented.

Do not build beyond these boundaries as a convenience shortcut.

## Required Workflow

Before editing:

1. Read the relevant sections of `README.md`, this file, and any ADRs or architecture docs for the area.
2. Inspect the repo for existing patterns before proposing new structure.
3. State assumptions if repo truth is missing.
4. Create or switch to a dedicated working branch before making changes. Do not work directly on `main`.

While editing:

1. Prefer the smallest vertical slice that satisfies the request.
2. Keep monorepo boundaries intact.
3. Update nearby documentation when repo truth, workflow, or structure changes.
4. Avoid placeholder implementations that blur what is real versus stubbed.

After editing:

1. Run the narrowest relevant verification for the change.
2. Check whether contributor-facing or agent-facing docs changed and update only what is now outdated.
3. Commit the change with a clear message.
4. Push the branch to `origin` if the environment and permissions allow it.
5. If branch creation, commit, or push is blocked, say so explicitly in the handoff.
6. Report what changed, what was verified, and what remains unverified.
7. Call out assumptions, risks, or follow-up work explicitly.

## Architecture Guardrails

- Put shared runtime schemas and cross-app types in `packages/shared`, not duplicated per app.
- Frontend pages must use API client modules and shared hooks rather than inline `fetch()` calls.
- Backend routes must use schema-validated request and response contracts.
- LLM integrations must remain mockable; tests must not depend on live model access.
- LLM failures or malformed LLM outputs must fail explicitly. Do not silently synthesize substitute production content.
- Do not create hidden tool-owned state inside managed repositories.

## Naming Rules

- Name files and directories for their function or content, not for delivery phases or temporary efforts.
- Use lowercase kebab-case for new directories and new non-component filenames unless a tool requires otherwise.
- Keep platform-required names unchanged, such as `README.md`, `AGENTS.md`, and files under `.github/`.
- Use PascalCase for React component files that export a primary component.
- Keep test filenames aligned with the target file and the repo's existing test suffixes.

## File Quality Rules

- Prefer small files with a single clear responsibility.
- Treat roughly 300-500 lines as a soft warning range for most code files, not a hard limit.
- If a file is becoming hard to understand, split or extract when that cleanup is low-risk and in scope.
- Larger files are acceptable when the content is still cohesive and splitting would make it harder to follow.

## Refactoring And Deletion Rules

- Apply the boy scout rule when the cleanup is low-risk and stays within scope.
- Refactoring that reduces complexity, removes duplication, shrinks files, or improves clarity is a positive change when behavior is preserved.
- Delete dead code, unused files, obsolete flags, and stale documentation when they are clearly no longer needed.
- Do not keep code, files, or configuration "just in case"; version control is the backup.

## Documentation Rules

- `README.md` must describe the product and workspace as they currently exist.
- `AGENTS.md` must remain a practical fast-start handbook for agents working in this repo.
- `docs/architecture/` is for internal engineering documentation.
- `docs/user/` is for the public docs content rendered at `/docs`.
- `docs/planning/` contains planning material and should not override current implementation truth unless the user explicitly asks to work from it.

## Verification Guidance

- Before pushing, run the required verification for the change and do not push known-broken work unless explicitly instructed.
- Full CI green status is the merge bar, not necessarily the local push bar.
- Prefer the narrowest relevant checks first, then wider repo checks when the change crosses boundaries.
- Current top-level verification commands are:
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm db:migrate`
- Never claim tests or checks passed unless you actually ran them.

## Safety Rules

- Never commit secrets, tokens, or example credentials that look real.
- Never weaken governance or evidence requirements without explicit instruction.
- Never use destructive git or filesystem commands unless explicitly requested.
- Never claim a command, test, route, or file exists unless you verified it locally.

## Expected Handoff Format

Final responses should include:

- a short summary of what changed
- verification performed, or a clear statement that verification was not possible
- any remaining assumptions, risks, or next steps
