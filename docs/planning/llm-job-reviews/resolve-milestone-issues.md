# Review: ResolveMilestoneDeliveryIssues / ResolveMilestoneCoverageIssues

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:4609` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Resolve delivery or coverage issues identified by `ReviewMilestoneDelivery` or `ReviewMilestoneScope`/`ReviewMilestoneCoverage`. For issues flagged as `needs_human_review`, the prompt tries to reconcile them; for others, it applies targeted fixes to bring the milestone back on track.

## Output

JSON with resolution details — which defaults were chosen, what operations were applied, and which issues remain unresolved.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'ResolveMilestoneDeliveryIssues'` or `'ResolveMilestoneCoverageIssues'`)
- [ ] **Prompt clarity** — are instructions for reconciling `needs_human_review` issues unambiguous?
- [ ] **Context completeness** — does the prompt include the milestone design document, feature list, workstream statuses, and the specific issues to resolve?
- [ ] **Output schema alignment** — does the prompt's described resolution structure match what the parser expects?
- [ ] **Output usefulness** — are the resolution choices sensible and specific? Would a professional team trust the defaults chosen? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON, or marks issues as resolved that are not actually resolved?
- [ ] **Prompt injection surface** — issue hints and milestone content are user-influenced; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

- Reviewed shared resolver path for `ResolveMilestoneDeliveryIssues` and `ResolveMilestoneCoverageIssues`, including prompt builders and auto-advance consumers.
- No local `llm_runs` evidence exists for either template (run count: 0 each).
- Schema alignment issue: delivery review emits `refresh_artifacts` actions, but resolver input parsing currently filters for `rewrite_feature_set`/`needs_human_review`; this drops delivery issues and produces no-op unresolved outcomes.
- Recommended: implement a dedicated delivery-issue parser/prompt contract that accepts `refresh_artifacts` and maps directly to executable refresh operations.