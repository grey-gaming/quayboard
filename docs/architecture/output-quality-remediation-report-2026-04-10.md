# Quayboard Output Quality Remediation Report (2026-04-10)

## Purpose
This report is a comprehensive fix catalog for improving Quayboard output quality, based on a full review of:
- Quayboard orchestration and quality-gate code
- Database history for project `/e6eb2201-9ee7-490a-8743-a1690b9d0130` (Split Flap Display)
- Generated repository `/home/mirdinj/qb-split-flap-display`
- Generated planning and documentation artifacts

This version intentionally avoids agent framing and focuses on everything concretely fixable.

## Evidence Snapshot
- Auto-advance completed for the project (`2026-04-08 07:19:54 UTC`).
- Project review reached `clear` (`loop_count=4`, `max_loops=5`).
- All 12 bug reports were created **after** review clear.
- Jobs: `340` total (`291 succeeded`, `42 failed`, `7 cancelled`).
- Sandbox runs: `108` total (`86 succeeded`, `20 failed`, `2 cancelled`).
- Active planning footprint for a small app: `31` features, `158` tasks.
- Workstream skew: `31` product specs, `31` tech specs, `15` UX, `17` arch docs, `1` user doc.
- Generated repo quality checks:
  - `npm test` is placeholder no-op (`scripts/test-placeholder.js`).
  - `npm run lint` fails (`17` errors, `12` warnings).
  - `npm run validate:ci` locally fails due hardcoded artifact path (`/root/.local/share/opencode/tool-output`).
  - `docs/quayboard` references `35` TypeScript files not present in repo (`0` `.ts` source files).

## Full Fix Catalog

## 1) Deterministic Quality Gates (must fix)
### Problem
Completion is still primarily inferred from run exit codes and LLM judgments.

### Fixes
1. Add a mandatory verification manifest per run kind (`implement`, `verify`, `project_fix`, `bug_fix`) with required commands and strict pass criteria.
2. Persist structured command outcomes (command, exit code, duration, stdout/stderr digest) as first-class artifacts.
3. Block `verification_passed` unless all required commands passed.
4. Surface these command outcomes in phase gates and review UI.

### Code targets
- `apps/api/src/services/sandbox-service.ts`
- `docker/agent-sandbox/qb_entrypoint.sh`
- `apps/api/src/services/phase-gate-service.ts`

## 2) Phase-Gate Semantics (must fix)
### Problem
Features phase passes on artifact/task presence, not objective repo quality.

### Fixes
1. Extend phase-gate criteria with quality gate items:
   - lint gate
   - build gate
   - test gate
   - docs conformance gate
2. Require a recent successful verification run after the latest meaningful change set.
3. Require no unresolved high/critical findings and no unresolved must-fix medium findings.

### Code targets
- `apps/api/src/services/phase-gate-service.ts`
- `apps/api/src/services/next-actions-service.ts`

## 3) Project Review Logic (must fix)
### Problem
Current review behavior can clear projects while non-trivial defects remain.

### Fixes
1. Remove or tightly constrain high-only mode; medium findings should remain blocking unless explicitly waived.
2. Stop auto-marking all open findings as `superseded` after a fix attempt.
3. Use `finalVerdict` booleans as enforceable gates, not informational-only metadata.
4. Require evidence hygiene:
   - evidence must map to existing repo files or explicit command outputs
   - reject placeholder evidence strings

### Code targets
- `apps/api/src/services/project-review-service.ts`
- `apps/api/test/unit/project-review-service.test.ts`

## 4) Milestone Delivery Review Robustness (must fix)
### Problem
Milestone delivery pass/fail is LLM-only and can pass with weak/empty issue signals.

### Fixes
1. Add deterministic preconditions before marking delivery review passed:
   - required workstreams approved
   - required docs exported
   - task planning complete
   - verification manifest passed for milestone branch
2. Treat malformed/empty review outputs as failure requiring retry or human review, not implicit pass.
3. Add consistency checks between milestone design doc requirements and actual generated artifacts.

### Code targets
- `apps/api/src/services/auto-advance.ts`
- `apps/api/src/services/jobs/job-runner-service.ts`
- `apps/api/src/services/jobs/job-prompts.ts`

## 5) Bug-Fix Closure Criteria (must fix)
### Problem
Bug can be marked fixed after merged PR without deterministic proof of bug resolution.

### Fixes
1. Add bug-specific verification contracts:
   - reproduction test (or scripted repro) must fail before fix and pass after fix
   - required regression checks must pass
2. Keep bug in `open`/`needs_review` unless verification evidence exists.
3. Persist fix validation artifacts and link them to bug record.

### Code targets
- `apps/api/src/services/jobs/job-runner-service.ts` (`RunBugFix`)
- `apps/api/src/services/bug-service.ts`
- `apps/api/src/services/sandbox-service.ts`

## 6) Planning Prompt Calibration (must fix)
### Problem
Prompt strategy over-expands scope for small projects and promotes excessive decomposition.

### Fixes
1. Add explicit project-size tiering before Product Spec and milestone generation.
2. Bound feature count and task count by size tier unless justified by explicit requirements.
3. Make “first milestone scaffolding” requirements conditional; avoid hardcoded heavy setup for all projects.
4. Reduce forced inference; require inferred scope to be flagged and optionally user-approved.

### Code targets
- `apps/api/src/services/jobs/job-prompts.ts`
- `apps/api/src/services/jobs/job-runner-service.ts`

## 7) Workstream Requirement Accuracy (must fix)
### Problem
`uxRequired`/`userDocsRequired`/`archDocsRequired` can be under-specified by LLM output with no calibration guard.

### Fixes
1. Add deterministic heuristics over feature metadata:
   - user-facing features default `userDocsRequired=true` unless explicit exemption
   - UI features default `uxRequired=true`
2. Require machine-readable rationale for each `required=false` decision.
3. Add a review pass that flags improbable requirement patterns at project level.

### Code targets
- `apps/api/src/services/jobs/job-runner-service.ts` (feature product spec generation/review)
- `apps/api/src/services/feature-workstream-service.ts`

## 8) Task Planning Realism (must fix)
### Problem
Generated tasks can conflict with repo reality (example: many `.ts` assumptions in JS repo) and include irrelevant bootstrap steps.

### Fixes
1. Inject repository fingerprint into task-generation prompts:
   - detected language/runtime/build tool/test framework
2. Add post-generation validation:
   - referenced file paths must be plausible in current repo
   - reject tasks that assume absent toolchain unless explicitly planned
3. Add de-duplication and no-op filtering for foundational tasks in already-initialized repos.

### Code targets
- `apps/api/src/services/jobs/job-runner-service.ts`
- `apps/api/src/services/jobs/job-prompts.ts`
- `apps/api/src/services/context-pack-service.ts` (if needed for repo fingerprint detail)

## 9) Documentation Fidelity (must fix)
### Problem
Generated planning docs can drift from delivered code and are not gated for conformance.

### Fixes
1. Add a doc-conformance checker:
   - parse referenced paths from generated docs
   - verify existence/type
   - emit findings on mismatches
2. Add post-implementation documentation reconciliation step.
3. Gate completion on zero high-severity docs/code drift findings.

### Code targets
- `apps/api/src/services/sandbox-service.ts` (`writeQuayboardDocs`)
- new job/checker under `apps/api/src/services/jobs/`
- `apps/api/src/services/project-review-service.ts`

## 10) Generated Repo Validation Script Portability (fix)
### Problem
Generated validation scripts can encode environment-specific hardcoded paths.

### Fixes
1. Ban hardcoded root/home paths in generated scripts unless explicitly required.
2. Template artifact output paths via env vars with safe defaults.
3. Add static lint rule to detect forbidden path patterns in generated repos.

### Code targets
- Prompt constraints in `job-prompts.ts`
- Sandbox instructions in `docker/agent-sandbox/qb_entrypoint.sh`
- Optional post-run static checker in Quayboard verification flow

## 11) Review Prompt Quality Controls (fix)
### Problem
Review output still includes noisy or contradictory findings despite instruction constraints.

### Fixes
1. Tighten review prompt with stronger evidence requirements:
   - each finding must include reproducible evidence path and validation method
2. Add “no strengths in findings” hard validation (already partially present) plus contradiction checks.
3. Add consistency checks across repeated review attempts to reduce oscillating findings.

### Code targets
- `docker/agent-sandbox/qb_entrypoint.sh` (project review prompt block)
- `apps/api/src/services/project-review-service.ts` parser/validator

## 12) Model Role Separation and Quality Policy (fix)
### Problem
Single model choice for all phases increases correlated failure risk.

### Fixes
1. Split model policy by role:
   - planning model
   - implementation model
   - review model
2. Add minimum capability profile for review model (reasoning + code-quality consistency).
3. Add fallback policy if configured model fails capability checks.

### Code targets
- project setup + LLM configuration services
- job execution paths in `job-runner-service.ts`

## 13) Telemetry and Diagnostics (fix)
### Problem
Quality tuning is hard with incomplete runtime metrics (e.g., token accounting gaps).

### Fixes
1. Fix token capture reliability for `llm_runs`.
2. Persist per-job quality metadata:
   - retries used
   - parse-repair invocations
   - deterministic gate outcomes
3. Add project-level quality KPIs:
   - bugs after clear
   - failure/cancel rates by run kind
   - findings reopened/superseded counts
   - docs drift counts

### Code targets
- `apps/api/src/services/jobs/job-runner-service.ts`
- reporting endpoints/UI where quality metrics are displayed

## 14) Test Coverage Gaps in Quayboard Itself (fix)
### Problem
Current tests verify some permissive behavior that contributes to low-quality clear states.

### Fixes
1. Add failing tests for undesirable states:
   - review clear with failing deterministic gates
   - fix completion without explicit finding closure evidence
   - docs/code mismatch still passing
2. Update existing tests that currently assert permissive transitions.

### Code targets
- `apps/api/test/unit/project-review-service.test.ts`
- `apps/api/test/unit/auto-advance.test.ts`
- `apps/api/test/unit/sandbox-service.test.ts`
- new targeted tests for doc conformance and gate enforcement

## 15) Operational Safeguards (fix)
### Problem
High run churn indicates expensive loops before quality converges.

### Fixes
1. Add quality-failure circuit breakers:
   - pause and require human intervention after repeated same-category failures
2. Add root-cause labels on failed runs (`prompt_quality`, `repo_state`, `environment`, `model_output`).
3. Add replay mode for deterministic repro with fixed prompts/context.

### Code targets
- `apps/api/src/services/auto-advance.ts`
- `apps/api/src/services/sandbox-service.ts`
- `apps/api/src/services/jobs/job-runner-service.ts`

## Prioritized Remediation Roadmap

## P0 (next 7 days)
1. Enforce deterministic verify gates.
2. Remove high-only auto-ignore for medium/low findings.
3. Remove blanket supersede of open findings on fix completion.
4. Add docs reference existence checker to project review.
5. Make bug closure require fix-validation artifacts.

## P1 (2-4 weeks)
1. Calibrate planning prompts for project-size proportionality.
2. Add workstream requirement heuristics and exemptions with rationale.
3. Add repo-fingerprint-aware task validation.
4. Add quality KPIs and dashboards/API output.

## P2 (4-8 weeks)
1. Model role separation with capability checks.
2. Replay framework for prompt/model regression testing.
3. Circuit breakers and richer failure taxonomy.

## Acceptance Metrics
Use the Split Flap baseline as control:
- Bugs after clear: target `0` within 48h of clear.
- Sandbox failure ratio: improve from baseline `20/108`.
- Deterministic gate compliance: `100%` verify/project_fix/bug_fix runs with attached gate results.
- Docs drift: `0` missing referenced files in generated planning docs at clear.
- Review integrity: no clear status with unresolved blocking findings.

## Validation Approach
1. Replay the Split Flap project through updated pipeline in dry-run mode.
2. Compare against baseline metrics above.
3. Run at least two additional projects of different complexity tiers (small + medium) to confirm proportional planning behavior.
4. Treat regressions in deterministic gate compliance or bugs-after-clear as release blockers.

