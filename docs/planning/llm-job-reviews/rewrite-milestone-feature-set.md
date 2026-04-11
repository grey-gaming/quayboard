# Review: RewriteMilestoneFeatureSet

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Direct LLM (Ollama / OpenAI) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:4372` |
| **Prompt builder** | `apps/api/src/services/jobs/job-prompts.ts` |

## Purpose

Rewrite the milestone's feature set to address issues identified by `ReviewMilestoneScope` or `ReviewMilestoneCoverage`. Uses a draft + review generation pattern.

## Output

Updated feature definitions for the milestone stored in the database, replacing the previous set.

## Checklist

- [ ] Read the prompt builder in `apps/api/src/services/jobs/job-prompts.ts` for this job's template ID
- [ ] Pull a real prompt and response from the database (filter `llm_runs` by `template_id = 'RewriteMilestoneFeatureSet'`)
- [ ] **Prompt clarity** — are instructions unambiguous? Could a weaker local Ollama model still produce usable output?
- [ ] **Context completeness** — does the prompt include the original feature set, milestone design, issues from the review, and the approved overview?
- [ ] **Multi-step generation** — does the review prompt catch the failure modes the draft prompt is prone to?
- [ ] **Regeneration stability** — does the prompt produce a consistent, improved feature set rather than introducing new problems?
- [ ] **Output schema alignment** — does the prompt's described feature structure match what the parser expects?
- [ ] **Output usefulness** — is the rewritten feature set a genuine improvement? Does it resolve the review findings without introducing new structural issues? If not, what prompt changes would fix it?
- [ ] **Failure handling** — what happens if the LLM returns malformed JSON or an empty feature list?
- [ ] **Terminology consistency** — are feature terms consistent with `ReviewMilestoneScope`, `GenerateFeatureProductSpec`, and downstream feature jobs?
- [ ] **Prompt injection surface** — milestone design content and review issues are user-influenced; verify they cannot hijack the instruction structure
- [ ] **Model-agnostic language** — will this degrade gracefully on smaller Ollama models?
- [ ] **Token budget** — do realistic inputs fit within 50,000 output tokens?

## Findings

- Reviewed rewrite+review prompt pair and parser for `RewriteMilestoneFeatureSet`, with local evidence (5 base runs, 5 review runs).
- Prompt includes strong ownership/exit-criteria constraints and explicit issue-driven rewrite framing, then validates through feature-shape parser before persistence.
- Major risk is prompt size/context bloat (local max ~187k chars), especially on smaller Ollama models.
- No local repair runs were observed for this template, but broader-context truncation risk remains for larger projects.

## Tier-1 Output Quality Review

- Verdict: Useful and generally professional, but not fully tier-1 because it does not consistently prove that each prior issue was resolved.
- Quality gaps: sampled rewritten feature sets were security-aware and coherent, but the output lacked an explicit issue-to-feature/acceptance-criterion mapping.
- Tier-1 bar: add a resolution matrix showing each input issue, the rewritten artifact change, and whether any concern remains deferred.
