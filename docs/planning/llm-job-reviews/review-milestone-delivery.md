# Review: ReviewMilestoneDelivery

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:4516` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Review delivery of a milestone's features against their product requirements — checking whether workstreams are complete, acceptance criteria are met, and the overall milestone is ready to ship.

## Output

JSON with a `complete` boolean and optional issue list, used to decide whether the milestone can be closed or needs further work.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'ReviewMilestoneDelivery'`)
- [ ] **Prompt clarity** — does the prompt clearly define what "delivery complete" means vs. partial delivery?
- [ ] **Context completeness** — does the prompt include the milestone design document, feature list, workstream statuses, and task progress needed to make a meaningful assessment?
- [ ] **Output schema alignment** — does the prompt's described output shape match what the parser expects? Is the `complete` boolean reliably produced?
- [ ] **Output usefulness** — are the delivery review findings specific and actionable? Would a professional team find them useful for deciding whether to close a milestone? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an incorrect `complete` value?
- [ ] **Terminology consistency** — are delivery terms consistent with `ReviewMilestoneScope` and `ResolveMilestoneDeliveryIssues`?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — milestone delivery context with multiple features and workstreams could be large; verify realistic inputs fit within 50,000 output tokens

## Findings

_No findings yet._