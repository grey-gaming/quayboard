# LLM Job QA Review

This document is the index for all LLM job prompt quality reviews. Each entry links to a dedicated review file containing the per-job checklist and findings.

**Status values:** `NOT REVIEWED` → `IN REVIEW` → `REVIEWED`

## Second-Pass Output Quality Findings

Completed on 2026-04-11 as a subagent-style independent rereview focused on whether each LLM job output would meet a tier-1 software team bar. The per-job review files now include a dedicated `Tier-1 Output Quality Review` section.

- Overall verdict: the best planning generators are useful and often professional, but the system is not yet consistently tier-1 because several jobs produce outputs that are too speculative, too broad, or too thinly evidenced for downstream automation to accept as autonomous gate inputs.
- Strongest outputs: `GenerateTaskClarifications`, `GenerateDecisionDeck`, `GenerateMilestoneDesign`, `GenerateMilestoneFeatureSetReview`, and parts of the feature-spec generators. These are detailed and actionable, but still need stronger traceability, confidence labels, and decision provenance.
- Weakest outputs: milestone review jobs that can return bare boolean completion results, especially `ReviewMilestoneMap`, `ReviewMilestoneScope`, and `ReviewMilestoneDelivery`. A tier-1 team would require coverage matrices, evidence, rationale, and placeholder rejection before accepting those as validation.
- Common gap: generated planning artifacts frequently convert inferred assumptions into authoritative product, architecture, route, API, vendor, or UX decisions. The fix is to require confirmed/proposed/unknown labels and a source-grounded assumption log.
- Common gap: implementation, repair, verification, and fix jobs lack a strong completion artifact contract. A tier-1 output should map scope or findings to changed files, exact checks run, failures/skips, and residual risk.
- Common gap: several jobs had no representative local output available, so the review could only evaluate prompt and orchestration shape. Those jobs need stored fixtures or recent run samples before their output quality can be meaningfully certified.
- Quality bar change recommended: add schema-level evidence fields where possible instead of only prompt wording. Prompt instructions alone are not enough for review jobs that downstream automation treats as gates.

---

## Review Process

### Orientation

Before reviewing any job, read:

1. `README.md` — product overview, local operation instructions, and workspace commands
2. `AGENTS.md` — database access patterns, source-of-truth order, and the diagnosis workflow for project/job state

### Inspecting Existing Projects

The most reliable way to evaluate a prompt is against real data from projects that have already run the job. Use the local Postgres database to find representative examples.

**Connect to the database** (see `AGENTS.md` → *Database Access*):

```sh
docker exec quayboard-postgres psql -U postgres -d quayboard
```

**Find recent projects:**

```sql
select id, name from projects order by created_at desc limit 20;
```

**Find completed runs for a specific job type** (e.g. `GenerateMilestones`):

```sql
select j.id, j.project_id, j.status, j.queued_at, lr.template_id, lr.prompt_tokens, lr.completion_tokens
from jobs j
join llm_runs lr on lr.job_id = j.id
where lr.template_id = 'GenerateMilestones'
order by j.queued_at desc
limit 10;
```

**Inspect the full prompt and response for a specific `llm_run`:**

```sql
select prompt, response, model, provider from llm_runs where id = '<llm_run_id>';
```

**For sandbox jobs**, the token stream is stored in `job_trace_events`. The prompt passed to OpenCode lives in the artifact storage path (configured via `ARTIFACT_STORAGE_PATH`) under the sandbox run's directory.

---

### Review Checklist

The per-job review files contain an instance of this checklist. This section is the canonical reference.

#### Direct LLM Jobs (Section 1)

- [ ] **Read the prompt builder** in `apps/api/src/services/jobs/job-prompts.ts` for the job's `templateId`
- [ ] **Pull a real prompt from the database** using the queries above and read it end-to-end as the model would
- [ ] **Prompt clarity** — are instructions unambiguous? Could a smaller/weaker model (e.g. a local Ollama model) still produce usable output?
- [ ] **Context completeness** — does the prompt include all data an autonomous expert reviewer or generation agent would need to perform the same task? Is any injected content at risk of being truncated for large projects given the 50,000 token output cap?
- [ ] **Output schema alignment** — for JSON-generating jobs, does the prompt's described output shape exactly match what the parser in `job-runner-service.ts` expects? Mismatches cause silent failures or corrupt DB state
- [ ] **Multi-step generation** — for jobs using draft + review generation: does the review prompt catch the failure modes the draft prompt is prone to?
- [ ] **Regeneration stability** — for `Regenerate*` and `Rewrite*` variants: does the prompt produce stable output when called repeatedly on the same input?
- [ ] **Failure handling** — what happens when the LLM returns malformed JSON or omits required fields?
- [ ] **Terminology consistency** — do the terms used in the prompt match how those terms are used in downstream jobs that consume the output?
- [ ] **Prompt injection surface** — any user-supplied content interpolated into the prompt should be checked to ensure it cannot hijack the instruction structure

#### Sandbox / OpenCode Jobs (Section 2)

- [ ] **Read the entrypoint** at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt file and context files are passed to OpenCode
- [ ] **Read the prompt and context files** for the run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like so OpenCode knows when to stop?
- [ ] **Output artifact specification** — does the prompt explicitly name the output files OpenCode must produce and describe their required schema?
- [ ] **Scope containment** — does the prompt constrain OpenCode to the right files and directories?
- [ ] **Fix/repair job scope** — for `RunProjectFix`, `RunBugFix`, and `RepairMilestoneCi`: is there a clear definition of "done" that prevents over-engineering?

#### Cross-cutting (all jobs)

- [ ] **Output usefulness** — given the purpose of the project being reviewed, does the output actually make sense? Does it read like something a professional software team would produce — or is it generic, vague, shallow, or structurally wrong? If not, identify specifically what is missing or misleading and note what prompt changes would fix it
- [ ] **Model-agnostic language** — prompts must degrade gracefully on smaller Ollama models, not just large OpenAI-compatible endpoints
- [ ] **Token budget** — verify that realistic inputs fit within `LLM_MAX_OUTPUT_TOKENS` (default 50,000) without truncation; flag any job where a large project might hit the limit
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in the review file

---

## Section 1 — Direct LLM Jobs (Ollama / OpenAI)

These jobs call the project's configured LLM provider directly through `llmProviderService.generate()`. Prompts are built in `apps/api/src/services/jobs/job-prompts.ts`.

| # | Job Name(s) | Purpose | Status | Findings |
|---|-------------|---------|--------|----------|
| 1 | `AutoAnswerQuestionnaire` | Auto-fill unanswered questionnaire fields | REVIEWED | [review](llm-job-reviews/auto-answer-questionnaire.md) |
| 2 | `GenerateProjectOverview` `RegenerateProjectOverview` `GenerateOverviewImprovements` | Generate or update the project overview document | REVIEWED | [review](llm-job-reviews/generate-project-overview.md) |
| 3 | `GenerateProductSpec` `RegenerateProductSpec` `GenerateProductSpecImprovements` | Generate or update the product specification | REVIEWED | [review](llm-job-reviews/generate-product-spec.md) |
| 4 | `GenerateUseCases` | Generate use cases from project context | REVIEWED | [review](llm-job-reviews/generate-use-cases.md) |
| 5 | `DeduplicateUseCases` | Deduplicate the existing use case list | REVIEWED | [review](llm-job-reviews/deduplicate-use-cases.md) |
| 6 | `GenerateDecisionDeck` | Generate a decision deck with architectural choices for the project blueprint | REVIEWED | [review](llm-job-reviews/generate-decision-deck.md) |
| 7 | `GenerateProjectBlueprint` | Compile the full project blueprint document | REVIEWED | [review](llm-job-reviews/generate-project-blueprint.md) |
| 8 | `GenerateMilestones` | Generate milestone definitions from use cases and planning documents | REVIEWED | [review](llm-job-reviews/generate-milestones.md) |
| 9 | `AppendMilestones` | Append additional milestones to the existing milestone map | REVIEWED | [review](llm-job-reviews/append-milestones.md) |
| 10 | `ReviewMilestoneMap` | Review the milestone map for structural issues | REVIEWED | [review](llm-job-reviews/review-milestone-map.md) |
| 11 | `RewriteMilestoneMap` | Rewrite the milestone map based on review feedback | REVIEWED | [review](llm-job-reviews/rewrite-milestone-map.md) |
| 12 | `GenerateMilestoneDesign` | Generate milestone design with delivery groups and user flows | REVIEWED | [review](llm-job-reviews/generate-milestone-design.md) |
| 13 | `ReviewMilestoneScope` `ReviewMilestoneCoverage` | Review milestone scope completeness and use-case coverage | REVIEWED | [review](llm-job-reviews/review-milestone-scope-coverage.md) |
| 14 | `GenerateMilestoneFeatureSet` | Generate the feature set for a milestone | REVIEWED | [review](llm-job-reviews/generate-milestone-feature-set.md) |
| 15 | `RewriteMilestoneFeatureSet` | Rewrite the milestone's feature set | REVIEWED | [review](llm-job-reviews/rewrite-milestone-feature-set.md) |
| 16 | `ReviewMilestoneDelivery` | Review delivery against product requirements | REVIEWED | [review](llm-job-reviews/review-milestone-delivery.md) |
| 17 | `ResolveMilestoneDeliveryIssues` `ResolveMilestoneCoverageIssues` | Resolve identified delivery and coverage issues | REVIEWED | [review](llm-job-reviews/resolve-milestone-issues.md) |
| 18 | `GenerateFeatureProductSpec` | Generate product spec for a specific feature | REVIEWED | [review](llm-job-reviews/generate-feature-product-spec.md) |
| 19 | `GenerateFeatureUxSpec` `GenerateFeatureTechSpec` `GenerateFeatureUserDocs` `GenerateFeatureArchDocs` | Generate UX spec, tech spec, user docs, and arch docs for a feature | REVIEWED | [review](llm-job-reviews/generate-feature-specs.md) |
| 20 | `GenerateTaskClarifications` | Generate clarification questions for feature task planning | REVIEWED (SUPERSEDED) | [review](llm-job-reviews/generate-task-clarifications.md) |
| 21 | `AutoAnswerTaskClarifications` | Auto-answer pending task clarification questions | REVIEWED (SUPERSEDED) | [review](llm-job-reviews/auto-answer-task-clarifications.md) |
| 22 | `GenerateFeatureTaskList` | Generate the implementation task list for a feature | REVIEWED (SUPERSEDED) | [review](llm-job-reviews/generate-feature-task-list.md) |
| 23 | `ReviewDelivery` | Review overall milestone coverage completeness against approved user flows | REVIEWED | [review](llm-job-reviews/review-delivery.md) |

---

## Section 2 — Sandbox (OpenCode) Jobs

These jobs launch a Docker container running `opencode` (via `docker/agent-sandbox/qb_entrypoint.sh`). Sandbox run kinds are defined in `packages/shared/src/schemas/sandbox.ts`.

| # | Job Name(s) | Purpose | Status | Findings |
|---|-------------|---------|--------|----------|
| 1 | `PlanFeatureTasksSandbox` | Plan feature tasks via OpenCode sandbox (run kind: `task_planning`) | REVIEWED | [review](llm-job-reviews/plan-feature-tasks-sandbox.md) |
| 2 | `RunProjectReview` | Full repository engineering review via OpenCode (run kind: `project_review`) | REVIEWED | [review](llm-job-reviews/run-project-review.md) |
| 3 | `RunProjectFix` | Fix project review issues via OpenCode (run kind: `project_fix`) | REVIEWED | [review](llm-job-reviews/run-project-fix.md) |
| 4 | `RunBugFix` | Fix a specific bug via OpenCode sandbox (run kind: `bug_fix`) | REVIEWED | [review](llm-job-reviews/run-bug-fix.md) |
| 5 | `ImplementChange` | Execute a feature implementation via OpenCode (run kind: `implement`) | REVIEWED | [review](llm-job-reviews/implement-change.md) |
| 6 | `TestAndVerify` | Test and verify an implementation via OpenCode (run kind: `verify`) | REVIEWED | [review](llm-job-reviews/test-and-verify.md) |
| 7 | `RepairMilestoneCi` | Repair CI failures via OpenCode (run kind: `ci_repair`) | REVIEWED | [review](llm-job-reviews/repair-milestone-ci.md) |
| 8 | `ExecuteMilestoneSession` | Execute a milestone-level sandbox session via OpenCode | REVIEWED | [review](llm-job-reviews/execute-milestone-session.md) |
