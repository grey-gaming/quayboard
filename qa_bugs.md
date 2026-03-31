# Quayboard QA Bugs

## Bug Log

### 2026-03-31T07:38:50Z - Auto-runner pauses at overview approval despite `skipReviewSteps`
- Timestamp: 2026-03-31T07:38:50Z
- Short title: `skipReviewSteps` does not skip overview approval gates
- Reproduction steps:
  1. Register a new user and create a new project.
  2. Complete setup, select `glm-5:cloud` via Ollama, and verify the sandbox.
  3. Start auto-advance with `skipReviewSteps: true` and `autoRepairMilestoneCoverage: true`.
  4. Wait for `AutoAnswerQuestionnaire` and `GenerateProjectOverview` to complete.
  5. Inspect `/api/projects/:id/auto-advance/status`.
- Expected behaviour: the runner should auto-approve the overview and continue to `product_spec` when review steps are being skipped.
- Actual behaviour: the session paused at `currentStep: overview_approval` with `pausedReason: needs_human`, even though `skipReviewSteps` was true in both the API session row and status response.
- Severity: high
- Current status: fixed locally in `apps/api/src/services/auto-advance.ts`; focused unit regression added in `apps/api/test/unit/auto-advance.test.ts`; live fix confirmed: resuming the session auto-approved the overview and advanced directly into `GenerateProductSpec` at 2026-03-31T07:39:00Z.

### 2026-03-31T08:27:51Z - Auto-runner pauses at feature product approval despite `skipReviewSteps`
- Timestamp: 2026-03-31T08:27:51Z
- Short title: `skipReviewSteps` does not skip feature workstream approval gates
- Reproduction steps:
  1. Register a new user and create a new project.
  2. Complete setup, select `glm-5:cloud` via Ollama, and verify the sandbox.
  3. Start auto-advance with `skipReviewSteps: true` and `autoRepairMilestoneCoverage: true`.
  4. Allow the run to progress through milestone planning, milestone design, and feature generation until the first feature product spec is generated.
  5. Inspect `/api/projects/:id/auto-advance/status`.
- Expected behaviour: the runner should auto-approve the feature product spec and continue into the next automated step when review steps are being skipped.
- Actual behaviour: the session paused at `currentStep: feature_product_approval` with `pausedReason: needs_human`, even though `skipReviewSteps` was true in the persisted session and status API response.
- Severity: high
- Current status: fixed locally in `apps/api/src/services/auto-advance.ts`; focused unit regression added in `apps/api/test/unit/auto-advance.test.ts`; live fix confirmed at 2026-03-31T08:29:07Z when resuming the session moved it from `feature_product_approval` back to `running` and advanced the next step to `feature_product_create`.

### 2026-03-31T09:06:45Z - Generated task list ignores answered clarifications and resolved scope
- Timestamp: 2026-03-31T09:06:45Z
- Short title: `GenerateFeatureTaskList` contradicts clarification answers for F-010
- Reproduction steps:
  1. Run auto-advance on a new project until feature task planning begins for `F-010 Repository Foundation`.
  2. Allow `GenerateTaskClarifications` and `AutoAnswerTaskClarifications` to complete.
  3. Inspect the task-planning session for the feature via `/api/features/:id/task-planning-session`.
  4. Compare the answered clarification stating `README.md` is out of scope for F-010 with the generated tasks.
- Expected behaviour: task generation should honor answered clarifications and the resolved feature scope, excluding out-of-scope README work and avoiding instructions like `git init` that are invalid for an already-existing repository.
- Actual behaviour: the generated F-010 task list includes a task that explicitly creates a placeholder `README.md` and instructs `git init` plus `git checkout -b main`, despite the clarification answer stating README is out of scope for F-010 and despite the project already existing inside a Git repository.
- Severity: high
- Current status: open; observed in live QA run, not currently blocking runner progression.

### 2026-03-31T09:22:57Z - Auto-runner pauses at milestone completion despite `skipReviewSteps`
- Timestamp: 2026-03-31T09:22:57Z
- Short title: `skipReviewSteps` does not skip milestone completion gates
- Reproduction steps:
  1. Run auto-advance on a new project with `skipReviewSteps: true`.
  2. Allow the runner to complete milestone delivery review for the active milestone.
  3. Inspect `/api/projects/:id/auto-advance/status` when the next step becomes `milestone_complete`.
- Expected behaviour: the runner should automatically complete the approved milestone and continue into the next milestone when review steps are being skipped.
- Actual behaviour: the session paused at `currentStep: milestone_complete` with `pausedReason: needs_human`, even though `skipReviewSteps` remained true in the session row and API response.
- Severity: high
- Current status: fixed locally in `apps/api/src/services/auto-advance.ts`; focused unit regression added in `apps/api/test/unit/auto-advance.test.ts`; live fix confirmed at 2026-03-31T09:24:17Z when resuming the session moved it from `milestone_complete` back to `running` and advanced the next step to `milestone_design_generate`.
