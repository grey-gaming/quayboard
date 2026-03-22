# Current Milestone

## Status

Post-M5 UX Sweep And Bug Fixes

This milestone is the active implementation target.

## Goal

Stabilize the completed M1-M5 planning workflow before starting M6 by fixing defects, tightening UX rough edges, and making small workflow improvements without expanding scope into task-planning implementation.

## In Scope

- UX polish and bug fixes across the completed M1-M5 planning workflow
- small copy, layout, interaction, validation, and navigation improvements that reduce user friction without expanding milestone scope
- fixes for regressions or rough edges in Mission Control, setup, document editors, milestones, features, and the Feature Editor
- test coverage and documentation updates needed to reflect corrected repo behavior
- branch and planning state updates required to hold M6 feature work until this sweep is complete

## Out Of Scope

- M6 delivery-task data modeling, task generation routes, or standalone task workflow implementation
- new planning stages, new execution surfaces, or feature expansion beyond what M1-M5 already define
- broad architecture rewrites that are not required to fix a concrete UX or bug issue
- sandbox execution, PR creation, verification runs, or later-milestone delivery features not already implemented
- OAuth, RBAC, API keys, or other M12 auth extensions

## Acceptance Criteria

The milestone is complete when the repo can support the following:

- M1-M5 workflow screens remain functional after the sweep, with targeted UX and bug issues resolved without introducing M6 scope
- existing planning phase gates and approvals still behave as documented
- any bug fix that changes observable behavior is covered by tests or documentation where appropriate
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass for the sweep changes
- repo docs clearly state that M5 is complete and M6 has not started yet

## Relevant ADRs

- [ADR 001: Branch and Verification Policy](../adr/001-branch-and-verification-policy.md)
- [ADR 007: SSE Realtime Updates](../adr/007-sse-realtime-updates.md)
- [ADR 008: Prefix Feature Workstream Tables And Use Approved Project Specs As Inputs](../adr/008-feature-workstream-table-prefixes.md)

## Working Rules

- Treat completed M1-M5 behavior as the baseline and prefer targeted corrections over redesign.
- Do not start M6 task-planning implementation during this sweep; keep existing task surfaces at their current stub or placeholder level.
- Keep live implementation-staleness tracking deferred until M6 implementation-record support exists.
- Update repo-facing docs only when the sweep changes actual repo truth.
- If implementation needs to deviate further from the outline’s cookie-session, SSE, or project-scoped secret model, capture that in an ADR first.
