#!/usr/bin/env bash
# Cursor hook script: pr-auto-labeler
# Event: stop
# If an open PR exists for the current branch (via gh CLI), apply labels
# inferred from the file paths touched in the branch.
# Non-blocking: always exits 0.
#
# NOTE: ensure executable bit is set: chmod +x .cursor/hooks/scripts/pr-auto-labeler.sh

set -euo pipefail

LOG_DIR=".cursor/hooks/logs"
LOG_FILE="${LOG_DIR}/pr-auto-labeler.log"
mkdir -p "$LOG_DIR" 2>/dev/null || true

cat >/dev/null 2>&1 || true

log() {
  echo "[pr-auto-labeler] $*" >&2
  printf '[%s] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

if ! command -v gh >/dev/null 2>&1; then
  log "gh CLI not available; skipping"
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [[ -z "$BRANCH" || "$BRANCH" == "HEAD" || "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
  exit 0
fi

# Find an open PR for this branch (quiet if none).
PR_NUM="$(gh pr view --json number --jq .number 2>/dev/null || true)"
if [[ -z "$PR_NUM" ]]; then
  log "no open PR for branch $BRANCH"
  exit 0
fi

# Determine the base branch for diff (fall back to main).
BASE="$(gh pr view --json baseRefName --jq .baseRefName 2>/dev/null || echo main)"
FILES="$(git diff --name-only "origin/${BASE}...HEAD" 2>/dev/null || git diff --name-only HEAD 2>/dev/null || true)"

declare -a LABELS=()
add_label() {
  local l="$1"
  for existing in "${LABELS[@]:-}"; do
    [[ "$existing" == "$l" ]] && return 0
  done
  LABELS+=("$l")
}

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  case "$f" in
    api/*)                    add_label "area: api" ;;
    frontend/*)               add_label "area: frontend" ;;
    documentation/*|docs/*)   add_label "area: docs" ;;
    .cursor/*|cursor-tooling-prompts/*) add_label "area: tooling" ;;
    *test*|*spec*)            add_label "type: tests" ;;
  esac
  case "$f" in
    *.md) add_label "type: docs" ;;
  esac
done <<< "$FILES"

if [[ "${#LABELS[@]}" -eq 0 ]]; then
  log "no labels inferred for PR #$PR_NUM"
  exit 0
fi

# Apply (merge with existing labels — gh pr edit --add-label is additive).
for l in "${LABELS[@]}"; do
  if gh pr edit "$PR_NUM" --add-label "$l" >/dev/null 2>&1; then
    log "applied label '$l' to PR #$PR_NUM"
  else
    log "failed to apply label '$l' to PR #$PR_NUM (label may not exist)"
  fi
done

exit 0
