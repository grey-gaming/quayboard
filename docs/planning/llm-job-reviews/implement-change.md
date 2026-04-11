# Review: ImplementChange / TestAndVerify

| | |
|---|---|
| **Status** | REVIEWED |
| **Type** | Sandbox (OpenCode) |
| **Code location** | `apps/api/src/services/jobs/job-runner-service.ts:5459` |
| **Entrypoint** | `docker/agent-sandbox/qb_entrypoint.sh` |

## Purpose

Execute a feature implementation (`ImplementChange`, run kind: `implement`) or verification run (`TestAndVerify`, run kind: `verify`) via the OpenCode sandbox. Both share the same job handler and delegate to the sandbox service with an existing `sandboxRunId`.

The `implement` run kind instructs OpenCode to follow the assigned implementation tasks, make code changes in the repository, and run verification. The `verify` run kind instructs OpenCode to verify an existing implementation without building new features.

## Output

Sandbox run outcome recorded in the database (changes applied, no-op, verification passed/failed, etc.).

## Checklist

- [ ] Read the entrypoint at `docker/agent-sandbox/qb_entrypoint.sh` to understand how the prompt and context files are passed to OpenCode
- [ ] Read the prompt and context files for `implement` and `verify` run kinds — locate a completed sandbox run in artifact storage and inspect the files that were mounted into the container
- [ ] **Acceptance criteria** — does the prompt clearly state what "done" looks like for each mode? For `implement`, is it clear that OpenCode should follow the assigned tasks? For `verify`, is it clear that OpenCode should only verify and fix narrow issues?
- [ ] **Output artifact specification** — does the prompt describe what evidence OpenCode should leave under the artifact directory?
- [ ] **Scope containment** — for `implement`, does the prompt constrain OpenCode to the assigned tasks without inventing new features? For `verify`, does the prompt prevent expanding product scope?
- [ ] **Output usefulness** — for `implement`, are the resulting changes grounded in the assigned tasks? For `verify`, are fixes narrow and tied to the requested implementation?
- [ ] **Failure handling** — what happens when the sandbox cannot implement the feature, or verification fails?
- [ ] **Model-agnostic language** — does the prompt degrade gracefully on smaller Ollama models?
- [ ] **Notes** — record any findings, edge cases, or suggested improvements in this review file

## Findings

- Reviewed implement orchestration across `job-runner-service.ts`, `sandbox-service.ts`, and sandbox entrypoint prompt modes.
- Local evidence: 79 `ImplementChange` jobs (55 succeeded, 21 failed, 3 cancelled), with automatic chaining into `verify` sandbox runs.
- Common failure mode is runtime stall/timeout (`implement run did not exit within 40 minutes`), which is explicitly detected and surfaced.
- Scope containment is prompt-driven and generally clear, but there is no changed-file allowlist at runtime, so broad edits remain technically possible.

## Tier-1 Output Quality Review

- Verdict: Cannot judge generated code quality from a single prompt review; observed run behavior shows the process needs stronger implementation evidence to meet a tier-1 bar.
- Quality gaps: scope containment is mostly prompt-driven, and completed runs need consistent changed-file summaries, tests run, failure handling, and residual-risk reporting.
- Tier-1 bar: require the implementation agent to produce a structured completion artifact with diff summary, verification evidence, skipped checks, and follow-up risks.
