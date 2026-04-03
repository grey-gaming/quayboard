#!/bin/sh
set -eu

REAL_BASH="${REAL_BASH:-/usr/local/share/quayboard/bash.real}"
child_pid=""

cleanup_process_group() {
  if [ -z "${child_pid}" ]; then
    return
  fi

  kill -TERM "-${child_pid}" 2>/dev/null || true
  sleep 0.2
  kill -KILL "-${child_pid}" 2>/dev/null || true
}

trap cleanup_process_group EXIT INT TERM

setsid "${REAL_BASH}" "$@" &
child_pid="$!"

set +e
wait "${child_pid}"
status="$?"
set -e

cleanup_process_group
trap - EXIT INT TERM

exit "${status}"
