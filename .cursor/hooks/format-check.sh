#!/usr/bin/env bash
# After any file edit, run the appropriate formatter
# Input: JSON on stdin with { "path": "...", "content": "..." }
# Output: JSON on stdout with { "continue": true }

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.path // empty')

if [[ -z "$FILE_PATH" ]]; then
  echo '{"continue": true}'
  exit 0
fi

case "$FILE_PATH" in
  *.py)
    # Run ruff format on Python files
    if command -v ruff &> /dev/null; then
      ruff format "$FILE_PATH" 2>/dev/null || true
      ruff check --fix "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
  *.ts|*.tsx|*.js|*.jsx)
    # Run prettier on TypeScript/JavaScript files
    if command -v npx &> /dev/null; then
      npx prettier --write "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
  *.tf)
    # Run terraform fmt on Terraform files
    if command -v terraform &> /dev/null; then
      terraform fmt "$FILE_PATH" 2>/dev/null || true
    fi
    ;;
esac

echo '{"continue": true}'
