# /tooling-health-check

Diagnose drift and configuration problems in the Simpler Grants AI coding toolkit.

## What this command does

Runs `bun run .cursor/hooks/health-check.ts` and reports the results. The health
check is **self-enumerating** — it discovers rules, agents, commands, skills,
dispatchers, handlers, and MCP servers from the filesystem rather than hardcoding
lists. Adding a new primitive does not require a code change in the health check;
it is picked up on the next run.

## Dual-tree model

This repo has two parallel AI config trees:

- **`.cursor/`** — source-of-truth. Edit this.
- **`.claude/`** — generated from `.cursor/` by `scripts/build-claude-target.py`.
  **Never hand-edit.** Regenerate after any `.cursor/` change.

The health check validates `.cursor/` and cross-checks that `.claude/` is in sync.

## How to run

```bash
# JSON output (for tools / CI):
bun run .cursor/hooks/health-check.ts

# Human-readable summary:
bun run .cursor/hooks/health-check.ts --summary

# CI mode — exits non-zero if any check fails:
bun run .cursor/hooks/health-check.ts --ci
```

Or, end-to-end with the generation-sync check wrapped in one script:

```bash
python3 scripts/check-tooling-inventory.py
```

## What it checks

1. **Runtime dependencies** — node, npm, python3, pip, bun, ruff, terraform, jq,
   git, gh. Minimum versions verified where applicable.
2. **Directory structure** — required `.cursor/` subdirectories and core files
   (`.cursorrules`, `hooks.json`, `mcp.json`, `build-claude-target.py`, etc.) exist.
   Inventory counts are reported (not hardcoded).
3. **Rule integrity** — every `.cursor/rules/*.mdc` has valid frontmatter
   (`description`, `alwaysApply`), sufficient body length, and either globs or
   `alwaysApply: true` so it actually activates.
4. **Agent integrity** — every `.cursor/agents/*.md` has `name` and `description`
   in frontmatter and non-trivial body.
5. **Command integrity** — every `.cursor/commands/*.md` is non-trivial Markdown.
6. **Skill integrity** — every `.cursor/skills/*/SKILL.md` has `name` and
   `description` and a non-trivial body.
7. **Hooks integrity** — every dispatcher under `.cursor/hooks/dispatchers/` is
   executable, **every handler it imports actually exists on disk** (catches the
   class of bug where a renamed handler crashes a dispatcher at runtime), and
   `hooks.json` parses as valid JSON.
8. **Claude Code hook parity** — explicitly reports which Cursor hook events
   run under Claude Code and which are DROPPED (`beforeMCPExecution`,
   `beforeReadFile`, `beforeSubmitPrompt`). Cross-checks
   `scripts/build-claude-target.py`'s `HOOK_EVENT_MAP` for agreement.
9. **MCP configuration** — `mcp.json` parses, servers are defined, and every tool
   name referenced in `.cursorrules` under "## MCP Tools" is listed. `.mcp.json`
   mirror for Claude Code is present.
10. **Generation pipeline sync** — runs `python3 scripts/build-claude-target.py --check`
    and fails if `.claude/` has drifted from `.cursor/`.
11. **Repository health** — git status, current branch.

## What it does NOT check

- Runtime connectivity to MCP servers (agent-level concern — call `list_rules()`
  yourself if you need to verify a server is alive).
- Plugin state inside the Cursor desktop app.
- That the Python interpreter has packages required for the API — this script is
  stdlib-only; API deps belong in `api/requirements.txt`.

## How to fix common failures

- **Dispatcher import broken** → a handler file was renamed or deleted. Fix the
  import in the dispatcher or restore the handler.
- **`.claude/` drift** → run `python3 scripts/build-claude-target.py` and commit.
- **Rule without globs and `alwaysApply: false`** → the rule will never activate.
  Either add a `globs:` line or set `alwaysApply: true`.
- **Hook parity warning about dropped events** → expected. Just confirms Claude
  Code cannot run the `beforeMCPExecution` / `beforeReadFile` / `beforeSubmitPrompt`
  dispatchers. If you need them under Claude, wire them via `UserPromptSubmit` or
  a wrapper — see `.claude/hooks/README.md`.

## Where things live

| Thing | Location |
|---|---|
| Diagnostic logic | `.cursor/hooks/health-check.ts` |
| Command doc (this file) | `.cursor/commands/tooling-health-check.md` |
| Generation script | `scripts/build-claude-target.py` |
| CI wrapper | `scripts/check-tooling-inventory.py` |
| Event mapping | `HOOK_EVENT_MAP` in `scripts/build-claude-target.py` |
