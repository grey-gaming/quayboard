# LLM Job QA Review

This document catalogues every background job in Quayboard that invokes an LLM — either directly via the Ollama/OpenAI adapter, or indirectly via an OpenCode sandbox container. Use the **Status** column to track whether each job's prompt has been reviewed for quality.

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

Work through the following for each job entry. Update the **Status** column as you go.

#### Direct LLM Jobs (Section 1)

- [ ] **Read the prompt builder** in `apps/api/src/services/jobs/job-prompts.ts` for the job's `templateId`
- [ ] **Pull a real prompt from the database** using the queries above and read it end-to-end as the model would
- [ ] **Prompt clarity** — are instructions unambiguous? Could a smaller/weaker model (e.g. a local Ollama model) still produce usable output?
- [ ] **Context completeness** — does the prompt include all data a human expert would need to perform the same task? Is any injected content (product spec, use cases, milestone data) at risk of being truncated for large projects given the 50,000 token output cap?
- [ ] **Output schema alignment** — for JSON-generating jobs, does the prompt's described output shape exactly match what the parser in `job-runner-service.ts` expects? Mismatches cause silent failures or corrupt DB state
- [ ] **Multi-step generation** — for jobs using draft + review generation (`GenerateFeatureTaskList`, `ReviewMilestoneMap`, etc.): does the review prompt catch the failure modes the draft prompt is prone to?
- [ ] **Regeneration stability** — for `Regenerate*` and `Rewrite*` variants: does the prompt produce stable output when called repeatedly on the same input, or does it encourage creative variation that would surprise the user?
- [ ] **Failure handling** — what happens when the LLM returns malformed JSON or omits required fields? Is parsing/validation robust, or does the job fail silently?
- [ ] **Terminology consistency** — do the terms used in the prompt (milestone, feature, delivery group, etc.) match how those terms are used in downstream jobs that consume the output?
- [ ] **Prompt injection surface** — any user-supplied content interpolated into the prompt (project name, questionnaire answers, bug descriptions) should be checked to ensure it cannot hijack the instruction structure

#### Sandbox / OpenCode Jobs (Section 2)

- [ ] **Read the entrypoint** at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt file and context files are passed to OpenCode
- [ ] **Read the prompt and context files** for the run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like so OpenCode knows when to stop?
- [ ] **Output artifact specification** — does the prompt explicitly name the output files OpenCode must produce (e.g. `project-review.json`, `task-plan.json`) and describe their required schema?
- [ ] **Scope containment** — does the prompt constrain OpenCode to the right files and directories? Overly broad prompts risk unintended changes to the repository
- [ ] **Fix/repair job scope** — for `RunProjectFix`, `RunBugFix`, and `RepairMilestoneCi`: is there a clear definition of "done" that prevents over-engineering?

#### Cross-cutting (all jobs)

- [ ] **Output usefulness** — given the purpose of the project being reviewed, does the output actually make sense? Does it read like something a professional software team would produce — or is it generic, vague, shallow, or structurally wrong? If not, identify specifically what is missing or misleading and note what prompt changes would fix it
- [ ] **Model-agnostic language** — prompts must degrade gracefully on smaller Ollama models, not just large OpenAI-compatible endpoints
- [ ] **Token budget** — verify that realistic inputs fit within `LLM_MAX_OUTPUT_TOKENS` (default 50,000) without truncation; flag any job where a large project might hit the limit
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in a notes field below the checklist when you mark the entry as reviewed

---

## Section 1 — Direct LLM Jobs (Ollama / OpenAI)

These jobs call the project's configured LLM provider directly through `llmProviderService.generate()` (wrapped by `generateWithJobFailure` / `runStructuredJsonGeneration`). Prompts are built in `apps/api/src/services/jobs/job-prompts.ts`.

| # | Job Name(s) | Purpose | Output | Code Location | Status |
|---|-------------|---------|--------|---------------|--------|
| 1 | `GenerateProjectDescription` | Generate a description for the project from questionnaire answers | Project description text (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:2847` | NOT REVIEWED |
| 2 | `AutoAnswerQuestionnaire` | Auto-fill unanswered questionnaire fields using structured JSON generation | JSON object with questionnaire field answers | `apps/api/src/services/jobs/job-runner-service.ts:2875` | NOT REVIEWED |
| 3 | `GenerateProjectOverview` `RegenerateProjectOverview` `GenerateOverviewImprovements` | Generate or update the project overview document | Overview markdown (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:2929` | NOT REVIEWED |
| 4 | `GenerateProductSpec` `RegenerateProductSpec` `GenerateProductSpecImprovements` | Generate or update the product specification | Product spec markdown (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:2982` | NOT REVIEWED |
| 5 | `GenerateUseCases` | Generate use cases from project context | List of use cases (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3315` | NOT REVIEWED |
| 6 | `DeduplicateUseCases` | Deduplicate the existing use case list | Deduplicated use case list (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3379` | NOT REVIEWED |
| 7 | `GenerateDecisionDeck` | Generate a decision deck with architectural choices for the project blueprint | Decision deck with options/choices (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3403` | NOT REVIEWED |
| 8 | `GenerateProjectBlueprint` | Compile the full project blueprint document | Blueprint markdown (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3484` | NOT REVIEWED |
| 9 | `GenerateMilestones` | Generate milestone definitions from use cases and planning documents | Milestone definitions (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3599` | NOT REVIEWED |
| 10 | `AppendMilestones` | Append additional milestones to the existing milestone map | Additional milestone definitions (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3665` | NOT REVIEWED |
| 11 | `ReviewMilestoneMap` | Review the milestone map for structural issues | Review report / issues list | `apps/api/src/services/jobs/job-runner-service.ts:3744` | NOT REVIEWED |
| 12 | `RewriteMilestoneMap` | Rewrite the milestone map based on review feedback | Updated milestone definitions (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3816` | NOT REVIEWED |
| 13 | `GenerateMilestoneDesign` | Generate design for a milestone including delivery groups and user flows | Milestone design document with delivery groups and flows (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:3880` | NOT REVIEWED |
| 14 | `ReviewMilestoneScope` `ReviewMilestoneCoverage` | Review milestone scope completeness and use-case coverage | Review findings (issues, gaps) | `apps/api/src/services/jobs/job-runner-service.ts:4152` | NOT REVIEWED |
| 15 | `GenerateMilestoneFeatureSet` | Generate the feature set for a milestone | Feature definitions for the milestone (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:4241` | NOT REVIEWED |
| 16 | `RewriteMilestoneFeatureSet` | Rewrite the milestone's feature set | Updated feature definitions (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:4372` | NOT REVIEWED |
| 17 | `ReviewMilestoneDelivery` | Review delivery against product requirements | Delivery review findings | `apps/api/src/services/jobs/job-runner-service.ts:4516` | NOT REVIEWED |
| 18 | `ResolveMilestoneDeliveryIssues` `ResolveMilestoneCoverageIssues` | Resolve identified delivery and coverage issues | Issue resolutions (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:4609` | NOT REVIEWED |
| 19 | `GenerateFeatureProductSpec` | Generate the product spec for a specific feature | Feature product spec document (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:4837` | NOT REVIEWED |
| 20 | `GenerateFeatureUxSpec` `GenerateFeatureTechSpec` `GenerateFeatureUserDocs` `GenerateFeatureArchDocs` | Generate UX spec, tech spec, user documentation, and architecture docs for a feature | Four feature spec documents (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:4933` | NOT REVIEWED |
| 21 | `GenerateTaskClarifications` | Generate clarification questions to resolve ambiguities before feature task planning | List of clarification questions (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:5072` | NOT REVIEWED |
| 22 | `AutoAnswerTaskClarifications` | Auto-answer pending task clarification questions | Answers to clarification questions (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:5073` | NOT REVIEWED |
| 23 | `GenerateFeatureTaskList` | Generate the implementation task list for a feature (uses multi-step draft + review generation) | Feature task list (stored in DB) | `apps/api/src/services/jobs/job-runner-service.ts:5074` | NOT REVIEWED |
| 24 | `ReviewDelivery` | Review overall milestone coverage completeness against approved user flows | Review result with completeness flag and issue list | `apps/api/src/services/jobs/job-runner-service.ts:5574` | NOT REVIEWED |

---

## Section 2 — Sandbox (OpenCode) Jobs

These jobs launch a Docker container running `opencode` (invoked via `docker/agent-sandbox/qb_entrypoint.sh`). The LLM is called inside the container using the project's configured provider. Sandbox run kinds are defined in `packages/shared/src/schemas/sandbox.ts`. Sandbox jobs are orchestrated via `apps/api/src/services/sandbox-service.ts`.

| # | Job Name(s) | Purpose | Output | Code Location | Status |
|---|-------------|---------|--------|---------------|--------|
| 1 | `PlanFeatureTasksSandbox` | Plan feature tasks using OpenCode in an isolated sandbox (run kind: `task_planning`) | `task-plan.json` artifact | `apps/api/src/services/jobs/job-runner-service.ts:5225` | NOT REVIEWED |
| 2 | `RunProjectReview` | Run a full repository engineering review using OpenCode (run kind: `project_review`) | `project-review.md`, `project-review.json` artifacts | `apps/api/src/services/jobs/job-runner-service.ts:5315` | NOT REVIEWED |
| 3 | `RunProjectFix` | Fix issues identified in a project review using OpenCode (run kind: `project_fix`) | Git branch name, PR URL | `apps/api/src/services/jobs/job-runner-service.ts:5369` | NOT REVIEWED |
| 4 | `RunBugFix` | Fix a specific bug report using OpenCode in sandbox (run kind: `bug_fix`) | Git branch name, PR URL | `apps/api/src/services/jobs/job-runner-service.ts:5401` | NOT REVIEWED |
| 5 | `ImplementChange` | Execute a pre-created sandbox run to implement a feature change via OpenCode (run kind: `implement`) | Code changes committed to a branch (sandbox run result) | `apps/api/src/services/jobs/job-runner-service.ts:5459` | NOT REVIEWED |
| 6 | `TestAndVerify` | Execute a pre-created sandbox run to test and verify an implementation via OpenCode (run kind: `verify`) | Verification result (test pass/fail, sandbox run) | `apps/api/src/services/jobs/job-runner-service.ts:5460` | NOT REVIEWED |
| 7 | `RepairMilestoneCi` | Repair CI failures for a milestone using OpenCode (run kind: `ci_repair`) | CI fixes committed to branch (sandbox run result) | `apps/api/src/services/jobs/job-runner-service.ts:5532` | NOT REVIEWED |
| 8 | `ExecuteMilestoneSession` | Execute a milestone-level sandbox session via OpenCode | Milestone session completion (sandbox run result) | `apps/api/src/services/jobs/job-runner-service.ts:5555` | NOT REVIEWED |
