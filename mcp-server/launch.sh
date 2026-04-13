#!/usr/bin/env bash
# MCP server launcher — resolves node/tsx even when launched from a GUI app
# (Cursor, VS Code) that doesn't inherit shell PATH with nvm/fnm/volta.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# Try to find node on PATH first; fall back to common version-manager locations.
find_node() {
  if command -v node &>/dev/null; then
    command -v node
    return
  fi
  # nvm
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    if [[ -x "$d/node" ]]; then echo "$d/node"; return; fi
  done
  # fnm
  for d in "$HOME"/Library/Application\ Support/fnm/node-versions/*/installation/bin; do
    if [[ -x "$d/node" ]]; then echo "$d/node"; return; fi
  done
  # volta
  if [[ -x "$HOME/.volta/bin/node" ]]; then echo "$HOME/.volta/bin/node"; return; fi
  # Homebrew
  if [[ -x "/opt/homebrew/bin/node" ]]; then echo "/opt/homebrew/bin/node"; return; fi
  if [[ -x "/usr/local/bin/node" ]]; then echo "/usr/local/bin/node"; return; fi
  echo "node"  # last resort — hope it's on PATH
}

NODE="$(find_node)"
TSX="$DIR/node_modules/.bin/tsx"

if [[ ! -x "$TSX" ]]; then
  echo "tsx not found at $TSX — run: cd $DIR && npm install" >&2
  exit 1
fi

exec "$NODE" "$TSX" "$DIR/src/index.ts"
