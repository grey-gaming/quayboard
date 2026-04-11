# Review: GenerateUseCases

| | |
|---|---|
| **Status** | REVIEWED |
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

- Reviewed `buildUserFlowPrompt`, `validateGeneratedUserFlows`, and local evidence (3 runs).
- Output schema alignment is strong and explicit: required fields plus normalized flow steps are enforced before persistence.
- Prompt and output can be large (local max prompt ~119k chars, response ~34k chars), which can stress smaller models.
- Recommended: if local-model quality drops, add a two-pass strategy (core flows first, then edge/failure augmentation) instead of one large generation pass.

## Tier-1 Output Quality Review

- Verdict: Detailed and useful, but not consistently tier-1 for this stage because it can over-prescribe UI labels, screens, and interaction copy.
- Quality gaps: sampled use cases provided strong flow detail, but some content belongs in UX design rather than use-case discovery and can prematurely constrain later design work.
- Tier-1 bar: separate user intent and success criteria from proposed UI examples, and mark any screen/copy detail as non-binding unless sourced from an approved UX spec.

## Fix Applied (2026-04-11)

Added three behavioral-constraint lines to `buildUserFlowPrompt` (`apps/api/src/services/jobs/job-prompts.ts`):

1. `flowSteps` — must describe what the user is trying to accomplish, not specific screens, buttons, or UI elements.
2. `entryPoint` / `endState` — must describe user or system state, not a screen name or page.
3. `acceptanceCriteria` — must state observable business outcomes or user success conditions, not UI elements or copy strings.
