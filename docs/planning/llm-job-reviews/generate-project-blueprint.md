# Review: GenerateProjectBlueprint

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3484` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Compile the full project blueprint document from the product spec, use cases, and resolved decision deck.

## Output

Blueprint markdown stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateProjectBlueprint'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include the product spec, use cases, and all resolved decisions?
- [ ] **Output usefulness** — does the blueprint read like a professional engineering planning document? Is it specific, structured, and actionable? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed or empty output?
- [ ] **Terminology consistency** — are terms consistent with what `GenerateMilestones` and downstream jobs expect?
- [ ] **Prompt injection surface** — product spec and decision content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — a full blueprint with all context could be large; verify realistic inputs fit within 50,000 output tokens

## Findings

_No findings yet._
