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

cat > "${PROMPT_PATH}" <<EOF
You are Quayboard's sandbox implementation agent.

Run kind: ${RUN_KIND}

Read /workspace/.quayboard-context.md for the project context and design decisions.
Read /workspace/.quayboard-tasks.md for the concrete work assigned to this run.

Work directly in the /workspace repository checkout.
Run build, test, and verification commands as needed to confirm your changes work.
Any server or background process you start must be short-lived and cleaned up before the command exits.
Prefer single-command verification patterns that start the service, probe it, and tear it down in one step.
Do not leave watch processes, dev servers, or background jobs running between steps.

Repository hygiene rules:
- Ensure .gitignore exists and preserves generated-output exclusions for node_modules/, dist/, build/, coverage/, .nyc_output/, and *.log.
- Add further .gitignore entries when your work creates generated output.
- Do not commit installed dependencies, build output, coverage reports, or log files.
- Treat .quayboard-context.md, .quayboard-tasks.md, and any .quayboard-* files as Quayboard-managed inputs. Read them, but do not edit, delete, or commit them.

Protection rules:
- Do not delete files or directories that were present when the run started unless the task explicitly requires removal.
- In particular, never delete docs/, README.md, CHANGELOG.md, AGENTS.md, CONTRIBUTING.md, .github/, or .gitignore.
- Do not overwrite documentation files with empty content.

Security:
- Do not commit, push, or expose secrets in output.

Artifacts:
- Leave useful machine-readable or human-readable evidence under ${ARTIFACT_DIR}.
EOF

if [[ "${RUN_KIND}" == "verify" ]]; then
  cat >> "${PROMPT_PATH}" <<'EOF'

Verification mode:
- Verify the existing implementation rather than building new features from scratch.
- Run the project's relevant tests, type checks, and build commands.
- Keep any fixes narrow and tied to the requested implementation.
- If the requested implementation depends on small adjacent code or documentation touch-ups to be coherent and verifiable, make them.
- Prefer existing repo dependencies and platform APIs before adding new third-party packages.
- Do not rely on model memory for package names or versions.
- When you need to add or upgrade a package, query the relevant package registry or package-manager metadata first and use the latest stable non-prerelease release.
- If the touched area depends on an outdated package that must change for the requested implementation to work safely, you may upgrade that package in the same run.
- If version lookup or package download fails, stop and report the failure instead of guessing a version.
- If install output shows deprecation, vulnerability, or obvious safety warnings for the chosen package, prefer a safer current alternative when feasible.
- Do not expand product scope, add unrelated features, or start broader cleanup work.
EOF
fi

if [[ "${RUN_KIND}" == "implement" ]]; then
  cat >> "${PROMPT_PATH}" <<'EOF'

Implementation mode:
- Follow the assigned implementation closely, but do not stop at an artificially narrow file boundary when a small adjacent integration update is required to complete the change cleanly.
- You may add or update relevant user-facing documentation or architecture documentation when the implemented behavior, wiring, or boundary changes would otherwise leave the repository misleading or incomplete.
- Keep documentation updates grounded in behavior that is actually implemented or touched in this run.
- Prefer existing repo dependencies and platform APIs before adding new third-party packages.
- Do not rely on model memory for package names or versions.
- When you need to add or upgrade a package, query the relevant package registry or package-manager metadata first and use the latest stable non-prerelease release.
- If the touched area depends on an outdated package that must change for the requested implementation to work safely, you may upgrade that package in the same run.
- If version lookup or package download fails, stop and report the failure instead of guessing a version.
- If install output shows deprecation, vulnerability, or obvious safety warnings for the chosen package, prefer a safer current alternative when feasible.
- Do not invent new features, speculative behavior, or unrelated refactors.
EOF
fi

if [[ "${RUN_KIND}" == "project_review" ]]; then
  cat >> "${PROMPT_PATH}" <<EOF

Project review mode:
- Treat this as a repository-wide engineering due diligence review.
- Inspect the real repository contents before making claims.
- Do not edit repository files.
- Write the full report to ${PROJECT_REVIEW_MARKDOWN_PATH}.
- Write a strict JSON summary to ${PROJECT_REVIEW_JSON_PATH}.
- The JSON must be a single object with exactly these top-level keys: executiveSummary, maturityLevel, usabilityVerdict, biggestStrengths, biggestRisks, engineeringQualityVerdict, finalVerdict, findings.
- finalVerdict must be an object with boolean fields documentationGoodEnough, testsGoodEnough, projectCompleteEnough, codeHasMajorIssues, plus confidence set to high, medium, or low.
- findings must be an array. Each finding must be an object with: category, severity, finding, evidence, whyItMatters, recommendedImprovement.
- category must be one of: documentation, tests, completeness, architecture.
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
- Read /workspace/.quayboard-project-review.md and /workspace/.quayboard-project-review-findings.json.
- Fix only the batched findings described there.
- Re-run the closest relevant verification before exiting.
- Write a concise remediation summary to ${PROJECT_FIX_SUMMARY_PATH}.
EOF
fi

if [[ "${RUN_KIND}" == "bug_fix" ]]; then
  cat >> "${PROMPT_PATH}" <<EOF

Bug fix mode:
- Read /workspace/.quayboard-bug-report.md before making changes.
- Fix only the reported defect.
- Re-run the closest relevant verification before exiting.
- Write a concise remediation summary to ${BUG_FIX_SUMMARY_PATH}.
EOF
fi

if [[ "${RUN_KIND}" == "ci_repair" ]]; then
  cat >> "${PROMPT_PATH}" <<'EOF'

CI repair mode:
- Read /workspace/.quayboard-ci-failure.md before making changes.
- Repair only the CI conditions described there, including failing checks or stale pending checks.
- Re-run the failing or closest equivalent local checks before exiting.
- Avoid unrelated refactors or new feature work.
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
- Generate an ordered, implementation-ready task list for the feature.

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

valid_categories = {"documentation", "tests", "completeness", "architecture"}
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
