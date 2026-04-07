# Hooks Reference

The Simpler Grants AI Coding Toolkit uses Cursor hooks for deterministic quality enforcement. Anything that should happen EVERY time becomes a hook, not just a directive.

> **Source prompts:** The 6 hooks documented below were generated from the prompt backlog under [`cursor-tooling-prompts/hooks/`](../cursor-tooling-prompts/hooks/). Each prompt follows the 10-section contract in [`cursor-tooling-prompts/_META_PROMPT.md`](../cursor-tooling-prompts/_META_PROMPT.md) and is the contract-of-record if this reference and the prompt ever disagree.

## Architecture

- **Runtime:** Bun (TypeScript)
- **Pattern:** One dispatcher per event calls multiple handlers in sequence
- **Source:** `.cursor/hooks/`
- **Configuration:** `.cursor/hooks.json`
- **Logs:** `.cursor/hooks/logs/` (JSON Lines format)

## Events and Handlers

### beforeShellExecution

Runs before any shell command. Can block dangerous operations.

| Handler | Purpose | Action |
|---|---|---|
| `dangerous-command-guard` | Block rm -rf /, sudo, force push, terraform destroy | Deny |
| `environment-protection` | Block writes to .env, credentials, .pem files | Deny |
| `command-logger` | Audit trail of every shell command | Log |

### beforeMCPExecution

Runs before any MCP tool call. Can block out-of-scope access.

| Handler | Purpose | Action |
|---|---|---|
| `mcp-scope-guard` | Block filesystem access outside project directories | Deny |
| `mcp-tool-logger` | Track every MCP tool call | Log |

### beforeReadFile

Runs before the AI reads a file. Can modify content (only hook with this ability).

| Handler | Purpose | Action |
|---|---|---|
| `secret-redactor` | Block production secrets, redact API keys in .env files | Deny/Modify |
| `sensitive-file-guard` | Advisory messages for auth, migration, infra files | Advisory |

### beforeSubmitPrompt

Runs before a prompt is submitted to the AI.

| Handler | Purpose | Action |
|---|---|---|
| `prompt-enrichment-logger` | Log prompt metadata for session tracking | Log |

### afterFileEdit

Runs after any file edit. Notification-only — cannot modify files directly.

| Handler | Purpose | Action |
|---|---|---|
| `auto-formatter` | Run ruff/prettier/terraform fmt on edited files | Format |
| `convention-checker` | Check ~15 NEVER/ALWAYS violations (Python + TypeScript) | Warn |
| `import-validator` | Check import patterns match conventions | Warn |
| `test-pattern-checker` | Validate test naming, factories, assertions | Warn |
| `error-pattern-checker` | Validate error handling contract | Warn |
| `accessibility-checker` | Check a11y violations (onClick on div, missing alt, tabIndex>0) | Warn |
| `todo-scanner` | Track TODO/FIXME markers in edited files | Warn |

### stop

Runs when the agent session ends. Can take longer (up to 120s).

| Handler | Purpose | Action |
|---|---|---|
| `session-summary` | Git diff summary, new files list | Log |
| `test-runner` | Auto-run tests for changed API/frontend code | Test |
| `coverage-reporter` | Report coverage for changed code | Report |
| `audit-log-finalizer` | Close session audit log entry | Log |

## Shared Libraries

| Library | Purpose |
|---|---|
| `lib/config.ts` | All constants: timeouts, blocked patterns, secret patterns |
| `lib/logger.ts` | JSON Lines audit logging |
| `lib/file-classifier.ts` | Classify files by language, surface, domain, and type flags |

## Log Files

| File | Contents |
|---|---|
| `hooks.jsonl` | General hook activity log |
| `shell-audit.jsonl` | All shell commands executed |
| `mcp-audit.jsonl` | All MCP tool calls |
| `prompt-audit.jsonl` | Prompt submission metadata |
| `sessions.jsonl` | Session summaries (git diff stats) |
| `audit.jsonl` | Session start/end events |

## Setup

1. Install Bun: `curl -fsSL https://bun.sh/install | bash`
2. Install dependencies: `cd .cursor/hooks && bun install`
3. Hooks activate automatically via `.cursor/hooks.json`

## Troubleshooting

- **Hooks not running:** Ensure Bun is installed and on PATH
- **Timeout errors:** Handlers have a 5s timeout, dispatchers 10s, stop handlers 120s
- **False positives:** Convention checks use heuristic regex — disable individual handlers by commenting out their import in the dispatcher
- **Logs growing:** Periodically clear `.cursor/hooks/logs/`

## Additional Hooks

The following hooks live alongside the dispatcher-based handlers above and are registered individually in `.cursor/hooks.json`.

### `pre-commit-pii-scanner`

- **Event:** `beforeShellExecution`
- **Trigger:** shell command contains `git commit`
- **Behavior:** scans command text + `git diff --cached` for SSN / email / phone patterns; reads `.cursor/hooks/.pii-allowlist`; exit 2 blocks commit with `file:pattern` reason.
- **Bypass:** add synthetic value to `.cursor/hooks/.pii-allowlist` or set `PII_ALLOWLIST_FILE`.

### `pre-commit-convention-checker`

- **Event:** `beforeShellExecution`
- **Trigger:** shell command contains `git commit`, and there are staged `.py` / `.ts` / `.tsx` / `.js` / `.jsx` files
- **Behavior:** regex-scans staged files for hard convention violations; exit 2 blocks with `file:line [rule] message` list.
- **Bypass:** fix the violation; emergency unregister in `.cursor/hooks.json`.

### `background-accessibility-monitor`

- **Event:** `afterFileEdit`
- **Trigger:** edited file matches `frontend/**/*.{tsx,jsx}` and does not contain `a11y-monitor: disable`
- **Behavior:** WCAG 2.1 AA checks (alt, roles, tabIndex, href, label); advisory stderr + JSONL log at `.cursor/hooks/logs/a11y-violations.jsonl`.
- **Bypass:** `// a11y-monitor: disable` marker in the file.

### `background-test-runner`

- **Event:** `stop`
- **Trigger:** `git diff --name-only HEAD` shows touched files under `api/` or `frontend/`
- **Behavior:** spawns scoped test suites as detached background jobs; logs to `.cursor/hooks/logs/test-runner.log`; never blocks.
- **Bypass:** stash changes or unregister hook.

### `pr-auto-labeler`

- **Event:** `stop`
- **Trigger:** `gh` CLI present, not on main/master, open PR exists for current branch
- **Behavior:** derives labels from touched paths; calls `gh pr edit --add-label` (additive).
- **Bypass:** uninstall `gh` or unregister hook.

### `stale-documentation-detector`

- **Event:** `afterFileEdit`
- **Trigger:** edited file is under `api/` / `frontend/` / `src/` / `lib/` and not Markdown; `documentation/` or `docs/` exists
- **Behavior:** warns when referencing docs are older than `STALE_THRESHOLD_DAYS` (default 30).
- **Bypass:** update the doc, raise `STALE_THRESHOLD_DAYS`, or unregister hook.
