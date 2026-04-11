# Review: AutoAnswerQuestionnaire

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:2875` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Auto-fill unanswered questionnaire fields using structured JSON generation, based on the partially completed questionnaire and any available project context.

## Output

JSON object with questionnaire field answers stored in the database.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'AutoAnswerQuestionnaire'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include all already-answered fields so the model can infer consistent answers for the rest?
- [ ] **Output schema alignment** — does the prompt's described JSON shape exactly match what the parser expects?
- [ ] **Output usefulness** — are the auto-generated answers plausible and specific, or generic placeholders? Would a professional team accept them as a starting point?
- [ ] **Failure handling** — what happens if the LLM omits required fields or returns malformed JSON?
- [ ] **Prompt injection surface** — existing questionnaire answers are user-supplied; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

- Reviewed prompt builder and parser path (`buildQuestionnaireAutoAnswerPrompt`, `AutoAnswerQuestionnaire` branch) and sampled local DB evidence (3 runs, last: 2026-04-08).
- Prompt clarity and schema alignment are strong: output is constrained to a JSON object, then filtered to blank keys and validated by `questionnaireAnswerMapSchema` before persistence.
- Prompt injection surface exists because user-provided answers are interpolated verbatim; current risk is partially mitigated by strict key filtering and schema parsing but still benefits from stronger data delimiting.
- Token budget risk appears low in local data (max prompt size ~7.1k chars, max response ~4.8k chars).
