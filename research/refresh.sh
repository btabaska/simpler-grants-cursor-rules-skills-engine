#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Simpler.Grants.gov AI Coding Toolkit — Rule Refresh Script
#
# Re-runs the PR extraction pipeline and shows what rules have changed.
# ============================================================================

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo -e "${BOLD}Simpler.Grants.gov Rule Refresh${NC}"
echo "================================"
echo ""

# ---- 1. Check prerequisites ------------------------------------------------

if [[ -z "${GITHUB_PAT:-}" ]]; then
  echo -e "${YELLOW}Error: GITHUB_PAT environment variable is not set.${NC}"
  echo "Export your GitHub personal access token:"
  echo "  export GITHUB_PAT=ghp_your_token_here"
  exit 1
fi

if ! command -v python3 &>/dev/null; then
  echo -e "${YELLOW}Error: python3 is required.${NC}"
  exit 1
fi

# Resolve paths relative to this script (research/) and the project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ---- 2. Snapshot current rules ----------------------------------------------

echo -e "${BOLD}Step 1/4: Snapshotting current rules...${NC}"
SNAPSHOT_DIR=$(mktemp -d)
if [[ -d "$PROJECT_ROOT/documentation/rules" ]]; then
  cp -r "$PROJECT_ROOT/documentation/rules" "$SNAPSHOT_DIR/rules-before"
  echo "  Saved snapshot of rule files"
else
  mkdir -p "$SNAPSHOT_DIR/rules-before"
  echo "  No existing rules to snapshot"
fi

# ---- 3. Extract new PR data ------------------------------------------------

echo ""
echo -e "${BOLD}Step 2/4: Extracting PR data from GitHub...${NC}"
python3 "$SCRIPT_DIR/extract.py" 2>&1 | sed 's/^/  /'

# ---- 4. Prepare batch for analysis -----------------------------------------

echo ""
echo -e "${BOLD}Step 3/4: Preparing analysis batch...${NC}"
python3 "$SCRIPT_DIR/prepare_batch.py" 2>&1 | sed 's/^/  /'

# ---- 5. Show diff -----------------------------------------------------------

echo ""
echo -e "${BOLD}Step 4/4: Comparing rules...${NC}"

if [[ -d "$PROJECT_ROOT/documentation/rules" ]]; then
  echo ""
  echo "Rule changes (if any):"
  echo "======================"
  diff -rq "$SNAPSHOT_DIR/rules-before" "$PROJECT_ROOT/documentation/rules" 2>/dev/null || true
  echo ""
  echo "To see detailed changes:"
  echo "  diff -r $SNAPSHOT_DIR/rules-before $PROJECT_ROOT/documentation/rules"
else
  echo "  No rules directory found after refresh."
fi

echo ""
echo -e "${GREEN}${BOLD}Extraction complete.${NC}"
echo ""
echo "Next steps:"
echo "  1. Review the extracted data in research/extracted_data/"
echo "  2. Run the analysis passes (research/analysis/ — pass1 → pass2 → pass3)"
echo "  3. Review generated rules in documentation/rules/"
echo "  4. Copy updated .mdc files to .cursor/rules/"
echo "  5. Rebuild MCP server: cd mcp-server && npm run build"
echo ""

# Cleanup
rm -rf "$SNAPSHOT_DIR"
