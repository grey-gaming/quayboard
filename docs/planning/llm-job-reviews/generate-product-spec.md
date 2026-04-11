# Review: GenerateProductSpec / RegenerateProductSpec / GenerateProductSpecImprovements

| | |
|---|---|
| **Status** | REVIEWED |
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

- Reviewed the full multi-step chain (`GenerateProductSpec` -> quality check -> optional retry -> review) and local run history (4 base runs, review/repair templates present).
- Failure handling is mature: malformed JSON routes through repair; major quality failures route through a dedicated quality-check pass with regeneration hints.
- Token budget risk is high on output size (local max response ~136k chars), which can degrade smaller models or increase truncation risk.
- Recommended: consider section-wise generation with deterministic assembly for large projects to reduce single-pass output pressure.

## Tier-1 Output Quality Review

- Verdict: Polished and comprehensive. The prompts have been updated to align with the committed-direction philosophy used by `GenerateProjectOverview`.
- Source-grounded requirement labels and assumption confidence markers are not applicable — the LLM is the product author here, not an annotator of external requirements. Everything is generated from a questionnaire; labeling inferences throughout the spec body produces a hedged document that downstream jobs cannot treat as authoritative product direction.
- Scope bloat is the legitimate concern from the original audit finding. Addressed by replacing the inference-labeling rule with committed-direction language: the main spec body owns product decisions; the Assumptions and Proposed Defaults section holds non-obvious scope extensions and platform capabilities beyond the stated direction.
- The review pass has been updated to enforce scope discipline (push extensions to Assumptions section) rather than add hedging markers throughout the spec.
