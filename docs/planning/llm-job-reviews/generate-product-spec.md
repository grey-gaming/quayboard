# Review: GenerateProductSpec / RegenerateProductSpec / GenerateProductSpecImprovements

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:2982` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate or update the product specification from the project overview and questionnaire. The `Regenerate` variant replaces the existing spec; the `Improvements` variant refines it.

## Output

Product spec markdown stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateProductSpec'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include the overview and sufficient project context to write a complete spec?
- [ ] **Output usefulness** — does the spec read like a professional product requirements document? Does it cover goals, user needs, and scope clearly? If not, what is missing and what prompt changes would fix it?
- [ ] **Regeneration stability** — does the `Regenerate` variant produce stable output on the same input?
- [ ] **Failure handling** — what happens if the LLM returns malformed or empty output?
- [ ] **Terminology consistency** — are product terms consistent with what downstream jobs (e.g. `GenerateUseCases`, `GenerateMilestones`) expect?
- [ ] **Prompt injection surface** — overview and questionnaire answers are user-supplied; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._
