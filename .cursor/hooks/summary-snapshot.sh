#!/usr/bin/env bash
# When an agent session completes, generate a summary of all changes
# Input: JSON on stdin
# Output: JSON with a summary message for the user

set -euo pipefail

# Get git diff summary
CHANGES=$(git diff --stat HEAD 2>/dev/null || echo "No git changes detected")
UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | head -10 || echo "")

SUMMARY="Session changes:\n$CHANGES"
if [[ -n "$UNTRACKED" ]]; then
  SUMMARY="$SUMMARY\n\nNew files:\n$UNTRACKED"
fi

ESCAPED=$(echo -e "$SUMMARY" | jq -Rs .)
echo "{\"continue\": true, \"userMessage\": $ESCAPED}"
