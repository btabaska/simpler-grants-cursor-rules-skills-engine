#!/usr/bin/env bash
# Cursor hook script: background-accessibility-monitor
# Event: afterFileEdit (advisory only — never blocks)
# Scans frontend files for WCAG 2.1 AA / Section 508 anti-patterns and
# logs findings to .cursor/hooks/logs/a11y-violations.jsonl.
# Always exits 0.
#
# NOTE: ensure executable bit is set: chmod +x .cursor/hooks/scripts/background-accessibility-monitor.sh

set -euo pipefail

LOG_DIR=".cursor/hooks/logs"
LOG_FILE="${LOG_DIR}/a11y-violations.jsonl"
mkdir -p "$LOG_DIR" 2>/dev/null || true

INPUT="$(cat || true)"
FILE=""
if command -v jq >/dev/null 2>&1 && [[ -n "$INPUT" ]]; then
  FILE="$(printf '%s' "$INPUT" | jq -r '.file_path // ""' 2>/dev/null || true)"
fi

# No file, nothing to do.
if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  exit 0
fi

# Only scan frontend component/page surfaces.
case "$FILE" in
  frontend/*.tsx|frontend/*.jsx|frontend/**/*.tsx|frontend/**/*.jsx) ;;
  *) exit 0 ;;
esac

# Respect per-file opt-out marker.
if grep -q "a11y-monitor: disable" "$FILE" 2>/dev/null; then
  exit 0
fi

emit() {
  local line="$1" rule="$2" wcag="$3" msg="$4"
  printf '{"ts":"%s","file":"%s","line":%s,"rule":"%s","wcag":"%s","severity":"warning","msg":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FILE" "$line" "$rule" "$wcag" "$msg" \
    >> "$LOG_FILE" 2>/dev/null || true
  echo "[a11y] ${FILE}:${line}: [${rule} / WCAG ${wcag}] ${msg}" >&2
}

# 1. <img> without alt
grep -nE '<img\b[^>]*>' "$FILE" 2>/dev/null | while IFS=: read -r ln rest; do
  if ! grep -qE 'alt\s*=' <<<"$rest"; then
    emit "$ln" "missing-alt-text" "1.1.1" "<img> missing alt attribute"
  fi
done || true

# 2. onClick on non-interactive element
grep -nE '<(div|span|p|li)\b[^>]*onClick' "$FILE" 2>/dev/null | while IFS=: read -r ln _; do
  emit "$ln" "interactive-role" "4.1.2" "onClick on non-button element; use <button> or add role + keyboard handler"
done || true

# 3. tabIndex > 0
grep -nE 'tabIndex\s*=\s*\{?\s*[1-9]' "$FILE" 2>/dev/null | while IFS=: read -r ln _; do
  emit "$ln" "tabindex-positive" "2.4.3" "positive tabIndex disrupts natural tab order"
done || true

# 4. <a> without href
grep -nE '<a\b[^>]*>' "$FILE" 2>/dev/null | while IFS=: read -r ln rest; do
  if ! grep -qE 'href\s*=' <<<"$rest"; then
    emit "$ln" "anchor-no-href" "2.1.1" "<a> without href is not keyboard-focusable"
  fi
done || true

# 5. label-less form inputs (heuristic)
grep -nE '<input\b[^>]*>' "$FILE" 2>/dev/null | while IFS=: read -r ln rest; do
  if ! grep -qE 'aria-label|aria-labelledby|id\s*=' <<<"$rest"; then
    emit "$ln" "input-unlabeled" "3.3.2" "<input> has no aria-label/aria-labelledby/id"
  fi
done || true

exit 0
