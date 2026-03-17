# Current Milestone

## Active Target

M2: Project Creation, Setup, Overview Document, and User Flows

This is the active implementation target. Work beyond M2 requires an explicit request.

## Goal

Deliver the scratch-path planning workflow: instance readiness, project creation, project setup, the 14-question questionnaire, LLM-assisted overview document generation, Mission Control, and user-flow generation/approval.

## In Scope

- `GET /api/system/readiness` with deployment prerequisite checks and remediation text
- pre-auth readiness gating on register/sign-in until all instance checks pass
- Project list/create/update flow with project-scoped setup status and Mission Control landing page
- Project setup workflow:
  repository verification via GitHub PAT, project-scoped LLM provider selection, sandbox defaults, evidence policy, and tool-policy preview
- Questionnaire persistence with the refined 14-question M2 definition
- Async job execution for project description, overview document generation, and user-flow generation/deduplication
- Overview document canonical/version history plus approval
- User-flow CRUD, coverage warnings, explicit warning acceptance, and approval snapshotting
- Shared schemas for planning-phase resources and SSE-driven job refresh
- User-facing and architecture docs that describe the M2 repo reality

## Out Of Scope

- import workflow execution beyond the future-release stub page
- OAuth, RBAC, API keys, or other M12 auth extensions
- Anthropic provider support
- full tool-policy enforcement and tool audit tables
- sandbox execution, PR creation, or evidence bundle generation
- blueprint, milestone, feature, and implementation workflows

## Acceptance Criteria

The milestone is complete when the repo can support the following:

- A visitor can view instance readiness with concrete remediation text, and register/sign-in stay blocked until all instance checks pass
- An authenticated user can view project setup readiness with concrete remediation text
- A user can create a project, connect a repo with a GitHub PAT, verify the configured LLM, and verify sandbox startup
- A user can save questionnaire answers, queue overview generation, inspect the canonical overview plus history, restore a version, and approve the current overview
- Mission Control is the project landing page and reflects phase gates and next actions
- User flows can be generated, added manually, deduplicated, and approved only when warnings are resolved or explicitly accepted
- Shared schema imports resolve across the workspace without TypeScript errors
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass
- Architecture and user docs describe the M2 repo behavior

## Relevant ADRs

- [ADR 001: Branch and Verification Policy](../adr/001-branch-and-verification-policy.md)
- [ADR 007: SSE Realtime Updates](../adr/007-sse-realtime-updates.md)

## Working Rules

- Keep the M2 import path as an explicit stub page rather than partial execution.
- Use project-scoped settings and secrets for setup state; do not introduce user-level or system-level PAT/API-key defaults.
- Keep OAuth, full tool-policy enforcement, and sandbox execution deferred to their later milestones.
- If implementation needs to deviate from the outline’s cookie-session, SSE, or project-scoped secret model, capture that in an ADR first.
