# Review: GenerateProjectOverview / RegenerateProjectOverview / GenerateOverviewImprovements

| | |
|---|---|
| **Status** | REVIEWED |
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

- Reviewed shared overview prompt for `GenerateProjectOverview`/`RegenerateProjectOverview`/`GenerateOverviewImprovements` and parser logic.
- Local evidence exists only for `GenerateProjectOverview` (3 runs); no local runs were found for regenerate/improvement variants.
- Schema alignment is strong (`title`, `description`, `markdown`) with explicit failure on missing fields and JSON repair fallback.
- Token budget appears moderate in local data (max prompt ~13k chars), with lower risk than milestone/feature-generation templates.

## Tier-1 Output Quality Review

- Verdict: Polished and readable, but the previous prompt was overly restrictive — forcing all inferred content into the Assumptions section left the body of the document thin and non-committal.
- Root cause: `"Place any inferred capabilities or proposed defaults exclusively in the Assumptions section"` conflated high-level product direction (which should be owned throughout) with specific capability extensions (which belong in Assumptions).
- Fix applied: prompt now instructs the LLM to make and commit to high-level design decisions (product paradigm, user model, experience model) throughout the document. The Assumptions section is scoped to specific capabilities beyond stated requirements and choices that later planning jobs will resolve. A tech-specifics guardrail was added to prevent premature implementation decisions.
- This job is an early-stage overview — downstream jobs (Product Spec, Decision Deck, Milestones) are responsible for progressively more specific decisions.
