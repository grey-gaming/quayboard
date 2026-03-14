# Contributing

This repository is still in the planning and foundation stage. Contribution quality depends more on scope control than on volume.

## Ground Rules

- Build only against the active milestone in `docs/planning/current-milestone.md`.
- Keep `README.md` truthful about current repo state.
- Prefer small, reviewable changes over broad scaffolding.
- Do not implement future roadmap items unless explicitly requested.
- Do all work on a dedicated branch, not directly on `main`.

## Definition Of Done

A change is done when all of the following are true:

- it is in scope for the active milestone
- documentation reflects the new reality
- relevant verification has been run, if executable behavior exists
- the work is committed on its branch and pushed to `origin`
- assumptions and unverified areas are called out in the handoff
- any architectural deviation from the outline is captured in an ADR

## Branch Workflow

- Start each cycle by creating or switching to a dedicated branch.
- Keep branch scope tight to one cycle's work.
- Commit with a clear message before handoff.
- Push the branch to `origin` at the end of the cycle.
- If push is blocked by environment, credentials, or policy, state that explicitly in the handoff.

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
