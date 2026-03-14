# Contributing

This repository is still in the planning and foundation stage. Contribution quality depends more on scope control than on volume.

## Ground Rules

- Build only against the active milestone in `docs/planning/current-milestone.md`.
- Keep `README.md` truthful about current repo state.
- Prefer small, reviewable changes over broad scaffolding.
- Do not implement future roadmap items unless explicitly requested.
- Do all work on a dedicated branch for the active milestone, not directly on `main`.
- Keep bug fixes for that milestone on the same branch unless explicitly directed otherwise.

## Definition Of Done

A change is done when all of the following are true:

- it is in scope for the active milestone
- documentation reflects the new reality
- relevant verification has been run, if executable behavior exists
- the work is committed on its branch and pushed to `origin`
- assumptions and unverified areas are called out in the handoff
- any architectural deviation from the outline is captured in an ADR

## Branch Workflow

- Start each milestone by creating or switching to its dedicated branch.
- Keep all work for that milestone, including bug fixes, on the same branch.
- Commit with a clear message as work progresses.
- Push the milestone branch to `origin` so it stays current.
- If push is blocked by environment, credentials, or policy, state that explicitly in the handoff.

## Pull Requests

- Use `.github/pull_request_template.md` for every PR.
- Record the milestone, scope, verification, documentation impact, and ADR decision in the PR.
- If no runnable verification exists yet, state that explicitly instead of leaving the section blank.

## Documentation Expectations

Update documentation when you:

- add or rename major directories
- add new developer workflows or commands
- change architecture or project structure
- change milestone scope or sequencing

Use these files for the right purpose:

- `README.md` for current repo state and contributor entrypoint
- `AGENTS.md` for agent rules
- `docs/planning/current-milestone.md` for active scope
- `docs/adr/` for architectural decisions

## Verification Expectations

- Do not claim tests passed unless you ran them.
- If no runnable verification exists yet, say that directly.
- When executable behavior is added, include the narrowest relevant verification with the change.

## ADR Rule

Create or update an ADR when a change affects:

- monorepo structure
- core framework or tooling choices
- API contract strategy
- design-system rules
- workflow or governance policy
