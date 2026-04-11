# Review: RunProjectReview

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5315` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Perform a full repository engineering review via the OpenCode sandbox (run kind: `project_review`). The sandbox inspects the repository without editing files and produces a structured review report in both Markdown and JSON formats.

## Output

Two artifacts: `project-review.md` (Markdown review report) and `project-review.json` (machine-readable review with findings, severity ratings, verdicts, and evidence paths).

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for the `project_review` run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like for a project review (no edits, just analysis)?
- [ ] **Output artifact specification** — does the prompt explicitly name both output files (`project-review.md` and `project-review.json`) and describe the required JSON schema (executiveSummary, maturityLevel, findings array with category/severity/evidence)?
- [ ] **Scope containment** — does the prompt prevent OpenCode from editing repository files?
- [ ] **Output usefulness** — are the findings specific, evidence-based, and actionable? Do severity ratings reflect real risk? Would a professional team find the review useful? If not, what prompt changes would fix it?
- [ ] **Failure handling** — what happens when the sandbox produces an empty JSON, missing required fields, or invalid category/severity values?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

- Reviewed `RunProjectReview` flow end-to-end, including run prompt, mandatory artifacts, JSON schema validation in `qb_entrypoint.sh`, and job completion parsing.
- Local evidence: 5 jobs (4 succeeded, 1 failed). Successful runs produced `project-review.md` and `project-review.json` artifact records.
- Failure handling is explicit: missing/invalid required artifacts fail the run, and auto-advance treats review/fix jobs as retryable in bounded loops.
- Local artifact files are not currently present on disk (metadata remains), so this review used DB metadata plus code-path validation.

## Tier-1 Output Quality Review

- Verdict: Useful and detailed, but not consistently tier-1 because sampled reports use broad maturity claims with insufficient evidence density.
- Quality gaps: project reviews can say a repository is mature or production-ready while only partially grounding claims in files, line references, check outputs, and severity-calibrated findings.
- Tier-1 bar: require evidence per major claim, exact verification commands and results, severity calibration, confidence, and clear separation between observed facts and reviewer judgment.
