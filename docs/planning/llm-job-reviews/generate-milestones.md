# Review: GenerateMilestones

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3599` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate milestone definitions from use cases and planning documents. Milestones represent shippable delivery increments covering the project's user flows.

## Output

Milestone definitions stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateMilestones'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include all use cases and the product spec needed to define coherent milestones?
- [ ] **Output schema alignment** — does the prompt's described milestone structure match what the parser expects?
- [ ] **Output usefulness** — are the milestones meaningful increments that a professional team would recognise as a delivery plan? Are they correctly scoped — not too large, not too granular? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty list?
- [ ] **Terminology consistency** — are milestone terms consistent with `ReviewMilestoneMap`, `GenerateMilestoneDesign`, and downstream jobs?
- [ ] **Prompt injection surface** — product spec and use case content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — a full set of use cases plus product spec could be large; verify realistic inputs fit within 50,000 output tokens

## Findings

- Reviewed milestone planning prompt/validator and local evidence (5 base runs, 2 repair runs).
- Schema alignment is clear (`title`, `summary`, `useCaseIds`), with first-milestone exception handled explicitly and post-parse validation catching empty downstream milestones.
- Observed failures include both structured-output issues and domain guards (e.g., invalid cross-project user-flow references), which is the correct fail-fast behavior.
- Prompt size is substantial (local max ~92k chars), so smaller models may still require additional decomposition or summarization.
