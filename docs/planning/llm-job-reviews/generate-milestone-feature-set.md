# Review: GenerateMilestoneFeatureSet

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:4241` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate the feature set for a milestone from the milestone design document. Features are the shippable units that make up the milestone's delivery groups.

## Output

Feature definitions for the milestone stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateMilestoneFeatureSet'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include the milestone design document and delivery groups needed to generate coherent features?
- [ ] **Output schema alignment** — does the prompt's described feature structure match what the parser expects?
- [ ] **Output usefulness** — are the features well-scoped and specific? Do they represent work a professional software team could implement and ship? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty feature list?
- [ ] **Terminology consistency** — are feature terms consistent with `ReviewMilestoneScope`, `GenerateFeatureProductSpec`, and downstream feature jobs?
- [ ] **Prompt injection surface** — milestone design content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

- Reviewed `GenerateMilestoneFeatureSet` draft+review prompts, validator (`validateGeneratedFeatures`), and local run history (12 base + 12 review runs).
- Prompt explicitly encodes ownership boundaries from milestone design docs and parser enforces non-empty acceptance criteria/kind/priority normalization.
- Primary risk is token pressure: this is one of the largest prompts in the system (local max prompt ~184k chars).
- Recommended: include only active-milestone-relevant slices from large project specs to improve model-agnostic stability.
