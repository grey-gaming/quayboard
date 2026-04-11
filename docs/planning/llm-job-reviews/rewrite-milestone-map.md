# Review: RewriteMilestoneMap

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3816` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Rewrite the milestone map to address issues identified by `ReviewMilestoneMap`.

## Output

Updated milestone definitions stored in the database, replacing the previous map.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'RewriteMilestoneMap'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include both the original milestone map and the review findings so the model knows exactly what to fix?
- [ ] **Multi-step generation** — does the rewrite actually address the issues identified by `ReviewMilestoneMap`, or does it ignore them?
- [ ] **Regeneration stability** — does the prompt produce a consistent, improved map rather than introducing new problems?
- [ ] **Output schema alignment** — does the prompt's described milestone structure match what the parser expects?
- [ ] **Output usefulness** — is the rewritten map a genuine improvement? Does it resolve the review findings without introducing new structural issues? If not, what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

- Reviewed `RewriteMilestoneMap` path: it reuses `buildMilestonePlanPrompt` with aggregated hints from map-review issues.
- No local `llm_runs` exist for template `RewriteMilestoneMap`, so regeneration stability could not be validated empirically.
- Unlike newer rewrite jobs, this path has no explicit draft+review pass, making output quality more sensitive to a single generation attempt.
- Recommended: add a review pass (or deterministic post-check) analogous to feature-set rewrite to improve stability.
