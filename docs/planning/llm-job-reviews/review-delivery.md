# Review: ReviewDelivery

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5574` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Review overall milestone delivery coverage completeness against approved user flows. The review checks whether user flows are adequately covered by the milestone map and produces a `complete` boolean plus an optional issue list.

## Output

JSON with a `complete` boolean and optional issues. If uncovered user flows exist, the job short-circuits and suggests adding milestones rather than calling the LLM.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'ReviewDelivery'`)
- [ ] **Prompt clarity** — does the prompt clearly define what "delivery complete" means vs. partial coverage?
- [ ] **Context completeness** — does the prompt include the product spec, user flows, coverage data, and milestone list needed to assess delivery completeness?
- [ ] **Output schema alignment** — does the prompt's described output shape match what the parser expects? Is the `complete` boolean reliably produced?
- [ ] **Output usefulness** — are the review findings specific and actionable? Would a professional team find them useful for deciding whether delivery is complete? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an incorrect `complete` value?
- [ ] **Terminology consistency** — are delivery terms consistent with `ReviewMilestoneDelivery` and `ResolveMilestoneDeliveryIssues`?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs (product spec + all user flows + all milestones) fit within 50,000 output tokens?

## Findings

- Reviewed `ReviewDelivery` execution/parsing and shared prompt builder `buildDeliveryReviewPrompt`.
- No local `ReviewDelivery` runs exist, so this item is code-path only in the current environment.
- Prompt contract uses `jobType` actions (`GenerateUseCases`/`GenerateMilestones`) and parser enforces `complete` boolean before output acceptance.
- Because this shares prompt structure with milestone-map review logic, dedicated project-level delivery examples should be added to integration tests before wider rollout.

## Tier-1 Output Quality Review

- Verdict: Cannot verify tier-1 output quality from local runs, and the prompt-level review shows the output contract needs more evidence structure.
- Quality gaps: a delivery review should not be a bare judgment; it needs acceptance criteria coverage, implementation evidence, test evidence, and explicit unresolved risks.
- Tier-1 bar: require a delivery evidence matrix and block completion when the review cannot cite the artifacts or checks behind its conclusion.
