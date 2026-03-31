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
