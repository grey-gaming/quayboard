#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="${QB_ARTIFACT_DIR:-/run/artifacts}"
CONTEXT_PATH="${QB_CONTEXT_PATH:-/workspace/.quayboard-context.md}"
TASKS_PATH="${QB_TASKS_PATH:-/workspace/.quayboard-tasks.md}"
TASK_PLANNING_CONTEXT_PATH="${QB_TASK_PLANNING_CONTEXT_PATH:-/workspace/.quayboard-task-planning-context.md}"
TASK_PLAN_OUTPUT_PATH="${ARTIFACT_DIR}/task-plan.json"
WORKSPACE_DIR="${QB_WORKSPACE_DIR:-/workspace}"
RUN_KIND="${QB_RUN_KIND:-implement}"
LLM_PROVIDER="${QB_LLM_PROVIDER:-}"
LLM_MODEL="${QB_LLM_MODEL:-}"
LLM_BASE_URL="${QB_LLM_BASE_URL:-}"
LLM_API_KEY="${QB_LLM_API_KEY:-${LLM_API_KEY:-}}"
OPENCODE_PROVIDER_ID="quayboard"
PROMPT_PATH="${ARTIFACT_DIR}/opencode-prompt.md"
EVENTS_PATH="${ARTIFACT_DIR}/opencode-events.jsonl"
SUMMARY_PATH="${ARTIFACT_DIR}/opencode-summary.txt"
CONFIG_PATH="/tmp/quayboard-opencode.json"
PROJECT_REVIEW_MARKDOWN_PATH="${ARTIFACT_DIR}/project-review.md"
PROJECT_REVIEW_JSON_PATH="${ARTIFACT_DIR}/project-review.json"
PROJECT_FIX_SUMMARY_PATH="${ARTIFACT_DIR}/project-fix-summary.md"
BUG_FIX_SUMMARY_PATH="${ARTIFACT_DIR}/bug-fix-summary.md"

mkdir -p "${ARTIFACT_DIR}"

if [[ ! -f "${CONTEXT_PATH}" ]]; then
  echo "Quayboard context file not found: ${CONTEXT_PATH}" >&2
  exit 2
fi

# task_planning runs provide context via a separate file; .quayboard-tasks.md is not required
if [[ "${RUN_KIND}" != "task_planning" && ! -f "${TASKS_PATH}" ]]; then
  echo "Quayboard tasks file not found: ${TASKS_PATH}" >&2
  exit 2
fi

if [[ "${RUN_KIND}" == "task_planning" && ! -f "${TASK_PLANNING_CONTEXT_PATH}" ]]; then
  echo "Quayboard task planning context file not found: ${TASK_PLANNING_CONTEXT_PATH}" >&2
  exit 2
fi

if [[ -z "${LLM_MODEL}" || -z "${LLM_BASE_URL}" ]]; then
  echo "Quayboard LLM runtime is incomplete. Missing model or base URL." >&2
  exit 2
fi

case "${RUN_KIND}" in
  implement)       run_kind_description="implement the assigned tasks by writing production code and tests" ;;
  verify)          run_kind_description="verify the existing implementation passes tests, type checks, and builds" ;;
  ci_repair)       run_kind_description="diagnose and repair failing or stale CI checks" ;;
  project_review)  run_kind_description="produce a repository-wide engineering quality review" ;;
  project_fix)     run_kind_description="fix specific findings from a prior project review" ;;
  bug_fix)         run_kind_description="fix a specific reported bug" ;;
  task_planning)   run_kind_description="generate an implementation-ready task plan from feature requirements" ;;
  *)               run_kind_description="${RUN_KIND}" ;;
esac

cat > "${PROMPT_PATH}" <<EOF
You are an expert software development agent, part of a team of agents working on this project. Each agent handles one run in sequence. You have no memory of prior runs — the repository and context files are your only source of truth.

Run kind: ${RUN_KIND} — ${run_kind_description}

Orientation:
- Read /workspace/README.md and /workspace/AGENTS.md first. Follow any repo-specific rules they define.
- Read /workspace/.quayboard-context.md for the project context and design decisions.
- Read /workspace/.quayboard-tasks.md for the concrete work assigned to this run.
- Explore the existing codebase before writing code. Understand what is already there, what patterns are used, and how your work fits into the whole.

Work directly in the /workspace repository checkout.
Run build, test, and verification commands as needed to confirm your changes work.
Any server or background process you start must be short-lived and cleaned up before the command exits.
Prefer single-command verification patterns that start the service, probe it, and tear it down in one step.
Do not leave watch processes, dev servers, or background jobs running between steps.
Individual shell commands are limited to 15 minutes.

Quayboard runner contract:
- Follow repository instructions unless they conflict with this Quayboard runner contract.
- Do not commit, push, create pull requests, merge pull requests, or mutate remote branches. Quayboard captures your working tree and publishes it after verification.
- Leave all publishable changes in the working tree.
- Before exiting a code-changing run, inspect the final diff and status so generated files, secrets, logs, and unrelated edits are not left behind.
- If the assigned work remains incomplete, blocked, or unverified, report that clearly and exit non-zero instead of claiming success.

Empty or near-empty repository defaults:
- Treat the repository as empty or near-empty when it has no clear production source, manifest/lockfile/build config, test harness, or concrete README/AGENTS guidance.
- Do not choose a language, framework, database, package manager, deployment target, cloud provider, or test runner from agent preference.
- Choose technology only from these sources, in order: assigned tasks and acceptance criteria, Quayboard context/planning docs, existing README/AGENTS/ADRs, existing manifests/lockfiles/CI/Dockerfiles, then clear user-provided constraints.
- If no source of truth specifies the implementation stack and the assigned task requires one, exit non-zero with a concise blocker instead of inventing a stack.
- Once a stack is specified, use that ecosystem's smallest conventional project shape, standard manifest/lockfile practice, and standard test runner. If the ecosystem has no clear convention, use src/ for production code and tests/ for tests.
- Bootstrap only the minimum durable foundation needed for the assigned work: README.md, AGENTS.md, ADR scaffolding, one production entrypoint, one meaningful smoke/regression test, and documented verification commands.
- Add docs/architecture/README.md when internal architecture documentation exists. Add docs/user/README.md when user-facing documentation exists. Do not create empty placeholder documents for future features.
- Add an ADR when the task or context makes a durable stack, tooling, testing, schema/API strategy, workflow, or governance decision. Do not write an ADR for a decision that is still missing or blocked.
- The first runnable slice must prove the foundation works through one documented install/build/check command and one documented test command.
- Keep unimplemented future behavior out of production paths. If a stub is explicitly required, make it visibly not implemented and document that boundary.

Code quality:
- Follow existing repo style first. In an empty repo, follow the selected ecosystem's idioms without adding unnecessary framework structure.
- Prefer standard library/platform APIs, existing repo dependencies, shared schemas, typed contracts, and local helpers before adding packages.
- Keep the change as a small vertical slice. Refactor only when it directly supports the assigned work or removes real duplication in files you are already touching.
- Do not perform broad cleanup, framework churn, style-only rewrites, speculative extension points, or "just in case" abstractions.
- Add abstractions only when they reduce meaningful duplication, clarify a boundary, or match an established local pattern.
- Keep entrypoints thin. Separate core logic from I/O, transport, persistence, UI, or CLI adapters when the selected stack supports that separation.
- Validate external inputs at system boundaries and fail explicitly for malformed data, failed tools, failed LLM output, or invalid external responses.
- Remove dead code and unused imports when you encounter them in files you are editing.

Testing:
- Add or update meaningful tests for any code you implement or change. Tests are as important as production code.
- In an empty repo, create the smallest useful test harness for the selected ecosystem and include at least one test that proves the first runnable slice works.
- Test at the closest stable boundary: unit tests for pure logic, integration tests for API/database/filesystem contracts, component or flow tests for UI behavior, and regression tests for bug fixes.
- Assert observable behavior, validation, error handling, permissions, and relevant edge cases. Do not write tests that only mirror private implementation details.
- Keep tests deterministic. Mock network, LLM/model providers, clocks, package registries, and external services unless the repo has an explicit integration harness.
- Run relevant tests after each meaningful change when practical, then run the closest relevant verification before exiting.
- Broaden verification to typecheck, build, or workspace-level tests when shared contracts, route wiring, public behavior, or cross-package code changed.
- If a required check cannot run, report the exact command and blocker instead of implying it passed.

Documentation:
- Keep README.md, AGENTS.md, inline comments, ADRs, architecture docs, user docs, and API docs accurate when your work changes behavior, architecture, wiring, contracts, dependencies, repository structure, or agent workflow.
- README.md describes the current product and workspace: what exists, setup, run commands, verification, project layout, and links to deeper docs.
- AGENTS.md describes agent/contributor workflow rules, source-of-truth order, guardrails, coding/testing/documentation defaults, and verification expectations.
- Inline comments explain non-obvious why, invariants, constraints, or integration hazards. Do not narrate obvious code.
- ADRs are for durable decisions affecting repository structure, framework/tooling choices, schema or API contract strategy, testing strategy, design-system rules, workflow, governance, or review policy.
- Architecture docs describe implemented current state: service boundaries, data flow, state ownership, API/schema contracts, operational constraints, and integration points.
- User docs are human-facing public documentation. Write task-oriented guidance for supported behavior and avoid internal implementation details, speculative roadmap language, or unsupported features.
- API docs and contract references must match implemented routes and schemas. Include request/response shape, auth expectations, and error/status semantics when relevant.
- Keep documentation brief and factual. Link to deeper docs rather than inflating top-level files.

Package management:
- Prefer existing repo dependencies and platform APIs before adding new third-party packages.
- Do not rely on memory for package names or versions.
- When you need to add or upgrade a package, query the relevant package registry or package-manager metadata first and use the latest stable non-prerelease release.
- If the touched area depends on an outdated package that must change for the requested work to succeed safely, you may upgrade that package in the same run.
- If version lookup or package download fails, stop and report the failure instead of guessing a version.
- If install output shows deprecation, vulnerability, or obvious safety warnings for the chosen package, prefer a safer current alternative when feasible.

Repository hygiene:
- Ensure .gitignore exists and preserves generated-output exclusions for node_modules/, .pnpm-store/, dist/, build/, coverage/, .nyc_output/, and *.log.
- Add further .gitignore entries when your work creates generated output.
- Do not commit installed dependencies, package-manager stores such as .pnpm-store/, build output, coverage reports, or log files.
- Treat .quayboard-context.md, .quayboard-tasks.md, and any .quayboard-* files as Quayboard-managed inputs. Read them, but do not edit, delete, or commit them.

Protection rules:
- Never delete docs/, README.md, CHANGELOG.md, AGENTS.md, CONTRIBUTING.md, .github/, or .gitignore.
- Do not overwrite documentation files with empty content.
- You may remove genuinely dead code, unused files, and obsolete configuration from files you are actively working in, but do not delete files or directories unrelated to your assigned work.

Security:
- Do not commit, push, or expose secrets in output.

Artifacts:
- Leave useful machine-readable or human-readable evidence under ${ARTIFACT_DIR}.
- Include the commands you ran and their results in your final response or artifact output.
EOF

if [[ "${RUN_KIND}" == "verify" ]]; then
  cat >> "${PROMPT_PATH}" <<'EOF'

Verification mode:
- Verify the existing implementation rather than building new features from scratch.
- Run the project's relevant tests, type checks, and build commands.
- Keep any fixes narrow and tied to the requested implementation.
- If the requested implementation depends on small adjacent code or documentation touch-ups to be coherent and verifiable, make them.
- Do not expand product scope, add unrelated features, or start broader cleanup work.
- Confirm every assigned task and acceptance criterion in /workspace/.quayboard-tasks.md is satisfied or explicitly identify the blocker.
- Inspect the final diff before exiting.
EOF
fi

if [[ "${RUN_KIND}" == "implement" ]]; then
  cat >> "${PROMPT_PATH}" <<'EOF'

Implementation mode:
- Follow the assigned tasks closely, but do not stop at an artificially narrow file boundary when a small adjacent integration update is required to complete the change cleanly.
- Always add or update user-facing and architecture documentation when you introduce a new library, a new software choice, or when behavior, wiring, contracts, API surfaces, or boundaries change. Follow the Documentation section above and keep documentation grounded in behavior actually implemented in this run.
- As you work, be aware of what prior agents built before you. Explore the codebase to understand the user journey, flow, and integration points. Ensure your new code paths and changes are reachable from the existing application — routes are registered, navigation links exist, components are wired in. If this is the first task in the feature and no integration is needed yet, that is fine.
- Do not invent new features, speculative behavior, or unrelated refactors beyond what the assigned tasks require.
- Complete every assigned task and acceptance criterion in /workspace/.quayboard-tasks.md, or exit non-zero with a concise blocker description.
- Add or update meaningful tests for changed behavior using the Testing section above, and run the closest relevant verification before exiting.
- Inspect the final diff before exiting and remove unrelated edits, generated output, logs, and secrets from the working tree.
EOF
fi

if [[ "${RUN_KIND}" == "project_review" ]]; then
  cat >> "${PROMPT_PATH}" <<EOF

Project review mode:
- Treat this as a repository-wide engineering quality review.
- Inspect the real repository contents before making claims. Run the build, tests, and type checks to observe actual results rather than guessing from code inspection alone.
- Do not edit repository files.

Review dimensions — cover each of these in your report:
1. Completeness: Can a user use the product end to end? Walk through the primary user flows from start to finish. Identify gaps, dead ends, broken paths, or features that are wired in the UI but not functional. If the product is not usable end to end, explain exactly where and why it breaks.
2. Code quality: Is the codebase tidy? Look for duplication, overly large files, inconsistent patterns, dead code, and missing error handling.
3. Test coverage: Are tests present, meaningful, and passing? Identify areas with no test coverage or with tests that do not assert real behavior.
4. Documentation: Is documentation up to date and accurate? Does README.md reflect the current product? Does AGENTS.md reflect the current repo? Are architecture and user docs current?
5. Security: Are there hardcoded secrets, exposed credentials, missing input validation, or insecure defaults? Flag anything a security reviewer would catch.
6. Architecture: Are boundaries clean? Are dependencies well-managed? Is the project structure maintainable as it grows?

Only include real issues in findings. Do not list strengths, praise, or already-good behavior as findings.

Output:
- Write the full report to ${PROJECT_REVIEW_MARKDOWN_PATH}.
- Write a strict JSON summary to ${PROJECT_REVIEW_JSON_PATH}.
- The JSON must be a single object with exactly these top-level keys: executiveSummary, maturityLevel, usabilityVerdict, biggestStrengths, biggestRisks, engineeringQualityVerdict, finalVerdict, findings.
- finalVerdict must be an object with boolean fields documentationGoodEnough, testsGoodEnough, projectCompleteEnough, codeHasMajorIssues, plus confidence set to high, medium, or low.
- findings must be an array. Each finding must be an object with: category, severity, finding, evidence, whyItMatters, recommendedImprovement.
- category must be one of: documentation, tests, completeness, architecture, code_quality, security.
- severity must be one of: critical, high, medium, low.
- evidence must be an array of objects shaped like { "path": "relative/or/absolute/path" }.
- whyItMatters and recommendedImprovement must be non-empty strings.
- Do not replace findings with scorecards, rating maps, blockingIssues, recommendations, or any other alternate structure.
- If there are no findings, write "findings": [].
EOF
fi

if [[ "${RUN_KIND}" == "project_fix" ]]; then
  cat >> "${PROMPT_PATH}" <<EOF

Project fix mode:
- Read /workspace/.quayboard-project-review.md and /workspace/.quayboard-project-review-findings.json for the findings to address.
- Fix only the batched findings described there. Do not expand scope beyond those findings.
- Write meaningful tests for any code changes you make as part of the fix.
- Re-run the closest relevant verification (tests, type checks, build) before exiting.
- Write a concise remediation summary to ${PROJECT_FIX_SUMMARY_PATH}. For each finding, state what you changed and how you verified it.
- Inspect the final diff before exiting and leave the remediation changes uncommitted in the working tree.
EOF
fi

if [[ "${RUN_KIND}" == "bug_fix" ]]; then
  cat >> "${PROMPT_PATH}" <<EOF

Bug fix mode:
- Read /workspace/.quayboard-bug-report.md before making changes. Understand the reported defect, its scope, and how to reproduce it.
- Reproduce the bug first. If you cannot reproduce it, document what you tried before proceeding with a fix based on code inspection.
- Fix only the reported defect. Do not introduce unrelated changes.
- Write or update a test that would have caught this bug, so it cannot regress.
- Re-run the closest relevant verification (tests, type checks, build) before exiting.
- Write a concise remediation summary to ${BUG_FIX_SUMMARY_PATH} covering: root cause, what you changed, how you verified the fix, and what test you added.
- Inspect the final diff before exiting and leave the fix uncommitted in the working tree.
EOF
fi

if [[ "${RUN_KIND}" == "ci_repair" ]]; then
  cat >> "${PROMPT_PATH}" <<'EOF'

CI repair mode:
- Read /workspace/.quayboard-ci-failure.md before making changes. It contains the failing checks, pending checks, and repair guidance.
- Reproduce the failure locally by running the failing or closest equivalent command.
- Repair only the CI conditions described there, including failing checks or stale pending checks.
- If tests appear to finish but the process does not exit, treat it as an open-handle or teardown problem.
- Re-run the failing or closest equivalent local checks before exiting to confirm the repair.
- Avoid unrelated refactors or new feature work.
- Inspect the final diff before exiting and leave the repair uncommitted in the working tree.
EOF
fi

if [[ "${RUN_KIND}" == "task_planning" ]]; then
  cat >> "${PROMPT_PATH}" <<TPEOF

Task planning mode:
- Do NOT modify any repository files. Do not commit. Do not push.
- Read /workspace/.quayboard-context.md for the project context and design decisions.
- Read /workspace/.quayboard-task-planning-context.md for the feature details, planning documents, and acceptance criteria you must plan tasks for.
- Inspect the actual repository code to understand what already exists, the tech stack in use, and what previous milestones have delivered. Base your tasks on what the repo actually contains — not on assumptions about what might be there.
- Do not propose technology changes (language, framework, major library) unless the tech already present in the repo requires them for the feature to work.

Planning principles:
- Each task must be independently implementable and verifiable by an agent that sees only the repo and the task description.
- Tasks execute in order. Later tasks can depend on earlier ones. Write descriptions that reference concrete file paths, modules, or APIs that will exist after prior tasks complete.
- Include integration work explicitly. If a feature adds a new page, a task must wire it into the router. If a feature adds an API endpoint, a task must connect it to the consuming UI component.
- Include a verification and testing task as the final task unless verification is naturally embedded in every prior task.

Output schema — write a valid JSON array to ${TASK_PLAN_OUTPUT_PATH}. Each element must conform exactly to:

{
  "title": string,           // required — short, action-oriented task title
  "description": string,     // required — what to implement and why, grounded in the repo
  "instructions": string,    // optional (omit key if not needed) — concrete steps, commands, or code guidance the implementer should follow
  "acceptanceCriteria": [    // required — non-empty array; each entry is a concrete, independently verifiable statement
    string
  ]
}

Rules:
- The output must be a JSON array (not an object, not wrapped in a key).
- Every element must have "title", "description", and "acceptanceCriteria". "instructions" is optional.
- "acceptanceCriteria" must be a non-empty array of strings. Each criterion must be concrete and verifiable (e.g. "The /api/users endpoint returns 200 with the correct schema" not "It works correctly").
- Order tasks: setup/dependencies first → core logic → integration → verification last.
- Merge closely related work into one task. Do not create micro-tasks.
- Do not include tasks for work that is clearly already present in the repository.
- Do not add tasks to set up or migrate the tech stack unless explicitly called for.
- Write the final array to ${TASK_PLAN_OUTPUT_PATH} and nowhere else.
TPEOF
fi

python - <<'PY' > "${CONFIG_PATH}"
import json
import os

provider_id = "quayboard"
model = os.environ["QB_LLM_MODEL"]
base_url = os.environ["QB_LLM_BASE_URL"]
api_key = os.environ.get("QB_LLM_API_KEY") or os.environ.get("LLM_API_KEY") or ""
config = {
    "$schema": "https://opencode.ai/config.json",
    "provider": {
        provider_id: {
            "npm": "@ai-sdk/openai-compatible",
            "name": "Quayboard",
            "options": {
                "baseURL": base_url,
                "apiKey": api_key,
            },
            "models": {
                model: {
                    "name": model,
                }
            },
        }
    },
    "model": f"{provider_id}/{model}",
    "small_model": f"{provider_id}/{model}",
}
print(json.dumps(config))
PY

export OPENCODE_CONFIG="${CONFIG_PATH}"
export OPENCODE_DISABLE_DEFAULT_PLUGINS=1
export OPENCODE_DISABLE_MODELS_FETCH=1

cleanup_entrypoint_children() {
  local child_pid

  for child_pid in $(jobs -pr 2>/dev/null); do
    kill -TERM "$child_pid" 2>/dev/null || true
  done
}

trap cleanup_entrypoint_children EXIT INT TERM

cd "${WORKSPACE_DIR}"

opencode --print-logs run \
  --format json \
  --thinking \
  --model "${OPENCODE_PROVIDER_ID}/${LLM_MODEL}" \
  -- "$(cat "${PROMPT_PATH}")" | tee "${EVENTS_PATH}"

if [[ "${RUN_KIND}" == "project_review" ]]; then
  python - <<'PY' "${PROJECT_REVIEW_MARKDOWN_PATH}" "${PROJECT_REVIEW_JSON_PATH}"
import json
import os
import sys

markdown_path, json_path = sys.argv[1], sys.argv[2]

if not os.path.exists(markdown_path):
    raise SystemExit(f"Missing project review markdown artifact: {markdown_path}")
if not os.path.exists(json_path):
    raise SystemExit(f"Missing project review JSON artifact: {json_path}")

with open(markdown_path, "r", encoding="utf-8") as handle:
    markdown = handle.read().strip()
if not markdown:
    raise SystemExit("project-review.md must not be empty.")

with open(json_path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

if not isinstance(payload, dict):
    raise SystemExit("project-review.json must be a JSON object.")

required_string_fields = [
    "executiveSummary",
    "maturityLevel",
    "usabilityVerdict",
]
for field in required_string_fields:
    value = payload.get(field)
    if not isinstance(value, str) or not value.strip():
        raise SystemExit(f"project-review.json field '{field}' must be a non-empty string.")

engineering_quality_verdict = payload.get("engineeringQualityVerdict")
if isinstance(engineering_quality_verdict, str):
    if not engineering_quality_verdict.strip():
        raise SystemExit("project-review.json field 'engineeringQualityVerdict' must not be empty.")
elif isinstance(engineering_quality_verdict, dict):
    normalized_parts = []
    for key, value in engineering_quality_verdict.items():
        if isinstance(value, str) and value.strip():
            normalized_parts.append(f"{key}: {value.strip()}")
    if not normalized_parts:
        raise SystemExit(
            "project-review.json field 'engineeringQualityVerdict' must be a non-empty string or an object of non-empty strings."
        )
    payload["engineeringQualityVerdict"] = "; ".join(normalized_parts)
    with open(json_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")
else:
    raise SystemExit(
        "project-review.json field 'engineeringQualityVerdict' must be a non-empty string or an object of non-empty strings."
    )

for field in ["biggestStrengths", "biggestRisks"]:
    value = payload.get(field)
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        raise SystemExit(f"project-review.json field '{field}' must be an array of non-empty strings.")

final_verdict = payload.get("finalVerdict")
if not isinstance(final_verdict, dict):
    raise SystemExit("project-review.json field 'finalVerdict' must be an object.")
for field in [
    "documentationGoodEnough",
    "testsGoodEnough",
    "projectCompleteEnough",
    "codeHasMajorIssues",
]:
    if not isinstance(final_verdict.get(field), bool):
        raise SystemExit(f"project-review.json finalVerdict.{field} must be a boolean.")
if final_verdict.get("confidence") not in {"high", "medium", "low"}:
    raise SystemExit("project-review.json finalVerdict.confidence must be one of: high, medium, low.")

findings = payload.get("findings")
if not isinstance(findings, list):
    raise SystemExit("project-review.json field 'findings' must be an array.")

valid_categories = {"documentation", "tests", "completeness", "architecture", "code_quality", "security"}
valid_severities = {"critical", "high", "medium", "low"}
for index, finding in enumerate(findings):
    if not isinstance(finding, dict):
        raise SystemExit(f"project-review.json findings[{index}] must be an object.")
    if finding.get("category") not in valid_categories:
        raise SystemExit(f"project-review.json findings[{index}].category is invalid.")
    if finding.get("severity") not in valid_severities:
        raise SystemExit(f"project-review.json findings[{index}].severity is invalid.")
    for field in ["finding", "whyItMatters", "recommendedImprovement"]:
        value = finding.get(field)
        if not isinstance(value, str) or not value.strip():
            raise SystemExit(f"project-review.json findings[{index}].{field} must be a non-empty string.")
    evidence = finding.get("evidence")
    if not isinstance(evidence, list):
        raise SystemExit(f"project-review.json findings[{index}].evidence must be an array.")
    for evidence_index, evidence_item in enumerate(evidence):
        if (
            not isinstance(evidence_item, dict)
            or not isinstance(evidence_item.get("path"), str)
            or not evidence_item["path"].strip()
        ):
            raise SystemExit(
                f"project-review.json findings[{index}].evidence[{evidence_index}] must contain a non-empty path string."
            )
PY
fi

if [[ "${RUN_KIND}" == "task_planning" ]]; then
  python - <<'PY' "${TASK_PLAN_OUTPUT_PATH}"
import json
import sys

output_path = sys.argv[1]

if not __import__("os").path.exists(output_path):
    raise SystemExit(f"Missing task plan artifact: {output_path}")

with open(output_path, "r", encoding="utf-8") as handle:
    try:
        payload = json.load(handle)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"task-plan.json is not valid JSON: {exc}") from exc

if not isinstance(payload, list):
    raise SystemExit("task-plan.json must be a JSON array.")

if not payload:
    raise SystemExit("task-plan.json must not be an empty array.")

for index, task in enumerate(payload):
    if not isinstance(task, dict):
        raise SystemExit(f"task-plan.json[{index}] must be an object.")
    for field in ["title", "description"]:
        value = task.get(field)
        if not isinstance(value, str) or not value.strip():
            raise SystemExit(f"task-plan.json[{index}].{field} must be a non-empty string.")
    if "instructions" in task and task["instructions"] is not None:
        if not isinstance(task["instructions"], str):
            raise SystemExit(f"task-plan.json[{index}].instructions must be a string or null.")
    criteria = task.get("acceptanceCriteria")
    if not isinstance(criteria, list) or not criteria:
        raise SystemExit(f"task-plan.json[{index}].acceptanceCriteria must be a non-empty array.")
    for ci, criterion in enumerate(criteria):
        if not isinstance(criterion, str) or not criterion.strip():
            raise SystemExit(f"task-plan.json[{index}].acceptanceCriteria[{ci}] must be a non-empty string.")
PY
fi

echo "OpenCode completed ${RUN_KIND} run with provider ${LLM_PROVIDER:-unknown} and model ${LLM_MODEL}." > "${SUMMARY_PATH}"
