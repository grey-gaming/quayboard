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

- Verdict: Polished and readable, but not consistently tier-1 because it leans toward product-strategy prose rather than testable planning constraints.
- Quality gaps: sampled overview content was helpful, but it lacked clear assumption labels, risk callouts, and concrete decisions that downstream planning can verify.
- Tier-1 bar: require explicit confirmed facts, inferred assumptions, open risks, and downstream planning constraints instead of only narrative synthesis.
