#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_DIR="${QB_ARTIFACT_DIR:-/run/artifacts}"
CONTEXT_PATH="${QB_CONTEXT_PATH:-/workspace/.quayboard-context.md}"
TASKS_PATH="${QB_TASKS_PATH:-/workspace/.quayboard-tasks.md}"
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

mkdir -p "${ARTIFACT_DIR}"

if [[ ! -f "${CONTEXT_PATH}" ]]; then
  echo "Quayboard context file not found: ${CONTEXT_PATH}" >&2
  exit 2
fi

if [[ ! -f "${TASKS_PATH}" ]]; then
  echo "Quayboard tasks file not found: ${TASKS_PATH}" >&2
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
- Leave useful machine-readable or human-readable evidence under /run/artifacts.
EOF

if [[ "${RUN_KIND}" == "verify" ]]; then
  cat >> "${PROMPT_PATH}" <<'EOF'

Verification mode:
- Verify the existing implementation rather than building new features from scratch.
- Run the project's relevant tests, type checks, and build commands.
- Fix failures that block verification, but do not expand scope beyond the requested implementation.
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
  --model "${OPENCODE_PROVIDER_ID}/${LLM_MODEL}" \
  -- "$(cat "${PROMPT_PATH}")" | tee "${EVENTS_PATH}"

echo "OpenCode completed ${RUN_KIND} run with provider ${LLM_PROVIDER:-unknown} and model ${LLM_MODEL}." > "${SUMMARY_PATH}"
