# Review: GenerateDecisionDeck

| | |
|---|---|
| **Status** | REVIEWED |
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

- Reviewed `buildDecisionDeckPrompt`, parser/validator (`validateGeneratedDecisionDeck`), and local evidence (6 runs, last: 2026-04-08).
- Prompt and parser are aligned on required keys and nested option shapes; validation correctly rejects incomplete cards and weak alternative sets.
- Prompt clarity is high for tradeoff framing, but token budget can become heavy when full product specs are large (local max prompt ~115k chars).
- Prompt injection surface remains from user-authored product specs; wrapping source blocks with explicit data delimiters would reduce instruction hijack risk.

## Tier-1 Output Quality Review

- Verdict: Stronger than most planning outputs and often close to tier-1 quality, but it still overcommits to vendor and architecture choices without enough traceability.
- Quality gaps: recommendations such as TTS vendors, caching strategies, or platform choices can be sensible but need clearer cost, constraint, and source linkage before a team should treat them as decisions.
- Tier-1 bar: require every decision card to include source constraints, alternatives considered, defer/no-decision viability, implementation impact, and confidence.
