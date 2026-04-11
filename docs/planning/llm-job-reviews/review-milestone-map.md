# Review: ReviewMilestoneMap

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3744` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Review the milestone map for structural issues — gaps in coverage, poor sequencing, or milestones that are too large or too granular.

## Output

Review report / issues list used to decide whether `RewriteMilestoneMap` should be triggered.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'ReviewMilestoneMap'`)
- [ ] **Prompt clarity** — does the prompt clearly define what constitutes a structural issue vs. an acceptable milestone map?
- [ ] **Context completeness** — does the prompt include the full milestone map and relevant use cases to make a meaningful assessment?
- [ ] **Multi-step generation** — does the review output feed correctly into `RewriteMilestoneMap`? Does it catch the specific failure modes that rewrite needs to address?
- [ ] **Output schema alignment** — does the prompt's described issue structure match what the parser expects?
- [ ] **Output usefulness** — are the review findings specific and actionable? Would a professional team find them useful? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty issues list?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._
