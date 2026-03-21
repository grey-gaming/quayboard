# Current Milestone

## Status

M4: Milestones and Feature Builder

This milestone is the active implementation target.

## Goal

Deliver the post-blueprint planning workflow on top of the completed M3 planning pipeline: milestone planning, milestone design docs, feature catalogue management, dependency graphing, and Mission Control updates for the new milestone and feature gates.

## In Scope

- `milestones`, `milestone_use_cases`, `milestone_design_docs`, `feature_cases`, `feature_revisions`, `feature_dependencies`, and `feature_edges` schema additions
- milestone CRUD, lifecycle transitions, approved-user-flow coverage tracking, and milestone design doc approval
- `GenerateMilestones`, `GenerateMilestoneDesign`, and `AppendFeatureFromOnePager` job support with explicit validation before persistence
- feature CRUD, revision history, dependency wiring, project-scoped graph reads, and feature rollups
- Mission Control phase-gate and next-action updates for Milestones and Features
- frontend routes for `/projects/:id/milestones` and `/projects/:id/features`, including the milestone design doc panel, feature intake drawer, dependency graph, and approved-user-flows gate
- user-facing and architecture docs that describe the M4 repo reality

## Out Of Scope

- feature workstream editors (`/projects/:id/features/:fid`) and standalone task planning
- feature-level product, UX, tech, user-doc, and architecture-doc specification workflows
- bug report workflows, milestone execution sessions, or sandbox implementation runs
- generic graph editing beyond direct `depends_on` dependencies
- manual milestone design doc editing
- OAuth, RBAC, API keys, or other M12 auth extensions

## Acceptance Criteria

The milestone is complete when the repo can support the following:

- A user with approved user flows can create milestones manually and queue milestone generation
- Milestones store linked user-flow coverage, enforce `draft -> approved -> completed`, and expose coverage summary in the API/UI
- A design document can be generated for an approved milestone and approved independently through `artifact_approvals`
- A user can create and revise features only against approved milestones
- Features can be seeded from the approved overview document through the append job
- Feature dependencies remain acyclic and are exposed through project-scoped graph and rollup endpoints
- Mission Control includes Milestones and Features phases, plus next actions that reflect the new planning state
- The Milestones and Feature Builder pages stay gated behind approved user flows
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass
- Architecture and user docs describe the M4 repo behavior

## Relevant ADRs

- [ADR 001: Branch and Verification Policy](../adr/001-branch-and-verification-policy.md)
- [ADR 007: SSE Realtime Updates](../adr/007-sse-realtime-updates.md)

## Working Rules

- Keep milestone planning tied to approved user flows; do not introduce detached roadmap objects.
- Keep feature dependencies limited to direct `depends_on` links in M4; richer edge editing remains later-milestone work.
- Use `artifact_approvals` for milestone design doc approvals rather than inventing a new review table.
- Do not add the M5 Feature Editor, feature task routes, or later-milestone documentation workflows in production code.
- If implementation needs to deviate from the outline’s cookie-session, SSE, or project-scoped secret model, capture that in an ADR first.
