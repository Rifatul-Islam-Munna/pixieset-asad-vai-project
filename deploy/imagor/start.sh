#!/bin/sh
set -eu

/usr/local/bin/imagor &
imagor_pid=$!

/usr/local/bin/imagor-cache-worker &
worker_pid=$!

shutdown() {
  kill -TERM "$worker_pid" 2>/dev/null || true
  kill -TERM "$imagor_pid" 2>/dev/null || true
  wait "$worker_pid" 2>/dev/null || true
  wait "$imagor_pid" 2>/dev/null || true
}

trap shutdown INT TERM

set +e
wait "$imagor_pid"
status=$?
set -e

kill -TERM "$worker_pid" 2>/dev/null || true
wait "$worker_pid" 2>/dev/null || true
exit "$status"
