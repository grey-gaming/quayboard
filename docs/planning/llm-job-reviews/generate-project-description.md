# Review: GenerateProjectDescription

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:2847` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate a short description for a new project from the answers provided in the project questionnaire.

## Output

Project description text stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (see [index](../llm-job-qa-review.md) for queries — filter `llm_runs` by `template_id = 'GenerateProjectDescription'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include all questionnaire answers a human would need to write a good description?
- [ ] **Output usefulness** — does the description read like something a professional software team would write? Is it specific to the project, or generic filler? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns an unusable or empty response?
- [ ] **Prompt injection surface** — questionnaire answers are user-supplied; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic questionnaire answers fit within 50,000 output tokens?

## Findings

_No findings yet._
