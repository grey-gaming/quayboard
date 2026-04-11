# Review: GenerateMilestoneDesign

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3880` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate the design document for a specific milestone, including its delivery groups and user flows. This drives the subsequent feature set generation.

## Output

Milestone design document with delivery groups and flows stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateMilestoneDesign'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include the milestone definition, product spec, and relevant user flows needed to design the milestone?
- [ ] **Output schema alignment** — does the prompt's described delivery group/flow structure match what the parser expects?
- [ ] **Output usefulness** — does the design reflect how a professional software team would break down a delivery milestone? Are delivery groups logical and flows correctly scoped? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON?
- [ ] **Terminology consistency** — are delivery group and flow terms consistent with `GenerateMilestoneFeatureSet` and downstream jobs?
- [ ] **Prompt injection surface** — product spec and milestone content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._
