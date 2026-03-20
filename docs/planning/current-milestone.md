# Current Milestone

## Status

M3: UX and Technical Spec Builder

This milestone is complete.

There is no new active implementation target yet. Work beyond M3 requires an explicit request.

## Goal

Deliver the post-product-spec planning workflow on top of the completed M2 planning workflow: UX decision tiles, UX Spec generation or manual save, Technical decision tiles, Technical Spec generation or manual save, direct spec approval, User Flows generation and approval, and Mission Control updates.

## In Scope

- `decision_cards`, `project_blueprints`, and `artifact_approvals` schema additions, plus cleanup of obsolete blueprint review tables
- Kind-specific decision-tile generation from approved planning artifacts, with persisted option or custom selections plus explicit decision acceptance
- UX and Technical Spec generation from the accepted decision tiles, plus manual-save support for direct authoring and version history
- UX/Technical Spec approval records and direct approval flow after generation or manual save
- UX Spec, Technical Spec, and User Flows phase gates plus Mission Control next-action updates
- Shared schemas, API client contracts, and UI routes for UX Spec, Technical Spec, and artifact approval
- User-facing and architecture docs that describe the M3 repo reality

## Out Of Scope

- import workflow execution beyond the future-release stub page
- milestone, feature, documentation, bug, and sandbox execution workflows
- OAuth, RBAC, API keys, or other M12 auth extensions
- Anthropic provider support
- full tool-policy enforcement and tool audit tables
- sandbox execution, PR creation, or evidence bundle generation
- generic artifact workflow support beyond blueprint artifacts

## Acceptance Criteria

The milestone is complete when the repo can support the following:

- A user with an approved Product Spec can queue UX decision tiles, select options, accept them, and then generate or manually save the UX Spec
- Technical decision tiles and the Technical Spec remain locked until the UX Spec is approved
- User Flows remain locked until the Technical Spec is approved
- Decision selections persist, support custom choices, require explicit acceptance before generation, and invalidate stale canonical specs when the decision set changes
- A user can generate or manually save both UX and Technical Specs through the API/UI and restore older versions
- A UX or Technical Spec can be approved directly after generation or manual save, and approval writes an `artifact_approvals` record for the canonical spec revision
- Mission Control includes separate UX Spec, Technical Spec, and User Flows phases plus workflow-specific next actions
- Shared schema imports resolve across the workspace without TypeScript errors
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass
- Architecture and user docs describe the M3 repo behavior

## Relevant ADRs

- [ADR 001: Branch and Verification Policy](../adr/001-branch-and-verification-policy.md)
- [ADR 007: SSE Realtime Updates](../adr/007-sse-realtime-updates.md)

## Working Rules

- Keep the import path as an explicit stub page rather than partial execution.
- Use project-scoped settings and secrets for setup state; do not introduce user-level or system-level PAT/API-key defaults.
- Limit the artifact workflow implementation to `blueprint_ux` and `blueprint_tech` in M3.
- Keep OAuth, full tool-policy enforcement, and sandbox execution deferred to their later milestones.
- If implementation needs to deviate from the outline’s cookie-session, SSE, or project-scoped secret model, capture that in an ADR first.
