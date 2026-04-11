# Review: DeduplicateUseCases

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3379` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Deduplicate the existing use case list by merging or removing semantically equivalent entries.

## Output

Deduplicated use case list stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'DeduplicateUseCases'`)
- [ ] **Prompt clarity** — are the deduplication rules clear? Does the model know when to merge vs. preserve distinct use cases?
- [ ] **Output schema alignment** — does the prompt's described output shape match what the parser expects?
- [ ] **Output usefulness** — does deduplication actually improve the list, or does it over-merge distinct use cases? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns an empty list or malformed JSON?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — could a large use case list exceed the 50,000-token output cap?

## Findings

- Implementation review shows `DeduplicateUseCases` is currently deterministic DB logic in `job-runner-service.ts`, not an LLM prompt-driven job.
- No `llm_runs` rows exist for template `DeduplicateUseCases` (run count: 0), which matches the current non-LLM implementation.
- Current behavior archives only exact title duplicates after lowercase/trim normalization; semantic duplicates with different wording are not deduplicated.
- Recommended: update this review metadata/type to reflect non-LLM behavior, or reintroduce a true LLM path if semantic deduplication is required.
