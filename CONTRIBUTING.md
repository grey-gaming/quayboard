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
- required verification for the change has been run, if executable behavior exists
- the work is committed on its branch and pushed to `origin`
- assumptions and unverified areas are called out in the handoff
- any architectural deviation from the outline is captured in an ADR

## Branch Workflow

- Start each milestone by creating or switching to its dedicated branch.
- Keep all work for that milestone, including bug fixes, on the same branch.
- Commit with a clear message as work progresses.
- Before pushing, run the required verification for the change.
- Push the milestone branch to `origin` so it stays current.
- If push is blocked by environment, credentials, or policy, state that explicitly in the handoff.

## Pull Requests

- Use `.github/pull_request_template.md` for every PR.
- Record the milestone, scope, verification, documentation impact, and ADR decision in the PR.
- If no runnable verification exists yet, state that explicitly instead of leaving the section blank.

## Naming Conventions

- Do not use milestone labels such as `m0` or `m1` in filenames or directory names.
- Use descriptive names based on function or content, not delivery phase.
- Use lowercase kebab-case for new directories and for non-component files unless a tool requires another convention.
- Keep required special names unchanged, such as `README.md`, `AGENTS.md`, and GitHub metadata files.
- When React component files are introduced, use PascalCase for files whose primary export is a component.

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

- Before pushing, run the required verification for the change and do not push known-broken work unless explicitly requested.
- Full CI should be green before merge; it does not have to be the local push gate in every case.
- Do not claim tests passed unless you ran them.
- If no runnable verification exists yet, say that directly.
- When executable behavior is added, include the narrowest relevant verification with the change.
- Once the toolchain exists, required verification should usually mean changed-area tests plus standard fast repo checks such as lint and typecheck.

## ADR Rule

Create or update an ADR when a change affects:

- monorepo structure
- core framework or tooling choices
- API contract strategy
- design-system rules
- workflow or governance policy
