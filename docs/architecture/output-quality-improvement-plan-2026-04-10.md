# Quayboard Output Quality Improvement Plan (2026-04-10)

## Scope Reviewed
- Quayboard project: `/e6eb2201-9ee7-490a-8743-a1690b9d0130` (`Split Flap Display`)
- Generated repository: `/home/mirdinj/qb-split-flap-display`
- Quayboard internals: auto-advance, project review, sandbox execution, planning prompts, phase gates
- Evidence sources: Postgres tables (`projects`, `auto_advance_sessions`, `jobs`, `llm_runs`, `project_review_*`, `bug_reports`, `sandbox_runs`), generated docs/artifacts, generated code checks

## Executive Summary
Quayboard produced a project that passed internal workflow gates but still required extensive post-clear bug fixing and still contains objective quality issues. The main problem is that completion is currently driven by LLM judgments and run exit codes, without enough deterministic quality gates tied to the actual repository state.

The quality plan below is built around agent workstreams that harden gates, reduce planning-to-code drift, and make quality failures measurable and enforceable.

## Key Evidence (Split Flap Case)
- Auto-advance session status: `completed` (updated at `2026-04-08 07:19:54 UTC`)
- Project review session status: `clear` (`loop_count=4`, `max_loops=5`)
- Bugs after review clear: `12/12` bug reports were created after clear (`first bug at 2026-04-08 14:14:04 UTC`)
- Job churn: `340` jobs total (`291 succeeded`, `42 failed`, `7 cancelled`)
- Sandbox churn: `108` runs total (`86 succeeded`, `20 failed`, `2 cancelled`)
- Feature/task volume for a small app: `31` active features, `158` tasks
- Workstream imbalance: `31` product specs, `31` tech specs, `15` UX specs, `17` arch docs, `1` user doc spec
- Generated repo checks:
  - `npm test` is a no-op placeholder (`scripts/test-placeholder.js` is only `process.exit(0)`)
  - `npm run lint` currently fails (`17` errors, `12` warnings)
  - `npm run validate:ci` fails locally due hardcoded artifact path (`/root/.local/share/opencode/tool-output`)
  - `docs/quayboard` contains architecture references to missing TypeScript files (`35` missing `.ts` references while repo has `0` `.ts` source files)

## Problem Areas and Root Causes

### 1) Completion gates are too permissive
Evidence:
- Features phase passes on feature/task existence, not code quality outcomes (`apps/api/src/services/phase-gate-service.ts`)
- Verify/project-review run success is mostly exit-code based (`apps/api/src/services/sandbox-service.ts`)
- Milestone delivery review passes when LLM returns `complete=true` or no issues (`apps/api/src/services/auto-advance.ts`)

Impact:
- A project can be marked complete while lint/build/tests are weak or partially enforced.

### 2) Project review loop can clear known quality debt
Evidence:
- Final-phase review ignores medium/low findings (`isProjectReviewHighOnlyPhase` and `partitionProjectReviewFindings` in `apps/api/src/services/project-review-service.ts`)
- Fix completion marks all open findings as `superseded` before re-review (`completeFixAttempt` in same file)
- `finalVerdict` booleans are stored but not used as gating signals

Impact:
- Review can report “clear” even when non-trivial issues remain.

### 3) Planning prompts over-drive scope and scaffolding
Evidence:
- Product spec prompt asks for exhaustive full-system breakdown and aggressive inference (`apps/api/src/services/jobs/job-prompts.ts`)
- Milestone prompt hard-requires a scaffolding-heavy first milestone (`buildMilestonesPrompt`)
- Resulting plan for this small app: 31 active features and 158 tasks

Impact:
- Output tends toward over-fragmentation and implementation noise.

### 4) Planning docs and delivered code drift is not actively policed
Evidence:
- `docs/quayboard/architecture/*` references many `.ts` files not present in generated repo
- Only one approved feature user doc was exported to `docs/quayboard/user`
- No deterministic “docs match code” gate in verify/project-review flows

Impact:
- “Documentation says X, code does Y” remains undetected until manual review.

### 5) Quality telemetry is insufficient for tuning
Evidence:
- `llm_runs` token usage recorded as zero for this project, reducing observability for prompt/model tuning
- High retry and failure counts across generation and fix jobs without quality-weighted failure classification

Impact:
- Hard to identify which prompts/models produce costly low-quality artifacts.

## Agent-Based Improvement Program

## Agent A: Deterministic Gate Agent
Mission: Replace “exit code only” completion with explicit quality contracts.

Tasks:
- Add a required verification manifest per run kind (`implement`, `verify`, `project_fix`, `bug_fix`) with mandatory commands and pass/fail semantics.
- Enforce minimum checks: lint, build, relevant tests, and route-level smoke checks when applicable.
- Persist command outcomes in structured artifacts and DB.

Concrete change targets:
- `apps/api/src/services/sandbox-service.ts`
- `docker/agent-sandbox/qb_entrypoint.sh`
- `apps/api/src/services/phase-gate-service.ts`

Acceptance criteria:
- A verify run cannot succeed without passing required commands.
- Phase gates surface command-level pass/fail, not just artifact counts.

## Agent B: Review Integrity Agent
Mission: Prevent project review from masking unresolved quality defects.

Tasks:
- Remove or tighten high-only mode; keep medium findings blocking unless explicitly waived.
- Stop auto-superseding all open findings on fix completion.
- Use `finalVerdict` booleans as hard constraints for clear status.
- Validate finding evidence paths to actual repository files (or explicit command outputs).

Concrete change targets:
- `apps/api/src/services/project-review-service.ts`
- `apps/api/test/unit/project-review-service.test.ts`

Acceptance criteria:
- Review clear requires: no open blocking findings, passing final verdict gates, and verified evidence quality.

## Agent C: Planning Calibration Agent
Mission: Reduce over-fragmentation and improve plan-to-delivery proportionality.

Tasks:
- Introduce project-size classifier and bounded feature/task budgets per size tier.
- Update prompts to prefer fewer vertical slices unless complexity evidence demands decomposition.
- Make first-milestone scaffolding requirements conditional (not always heavy).
- Add guardrails that discourage technology drift (example: avoid TypeScript-only planning for JS-only repos unless TS is an explicit requirement).

Concrete change targets:
- `apps/api/src/services/jobs/job-prompts.ts`
- `apps/api/src/services/jobs/job-runner-service.ts`
- tests under `apps/api/test/unit/*` for milestone/feature/task generation behavior

Acceptance criteria:
- For small app descriptions, generated plans stay within configured feature/task bands and preserve completeness.

## Agent D: Doc Fidelity Agent
Mission: Keep generated docs aligned with actual repository output.

Tasks:
- Add a documentation conformance job:
  - Extract file references from generated docs.
  - Verify referenced files exist.
  - Flag mismatches as review findings.
- Require user-doc and architecture-doc coverage for user-facing features unless explicitly marked non-user-facing with justification.
- Add post-implementation doc reconciliation pass to update planning docs when implementation shape changes materially.

Concrete change targets:
- `apps/api/src/services/sandbox-service.ts` (`writeQuayboardDocs`)
- new checker under `apps/api/src/services/jobs/` (doc conformance)
- project review schema consumption in `project-review-service`

Acceptance criteria:
- No review clear when docs reference non-existent implementation files.

## Agent E: Quality Telemetry Agent
Mission: Make quality regressions and LLM cost/quality tradeoffs visible.

Tasks:
- Fix token accounting ingestion for `llm_runs`.
- Add quality KPIs per project:
  - bugs after clear
  - failed run ratio
  - retries per job type
  - finding reopen/supersede rates
- Add model-role split policy (planning model vs review model) and A/B harness for quality outcomes.

Concrete change targets:
- `apps/api/src/services/jobs/job-runner-service.ts` (`storeLlmRun` call paths)
- DB/reporting surfaces for project quality stats

Acceptance criteria:
- Dashboard or API endpoint can show quality and churn metrics per completed project.

## Delivery Sequence (Recommended)
1. Agent A + Agent B first (hard gates and review integrity).
2. Agent D next (doc-code conformance).
3. Agent C (planning calibration) with replay tests against historical projects.
4. Agent E (telemetry and model policy) for continuous tuning.

## Immediate Fixes to Prioritize (Next 7 Days)
1. Make project review clear impossible when lint/build/test gates fail.
2. Disable medium/low auto-ignore in final review phase.
3. Remove blanket `superseded` transition in fix completion; require explicit revalidation.
4. Replace placeholder `npm test` acceptance with enforced real test command set.
5. Add doc reference existence checks for `docs/quayboard`.

## Validation Plan for the Improvement Program
- Replay the Split Flap project through updated pipeline in a dry-run environment.
- Success threshold:
  - zero bugs created after review clear for 48 hours
  - deterministic gate pass/fail artifacts attached to every verify/project_fix/bug_fix run
  - no missing file references in generated docs
  - lower failure ratio than baseline (`20/108` failed sandbox runs in this case)

