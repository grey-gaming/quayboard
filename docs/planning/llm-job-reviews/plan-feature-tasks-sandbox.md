# Review: PlanFeatureTasksSandbox

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5225` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Plan implementation tasks for a feature via the OpenCode sandbox. The sandbox reads feature context and planning documents, inspects the repository, and produces an ordered, implementation-ready task list as a JSON artifact.

## Output

A `task-plan.json` artifact containing an array of tasks, each with `title`, `description`, optional `instructions`, and `acceptanceCriteria`.

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for the `task_planning` run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like so OpenCode knows when to stop?
- [ ] **Output artifact specification** — does the prompt explicitly name the output file (`task-plan.json`) and describe its required schema?
- [ ] **Scope containment** — does the prompt constrain OpenCode to the feature's scope without inventing new features or technology changes?
- [ ] **Output usefulness** — are the generated tasks implementable units that a professional team could pick up? Are they grounded in what the repo actually contains rather than assumptions? If not, what prompt changes would fix it?
- [ ] **Failure handling** — what happens when the sandbox produces an empty task list or invalid JSON?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

_No findings yet._