# Review: TestAndVerify

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5459` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Verify an existing implementation via the OpenCode sandbox (run kind: `verify`). OpenCode runs the project's tests and type checks, keeping any fixes narrow and tied to the requested implementation, rather than building new features.

## Output

Sandbox run outcome recorded in the database (verification passed/failed, etc.).

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for the `verify` run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like for a verification run (run tests, fix narrow issues, confirm implementation)?
- [ ] **Output artifact specification** — does the prompt describe what evidence OpenCode should leave under the artifact directory?
- [ ] **Scope containment** — does the prompt constrain OpenCode to verifying the implementation rather than expanding product scope or starting broader cleanup?
- [ ] **Output usefulness** — are verification fixes narrow and correct? Does OpenCode stay within the touched area?
- [ ] **Failure handling** — what happens when verification fails even after OpenCode's fix attempts?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

_No findings yet._