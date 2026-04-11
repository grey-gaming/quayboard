# Review: GenerateDecisionDeck

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3403` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Generate a decision deck with architectural and product choices for the project blueprint. Each decision presents options with trade-offs for the team to select from.

## Output

Decision deck with options/choices stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateDecisionDeck'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include sufficient product spec and use case context to generate meaningful decisions?
- [ ] **Output schema alignment** — does the prompt's described decision structure match what the parser expects?
- [ ] **Output usefulness** — are the decisions meaningful and non-trivial? Do the options and trade-offs reflect real engineering choices a professional team would face? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or empty decisions?
- [ ] **Terminology consistency** — are terms consistent with downstream blueprint generation?
- [ ] **Prompt injection surface** — product spec and use case content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._
