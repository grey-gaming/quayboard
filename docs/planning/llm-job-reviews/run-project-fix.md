# Review: RunProjectFix

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5369` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Fix project review findings via the OpenCode sandbox (run kind: `project_fix`). The sandbox reads the review findings and applies targeted fixes to the repository.

## Output

A `project-fix-summary.md` artifact describing what was fixed. The job also records the branch and pull request URL from the sandbox run.

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for the `project_fix` run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like (fix the batched findings, re-run verification)?
- [ ] **Output artifact specification** — does the prompt explicitly name the output file (`project-fix-summary.md`)?
- [ ] **Scope containment** — does the prompt constrain OpenCode to fixing only the batched findings, avoiding unrelated refactors or new feature work?
- [ ] **Fix/repair job scope** — is there a clear definition of "done" that prevents over-engineering? Are the findings specific enough to guide targeted fixes?
- [ ] **Output usefulness** — are the fixes narrow and targeted, or do they introduce unrelated changes? Does the summary accurately reflect what was changed?
- [ ] **Failure handling** — what happens when the sandbox cannot fix a finding, or produces changes that don't address the reported issues?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

- Reviewed `RunProjectFix` orchestration and `project_fix` prompt instructions in sandbox entrypoint.
- Local evidence: 4 successful jobs/runs; artifact metadata includes `project-fix-summary.md` for sampled runs.
- Prompt scope containment is clear (fix only batched findings), but success criteria in code are exit/publish-driven and do not validate summary artifact presence.
- Recommended: add explicit artifact validation for `project-fix-summary.md` analogous to `project_review` JSON/markdown validation.

## Tier-1 Output Quality Review

- Verdict: Useful automation path, but not tier-1 unless every fix is traceable to a project-review finding and verified.
- Quality gaps: a successful run alone is not enough; the output needs finding-to-change mapping, exact checks run, skipped checks, and evidence that the original issue was actually resolved.
- Tier-1 bar: require a fix matrix with review finding ID, changed files, verification command, result, and remaining risk.
