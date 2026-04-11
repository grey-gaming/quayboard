# LLM Job QA Review

This document is the index for all LLM job prompt quality reviews. Each entry links to a dedicated review file containing the per-job checklist and findings.

**Status values:** `NOT REVIEWED` → `IN REVIEW` → `REVIEWED`

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
- [ ] **Context completeness** — does the prompt include all data a human expert would need to perform the same task? Is any injected content at risk of being truncated for large projects given the 50,000 token output cap?
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
| 1 | `GenerateProjectDescription` | Generate project description from questionnaire answers | NOT REVIEWED | [review](llm-job-reviews/generate-project-description.md) |
| 2 | `AutoAnswerQuestionnaire` | Auto-fill unanswered questionnaire fields | NOT REVIEWED | [review](llm-job-reviews/auto-answer-questionnaire.md) |
| 3 | `GenerateProjectOverview` `RegenerateProjectOverview` `GenerateOverviewImprovements` | Generate or update the project overview document | NOT REVIEWED | [review](llm-job-reviews/generate-project-overview.md) |
| 4 | `GenerateProductSpec` `RegenerateProductSpec` `GenerateProductSpecImprovements` | Generate or update the product specification | NOT REVIEWED | [review](llm-job-reviews/generate-product-spec.md) |
| 5 | `GenerateUseCases` | Generate use cases from project context | NOT REVIEWED | [review](llm-job-reviews/generate-use-cases.md) |
| 6 | `DeduplicateUseCases` | Deduplicate the existing use case list | NOT REVIEWED | [review](llm-job-reviews/deduplicate-use-cases.md) |
| 7 | `GenerateDecisionDeck` | Generate a decision deck with architectural choices for the project blueprint | NOT REVIEWED | [review](llm-job-reviews/generate-decision-deck.md) |
| 8 | `GenerateProjectBlueprint` | Compile the full project blueprint document | NOT REVIEWED | [review](llm-job-reviews/generate-project-blueprint.md) |
| 9 | `GenerateMilestones` | Generate milestone definitions from use cases and planning documents | NOT REVIEWED | [review](llm-job-reviews/generate-milestones.md) |
| 10 | `AppendMilestones` | Append additional milestones to the existing milestone map | NOT REVIEWED | [review](llm-job-reviews/append-milestones.md) |
| 11 | `ReviewMilestoneMap` | Review the milestone map for structural issues | NOT REVIEWED | [review](llm-job-reviews/review-milestone-map.md) |
| 12 | `RewriteMilestoneMap` | Rewrite the milestone map based on review feedback | NOT REVIEWED | [review](llm-job-reviews/rewrite-milestone-map.md) |
| 13 | `GenerateMilestoneDesign` | Generate milestone design with delivery groups and user flows | NOT REVIEWED | [review](llm-job-reviews/generate-milestone-design.md) |
| 14 | `ReviewMilestoneScope` `ReviewMilestoneCoverage` | Review milestone scope completeness and use-case coverage | NOT REVIEWED | [review](llm-job-reviews/review-milestone-scope-coverage.md) |
| 15 | `GenerateMilestoneFeatureSet` | Generate the feature set for a milestone | NOT REVIEWED | [review](llm-job-reviews/generate-milestone-feature-set.md) |
| 16 | `RewriteMilestoneFeatureSet` | Rewrite the milestone's feature set | NOT REVIEWED | [review](llm-job-reviews/rewrite-milestone-feature-set.md) |
| 17 | `ReviewMilestoneDelivery` | Review delivery against product requirements | NOT REVIEWED | [review](llm-job-reviews/review-milestone-delivery.md) |
| 18 | `ResolveMilestoneDeliveryIssues` `ResolveMilestoneCoverageIssues` | Resolve identified delivery and coverage issues | NOT REVIEWED | [review](llm-job-reviews/resolve-milestone-issues.md) |
| 19 | `GenerateFeatureProductSpec` | Generate product spec for a specific feature | NOT REVIEWED | [review](llm-job-reviews/generate-feature-product-spec.md) |
| 20 | `GenerateFeatureUxSpec` `GenerateFeatureTechSpec` `GenerateFeatureUserDocs` `GenerateFeatureArchDocs` | Generate UX spec, tech spec, user docs, and arch docs for a feature | NOT REVIEWED | [review](llm-job-reviews/generate-feature-specs.md) |
| 21 | `GenerateTaskClarifications` | Generate clarification questions for feature task planning | SUPERSEDED by `PlanFeatureTasksSandbox` | [review](llm-job-reviews/generate-task-clarifications.md) |
| 22 | `AutoAnswerTaskClarifications` | Auto-answer pending task clarification questions | SUPERSEDED by `PlanFeatureTasksSandbox` | [review](llm-job-reviews/auto-answer-task-clarifications.md) |
| 23 | `GenerateFeatureTaskList` | Generate the implementation task list for a feature | SUPERSEDED by `PlanFeatureTasksSandbox` | [review](llm-job-reviews/generate-feature-task-list.md) |
| 24 | `ReviewDelivery` | Review overall milestone coverage completeness against approved user flows | NOT REVIEWED | [review](llm-job-reviews/review-delivery.md) |

---

## Section 2 — Sandbox (OpenCode) Jobs

These jobs launch a Docker container running `opencode` (via `docker/agent-sandbox/qb_entrypoint.sh`). Sandbox run kinds are defined in `packages/shared/src/schemas/sandbox.ts`.

| # | Job Name(s) | Purpose | Status | Findings |
|---|-------------|---------|--------|----------|
| 1 | `PlanFeatureTasksSandbox` | Plan feature tasks via OpenCode sandbox (run kind: `task_planning`) | NOT REVIEWED | [review](llm-job-reviews/plan-feature-tasks-sandbox.md) |
| 2 | `RunProjectReview` | Full repository engineering review via OpenCode (run kind: `project_review`) | NOT REVIEWED | [review](llm-job-reviews/run-project-review.md) |
| 3 | `RunProjectFix` | Fix project review issues via OpenCode (run kind: `project_fix`) | NOT REVIEWED | [review](llm-job-reviews/run-project-fix.md) |
| 4 | `RunBugFix` | Fix a specific bug via OpenCode sandbox (run kind: `bug_fix`) | NOT REVIEWED | [review](llm-job-reviews/run-bug-fix.md) |
| 5 | `ImplementChange` | Execute a feature implementation via OpenCode (run kind: `implement`) | NOT REVIEWED | [review](llm-job-reviews/implement-change.md) |
| 6 | `TestAndVerify` | Test and verify an implementation via OpenCode (run kind: `verify`) | NOT REVIEWED | [review](llm-job-reviews/test-and-verify.md) |
| 7 | `RepairMilestoneCi` | Repair CI failures via OpenCode (run kind: `ci_repair`) | NOT REVIEWED | [review](llm-job-reviews/repair-milestone-ci.md) |
| 8 | `ExecuteMilestoneSession` | Execute a milestone-level sandbox session via OpenCode | NOT REVIEWED | [review](llm-job-reviews/execute-milestone-session.md) |
