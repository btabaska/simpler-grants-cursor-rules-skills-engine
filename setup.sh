#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Simpler.Grants.gov AI Coding Toolkit — Setup Script
#
# This script symlinks the Cursor configuration (rules, agents, MCP servers,
# notepads, snippets) into your local clone of the simpler-grants-gov monorepo.
# ============================================================================

TOOLKIT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo -e "${BOLD}Simpler.Grants.gov AI Coding Toolkit — Setup${NC}"
echo "============================================="
echo ""

# ---- 1. Locate the monorepo ------------------------------------------------

MONOREPO_DIR=""

# Check common locations
CANDIDATES=(
  "../simpler-grants-gov"
  "../simpler-grants-gov-main"
  "../../simpler-grants-gov"
)

for candidate in "${CANDIDATES[@]}"; do
  resolved="$(cd "$TOOLKIT_DIR" && cd "$candidate" 2>/dev/null && pwd)" || true
  if [[ -n "$resolved" && -d "$resolved/.git" ]]; then
    MONOREPO_DIR="$resolved"
    break
  fi
done

if [[ -z "$MONOREPO_DIR" ]]; then
  echo -e "${YELLOW}Could not auto-detect the simpler-grants-gov monorepo.${NC}"
  echo ""
  read -rp "Enter the full path to your simpler-grants-gov clone: " MONOREPO_DIR
  MONOREPO_DIR="${MONOREPO_DIR/#\~/$HOME}"
fi

if [[ ! -d "$MONOREPO_DIR/.git" ]]; then
  echo -e "${RED}Error: $MONOREPO_DIR does not appear to be a git repository.${NC}"
  exit 1
fi

echo -e "Monorepo found at: ${GREEN}$MONOREPO_DIR${NC}"
echo ""

# ---- 2. Check prerequisites ------------------------------------------------

MISSING=()

if ! command -v node &>/dev/null; then
  MISSING+=("node (required for MCP servers)")
fi

if ! command -v npx &>/dev/null; then
  MISSING+=("npx (required for MCP servers)")
fi

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${YELLOW}Warning: Missing prerequisites:${NC}"
  for item in "${MISSING[@]}"; do
    echo "  - $item"
  done
  echo ""
  echo "MCP servers won't work until these are installed."
  echo "You can still use rules, agents, notepads, and snippets without them."
  echo ""
fi

if [[ -z "${GITHUB_PAT:-}" ]]; then
  echo -e "${YELLOW}Note: GITHUB_PAT environment variable is not set.${NC}"
  echo "The GitHub MCP server needs this to access the HHS/simpler-grants-gov repo."
  echo "Add to your shell profile: export GITHUB_PAT=ghp_your_token_here"
  echo ""
fi

# ---- 3. Create symlinks ----------------------------------------------------

echo -e "${BOLD}Creating symlinks...${NC}"

# Back up existing files if they exist and aren't already symlinks
for target in ".cursor" ".cursorrules"; do
  dest="$MONOREPO_DIR/$target"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    backup="$dest.backup.$(date +%Y%m%d%H%M%S)"
    echo -e "  ${YELLOW}Backing up existing $target → $backup${NC}"
    mv "$dest" "$backup"
  elif [[ -L "$dest" ]]; then
    echo "  Removing existing symlink: $target"
    rm "$dest"
  fi
done

ln -s "$TOOLKIT_DIR/.cursor" "$MONOREPO_DIR/.cursor"
echo -e "  ${GREEN}✓${NC} .cursor/ → toolkit"

ln -s "$TOOLKIT_DIR/.cursorrules" "$MONOREPO_DIR/.cursorrules"
echo -e "  ${GREEN}✓${NC} .cursorrules → toolkit"

# Symlink documentation into monorepo as well (for MCP filesystem server)
if [[ ! -e "$MONOREPO_DIR/documentation" && ! -L "$MONOREPO_DIR/documentation" ]]; then
  ln -s "$TOOLKIT_DIR/documentation" "$MONOREPO_DIR/documentation"
  echo -e "  ${GREEN}✓${NC} documentation/ → toolkit"
elif [[ -L "$MONOREPO_DIR/documentation" ]]; then
  rm "$MONOREPO_DIR/documentation"
  ln -s "$TOOLKIT_DIR/documentation" "$MONOREPO_DIR/documentation"
  echo -e "  ${GREEN}✓${NC} documentation/ → toolkit (replaced existing symlink)"
else
  echo -e "  ${YELLOW}⚠${NC} documentation/ already exists in monorepo, skipping"
fi

echo ""

# ---- 4. Build MCP server (if exists) ---------------------------------------

if [[ -f "$TOOLKIT_DIR/mcp-server/package.json" ]]; then
  echo -e "${BOLD}Building custom MCP server...${NC}"
  (cd "$TOOLKIT_DIR/mcp-server" && npm install && npm run build) 2>&1 | sed 's/^/  /'
  echo -e "  ${GREEN}✓${NC} MCP server built"
  echo ""
fi

# ---- 5. Install git hooks (opt-in) -----------------------------------------

if [[ -d "$TOOLKIT_DIR/.githooks" ]]; then
  echo ""
  read -rp "Install optional git hooks for convention validation? (y/N) " INSTALL_HOOKS
  if [[ "$INSTALL_HOOKS" =~ ^[Yy]$ ]]; then
    git -C "$MONOREPO_DIR" config core.hooksPath "$TOOLKIT_DIR/.githooks"
    echo -e "  ${GREEN}✓${NC} Git hooks installed"
  else
    echo "  Skipped git hooks"
  fi
  echo ""
fi

# ---- 6. Required Cursor Plugins -------------------------------------------

echo ""
echo -e "${BOLD}Required Cursor Plugins${NC}"
echo ""
echo "The toolkit's agents and rules use specialist sub-agents and knowledge"
echo "indexing from two Cursor community plugins. These MUST be installed for"
echo "the full quality gate pipelines to work."
echo ""
echo -e "${BOLD}Plugin 1: Compound Engineering${NC}"
echo "  What it does:  Provides 15 specialist review sub-agents (security-sentinel,"
echo "                 architecture-strategist, codebase-conventions-reviewer, etc.)"
echo "  Why needed:    Every agent runs a quality gate pipeline using these specialists."
echo "                 Without it, quality validation steps will be skipped."
echo "  Install:"
echo "    1. Open Cursor Settings (Cmd+, or Ctrl+,)"
echo "    2. Go to Extensions / Plugins"
echo "    3. Search for 'compound-engineering'"
echo "    4. Click Install"
echo "  Verify:"
echo "    Type @compound in Cursor chat — specialists should appear in autocomplete."
echo ""
echo -e "${BOLD}Plugin 2: Compound Knowledge${NC}"
echo "  What it does:  Indexes project documentation for AI context enrichment."
echo "  Why needed:    Rules and agents reference indexed docs for architectural context."
echo "                 Without it, Compound Knowledge references will have no effect."
echo "  Install:"
echo "    1. Open Cursor Settings (Cmd+, or Ctrl+,)"
echo "    2. Go to Extensions / Plugins"
echo "    3. Search for 'compound-knowledge'"
echo "    4. Click Install"
echo "  Index your project:"
echo "    1. Open the Compound Knowledge panel in Cursor"
echo "    2. Add the documentation/ directory to the knowledge index"
echo "    3. Add the .cursor/rules/ directory to the knowledge index"
echo "    4. Wait for indexing to complete"
echo ""
read -rp "Press Enter after installing both plugins (or 's' to skip for now): " PLUGIN_RESPONSE
if [[ "$PLUGIN_RESPONSE" =~ ^[Ss]$ ]]; then
  echo -e "  ${YELLOW}Skipped plugin installation — agents will work but without specialist validation${NC}"
else
  echo -e "  ${GREEN}✓${NC} Plugins acknowledged"
fi
echo ""

# ---- 7. Verify Installation -----------------------------------------------

echo -e "${BOLD}Verifying installation...${NC}"
ISSUES=0

# Check symlinks
for target in ".cursor" ".cursorrules" "documentation"; do
  if [[ -L "$MONOREPO_DIR/$target" ]]; then
    echo -e "  ${GREEN}✓${NC} $target symlink exists"
  else
    echo -e "  ${RED}✗${NC} $target symlink missing"
    ISSUES=$((ISSUES + 1))
  fi
done

# Check rule file count
RULE_COUNT=$(ls -1 "$TOOLKIT_DIR/.cursor/rules/"*.mdc 2>/dev/null | wc -l | tr -d ' ')
if [[ "$RULE_COUNT" -eq 24 ]]; then
  echo -e "  ${GREEN}✓${NC} All 24 rule files present (18 domain + 6 agents)"
else
  echo -e "  ${RED}✗${NC} Expected 24 rule files, found $RULE_COUNT"
  ISSUES=$((ISSUES + 1))
fi

# Check MCP server build
if [[ -f "$TOOLKIT_DIR/mcp-server/dist/index.js" ]]; then
  echo -e "  ${GREEN}✓${NC} Custom MCP server built (simpler-grants-context)"
else
  echo -e "  ${YELLOW}⚠${NC} Custom MCP server not built — run: cd mcp-server && npm install && npm run build"
  ISSUES=$((ISSUES + 1))
fi

# Check MCP config
if [[ -f "$TOOLKIT_DIR/.cursor/mcp.json" ]]; then
  echo -e "  ${GREEN}✓${NC} MCP server configuration present (.cursor/mcp.json)"
else
  echo -e "  ${RED}✗${NC} MCP server configuration missing"
  ISSUES=$((ISSUES + 1))
fi

# Check notepads and snippets
NOTEPAD_COUNT=$(ls -1 "$TOOLKIT_DIR/.cursor/notepads/"*.md 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${GREEN}✓${NC} $NOTEPAD_COUNT notepads available"

SNIPPET_COUNT=$(ls -1 "$TOOLKIT_DIR/.cursor/snippets/"*.code-snippets 2>/dev/null | wc -l | tr -d ' ')
echo -e "  ${GREEN}✓${NC} $SNIPPET_COUNT snippet files available"

echo ""
if [[ $ISSUES -gt 0 ]]; then
  echo -e "${YELLOW}Setup completed with $ISSUES warning(s). Review the items above.${NC}"
else
  echo -e "${GREEN}All checks passed.${NC}"
fi

# ---- 8. Summary ------------------------------------------------------------

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "What's now available in Cursor:"
echo ""
echo "  Rules (auto-activate based on file path):"
echo "    18 domain-specific rules for API, Frontend, Infra, CI/CD"
echo "    Each rule triggers Compound Engineering specialists for quality validation"
echo ""
echo "  Agents (invoke manually in chat):"
echo "    @agent-new-endpoint    — Generate a complete API endpoint"
echo "    @agent-code-generation — Generate code following project patterns"
echo "    @agent-test-generation — Generate tests (pytest / Jest / Playwright)"
echo "    @agent-migration       — Generate Alembic database migrations"
echo "    @agent-i18n            — Manage translations"
echo "    @agent-adr             — Write Architecture Decision Records"
echo "    @pr-review             — Review a PR against team conventions"
echo "    Each agent runs a multi-gate quality pipeline using Compound Engineering"
echo ""
echo "  Notepads (reference in chat with @notepad-name):"
echo "    new-api-endpoint, new-frontend-page, new-form-field,"
echo "    new-database-table, debug-api-error, architecture-overview"
echo ""
echo "  Snippets (type prefix 'sgg-' to see all):"
echo "    sgg-route, sgg-service, sgg-model, sgg-component, etc."
echo ""
echo "  MCP Servers:"
echo "    simpler-grants-context — Architecture sections, rule lookup, conventions"
echo "    GitHub — PR review, issue lookup, repo context"
echo "    Filesystem — Architecture guide & detailed rule docs"
echo ""
echo "  Plugins:"
echo "    Compound Engineering — 15 specialist sub-agents for quality validation"
echo "    Compound Knowledge  — Documentation indexing for AI context enrichment"
echo ""
echo "  Documentation:"
echo "    docs/README.md      — Full documentation library (15 guides + appendix)"
echo ""
echo -e "Open ${BOLD}$MONOREPO_DIR${NC} in Cursor to get started."
echo ""
