# Review: GenerateTaskClarifications

| | |
|---|---|
| **Status** | SUPERSEDED |
| **Type** | Direct LLM (Ollama / OpenAI) — superseded by `PlanFeatureTasksSandbox` |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5072` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate clarification questions for feature task planning. Given a feature's acceptance criteria, milestone design, and workstream specs, the model produces a list of questions whose answers will help scope implementation tasks.

> **Superseded:** Task generation has moved to the sandbox path. `PlanFeatureTasksSandbox` (Section 2) now handles task planning end-to-end via OpenCode. This direct-LLM job type is still callable via the API but is no longer part of the auto-advance workflow (`auto-advance.ts:321`).

## Output

JSON array of clarification questions stored in the database, each with a question string and optional context.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateTaskClarifications'`)
- [ ] **Prompt clarity** — are instructions unambiguous about the kinds of questions the model should ask? Could a weaker local Ollama model produce usable clarifications?
- [ ] **Context completeness** — does the prompt include the feature's acceptance criteria, milestone design document, and all completed workstream documents (product spec, UX spec, tech spec)?
- [ ] **Output schema alignment** — does the prompt's described clarification structure match what the parser expects?
- [ ] **Output usefulness** — are the generated questions specific to the feature and genuinely useful for scoping tasks? Or are they generic questions that any project would generate? If not, what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty array?
- [ ] **Terminology consistency** — are clarification questions consistent with the feature's spec content and downstream task generation?
- [ ] **Prompt injection surface** — feature specs and acceptance criteria are user-influenced; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._