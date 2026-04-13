#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Simpler.Grants.gov AI Coding Toolkit — Setup Script
#
# Installs the toolkit (rules, agents, skills, commands, hooks, MCP servers)
# into your local clone of the simpler-grants-gov monorepo for either Cursor,
# Claude Code, or both.
#
# Usage:
#   ./setup.sh                          # interactive
#   ./setup.sh --target=cursor          # cursor only
#   ./setup.sh --target=claude          # claude code only
#   ./setup.sh --target=both            # install both
#   TOOLKIT_TARGET=claude ./setup.sh    # via env var
# ============================================================================

TOOLKIT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TARGET="${TOOLKIT_TARGET:-}"

# ---- Argument parsing ------------------------------------------------------
for arg in "$@"; do
  case "$arg" in
    --target=*) TARGET="${arg#--target=}" ;;
    --monorepo=*) MONOREPO_DIR="${arg#--monorepo=}" ;;
    -h|--help)
      sed -n '4,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

echo ""
echo -e "${BOLD}Simpler.Grants.gov AI Coding Toolkit — Setup${NC}"
echo "============================================="
echo ""

# ---- 0. Choose target ------------------------------------------------------

prompt_target() {
  echo "Which assistant are you installing the toolkit for?"
  echo "  1) Cursor"
  echo "  2) Claude Code"
  echo "  3) Both"
  read -rp "Choice [1/2/3]: " CHOICE
  case "$CHOICE" in
    1) TARGET="cursor" ;;
    2) TARGET="claude" ;;
    3) TARGET="both" ;;
    *) echo -e "${RED}Invalid choice.${NC}"; exit 1 ;;
  esac
}

case "${TARGET:-}" in
  cursor|claude|both) ;;
  "") prompt_target ;;
  *) echo -e "${RED}Invalid --target=$TARGET (expected cursor|claude|both)${NC}"; exit 1 ;;
esac

INSTALL_CURSOR=false
INSTALL_CLAUDE=false
[[ "$TARGET" == "cursor" || "$TARGET" == "both" ]] && INSTALL_CURSOR=true
[[ "$TARGET" == "claude" || "$TARGET" == "both" ]] && INSTALL_CLAUDE=true

echo -e "Target: ${GREEN}${TARGET}${NC}"
echo ""

# ---- 1. Locate the monorepo ------------------------------------------------

if [[ -z "${MONOREPO_DIR:-}" ]]; then
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
fi

if [[ -z "${MONOREPO_DIR:-}" ]]; then
  echo -e "${YELLOW}Could not auto-detect the simpler-grants-gov monorepo.${NC}"
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
command -v node &>/dev/null || MISSING+=("node (required for MCP servers)")
command -v npx  &>/dev/null || MISSING+=("npx (required for MCP servers)")

if [[ ${#MISSING[@]} -gt 0 ]]; then
  echo -e "${YELLOW}Warning: Missing prerequisites:${NC}"
  for item in "${MISSING[@]}"; do echo "  - $item"; done
  echo ""
fi

if [[ -z "${GITHUB_PAT:-}" ]]; then
  echo -e "${YELLOW}Note: GITHUB_PAT environment variable is not set.${NC}"
  echo "The GitHub MCP server needs this to access HHS/simpler-grants-gov."
  echo ""
fi

# ---- 3. Regenerate Claude Code tree if installing claude target ------------

if $INSTALL_CLAUDE; then
  if command -v python3 &>/dev/null; then
    echo -e "${BOLD}Regenerating .claude/ from .cursor/...${NC}"
    python3 "$TOOLKIT_DIR/scripts/build-claude-target.py" 2>&1 | sed 's/^/  /'
    echo ""
  else
    echo -e "${YELLOW}python3 not found — using committed .claude/ tree as-is.${NC}"
    echo ""
  fi
fi

# ---- 4. Symlink helpers ----------------------------------------------------

backup_if_real() {
  local dest="$1"
  if [[ -e "$dest" && ! -L "$dest" ]]; then
    local backup="$dest.backup.$(date +%Y%m%d%H%M%S)"
    echo -e "  ${YELLOW}Backing up existing $(basename "$dest") → $backup${NC}"
    mv "$dest" "$backup"
  elif [[ -L "$dest" ]]; then
    rm "$dest"
  fi
}

link() {
  local src="$1" dest="$2"
  backup_if_real "$dest"
  ln -s "$src" "$dest"
  echo -e "  ${GREEN}✓${NC} $(basename "$dest") → toolkit"
}

install_cursor() {
  echo -e "${BOLD}Installing Cursor target...${NC}"
  link "$TOOLKIT_DIR/.cursor"      "$MONOREPO_DIR/.cursor"
  link "$TOOLKIT_DIR/.cursorrules" "$MONOREPO_DIR/.cursorrules"
  if [[ ! -e "$MONOREPO_DIR/documentation" ]]; then
    ln -s "$TOOLKIT_DIR/documentation" "$MONOREPO_DIR/documentation"
    echo -e "  ${GREEN}✓${NC} documentation/ → toolkit"
  elif [[ -L "$MONOREPO_DIR/documentation" ]]; then
    rm "$MONOREPO_DIR/documentation"
    ln -s "$TOOLKIT_DIR/documentation" "$MONOREPO_DIR/documentation"
    echo -e "  ${GREEN}✓${NC} documentation/ → toolkit (replaced)"
  else
    echo -e "  ${YELLOW}⚠${NC} documentation/ already exists in monorepo, skipping"
  fi
  echo ""
}

install_claude() {
  echo -e "${BOLD}Installing Claude Code target...${NC}"
  # Preserve user's settings.local.json if present in monorepo's .claude
  if [[ -f "$MONOREPO_DIR/.claude/settings.local.json" && ! -L "$MONOREPO_DIR/.claude" ]]; then
    local backup="$MONOREPO_DIR/.claude/settings.local.json.backup.$(date +%Y%m%d%H%M%S)"
    cp "$MONOREPO_DIR/.claude/settings.local.json" "$backup"
    echo -e "  ${YELLOW}Backed up settings.local.json → $backup${NC}"
  fi
  link "$TOOLKIT_DIR/.claude"   "$MONOREPO_DIR/.claude"
  link "$TOOLKIT_DIR/.mcp.json" "$MONOREPO_DIR/.mcp.json"
  echo ""
}

# ---- 5. Run install --------------------------------------------------------

$INSTALL_CURSOR && install_cursor
$INSTALL_CLAUDE && install_claude

# ---- 6. Build MCP server ---------------------------------------------------

if [[ -f "$TOOLKIT_DIR/mcp-server/package.json" ]]; then
  echo -e "${BOLD}Building custom MCP server...${NC}"
  (cd "$TOOLKIT_DIR/mcp-server" && npm install && npm run build) 2>&1 | sed 's/^/  /'
  echo -e "  ${GREEN}✓${NC} MCP server built"
  echo ""
fi

# ---- 6b. Expose mcp-server to the monorepo --------------------------------
# Both .mcp.json and .cursor/mcp.json reference ./mcp-server/dist/index.js
# relative to the monorepo CWD, so the built server must be reachable from
# there for the simpler-grants-context MCP server to launch.
if [[ -d "$TOOLKIT_DIR/mcp-server" ]]; then
  echo -e "${BOLD}Linking mcp-server into monorepo...${NC}"
  link "$TOOLKIT_DIR/mcp-server" "$MONOREPO_DIR/mcp-server"
  echo ""
fi

# ---- 7. Optional git hooks -------------------------------------------------

if [[ -d "$TOOLKIT_DIR/.githooks" ]]; then
  read -rp "Install optional git hooks for convention validation? (y/N) " INSTALL_HOOKS
  if [[ "$INSTALL_HOOKS" =~ ^[Yy]$ ]]; then
    git -C "$MONOREPO_DIR" config core.hooksPath "$TOOLKIT_DIR/.githooks"
    echo -e "  ${GREEN}✓${NC} Git hooks installed"
  fi
  echo ""
fi

# ---- 8. Cursor plugin reminder (cursor target only) ------------------------

if $INSTALL_CURSOR; then
  echo ""
  echo -e "${BOLD}Enable MCP servers in Cursor${NC}"
  echo ""
  echo "Cursor does not auto-enable MCP servers from .cursor/mcp.json. After"
  echo "opening the monorepo in Cursor:"
  echo ""
  echo "  1. Open Settings → MCP"
  echo "  2. Ensure 'simpler-grants-context' is enabled (toggle it on)"
  echo "     — also enable 'github' and 'filesystem' if you want them"
  echo "  3. Click 'Reload MCP Servers' (or run 'Developer: Reload Window')"
  echo "  4. If simpler-grants-context still fails, reinstall deps:"
  echo "       cd $TOOLKIT_DIR/mcp-server && npm install"
  echo "     then reload MCP servers again (tsx runs from source, no build needed)"
  echo ""
  echo "Verify by asking Cursor to call simpler-grants-context list_rules —"
  echo "it should return the rule index instead of 'tool unavailable'."
  echo ""
  read -rp "Press Enter once MCP servers are enabled (or 's' to skip): " MCP_RESPONSE
  if [[ "$MCP_RESPONSE" =~ ^[Ss]$ ]]; then
    echo -e "  ${YELLOW}Skipped — slash commands and rule routing will fail until MCP is enabled${NC}"
  else
    echo -e "  ${GREEN}✓${NC} MCP enablement acknowledged"
  fi
  echo ""

  echo -e "${BOLD}Required Cursor Plugins${NC}"
  echo ""
  echo "The toolkit uses two Cursor community plugins for the full quality"
  echo "gate pipelines:"
  echo ""
  echo "  Plugin 1: Compound Engineering — 15 specialist review sub-agents"
  echo "    Install: Cursor Settings → Extensions → search 'compound-engineering'"
  echo "    Verify:  Type @compound in chat — specialists appear in autocomplete"
  echo ""
  echo "  Plugin 2: Compound Knowledge — Documentation indexing"
  echo "    Install: Cursor Settings → Extensions → search 'compound-knowledge'"
  echo "    Index:   Add documentation/ and .cursor/rules/ to the knowledge index"
  echo ""
  read -rp "Press Enter after installing both plugins (or 's' to skip): " PLUGIN_RESPONSE
  if [[ "$PLUGIN_RESPONSE" =~ ^[Ss]$ ]]; then
    echo -e "  ${YELLOW}Skipped — agents will work but without specialist validation${NC}"
  else
    echo -e "  ${GREEN}✓${NC} Plugins acknowledged"
  fi
  echo ""
fi

# ---- 9. Verification -------------------------------------------------------

ISSUES=0

verify_cursor() {
  echo -e "${BOLD}Verifying Cursor installation...${NC}"
  for target in ".cursor" ".cursorrules" "documentation"; do
    if [[ -L "$MONOREPO_DIR/$target" ]]; then
      echo -e "  ${GREEN}✓${NC} $target symlink exists"
    else
      echo -e "  ${RED}✗${NC} $target symlink missing"
      ISSUES=$((ISSUES + 1))
    fi
  done
  local rule_count agent_count skill_count cmd_count notepad_count snippet_count
  rule_count=$(ls -1 "$TOOLKIT_DIR/.cursor/rules/"*.mdc 2>/dev/null | wc -l | tr -d ' ')
  agent_count=$(ls -1 "$TOOLKIT_DIR/.cursor/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
  skill_count=$(ls -1d "$TOOLKIT_DIR/.cursor/skills/"*/ 2>/dev/null | wc -l | tr -d ' ')
  cmd_count=$(ls -1 "$TOOLKIT_DIR/.cursor/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
  notepad_count=$(ls -1 "$TOOLKIT_DIR/.cursor/notepads/"*.md 2>/dev/null | wc -l | tr -d ' ')
  snippet_count=$(ls -1 "$TOOLKIT_DIR/.cursor/snippets/"*.code-snippets 2>/dev/null | wc -l | tr -d ' ')
  echo -e "  ${GREEN}✓${NC} $rule_count domain rules, $agent_count agents, $skill_count skills, $cmd_count commands"
  echo -e "  ${GREEN}✓${NC} $notepad_count notepads, $snippet_count snippet files"
  [[ -f "$TOOLKIT_DIR/.cursor/hooks.json" ]] && echo -e "  ${GREEN}✓${NC} hooks.json present"
}

verify_claude() {
  echo -e "${BOLD}Verifying Claude Code installation...${NC}"
  for target in ".claude" ".mcp.json"; do
    if [[ -L "$MONOREPO_DIR/$target" ]]; then
      echo -e "  ${GREEN}✓${NC} $target symlink exists"
    else
      echo -e "  ${RED}✗${NC} $target symlink missing"
      ISSUES=$((ISSUES + 1))
    fi
  done
  local agent_count skill_count cmd_count
  agent_count=$(ls -1 "$TOOLKIT_DIR/.claude/agents/"*.md 2>/dev/null | wc -l | tr -d ' ')
  skill_count=$(ls -1 "$TOOLKIT_DIR/.claude/skills/"*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
  cmd_count=$(ls -1 "$TOOLKIT_DIR/.claude/commands/"*.md 2>/dev/null | wc -l | tr -d ' ')
  echo -e "  ${GREEN}✓${NC} $agent_count agents, $skill_count skills, $cmd_count slash commands"
  [[ -f "$TOOLKIT_DIR/.claude/CLAUDE.md" ]]    && echo -e "  ${GREEN}✓${NC} CLAUDE.md present"     || ISSUES=$((ISSUES + 1))
  [[ -f "$TOOLKIT_DIR/.claude/settings.json" ]] && echo -e "  ${GREEN}✓${NC} settings.json present" || ISSUES=$((ISSUES + 1))
  [[ -f "$TOOLKIT_DIR/.mcp.json" ]]            && echo -e "  ${GREEN}✓${NC} .mcp.json present"      || ISSUES=$((ISSUES + 1))
}

if [[ -f "$TOOLKIT_DIR/mcp-server/src/index.ts" ]]; then
  if [[ -d "$TOOLKIT_DIR/mcp-server/node_modules" ]]; then
    echo -e "  ${GREEN}✓${NC} Custom MCP server dependencies installed"
  else
    echo -e "  ${YELLOW}⚠${NC} MCP server dependencies missing — run: cd mcp-server && npm install"
  fi
  if [[ -f "$TOOLKIT_DIR/mcp-server/dist/index.js" ]]; then
    echo -e "  ${GREEN}✓${NC} Custom MCP server compiled (dist/)"
  else
    echo -e "  ${YELLOW}⚠${NC} MCP server not compiled (tsx will run from source instead)"
  fi
fi

if [[ -L "$MONOREPO_DIR/mcp-server" && -f "$MONOREPO_DIR/mcp-server/src/index.ts" ]]; then
  echo -e "  ${GREEN}✓${NC} mcp-server symlink resolves to server source"
else
  echo -e "  ${RED}✗${NC} mcp-server symlink missing or server source not found in monorepo"
  ISSUES=$((ISSUES + 1))
fi

$INSTALL_CURSOR && verify_cursor
$INSTALL_CLAUDE && verify_claude

echo ""
if [[ $ISSUES -gt 0 ]]; then
  echo -e "${YELLOW}Setup completed with $ISSUES warning(s).${NC}"
else
  echo -e "${GREEN}All checks passed.${NC}"
fi

# ---- 10. Summary -----------------------------------------------------------

echo ""
echo -e "${GREEN}${BOLD}Setup complete!${NC}"
echo ""
echo "Slash commands available in either assistant:"
echo "  /new-endpoint /generate /test /migration /i18n /adr /debug /refactor /review-pr"
echo ""
echo "MCP servers (configured for the chosen target):"
echo "  simpler-grants-context, github, filesystem"
echo ""
if $INSTALL_CURSOR; then
  echo "Cursor: open $MONOREPO_DIR in Cursor."
fi
if $INSTALL_CLAUDE; then
  echo "Claude Code: cd $MONOREPO_DIR && claude"
fi
echo ""
echo "Documentation: docs/README.md (start at docs/03-getting-started.md)"
echo ""
