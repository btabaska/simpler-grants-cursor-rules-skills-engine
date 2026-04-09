#!/usr/bin/env bash
# Cursor hook script: stale-documentation-detector
# Event: afterFileEdit (advisory, non-blocking)
# When source files change, check whether nearby docs reference them and
# warn if the docs have not been touched recently.
# Always exits 0.
#
# NOTE: ensure executable bit is set: chmod +x .cursor/hooks/scripts/stale-documentation-detector.sh

set -euo pipefail

LOG_DIR=".cursor/hooks/logs"
LOG_FILE="${LOG_DIR}/stale-docs.jsonl"
mkdir -p "$LOG_DIR" 2>/dev/null || true

STALE_THRESHOLD_DAYS="${STALE_THRESHOLD_DAYS:-30}"

INPUT="$(cat || true)"
FILE=""
if command -v jq >/dev/null 2>&1 && [[ -n "$INPUT" ]]; then
  FILE="$(printf '%s' "$INPUT" | jq -r '.file_path // ""' 2>/dev/null || true)"
fi

if [[ -z "$FILE" ]]; then
  exit 0
fi

# Only act on source files, not on doc edits themselves.
case "$FILE" in
  *.md|*.mdx) exit 0 ;;
  api/*|frontend/*|src/*|lib/*) ;;
  *) exit 0 ;;
esac

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

BASENAME="$(basename "$FILE")"
STEM="${BASENAME%.*}"

# Directories we consider "documentation".
DOC_DIRS=()
[[ -d documentation ]] && DOC_DIRS+=("documentation")
[[ -d docs ]] && DOC_DIRS+=("docs")

if [[ "${#DOC_DIRS[@]}" -eq 0 ]]; then
  exit 0
fi

# Find doc files that reference this source file by path or stem.
mapfile -t REFS < <(grep -rlE "(${FILE}|\\b${STEM}\\b)" "${DOC_DIRS[@]}" --include='*.md' --include='*.mdx' 2>/dev/null || true)

if [[ "${#REFS[@]}" -eq 0 ]]; then
  exit 0
fi

NOW_EPOCH="$(date +%s)"
THRESHOLD_SECS=$(( STALE_THRESHOLD_DAYS * 86400 ))

for doc in "${REFS[@]}"; do
  [[ -f "$doc" ]] || continue
  # Last commit time for the doc (fall back to mtime).
  LAST_TS="$(git log -1 --format=%ct -- "$doc" 2>/dev/null || true)"
  if [[ -z "$LAST_TS" ]]; then
    if stat -f %m "$doc" >/dev/null 2>&1; then
      LAST_TS="$(stat -f %m "$doc")"
    else
      LAST_TS="$(stat -c %Y "$doc" 2>/dev/null || echo "$NOW_EPOCH")"
    fi
  fi
  AGE=$(( NOW_EPOCH - LAST_TS ))
  if (( AGE > THRESHOLD_SECS )); then
    DAYS=$(( AGE / 86400 ))
    echo "[stale-docs] ${doc} references ${FILE} but was last updated ${DAYS} days ago (threshold ${STALE_THRESHOLD_DAYS}d)." >&2
    printf '{"ts":"%s","source":"%s","doc":"%s","age_days":%s}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE" "$doc" "$DAYS" \
      >> "$LOG_FILE" 2>/dev/null || true
  fi
done

exit 0
