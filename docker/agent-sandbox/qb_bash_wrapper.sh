#!/bin/sh
set -eu

REAL_BASH="${REAL_BASH:-/usr/local/share/quayboard/bash.real}"
COMMAND_TIMEOUT_SECONDS="${QB_BASH_COMMAND_TIMEOUT_SECONDS:-900}"
TIMEOUT_BYPASS_SCRIPT="${QB_BASH_TIMEOUT_BYPASS_SCRIPT:-/usr/local/bin/qb_entrypoint.sh}"
child_pid=""
watchdog_pid=""
timeout_marker="/tmp/qb-bash-timeout-$$"

is_positive_integer() {
  case "$1" in
    ''|*[!0-9]*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

should_bypass_timeout() {
  if [ "$#" -eq 0 ]; then
    return 1
  fi

  [ "$1" = "${TIMEOUT_BYPASS_SCRIPT}" ]
}

cleanup_process_group() {
  if [ -z "${child_pid}" ]; then
    return
  fi

  kill -TERM "-${child_pid}" 2>/dev/null || true
  sleep 0.2
  kill -KILL "-${child_pid}" 2>/dev/null || true
}

cleanup_watchdog() {
  if [ -n "${watchdog_pid}" ]; then
    kill -TERM "-${watchdog_pid}" 2>/dev/null || kill -TERM "${watchdog_pid}" 2>/dev/null || true
    sleep 0.1
    kill -KILL "-${watchdog_pid}" 2>/dev/null || kill -KILL "${watchdog_pid}" 2>/dev/null || true
    wait "${watchdog_pid}" 2>/dev/null || true
  fi
}

cleanup_wrapper() {
  cleanup_watchdog
  cleanup_process_group
  rm -f "${timeout_marker}"
}

trap cleanup_wrapper EXIT INT TERM

rm -f "${timeout_marker}"

setsid "${REAL_BASH}" "$@" &
child_pid="$!"

if ! should_bypass_timeout "$@" \
  && is_positive_integer "${COMMAND_TIMEOUT_SECONDS}" \
  && [ "${COMMAND_TIMEOUT_SECONDS}" -gt 0 ]; then
  setsid sh -c '
    timeout_seconds="$1"
    target_pid="$2"
    marker_path="$3"

    sleep "${timeout_seconds}"
    if kill -0 "-${target_pid}" 2>/dev/null; then
      echo "timeout" >"${marker_path}"
      printf "qb_bash_wrapper_timeout: command exceeded %ss; terminating process group.\n" "${timeout_seconds}" >&2
      kill -TERM "-${target_pid}" 2>/dev/null || true
      sleep 1
      kill -KILL "-${target_pid}" 2>/dev/null || true
    fi
  ' sh "${COMMAND_TIMEOUT_SECONDS}" "${child_pid}" "${timeout_marker}" &
  watchdog_pid="$!"
fi

set +e
wait "${child_pid}"
status="$?"
set -e

if [ -f "${timeout_marker}" ]; then
  status="124"
fi

cleanup_wrapper
trap - EXIT INT TERM

exit "${status}"
