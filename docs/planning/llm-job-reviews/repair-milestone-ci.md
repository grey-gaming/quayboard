# Review: RepairMilestoneCi

| | |
|---|---|
| **Status** | NOT REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5532` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Repair CI failures via the OpenCode sandbox (run kind: `ci_repair`). The sandbox reads the CI failure description, fixes the failing checks, and re-runs verification before exiting.

## Output

Sandbox run outcome recorded in the database. The CI repair run targets the milestone's repository branch.

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for the `ci_repair` run kind — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like (repair the CI conditions, re-run the failing checks)?
- [ ] **Output artifact specification** — does the prompt describe what evidence OpenCode should leave under the artifact directory?
- [ ] **Scope containment** — does the prompt constrain OpenCode to the failing CI conditions without unrelated refactors or new feature work?
- [ ] **Fix/repair job scope** — is there a clear definition of "done" that prevents over-engineering? Are CI failure descriptions specific enough to guide targeted repairs?
- [ ] **Output usefulness** — are the CI fixes narrow and targeted, or do they introduce unrelated changes?
- [ ] **Failure handling** — what happens when the sandbox cannot fix the CI failure, or fixes introduce new failures?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

_No findings yet._