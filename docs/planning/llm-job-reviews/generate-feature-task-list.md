# Review: GenerateFeatureTaskList

| | |
|---|---|
| **Status** | SUPERSEDED |
| **Type** | Direct LLM (Ollama / OpenAI) — superseded by `PlanFeatureTasksSandbox` |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5074` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate the implementation task list for a feature based on its acceptance criteria, workstream specs, clarification answers, and milestone design. Tasks are the units that feed into sandbox implementation runs.

> **Superseded:** Task generation has moved to the sandbox path. `PlanFeatureTasksSandbox` (Section 2) now handles task planning end-to-end via OpenCode. This direct-LLM job type is still callable via the API but is no longer part of the auto-advance workflow (`auto-advance.ts:332`).

## Output

JSON array of tasks (each with title, description, and metadata) stored in the database as the feature's task plan.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateFeatureTaskList'`)
- [ ] **Prompt clarity** — are instructions unambiguous about what constitutes a good implementation task? Could a weaker local Ollama model produce usable output?
- [ ] **Context completeness** — does the prompt include the feature's acceptance criteria, milestone design, all workstream specs, and clarification answers?
- [ ] **Output schema alignment** — does the prompt's described task structure match what the parser expects?
- [ ] **Output usefulness** — are the tasks well-scoped, implementable units that a professional software team could pick up and work on? Are they correctly sequenced? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty task list?
- [ ] **Terminology consistency** — are task terms consistent with downstream sandbox jobs (`ImplementChange`, `TestAndVerify`)?
- [ ] **Prompt injection surface** — spec content and clarification answers are user-influenced; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens? A feature with many specs could produce a large prompt

## Findings

_No findings yet._