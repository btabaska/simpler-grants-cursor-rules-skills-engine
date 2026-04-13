#!/usr/bin/env bash
# Prints a PATH that includes the directory containing `node`.
# Designed to be sourced or used in MCP env blocks so that GUI apps
# (Cursor, VS Code) can find node/npx even when nvm/fnm/volta
# isn't on the default macOS GUI PATH.
set -euo pipefail

find_node_bin_dir() {
  # Already on PATH?
  if command -v node &>/dev/null; then
    dirname "$(command -v node)"
    return
  fi
  # nvm
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [[ -x "$d/node" ]] && { echo "$d"; return; }
  done
  # fnm
  for d in "$HOME"/Library/Application\ Support/fnm/node-versions/*/installation/bin; do
    [[ -x "$d/node" ]] && { echo "$d"; return; }
  done
  # volta
  [[ -x "$HOME/.volta/bin/node" ]] && { echo "$HOME/.volta/bin"; return; }
  # Homebrew
  [[ -x "/opt/homebrew/bin/node" ]] && { echo "/opt/homebrew/bin"; return; }
  [[ -x "/usr/local/bin/node" ]]    && { echo "/usr/local/bin"; return; }
  echo ""
}

NODE_BIN="$(find_node_bin_dir)"
if [[ -n "$NODE_BIN" ]]; then
  echo "$NODE_BIN:$PATH"
else
  echo "$PATH"
fi
