# Current Milestone

## Active Target

M3: Blueprint Builder

This is the active implementation target. Work beyond M3 requires an explicit request.

## Goal

Deliver the Blueprint phase on top of the completed M2 planning workflow: decision deck generation, persisted user selections, UX/tech blueprint generation or manual save, review-item triage, approval, and Mission Control updates.

## In Scope

- `decision_cards`, `project_blueprints`, `artifact_review_runs`, `artifact_review_items`, and `artifact_approvals` schema additions
- Decision deck generation from approved planning artifacts, with persisted option or custom selections
- UX and tech blueprint generation from the selected deck plus manual-save support for direct authoring
- Blueprint review jobs, review-item triage (`DONE`, `ACCEPTED`, `IGNORED`), and approval records
- Blueprint-specific phase gates and Mission Control next-action updates
- Shared schemas, API client contracts, and UI routes for Blueprint Builder and artifact review
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

- A user with approved user flows can queue a decision deck and see recommendation-driven decision cards
- Decision card selections persist, support custom choices, and invalidate stale canonical blueprints when the deck changes
- A user can generate UX and tech blueprints from the selected deck or save them manually through the API/UI
- Review jobs create structured review items with `BLOCKER`, `WARNING`, and `SUGGESTION` severities
- Review items can be triaged to `DONE`, `ACCEPTED`, or `IGNORED`
- A blueprint cannot be approved until review has completed and no blocker remains open
- Approval writes an `artifact_approvals` record for the canonical blueprint revision
- Mission Control includes the Blueprint phase plus blueprint-specific next actions
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
