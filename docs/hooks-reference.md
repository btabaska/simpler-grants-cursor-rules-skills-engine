# Hooks Reference

The Simpler Grants AI Coding Toolkit uses Cursor hooks for deterministic quality enforcement. Anything that should happen EVERY time becomes a hook, not just a directive.

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
