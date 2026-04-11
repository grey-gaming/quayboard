# Review: GenerateProjectDescription

| | |
|---|---|
| **Status** | REVIEWED |
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
- [ ] **Context completeness** — does the prompt include all questionnaire answers an autonomous generation agent would need to write a good description?
- [ ] **Output usefulness** — does the description read like something a professional software team would write? Is it specific to the project, or generic filler? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns an unusable or empty response?
- [ ] **Prompt injection surface** — questionnaire answers are user-supplied; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic questionnaire answers fit within 50,000 output tokens?

## Findings

- Reviewed `buildProjectDescriptionPrompt` and `GenerateProjectDescription` execution path in `job-runner-service.ts`.
- No local `llm_runs` rows exist for this template, so this assessment is code-only in this environment.
- Unlike most jobs, this path does not enforce structured output or minimum content quality; it persists `generated.content.trim()` directly.
- Recommended: add lightweight guardrails (minimum length, sentence count, non-empty assertion) to avoid silently storing empty or trivial descriptions.

## Tier-1 Output Quality Review

- Verdict: Cannot verify tier-1 quality without a local representative output; the current review only covers contract and prompt risks.
- Quality gaps: description generation needs stronger validation for empty, generic, injected, or marketing-only summaries before a team should rely on it as project identity.
- Tier-1 bar: store output examples and require a description quality rubric covering specificity, source grounding, prohibited invented claims, and minimum useful detail.
