# Review: GenerateProjectBlueprint

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3484` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Compile the full project blueprint document from the product spec, use cases, and resolved decision deck.

## Output

Blueprint markdown stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'GenerateProjectBlueprint'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include the product spec, use cases, and all resolved decisions?
- [ ] **Output usefulness** — does the blueprint read like a professional engineering planning document? Is it specific, structured, and actionable? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed or empty output?
- [ ] **Terminology consistency** — are terms consistent with what `GenerateMilestones` and downstream jobs expect?
- [ ] **Prompt injection surface** — product spec and decision content is user-influenced; verify it cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — a full blueprint with all context could be large; verify realistic inputs fit within 50,000 output tokens

## Findings

- Reviewed blueprint generation path including `ValidateDecisionConsistency` and repair loop, plus local evidence (6 blueprint runs, 6 consistency checks).
- Prompt/parser alignment is good for title/markdown outputs, and decision-consistency gating materially reduces downstream contradiction risk.
- One repair run exists, showing structured-output fallback is exercised in practice.
- Token budget is significant (local max prompt ~118k chars; response up to ~51k chars), so this remains sensitive for smaller local models.

## Tier-1 Output Quality Review

- Verdict: Technically rich, but below tier-1 when treated as an authoritative blueprint because it inserts architecture choices that may not be confirmed.
- Quality gaps: sampled output confidently proposed items such as offline/PWA behavior, auth providers, caching, and TTS architecture without enough proof those decisions were accepted.
- Tier-1 bar: require a decision-trace section linking every major architecture choice to accepted decisions, constraints, and alternatives rejected.
