#!/bin/sh
set -eu

# imagor officially supports AWS_LOADER_* and AWS_RESULT_STORAGE_* credential
# overrides. Also expose the loader credentials as the global AWS fallback so
# older/cached imagor builds never fall through to EC2 IMDS when reading R2.
if [ -z "${AWS_ACCESS_KEY_ID:-}" ] && [ -n "${AWS_LOADER_ACCESS_KEY_ID:-}" ]; then
  export AWS_ACCESS_KEY_ID="${AWS_LOADER_ACCESS_KEY_ID}"
fi
if [ -z "${AWS_SECRET_ACCESS_KEY:-}" ] && [ -n "${AWS_LOADER_SECRET_ACCESS_KEY:-}" ]; then
  export AWS_SECRET_ACCESS_KEY="${AWS_LOADER_SECRET_ACCESS_KEY}"
fi
if [ -z "${AWS_REGION:-}" ]; then
  export AWS_REGION="${AWS_LOADER_REGION:-auto}"
fi

# This container is not EC2. If credentials are missing, fail immediately
# instead of waiting for 169.254.169.254 / IMDS and timing out.
export AWS_EC2_METADATA_DISABLED=true

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
