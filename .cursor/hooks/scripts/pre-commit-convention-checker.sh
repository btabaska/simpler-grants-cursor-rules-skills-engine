#!/usr/bin/env bash
# Cursor hook script: pre-commit-convention-checker
# Event: beforeShellExecution
# Blocks `git commit` if any staged file violates a hard convention rule.
# Exit 0 = ok, 2 = block, 1 = internal error (fail-open).
#
# NOTE: ensure executable bit is set: chmod +x .cursor/hooks/scripts/pre-commit-convention-checker.sh

set -euo pipefail

LOG_DIR=".cursor/hooks/logs"
LOG_FILE="${LOG_DIR}/convention-violations.jsonl"
mkdir -p "$LOG_DIR" 2>/dev/null || true

INPUT="$(cat || true)"
COMMAND=""
if command -v jq >/dev/null 2>&1 && [[ -n "$INPUT" ]]; then
  COMMAND="$(printf '%s' "$INPUT" | jq -r '.command // .tool_input.command // ""' 2>/dev/null || true)"
fi

# Only gate git commits.
if [[ "$COMMAND" != *"git commit"* ]]; then
  exit 0
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

# Collect staged files.
mapfile -t STAGED < <(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)
if [[ "${#STAGED[@]}" -eq 0 ]]; then
  exit 0
fi

VIOLATIONS=()

record() {
  local file="$1" line="$2" rule="$3" msg="$4"
  VIOLATIONS+=("${file}:${line}: [${rule}] ${msg}")
  printf '{"ts":"%s","file":"%s","line":%s,"rule":"%s","msg":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$file" "$line" "$rule" "$msg" \
    >> "$LOG_FILE" 2>/dev/null || true
}

scan_py_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  # bare except
  grep -nE '^\s*except\s*:' "$f" 2>/dev/null | while IFS=: read -r ln _; do
    record "$f" "$ln" "api-error-handling" "bare 'except:' clause; catch specific exceptions"
  done
  # raw HTTPException
  grep -nE 'raise\s+(HTTPException|abort\s*\()' "$f" 2>/dev/null | while IFS=: read -r ln _; do
    record "$f" "$ln" "api-error-handling" "raw HTTPException; use raise_flask_error()"
  done
  # legacy Column() without Mapped[
  if grep -qE '=\s*Column\(' "$f" 2>/dev/null && ! grep -qE 'Mapped\[' "$f" 2>/dev/null; then
    local ln
    ln="$(grep -nE '=\s*Column\(' "$f" | head -1 | cut -d: -f1)"
    record "$f" "${ln:-1}" "api-database" "legacy Column() syntax; use Mapped[T] + mapped_column()"
  fi
}

scan_ts_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  # inline styles
  grep -nE 'style\s*=\s*\{\{' "$f" 2>/dev/null | while IFS=: read -r ln _; do
    record "$f" "$ln" "frontend-components" "inline style={{}}; use USWDS utility classes"
  done
  # 'any' types
  grep -nE ':\s*any\b' "$f" 2>/dev/null | while IFS=: read -r ln _; do
    record "$f" "$ln" "typescript" "'any' type annotation; use a specific type"
  done
  # barrel index files
  if [[ "$f" == */index.ts || "$f" == */index.tsx ]]; then
    if grep -qE '^\s*export\s+\*\s+from|^\s*export\s*\{' "$f" 2>/dev/null; then
      record "$f" "1" "frontend-components" "barrel file re-export; import directly from source"
    fi
  fi
}

for f in "${STAGED[@]}"; do
  case "$f" in
    *.py)              scan_py_file "$f" ;;
    *.ts|*.tsx|*.js|*.jsx) scan_ts_file "$f" ;;
  esac
done

if [[ "${#VIOLATIONS[@]}" -gt 0 ]]; then
  echo "[pre-commit-convention-checker] BLOCK: ${#VIOLATIONS[@]} convention violation(s):" >&2
  for v in "${VIOLATIONS[@]}"; do
    echo "  - $v" >&2
  done
  echo "  Fix the violations above, re-stage, and retry the commit." >&2
  exit 2
fi

exit 0
