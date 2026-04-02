#!/usr/bin/env bash

quayboard_cleanup_background_jobs() {
  local job_pid

  for job_pid in $(jobs -pr 2>/dev/null); do
    kill -TERM "$job_pid" 2>/dev/null || true
  done

  sleep 0.1

  for job_pid in $(jobs -pr 2>/dev/null); do
    kill -KILL "$job_pid" 2>/dev/null || true
  done
}

trap quayboard_cleanup_background_jobs EXIT
