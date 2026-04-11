# Review: ExecuteMilestoneSession

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5555` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Execute a milestone-level sandbox session via OpenCode. This job delegates to the sandbox service to run an existing milestone session that may contain multiple feature implementation tasks, coordinating them sequentially.

## Output

Sandbox milestone session result recorded in the database, including the status of each feature task within the session.

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for milestone session runs — locate a completed sandbox milestone session in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like for a milestone session (all feature tasks implemented and verified)?
- [ ] **Output artifact specification** — does the prompt describe what evidence OpenCode should produce for each task in the session?
- [ ] **Scope containment** — does the prompt constrain OpenCode to the milestone's feature scope without inventing new features or expanding scope?
- [ ] **Output usefulness** — are the resulting implementations grounded in the assigned tasks? Does the session complete all features without introducing scope creep?
- [ ] **Failure handling** — what happens when one feature in the session fails — does it block subsequent features? How are partial sessions handled?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

- Reviewed orchestration in `sandbox-service.ts` (`runMilestoneSession`) and job dispatch in `job-runner-service.ts` (`ExecuteMilestoneSession`).
- No local milestone session executions are present (`sandbox_milestone_sessions` row count: 0), so this review is code-path only.
- Failure handling is explicit: feature tasks run sequentially, and the first failed implement run marks both task and session failed and stops the remaining queue.
- There is no dedicated milestone-session OpenCode prompt/output contract; behavior inherits implement/verify run prompts and artifacts.

## Tier-1 Output Quality Review

- Verdict: Cannot confirm tier-1 output quality from local evidence; the current review relies on orchestration behavior rather than a session-level output artifact.
- Quality gaps: the system appears to rely on per-feature implementation runs, but a tier-1 session output should include a rollup of scope, changed files, verification, failures, and remaining risks.
- Tier-1 bar: define and store a milestone-session summary artifact that ties each feature run to acceptance evidence and unresolved work.
