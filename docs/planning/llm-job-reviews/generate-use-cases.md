# Review: GenerateUseCases

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3315` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate a set of use cases from the product spec and project context.

## Output

List of use cases stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateUseCases'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include sufficient product spec context to generate meaningful use cases?
- [ ] **Output schema alignment** — does the prompt's described use case structure match what the parser expects?
- [ ] **Output usefulness** — are the use cases meaningful and distinct? Would a professional team use them as a genuine planning artefact, or are they too generic? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty list?
- [ ] **Terminology consistency** — are use case terms consistent with what `DeduplicateUseCases` and `GenerateMilestones` expect?
- [ ] **Prompt injection surface** — product spec content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._
