# Review: ReviewMilestoneScope / ReviewMilestoneCoverage

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:4152` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Review a milestone's scope (is it correctly bounded?) and coverage (does it address all required user flows?). Findings feed into `ResolveMilestoneCoverageIssues`.

## Output

Review findings (issues, gaps) used to determine whether remediation jobs should run.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for these jobs' template IDs
- [ ] Pull real prompts and responses from the database (filter `llm_runs` by `template_id IN ('ReviewMilestoneScope', 'ReviewMilestoneCoverage')`)
- [ ] **Prompt clarity** — do the prompts clearly define what constitutes a scope or coverage issue?
- [ ] **Context completeness** — does each prompt include the milestone design, feature set, and the user flows it is expected to cover?
- [ ] **Multi-step generation** — do the findings feed correctly into `ResolveMilestoneCoverageIssues`? Are findings specific enough to be actionable by the resolution job?
- [ ] **Output schema alignment** — does the prompt's described issue structure match what the parser expects?
- [ ] **Output usefulness** — are the findings specific and actionable? Would a professional team find them useful for improving the milestone? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty issues list?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

_No findings yet._
