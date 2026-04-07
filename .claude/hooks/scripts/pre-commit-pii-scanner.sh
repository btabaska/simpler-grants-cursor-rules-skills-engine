#!/usr/bin/env bash
# Cursor hook script: pre-commit-pii-scanner
# Event: beforeShellExecution
# Blocks `git commit` invocations whose message or staged content contains PII.
# Exit 0 = allow, Exit 2 = block (Cursor will surface stderr), Exit 1 = internal error (non-blocking).
#
# NOTE: ensure executable bit is set: chmod +x .cursor/hooks/scripts/pre-commit-pii-scanner.sh

set -euo pipefail

LOG_DIR=".cursor/hooks/logs"
LOG_FILE="${LOG_DIR}/pii-detection.jsonl"
ALLOWLIST_FILE="${PII_ALLOWLIST_FILE:-.cursor/hooks/.pii-allowlist}"

mkdir -p "$LOG_DIR" 2>/dev/null || true

# Read payload (Cursor beforeShellExecution passes JSON on stdin).
INPUT="$(cat || true)"
if [[ -z "${INPUT}" ]]; then
  exit 0
fi

# Extract command without requiring jq.
COMMAND=""
if command -v jq >/dev/null 2>&1; then
  COMMAND="$(printf '%s' "$INPUT" | jq -r '.command // .tool_input.command // ""' 2>/dev/null || true)"
else
  COMMAND="$(printf '%s' "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)"
fi

# Only act on git commit commands.
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

# Build the scan corpus: command text + staged diff (if any).
SCAN_TEXT="$COMMAND"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  STAGED="$(git diff --cached --no-color 2>/dev/null || true)"
  SCAN_TEXT="${SCAN_TEXT}"$'\n'"${STAGED}"
fi

SSN_RE='[0-9]{3}-[0-9]{2}-[0-9]{4}'
EMAIL_RE='[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
PHONE_RE='(\([0-9]{3}\)[[:space:]]?[0-9]{3}-[0-9]{4}|[0-9]{3}-[0-9]{3}-[0-9]{4})'

is_allowlisted() {
  local match="$1"
  [[ -f "$ALLOWLIST_FILE" ]] || return 1
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^# ]] && continue
    local rex="${line//./\\.}"; rex="${rex//\*/.*}"
    if [[ "$match" =~ ^${rex}$ ]]; then
      return 0
    fi
  done < "$ALLOWLIST_FILE"
  return 1
}

scan_pattern() {
  local label="$1" regex="$2"
  local matches
  matches="$(printf '%s' "$SCAN_TEXT" | grep -oE "$regex" || true)"
  [[ -z "$matches" ]] && return 1
  while IFS= read -r m; do
    [[ -z "$m" ]] && continue
    if is_allowlisted "$m"; then
      continue
    fi
    printf '{"ts":"%s","type":"%s","match":"%s"}\n' \
      "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$label" "$m" >> "$LOG_FILE" 2>/dev/null || true
    FOUND_TYPE="$label"
    FOUND_MATCH="$m"
    return 0
  done <<< "$matches"
  return 1
}

FOUND_TYPE=""
FOUND_MATCH=""
if scan_pattern "ssn" "$SSN_RE" \
  || scan_pattern "email" "$EMAIL_RE" \
  || scan_pattern "phone" "$PHONE_RE"; then
  echo "[pre-commit-pii-scanner] BLOCK: ${FOUND_TYPE} PII detected (${FOUND_MATCH})." >&2
  echo "  Commit aborted. Do not commit PII. Use test fixtures under tests/ or add the pattern to ${ALLOWLIST_FILE} if it is synthetic test data." >&2
  echo "  FedRAMP / HHS policy: production PII must never land in git history." >&2
  exit 2
fi

exit 0
