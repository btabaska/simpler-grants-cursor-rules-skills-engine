#!/usr/bin/env bash
# Cursor hook script: background-test-runner
# Event: stop
# Runs scoped test suites for the surfaces touched in the current session.
# Never blocks: always exits 0. Results are logged and streamed to stderr.
#
# NOTE: ensure executable bit is set: chmod +x .cursor/hooks/scripts/background-test-runner.sh

set -euo pipefail

LOG_DIR=".cursor/hooks/logs"
LOG_FILE="${LOG_DIR}/test-runner.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

# Read and discard payload (we just need the fact that the session stopped).
cat >/dev/null 2>&1 || true

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

CHANGED="$(git diff --name-only HEAD 2>/dev/null || true)"
if [[ -z "$CHANGED" ]]; then
  exit 0
fi

TOUCHED_API=false
TOUCHED_FE=false
while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  [[ "$f" == api/* ]] && TOUCHED_API=true
  [[ "$f" == frontend/* ]] && TOUCHED_FE=true
done <<< "$CHANGED"

log() {
  local msg="$1"
  echo "[background-test-runner] $msg" >&2
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

run_bg() {
  local label="$1"; shift
  local cmd="$*"
  log "spawning: $label :: $cmd"
  (
    set +e
    eval "$cmd" >> "$LOG_FILE" 2>&1
    rc=$?
    printf '[%s] %s exit=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$label" "$rc" >> "$LOG_FILE" 2>/dev/null || true
  ) &
  disown || true
}

if $TOUCHED_API; then
  if [[ -d api ]]; then
    run_bg "api-tests" "cd api && python -m pytest tests/ --tb=short -q"
  fi
fi

if $TOUCHED_FE; then
  if [[ -d frontend ]]; then
    run_bg "frontend-tests" "cd frontend && npm test -- --watchAll=false --reporters=default"
  fi
fi

log "dispatch complete; tail ${LOG_FILE} for results"
exit 0
