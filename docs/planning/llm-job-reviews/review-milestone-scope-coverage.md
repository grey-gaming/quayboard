# Review: ReviewMilestoneScope / ReviewMilestoneCoverage

| | |
|---|---|
| **Status** | REVIEWED |
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

- Reviewed shared scope/coverage review flow and parser behavior, with local evidence for `ReviewMilestoneScope` only (21 runs; `ReviewMilestoneCoverage` runs: 0).
- Prompt contract and parser align on `{ complete, issues[] }` with actionable `action` + `hint` pairs used by downstream repair jobs.
- Coverage and scope currently share the same prompt text and data payload, which limits role-specific diagnostics.
- Recommended: add a mode flag or split prompt templates so scope-boundary and coverage-completeness failures can be distinguished more consistently.

## Tier-1 Output Quality Review

- Verdict: Not tier-1 based on sampled output; the placeholder milestoneId plus bare completion result is a serious quality failure.
- Quality gaps: placeholder identifiers and no evidence trail make the review unsafe because downstream automation can treat a low-information answer as validation.
- Tier-1 bar: reject placeholder IDs, require source artifact references, and demand coverage evidence plus issue rationale before marking scope complete.
