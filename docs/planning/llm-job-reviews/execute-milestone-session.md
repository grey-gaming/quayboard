# Review: ExecuteMilestoneSession

| | |
|---|---|
| **Status** | NOT REVIEWED |
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

_No findings yet._