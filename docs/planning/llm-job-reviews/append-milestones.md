# Review: AppendMilestones

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3665` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Append additional milestones to the existing milestone map, typically to cover use cases not addressed by the current plan.

## Output

Additional milestone definitions stored in the database alongside the existing ones.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'AppendMilestones'`)
- [ ] **Prompt clarity** — does the prompt clearly distinguish between existing milestones (do not repeat) and the gap it needs to fill?
- [ ] **Context completeness** — does the prompt include the existing milestone map so the model avoids duplicating what already exists?
- [ ] **Output schema alignment** — does the prompt's described milestone structure match what the parser expects?
- [ ] **Output usefulness** — are the appended milestones coherent with the existing plan? Do they genuinely fill gaps rather than repeat or contradict existing milestones? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty list?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — existing milestones plus uncovered use cases could be large; verify realistic inputs fit within 50,000 output tokens

## Findings

_No findings yet._
