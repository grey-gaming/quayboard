# Review: GenerateFeatureUxSpec / GenerateFeatureTechSpec / GenerateFeatureUserDocs / GenerateFeatureArchDocs

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:4933` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate feature-level specification documents — UX spec, technical spec, user documentation, or architecture docs — for a specific feature. Each variant requires an approved feature Product Spec as input and produces a workstream revision for its respective spec type.

## Output

Feature spec markdown (UX, tech, user docs, or arch docs) stored in the database as a workstream revision.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for these job template IDs
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id` in `('GenerateFeatureUxSpec', 'GenerateFeatureTechSpec', 'GenerateFeatureUserDocs', 'GenerateFeatureArchDocs')`)
- [ ] **Prompt clarity** — are instructions for each spec variant unambiguous? Could a weaker local Ollama model still produce usable output for each variant?
- [ ] **Context completeness** — does each variant include the feature product spec, milestone design, sibling features, and the relevant project-level spec (UX, tech, etc.)?
- [ ] **Output usefulness** — does each generated spec read like something a professional team would produce? Are UX specs visual and interaction-focused, tech specs architecture and API-focused, user docs task-oriented, and arch docs structural? If any is shallow or generic, identify what prompt changes would fix it
- [ ] **Failure handling** — what happens if the LLM returns an unusable or empty spec?
- [ ] **Terminology consistency** — are terms consistent with `GenerateFeatureProductSpec` and other feature spec jobs?
- [ ] **Prompt injection surface** — feature product spec content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will each variant degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs (feature product spec + project spec + milestone context) fit within 50,000 output tokens? Flag if any variant is likely to produce longer output

## Findings

- Reviewed all four variant prompts (UX/Tech/UserDocs/ArchDocs), shared review prompt, parser behavior, and local run history (`UX 30`, `Tech 63`, `UserDocs 5`, `ArchDocs 38`).
- Draft+review flow is robust and enforces explicit failures on malformed JSON; repair templates are actively used for UX/Tech/Arch variants, indicating real-world shape drift.
- Variant intent is generally clear, but prompt size is high (local max prompts between ~72k and ~150k chars), increasing truncation and quality risk on smaller models.
- No local evidence exists for template `GenerateFeatureArchDocs` requiring dedicated output schema beyond title/markdown; if stronger structure is desired, add variant-specific schema checks.