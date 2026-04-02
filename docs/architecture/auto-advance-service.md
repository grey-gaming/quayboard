# Auto-Advance Service

The auto-advance service (`apps/api/src/services/auto-advance.ts`) orchestrates the Quayboard planning workflow by automatically enqueuing background jobs in response to the current project state. It owns the `auto_advance_sessions` table and publishes SSE events so the frontend stays up to date within 2 seconds of every state change. The workflow is active-milestone driven: Quayboard generates the milestone map once, then fully plans only the active milestone before advancing to the next one.

---

## Database Schema

**Table: `auto_advance_sessions`** (`apps/api/drizzle/0012_m7_auto_advance.sql`)

One row per project (enforced by a unique index on `project_id`).

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `project_id` | TEXT FK | Cascading delete from `projects` |
| `status` | TEXT CHECK | `idle \| running \| paused \| completed \| failed` |
| `current_step` | TEXT nullable | Key of the step currently executing |
| `paused_reason` | TEXT CHECK nullable | Why the session is paused (see below) |
| `auto_approve_when_clear` | BOOLEAN | Reserved for future auto-approval logic |
| `skip_review_steps` | BOOLEAN | When true, approval gates are bypassed |
| `auto_repair_milestone_coverage` | BOOLEAN | Opt-in repair loop for milestone coverage failures |
| `milestone_repair_count` | INTEGER | Counts bounded milestone auto-repair attempts in the current session |
| `creativity_mode` | TEXT | `conservative \| balanced \| creative` |
| `started_at` | TIMESTAMPTZ nullable | Set when status transitions to `running` |
| `paused_at` | TIMESTAMPTZ nullable | Set when status transitions to `paused` |
| `completed_at` | TIMESTAMPTZ nullable | Set when all steps are done |
| `created_at` | TIMESTAMPTZ | Row creation timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

`paused_reason` values: `quality_gate_blocker`, `job_failed`, `policy_mismatch`, `manual_pause`, `budget_exceeded`, `needs_human`, `milestone_repair_limit_reached`, `review_limit_reached`.

---

## Service Interface

```ts
createAutoAdvanceService(db, nextActionsService, jobService, sseHub) => {
  getStatus(ownerUserId, projectId): Promise<AutoAdvanceStatusResponse>
  start(ownerUserId, projectId, opts): Promise<AutoAdvanceSession>
  stop(ownerUserId, projectId): Promise<AutoAdvanceSession>
  resume(ownerUserId, projectId): Promise<AutoAdvanceSession>
  reset(ownerUserId, projectId): Promise<void>
  step(ownerUserId, projectId): Promise<AutoAdvanceSession>
  onJobComplete(jobId, outcome: 'success' | 'failure'): Promise<void>
}
```

---

## Session State Machine

```
          start()
  ─────────────────────────►
  idle                      running
  ◄─────────────────────────
          reset()
                            │  ▲
               stop() /     │  │ resume()
               needs_human /│  │
               job_failed   ▼  │
                          paused
                            │
                    (all steps done)
                            │
                            ▼
                        completed
```

### `start(ownerUserId, projectId, opts)`

1. Checks for an existing session. Throws if status is `running`.
2. Inserts a new session row with `status: running`, `started_at: now`, and any requested session options.
3. Resets the bounded milestone repair counter to `0`.
4. Calls `advanceStep` (see below).
5. Publishes `auto-advance:updated` SSE event.

### `stop(ownerUserId, projectId)`

1. Loads the current session. Throws if none exists or not `running`.
2. Updates to `status: paused`, `paused_reason: manual_pause`, `paused_at: now`.
3. Publishes SSE event.

### `resume(ownerUserId, projectId)`

1. Loads the current session. Throws if none exists or not `paused`.
2. Updates to `status: running`, clears `paused_reason` and `paused_at`.
3. Calls `advanceStep`.
4. Publishes SSE event.

### `step(ownerUserId, projectId)`

1. Loads the current session. Throws if none exists or not `paused`.
2. Updates to `status: running`.
3. Calls `advanceStep` (which will enqueue one job then the session will pause again after the job completes via `onJobComplete` → `advanceStep` → pause-with-needs_human, or remain running until the job callback fires).
4. Publishes SSE event.

### `reset(ownerUserId, projectId)`

Deletes the session row unconditionally. Publishes SSE event.

---

## `advanceStep` Internal Helper

This is the core of the automation logic. It is called from `start`, `resume`, `step`, and `onJobComplete` (on success).

```
advanceStep(ownerUserId, projectId, session):
  1. Call nextActionsService.build(ownerUserId, projectId)
  2. Take the first action from the returned list
  3. If no actions remain → run final delivery review or update session to completed
  4. Look up action.key in AUTOMATABLE_STEPS map
  5. If no mapping exists → pause with needs_human
  6. Otherwise:
     a. Resolve job inputs (may extract IDs from action.href)
     b. Update session current_step = action.key
     c. Call jobService.createJob(...)
```

---

## AUTOMATABLE_STEPS Mapping

The mapping table connects next-action keys to the job types and input factories used to enqueue them:

| Action key | Job type | Inputs |
|-----------|----------|--------|
| `overview` | `GenerateProjectOverview` | `{}` |
| `product_spec` | `GenerateProductSpec` | `{}` |
| `ux_decisions_generate` | `GenerateDecisionDeck` | `{ kind: "ux" }` |
| `tech_decisions_generate` | `GenerateDecisionDeck` | `{ kind: "tech" }` |
| `technical_spec` | `GenerateTechnicalSpec` | `{}` |
| `user_flows` | `GenerateUserFlows` | `{}` |
| `feature_product_create` | `GenerateFeatureProductSpec` | `{ featureId }` (from href) |
| `feature_product_regenerate` | `GenerateFeatureProductSpec` | `{ featureId }` (from href) |
| `feature_tech_create` | `GenerateFeatureTechSpec` | `{ featureId }` (from href) |
| `feature_tech_regenerate` | `GenerateFeatureTechSpec` | `{ featureId }` (from href) |
| `milestones_generate` | `GenerateMilestones` | `{}` |
| `milestone_design_generate` | `GenerateMilestoneDesign` | `{ milestoneId }` |
| `milestone_reconciliation_review` | `ReviewMilestoneCoverage` | `{ milestoneId }` |
| `features_create` | `GenerateMilestoneFeatureSet` | `{ milestoneId }` |
| `feature_product_create` | `GenerateFeatureProductSpec` | `{ featureId }` |
| `feature_ux_create` | `GenerateFeatureUxSpec` | `{ featureId }` |
| `feature_tech_create` | `GenerateFeatureTechSpec` | `{ featureId }` |
| `feature_user_docs_create` | `GenerateFeatureUserDocs` | `{ featureId }` |
| `feature_arch_docs_create` | `GenerateFeatureArchDocs` | `{ featureId }` |
| `feature_task_clarifications_generate` | `GenerateTaskClarifications` | `{ featureId, sessionId }` |
| `feature_task_list_generate` | `GenerateFeatureTaskList` | `{ featureId, sessionId }` |
| `feature_implement` | `ImplementChange` via sandbox run creation | `{ featureId }` (from Develop href query) |
| `feature_stale_implementation` | `ImplementChange` via sandbox run creation | `{ featureId }` (from Develop href query) |

Any key not in this map causes the session to pause with `needs_human`, prompting the user to take the manual action and then Resume.

## Milestone Reconciliation

When the active milestone has no remaining feature, workstream, or task-planning actions, auto-advance queues `ReviewMilestoneCoverage`. That review compares the canonical milestone design doc against the active milestone's approved feature workstreams and generated delivery tasks.

- If reconciliation passes, the next step becomes milestone completion.
- If reconciliation finds structural gaps, auto-advance queues `RewriteMilestoneFeatureSet` with the full issue set, then resumes the normal workstream and task-planning flow for the replacement features.
- If reconciliation returns ambiguous-only issues, auto-advance queues `ResolveMilestoneCoverageIssues` against the existing active-milestone features, workstreams, and tasks.
- The session can spend up to 3 milestone repair attempts across these repair jobs before it pauses with `milestone_repair_limit_reached`.

### `ResolveMilestoneCoverageIssues`

This internal job is a generic LLM-driven repair loop for milestone coverage blockers that can be resolved without replacing the feature set.

- Inputs: `milestoneId`, the unresolved `needs_human_review` issues from `ReviewMilestoneCoverage`, the current attempt number, and optional unresolved reasons from a prior repair attempt
- Allowed edits:
  - create a new revision for an existing active-milestone feature
  - regenerate and self-approve downstream feature workstreams
  - regenerate task clarifications and delivery tasks
- Disallowed edits:
  - milestone design docs
  - milestone titles/summaries
  - creating or archiving features
  - touching non-active milestones

The repair planner produces structured JSON only. The executor validates the plan before applying it:

- every referenced `featureKey` must belong to the active milestone
- unsupported refresh targets are rejected
- malformed or non-executable plans fail closed and return `resolved: false`

The repair loop is deliberately bounded to three attempts per auto-advance session. Retryable job failures still use the normal per-job retry loop and do not consume a milestone repair attempt.

---

## `onJobComplete(jobId, outcome)`

Called by the job scheduler after every job completes (success or failure).

1. Looks up the job by `jobId`.
2. If the job has no `projectId`, returns early (noop).
3. Queries for a `running` session for that project.
4. If none exists, returns early.
5. On `failure`: inspects the job's structured error payload. Retryable failures are re-queued up to the per-job retry limit, carrying any repair hint back into the next job inputs when that job accepts hints; non-retryable failures pause the session with `paused_reason: job_failed`. Publishes SSE.
6. On `success`: clears any session retry counter and calls `advanceStep` to enqueue the next job. Publishes SSE.

Malformed structured-output failures remain retryable after the in-job JSON repair pass is exhausted, so auto-advance can rerun the full job up to the normal retry limit. Prompt/context-limit failures remain non-retryable. Exhausted blueprint decision-repair failures are also retryable so the full blueprint job can re-enter its decision-repair loop on the next bounded job retry. Transient provider failures (`429`, `5xx`, timeout, and connection errors) are treated as retryable; ordinary provider `4xx` request failures are not.

For parallel feature batches, `onJobComplete` waits until the active batch fully settles before deciding whether to retry or pause. Any mixed-success batch with at least one failed job counts as a single retry attempt; already-succeeded feature work is left in place, and only unfinished work is re-enqueued on the next pass. The session pauses with `job_failed` only after three consecutive failed batch attempts.

`milestone_repair_limit_reached` is reserved for milestone review/repair paths that actually consumed the bounded repair budget. Human-review-only milestone review results pause with `needs_human`.

Errors inside `onJobComplete` are caught and logged; they do not propagate to the job runner so a failed auto-advance callback cannot break normal job processing.

---

## Job Scheduler Integration

`onJobComplete` is wired in `apps/api/src/app-services.ts`:

```ts
// Inside createJobScheduler options:
execute: async (job) => {
  const result = await jobRunnerService.execute(job);
  await autoAdvanceService.onJobComplete(job.id, "success").catch(logger.error);
  return result;
},
onFailure: async (job, error) => {
  await jobRunnerService.onFailure(job, error);
  await autoAdvanceService.onJobComplete(job.id, "failure").catch(logger.error);
},
```

---

## SSE Integration

Every state-changing operation emits an `auto-advance:updated` event via `sseHub.publish(ownerUserId, "auto-advance:updated", { projectId })`.

The web client (`apps/web/src/hooks/use-sse-events.ts`) listens for this event and invalidates the `["project", projectId, "auto-advance"]` query key, triggering a background refetch of the status endpoint.

---

## API Routes

All routes require authentication (via `requireAuth` middleware) and are mounted under `/projects/:id/auto-advance/`.

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/status` | `getStatus` |
| `POST` | `/start` | `start` |
| `POST` | `/stop` | `stop` |
| `POST` | `/resume` | `resume` |
| `POST` | `/reset` | `reset` (returns 204) |
| `POST` | `/step` | `step` |

Request bodies are validated with the Zod schemas from `@quayboard/shared` (`startAutoAdvanceRequestSchema`).

---

## Shared Schemas

Defined in `packages/shared/src/schemas/auto-advance.ts`:

- `AutoAdvanceSession` — full session row type
- `AutoAdvanceStatusResponse` — `{ session: AutoAdvanceSession | null, nextStep: string | null }`
- `StartAutoAdvanceRequest` — `{ autoApproveWhenClear?, skipReviewSteps?, autoRepairMilestoneCoverage?, creativityMode? }`

All types are re-exported from `@quayboard/shared`.
