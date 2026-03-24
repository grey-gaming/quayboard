# Current Milestone

## Status

Milestone 6 — Approval and Task Planning

This milestone is the active implementation target.

## Goal

Enable task planning for features with approved technical specifications. Users can generate clarification questions, answer them (manually or via LLM auto-answer), generate ordered delivery task lists, and track implementation records that link features to implemented tech revisions.

## In Scope

- Task planning database schema and migrations
- Clarification question generation and answering workflow
- Delivery task list generation from answered clarifications
- Implementation record tracking (which tech revision was implemented, commit SHA)
- Frontend Tasks tab in Feature Editor (replace existing stub)
- Job executors: `GenerateTaskClarifications`, `AutoAnswerTaskClarifications`, `GenerateFeatureTaskList`, `RecommendNextFeature`

## Out Of Scope

- Feature review routes and LLM executors (deferred to future milestone)
- Bug reports, bug fix tasks, and verification workflow (deferred to M8 or later)
- Quality gates for task plans (`ReviewFeatureCohesion`, `StressTestTaskPlan`)
- Sandbox execution and PR creation (M8)
- Auto-advance orchestration (M7)

## Acceptance Criteria

The milestone is complete when the repo can support the following:

- Database migration creates all new task planning and implementation record tables without errors
- Task planning session is created when a feature has an approved tech specification
- Clarification questions can be generated via LLM and listed
- Clarification questions can be answered manually or via auto-answer
- Delivery task list can be generated from answered clarifications
- Implementation records can be created to link a feature to an implemented tech revision
- Tasks tab in Feature Editor shows clarification questions and delivery tasks with appropriate states
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass
- `pnpm db:migrate` succeeds on a fresh database
- User-facing documentation exists for all new screens and flows introduced in this milestone
- Internal architecture documentation exists for all new services, schema tables, and API routes

## Relevant ADRs

- [ADR 001: Branch and Verification Policy](../adr/001-branch-and-verification-policy.md)
- [ADR 007: SSE Realtime Updates](../adr/007-sse-realtime-updates.md)
- [ADR 008: Prefix Feature Workstream Tables And Use Approved Project Specs As Inputs](../adr/008-feature-workstream-table-prefixes.md)

## Working Rules

- Keep task planning workflow independent of sandbox execution, which arrives in M8
- Implementation records capture the relationship between features and implemented revisions; they do not trigger sandbox runs
- Clarification questions and delivery tasks are scoped to a single feature and stored per-feature
- Remove any existing M6 placeholder or stub code related to feature review (e.g., ReviewPanel)
- Update repo-facing docs after all implementation is verified