# Review: GenerateFeatureProductSpec

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:4837` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate a product specification for a specific feature, drawing on the project-level product spec, technical spec, UX spec, and the feature's acceptance criteria and milestone context.

## Output

Feature product spec markdown stored in the database as a workstream revision.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateFeatureProductSpec'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include the project product spec, technical spec, UX spec, milestone design document, sibling features, and the feature's acceptance criteria?
- [ ] **Output usefulness** — does the generated spec read like something a professional software team would write for a feature? Is it specific and actionable, or generic filler? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns an unusable or empty spec?
- [ ] **Terminology consistency** — are feature terms consistent with `GenerateMilestoneFeatureSet` and downstream feature spec jobs?
- [ ] **Prompt injection surface** — acceptance criteria and spec content are user-influenced; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — multiple specs plus milestone context could be large; verify realistic inputs fit within 50,000 output tokens

## Findings

- Reviewed draft+review generation path (`GenerateFeatureProductSpec` + `GenerateFeatureProductSpecReview`) and local run history (65 base runs, 64 review runs, 1 repair run).
- Output schema alignment is solid via `parseFeatureWorkstreamResult`; malformed responses fail explicitly and trigger repair attempts.
- Prompt context is very large in practice (local max prompt ~167k chars), which is a real model-agnostic risk for smaller Ollama models.
- Recommended: trim repeated upstream sections or pre-summarize sibling/project docs to reduce prompt size without losing feature-boundary constraints.

## Tier-1 Output Quality Review

- Verdict: Detailed and useful, but not always tier-1 because it can blur product requirements with proposed implementation details.
- Quality gaps: sampled outputs included concrete error taxonomies and backend-like codes that may be helpful, but they should not appear as confirmed product truth unless tied to existing contracts.
- Root cause: prompt lacked the committed-direction philosophy applied to `GenerateProductSpec` (commit 5919b69) — the LLM had no guidance to distinguish confirmed requirements from its own inferences, so technical assumptions were embedded in the main spec body as fact.
- Fix applied: added committed-direction instructions to both the generation and review prompts — core feature capabilities are stated authoritatively; proposed technical approaches and non-obvious design choices go in an "Assumptions and Proposed Defaults" section only.
