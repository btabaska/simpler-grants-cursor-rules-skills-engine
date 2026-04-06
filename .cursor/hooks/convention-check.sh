#!/usr/bin/env bash
# Quick convention check after file edit — lightweight, fast
# Only flags critical violations (NEVER directives), not style nits
# Input: JSON on stdin with { "path": "..." }
# Output: JSON on stdout with warnings for the agent

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.path // empty')
WARNINGS=""

if [[ -z "$FILE_PATH" ]]; then
  echo '{"continue": true}'
  exit 0
fi

case "$FILE_PATH" in
  api/src/api/*.py)
    # Check: business logic should not be in route handlers
    if grep -q "db_session\." "$FILE_PATH" 2>/dev/null; then
      if [[ "$FILE_PATH" == *"/routes/"* ]]; then
        WARNINGS="WARNING: Direct db_session usage detected in route handler. Business logic should be in the service layer per api-services rule."
      fi
    fi
    ;;
  api/src/services/*.py)
    # Check: services must use raise_flask_error, not raw exceptions for API errors
    if grep -qE "raise (HTTPException|abort\()" "$FILE_PATH" 2>/dev/null; then
      WARNINGS="WARNING: Raw HTTP exception in service layer. Use raise_flask_error() per api-error-handling rule."
    fi
    ;;
  frontend/src/components/*.tsx)
    # Check: no inline styles (should use USWDS classes)
    if grep -q 'style={{' "$FILE_PATH" 2>/dev/null; then
      WARNINGS="WARNING: Inline styles detected. Use USWDS utility classes per frontend-components rule."
    fi
    ;;
esac

if [[ -n "$WARNINGS" ]]; then
  # Escape for JSON
  ESCAPED=$(echo "$WARNINGS" | jq -Rs .)
  echo "{\"continue\": true, \"agentMessage\": $ESCAPED}"
else
  echo '{"continue": true}'
fi
