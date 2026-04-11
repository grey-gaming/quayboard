# Review: AppendMilestones

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:3665` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Append additional milestones to the existing milestone map, typically to cover use cases not addressed by the current plan.

## Output

Additional milestone definitions stored in the database alongside the existing ones.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'AppendMilestones'`)
- [ ] **Prompt clarity** — does the prompt clearly distinguish between existing milestones (do not repeat) and the gap it needs to fill?
- [ ] **Context completeness** — does the prompt include the existing milestone map so the model avoids duplicating what already exists?
- [ ] **Output schema alignment** — does the prompt's described milestone structure match what the parser expects?
- [ ] **Output usefulness** — are the appended milestones coherent with the existing plan? Do they genuinely fill gaps rather than repeat or contradict existing milestones? If not, what is missing and what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty list?
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — existing milestones plus uncovered use cases could be large; verify realistic inputs fit within 50,000 output tokens

## Findings

- Reviewed `buildAppendMilestonePlanPrompt` in `apps/api/src/services/jobs/job-prompts.ts` and `AppendMilestones` execution/parsing in `apps/api/src/services/jobs/job-runner-service.ts` on 2026-04-11.
- No local `llm_runs` rows exist for template `AppendMilestones` (run count: 0), so output quality and regeneration stability could not be validated on real data in this environment.
- Prompt/schema alignment is consistent with `validateGeneratedMilestones`, but this path still needs at least one integration run to confirm duplicate-avoidance behavior against existing milestone maps.
- Recommended: add a targeted integration test that seeds uncovered flows plus existing milestones and asserts appended milestones are non-overlapping and only reference uncovered flow IDs.

## Tier-1 Output Quality Review

- Verdict: Not enough local evidence to say the generated output is tier-1 quality; no representative AppendMilestones run was found in the sampled job history.
- Quality gaps: the current review can only evaluate the prompt shape, not whether the output preserves milestone sequencing, avoids duplicates, and explains why each appended milestone belongs in the roadmap.
- Tier-1 bar: require an output fixture or recent run sample with a before/after milestone map, explicit coverage gaps, and a rationale for every appended milestone.
