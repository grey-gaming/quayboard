# Current Milestone

## Status

Milestone 7 — Mission Control Auto-Advance and Orchestration

This milestone is the active implementation target.

## Goal

Extend Mission Control with auto-advance session controls, stage orchestration, implementation staleness detection, and supporting UI panels. Users can start/stop/resume/reset/step an auto-advance session that automatically progresses the project through planning stages.

## In Scope

- `auto_advance_sessions` database table and migration
- Auto-advance service: full session state machine (start, stop, resume, reset, step, onJobComplete)
- Auto-advance routes: `POST start/stop/resume/reset`, `GET status`, `POST step`
- `onJobComplete` callback wired from JobScheduler into auto-advance service
- Implementation staleness detection in next-actions service
- Shared Zod schemas for auto-advance types
- Frontend: `AutoAdvanceBanner`, `AutoAdvanceControlsCard`, `MissionActivityTimeline`, `MissionStatsStrip`, `NextActionsPanel` (extracted)
- Frontend: `useAutoAdvance` hook, `useNextActions` hook, `mission-control-api.ts` client module
- `WorkflowSettingsPage` at `/settings/workflow`
- Integration tests for all auto-advance session state transitions
- User-facing and internal architecture documentation

## Out Of Scope

- `MissionControlTubeMap` tube-map stage visualiser (deferred per user instruction)
- Sandbox execution and PR creation (M8)
- Bug management, review workflows, quality gates (M8+)
- Feature review routes and LLM executors

## Acceptance Criteria

The milestone is complete when:

- `pnpm db:migrate` succeeds on a fresh database
- `auto_advance_sessions` table exists with correct columns and constraints
- Auto-advance start/stop/resume/reset/step all work end-to-end via API
- Auto-advance pauses when a job fails (`paused_reason: job_failed`)
- Auto-advance resumes and picks up the next step after blocker is resolved
- Next-actions panel shows the correct next automatable step given current project state
- Features with a stale implementation record are flagged in Mission Control
- Phase gate checklist reflects live state in real time (SSE-reactive)
- All session state transitions have integration test coverage
- `WorkflowSettingsPage` renders at `/settings/workflow`
- `MissionControlPage` shows `AutoAdvanceBanner`, `AutoAdvanceControlsCard`, `MissionActivityTimeline`, `MissionStatsStrip`
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass
- User-facing documentation exists for all new screens and flows
- Internal architecture documentation exists for all new services, schema tables, and API routes

## Relevant ADRs

- [ADR 001: Branch and Verification Policy](../adr/001-branch-and-verification-policy.md)
- [ADR 007: SSE Realtime Updates](../adr/007-sse-realtime-updates.md)
- [ADR 008: Prefix Feature Workstream Tables And Use Approved Project Specs As Inputs](../adr/008-feature-workstream-table-prefixes.md)

## Working Rules

- Do not scaffold the tube-map visualiser (`MissionControlTubeMap`) — explicitly deferred
- Auto-advance sessions are project-scoped (one session per project at a time)
- The `onJobComplete` wiring must not break existing job behaviour when no auto-advance session is active
- Keep auto-advance service independent of sandbox execution (M8)
