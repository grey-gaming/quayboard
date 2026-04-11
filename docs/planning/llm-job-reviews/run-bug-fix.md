# Review: RunBugFix

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5401` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Fix a specific bug via the OpenCode sandbox (run kind: `bug_fix`). The sandbox reads the bug report, applies a targeted fix, and produces a mergeable pull request.

## Output

A `bug-fix-summary.md` artifact describing the fix. The job also creates a pull request and merges it on success.

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for the `bug_fix` run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like (fix the reported defect, re-run verification)?
- [ ] **Output artifact specification** — does the prompt explicitly name the output file (`bug-fix-summary.md`)?
- [ ] **Scope containment** — does the prompt constrain OpenCode to fixing only the reported defect?
- [ ] **Fix/repair job scope** — is there a clear definition of "done" that prevents over-engineering? Does the bug report provide enough context for a targeted fix?
- [ ] **Output usefulness** — is the fix narrow and correct? Does the summary accurately describe the change? Would a professional engineer produce the same fix?
- [ ] **Failure handling** — what happens when the sandbox cannot fix the bug, or the resulting PR cannot be merged?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

- Reviewed bug-fix sandbox flow across `qb_entrypoint.sh`, `sandbox-service.ts`, and `RunBugFix` job handling.
- Local evidence: 21 jobs (12 succeeded, 7 failed, 2 cancelled); failures include non-zero exits/timeouts (e.g., exit code 124).
- Done criteria are strong in code: success requires a mergeable PR path (`changes_applied` + branch + merge).
- Prompt requests `bug-fix-summary.md`, but runner does not hard-fail when the summary artifact is missing; consider enforcing this output contract in code.

## Tier-1 Output Quality Review

- Verdict: Not enough local output evidence to call it tier-1; observed behavior needs a stronger completion contract.
- Quality gaps: bug-fix runs should consistently report root cause, changed files, tests run, non-regression evidence, and any behavior that remains unverified.
- Tier-1 bar: require a structured bug-fix artifact that maps bug symptoms to root cause, patch summary, verification, and residual risk.
