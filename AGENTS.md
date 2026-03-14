# AGENTS.md

This file defines mandatory operating rules for any LLM agent working in this repository.

## Mission

Build Quayboard incrementally from the approved planning documents without drifting from the current milestone, inventing undocumented architecture, or leaving repo state harder to reason about.

## Source Of Truth Order

Read these before making non-trivial changes:

1. `docs/planning/current-milestone.md`
2. `README.md`
3. `docs/planning/quayboard-project-outline.md`
4. relevant ADRs in `docs/adr/`
5. local code and tests in the affected area

If these sources conflict, the more specific and newer document wins. If the conflict is architectural and unresolved, stop and ask or add an ADR instead of guessing.

## Operating Mode

- The repo is in pre-development and currently targeting M0 only.
- Work one milestone at a time.
- Do not scaffold future milestones unless the user explicitly requests it.
- Keep changes small, reviewable, and directly tied to milestone deliverables or acceptance criteria.
- Use one dedicated git branch per milestone; do not work directly on `main`.
- Keep bug fixes for a milestone on that same milestone branch unless explicitly directed otherwise.

## Required Workflow

Before editing:

1. Read the active milestone doc and the relevant section of the project outline.
2. Inspect the repo for existing patterns before proposing new structure.
3. Confirm whether the requested change belongs to the current milestone.
4. State assumptions if repo truth is missing.
5. Create or switch to the dedicated branch for the active milestone before making changes.

While editing:

1. Prefer the smallest vertical slice that satisfies the request.
2. Keep planned monorepo boundaries intact.
3. Update nearby docs when adding new structure, workflow, or conventions.
4. Avoid placeholder implementations that obscure what is real versus planned.

After editing:

1. Run all required verification for the change that exists in the repo before pushing.
2. Check whether the cycle changed repo-wide agent rules, contributor-facing repo reality, or active milestone scope.
3. Update only the relevant governing docs when needed:
4. `AGENTS.md` if repo-level agent behavior or mandatory workflow changed.
5. `README.md` if current repo state, setup, structure, or contributor workflow changed.
6. `docs/planning/current-milestone.md` if the active milestone, scope boundaries, or acceptance criteria changed.
7. Leave these files untouched if the cycle did not change their truth.
8. Commit the cycle's changes with a clear message to the milestone branch.
9. Push the milestone branch to `origin` so it stays current.
10. If branch creation, commit, or push is blocked, say so explicitly in the handoff.
11. Report what changed, what was verified, and what remains unverified.
12. Call out any assumptions, risks, or follow-up work explicitly.

## Architecture Guardrails

- Preserve the target monorepo shape from the outline unless an ADR changes it.
- Put shared runtime schemas and cross-app types in `packages/shared`, not duplicated per app.
- Frontend pages must use design-system primitives and approved layout patterns once the UI exists.
- Do not use inline `fetch()` in page components; use API client modules.
- Backend routes must use schema-validated request and response contracts.
- LLM integrations must be mockable; tests must not depend on live model access.
- Do not create hidden tool-owned state inside managed repositories.

## Naming Rules

- Do not put milestone labels such as `m0`, `m1`, or `m14` in filenames or directory names.
- Milestone labels are allowed in branch names, planning text, PR text, and commit messages, but not in persistent repo filenames.
- Name files for their function or content, not for the milestone that introduced them.
- Use lowercase kebab-case for new directories and for new non-component filenames unless a tool or framework requires a different convention.
- Keep special root docs and platform-required names exactly as required, such as `README.md`, `AGENTS.md`, and files under `.github/`.
- When frontend component files are introduced, use PascalCase for files that export a primary React component and kebab-case for non-component modules.
- Test files should mirror the target file name and use the repo's chosen test suffix once the toolchain exists.

## Delivery Guardrails

- README must describe current reality, not aspirational commands or setup that do not exist yet.
- Do a documentation trigger check at the end of every cycle, but do not rewrite governing docs unless their content is actually outdated.
- Do not work directly on `main`; use one branch per milestone and keep that branch updated with commits and pushes.
- Before pushing, run the required verification for the change and do not push known-red work unless explicitly instructed.
- Treat full CI green status as the merge requirement, not necessarily the push requirement.
- Apply the repo naming rules to all new files and directories; do not encode milestone numbers into persistent paths.
- Do not introduce future-milestone tables, routes, hooks, or components "for convenience."
- Prefer explicit TODOs in planning docs over speculative production code.
- Record meaningful architecture, workflow, or design-system deviations as ADRs.
- When a change adds a new developer workflow, document it in `README.md` or `CONTRIBUTING.md`.

## Safety Rules

- Never commit secrets, tokens, or example credentials that look real.
- Never weaken governance or evidence requirements without explicit instruction.
- Never use destructive git or filesystem commands unless explicitly requested.
- Never claim a command, test, route, or file exists unless you verified it locally.
- Never claim tests or checks passed unless you actually ran them.

## Expected Handoff Format

Final responses should include:

- a short summary of what changed
- verification performed, or a clear statement that verification was not possible
- any remaining assumptions, risks, or next steps
