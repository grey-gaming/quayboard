# Review: GenerateProjectOverview / RegenerateProjectOverview / GenerateOverviewImprovements

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:2929` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate or update the project overview document from the project questionnaire. The `Regenerate` variant replaces the existing overview; the `Improvements` variant refines it based on feedback.

## Output

Overview markdown stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateProjectOverview'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include sufficient questionnaire context to write a meaningful overview?
- [ ] **Output usefulness** — does the overview read like a professional project brief? Is it specific and actionable, or generic? If not, what is missing and what prompt changes would fix it?
- [ ] **Regeneration stability** — does the `Regenerate` variant produce stable output on the same input, or introduce unwanted variation?
- [ ] **Failure handling** — what happens if the LLM returns malformed or empty output?
- [ ] **Prompt injection surface** — questionnaire answers are user-supplied; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._
