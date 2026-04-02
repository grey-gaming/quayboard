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

Begin by reading /workspace/.quayboard-context.md and /workspace/.quayboard-tasks.md.
Use those files to make the required changes in /workspace.
Work directly in the repository checkout. Run the build, test, and verification commands you need.
Do not commit, push, or expose secrets in output.
Leave any useful machine-readable or human-readable evidence under /run/artifacts.
EOF

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

cd "${WORKSPACE_DIR}"

opencode --print-logs run \
  --format json \
  --model "${OPENCODE_PROVIDER_ID}/${LLM_MODEL}" \
  -- "$(cat "${PROMPT_PATH}")" | tee "${EVENTS_PATH}"

echo "OpenCode completed ${RUN_KIND} run with provider ${LLM_PROVIDER:-unknown} and model ${LLM_MODEL}." > "${SUMMARY_PATH}"
