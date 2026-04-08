# simpler-grants-gov — Claude Code project memory

_Generated from `.cursorrules` by `scripts/build-claude-target.py`._

# simpler-grants-gov — Cursor Configuration

This project uses Cursor's full primitive system for AI-assisted development.

## Directory Structure

- **`.claude/rules/`** — Passive coding conventions. Auto-activate based on file path globs. Define ALWAYS/NEVER/MUST directives for each domain.
- **`.claude/agents/`** — Specialist subagents for complex multi-step tasks. Discovered automatically. Start with the orchestrator if unsure which agent to use.
- **`.claude/commands/`** — Slash commands (`/debug`, `/refactor`, `/new-endpoint`, `/generate`, `/test`, `/migration`, `/i18n`, `/adr`, `/review-pr`). Quick intake forms that route to agents and skills.
- **`.claude/skills/`** — Multi-step workflows with supporting files. PR review, quality gates, onboarding, flag cleanup.
- **`.claude/hooks.json`** — Automatic lifecycle hooks powered by Bun/TypeScript dispatchers. 19 handlers across 6 events enforce security guardrails, convention compliance, and audit logging.
- **`.claude/mcp.json`** — MCP servers for project context, GitHub, and filesystem access.

## Key Global Conventions (always apply)

- Structured logging: static messages + flat snake_case `extra={}` keys. No PII in logs.
- Error handling: ALWAYS use `raise_flask_error()` with `ValidationErrorDetail` in the API.
- Testing: tests ship with code in the same PR. Use factory `.build()` over `.create()`.
- Frontend: server-first rendering. USWDS components preferred. No barrel files.
- Feature flags: flags live in service layer. Use the flag-cleanup skill when removing.
- Naming: boolean fields use `is_*` / `has_*`. camelCase in TypeScript, snake_case in Python.
- PRs: title format `[Issue N] Description`. Trunk-based development to `main`.

## Tool-calling contract (MUST follow)

These rules are non-negotiable. They exist because the project relies on live MCP
context to stay correct, and fabricated tool output is worse than no tool output.

- ALWAYS call `get_rules_for_file(path)` from the `simpler-grants-context` MCP server
  BEFORE proposing or making any edit to a file under `api/`, `frontend/`, `infra/`,
  or `.github/`. Do not answer from memory about project conventions when a rule file
  exists — cite the rule by path.
- ALWAYS call `get_architecture_section(section)` BEFORE answering architecture
  questions or before investigating a bug whose domain you have not already loaded
  in this session.
- NEVER fabricate the output of an MCP tool, a slash command, an agent, or a hook.
  If a required tool call fails, is unavailable, or returns empty, you MUST say so
  explicitly ("`<tool>` unavailable — cannot proceed without it") and stop. Do not
  guess what the tool would have returned.
- NEVER claim a file, function, rule, or tool exists without having read it or
  listed it this session. Verify first, cite second.
- When the user's intent matches the routing table below, you MUST invoke the listed
  entry point rather than answering directly from memory.

### Intent → tool routing

| User intent                                   | Required entry point      | Fallback if unavailable |
|------------------------------------------------|---------------------------|-------------------------|
| Report a bug / stack trace / failing test      | `/debug`                  | State MCP missing; ask for repro details and stop |
| Add a new API endpoint                         | `/new-endpoint`           | State MCP missing; stop |
| Restructure / rename across files              | `/refactor`               | State MCP missing; stop |
| Generate production code following conventions | `/generate`               | State MCP missing; stop |
| Write or fix tests                             | `/test`                   | State MCP missing; stop |
| Database schema change                         | `/migration`              | State MCP missing; stop |
| Add or modify user-facing strings              | `/i18n`                   | State MCP missing; stop |
| Document an architectural decision             | `/adr`                    | State MCP missing; stop |
| Review a PR / branch                           | `/review-pr`              | State MCP missing; stop |
| Check a file against conventions               | `/check-conventions`      | State MCP missing; stop |
| Explain how a file fits in the project         | `/explain-architecture`   | State MCP missing; stop |
| Verify toolkit / diagnose config drift         | `/tooling-health-check`   | Run `bun run .claude/hooks/health-check.ts --summary` directly |

If the user's intent clearly matches one of these rows, invoking the entry point
is MANDATORY. "The user didn't literally type the slash command" is not an excuse
to skip the specialist.

## Quick Start

- `/debug` — investigate a bug
- `/refactor` — restructure code safely
- `/new-endpoint` — scaffold a new API endpoint
- `/generate` — generate code following project patterns
- `/test` — generate tests for existing code
- `/migration` — generate a database migration
- `/i18n` — add or modify translations
- `/adr` — write an Architecture Decision Record
- `/review-pr` — run a full code review
- `/check-conventions` — check a file against project rules
- `/explain-architecture` — understand how a file fits in the project
- `/tooling-health-check` — verify toolkit setup and diagnose configuration issues

## MCP Tools

- `get_architecture_section(section)` — load architecture documentation
- `get_rules_for_file(file_path)` — get applicable rules for a file
- `get_rule_detail(rule_name)` — get full rule content
- `get_conventions_summary()` — get cross-cutting conventions
- `list_rules()` — list all available rules
- `list_agents()` — list available subagents
- `list_commands()` — list available slash commands
- `list_skills()` — list available skills

## Hooks (Deterministic Enforcement)

Hooks run automatically on every Cursor lifecycle event. They enforce conventions that must ALWAYS apply — no directive fatigue, no forgotten checks.

| Event | Dispatcher | Handlers |
|---|---|---|
| `beforeShellExecution` | `before-shell.ts` | dangerous-command-guard, environment-protection, command-logger |
| `beforeMCPExecution` | `before-mcp.ts` | mcp-scope-guard, mcp-tool-logger |
| `beforeReadFile` | `before-read-file.ts` | secret-redactor, sensitive-file-guard |
| `beforeSubmitPrompt` | `before-submit-prompt.ts` | prompt-enrichment-logger |
| `afterFileEdit` | `after-file-edit.ts` | auto-formatter, convention-checker, import-validator, test-pattern-checker, error-pattern-checker, accessibility-checker, todo-scanner |
| `stop` | `on-stop.ts` | session-summary, test-runner, coverage-reporter, audit-log-finalizer |

Hooks require [Bun](https://bun.sh) runtime. Source: `.claude/hooks/`. Logs: `.claude/hooks/logs/`.

**Cursor vs. Claude Code hook parity.** Only `beforeShellExecution`, `afterFileEdit`,
and `stop` are wired under Claude Code (remapped by `scripts/build-claude-target.py`
to `PreToolUse`, `PostToolUse`, and `Stop`). The `beforeMCPExecution`, `beforeReadFile`,
and `beforeSubmitPrompt` dispatchers ship in this repo but **DO NOT RUN** under Claude
Code — they are Cursor-IDE-only. Do not rely on `secret-redactor`, `sensitive-file-guard`,
`mcp-scope-guard`, or `prompt-enrichment-logger` when running under Claude Code.
The `/tooling-health-check` command surfaces this gap explicitly.

## Maintenance

- `.claude/` is **source-of-truth**. Never hand-edit anything under `.claude/` — it is
  regenerated by `scripts/build-claude-target.py` and any local edits will be lost.
- After any change under `.claude/`, run `python3 scripts/build-claude-target.py` and
  commit the resulting `.claude/` updates in the same PR.
- Before opening a PR, run `python3 scripts/check-tooling-inventory.py`. It runs both
  the self-enumerating health check and the generation-sync check; non-zero exit
  indicates drift.
- The health check enumerates rules, agents, commands, skills, and dispatchers from
  the filesystem. Adding a new primitive does **not** require a code change in the
  health check — it is picked up automatically. If you add a new dispatcher or a new
  MCP tool that agents are expected to call, add a row to the "Tool-calling contract"
  routing table above so the routing stays explicit.

## Architecture

For project architecture and philosophy, see `documentation/architecture-guide.md`.
For domain-specific conventions with rationale, see `documentation/rules/*.md`.
For hook system documentation, see `docs/hooks-reference.md`.


## Rule index (auto-generated)

- `skills/rule-accessibility/` — see `.claude/skills/rule-accessibility/SKILL.md`
- `skills/rule-api-adapters/` — see `.claude/skills/rule-api-adapters/SKILL.md`
- `skills/rule-api-auth/` — see `.claude/skills/rule-api-auth/SKILL.md`
- `skills/rule-api-cli/` — see `.claude/skills/rule-api-cli/SKILL.md`
- `skills/rule-api-constants/` — see `.claude/skills/rule-api-constants/SKILL.md`
- `skills/rule-api-database/` — see `.claude/skills/rule-api-database/SKILL.md`
- `skills/rule-api-error-handling/` — see `.claude/skills/rule-api-error-handling/SKILL.md`
- `skills/rule-api-form-schema/` — see `.claude/skills/rule-api-form-schema/SKILL.md`
- `skills/rule-api-logging/` — see `.claude/skills/rule-api-logging/SKILL.md`
- `skills/rule-api-routes/` — see `.claude/skills/rule-api-routes/SKILL.md`
- `skills/rule-api-search/` — see `.claude/skills/rule-api-search/SKILL.md`
- `skills/rule-api-services/` — see `.claude/skills/rule-api-services/SKILL.md`
- `skills/rule-api-tasks/` — see `.claude/skills/rule-api-tasks/SKILL.md`
- `skills/rule-api-tests/` — see `.claude/skills/rule-api-tests/SKILL.md`
- `skills/rule-api-validation/` — see `.claude/skills/rule-api-validation/SKILL.md`
- `skills/rule-api-workflow/` — see `.claude/skills/rule-api-workflow/SKILL.md`
- `skills/rule-ci-cd/` — see `.claude/skills/rule-ci-cd/SKILL.md`
- `skills/rule-cross-domain/` — see `.claude/skills/rule-cross-domain/SKILL.md`
- `skills/rule-data-privacy/` — see `.claude/skills/rule-data-privacy/SKILL.md`
- `skills/rule-docker/` — see `.claude/skills/rule-docker/SKILL.md`
- `skills/rule-fedramp/` — see `.claude/skills/rule-fedramp/SKILL.md`
- `skills/rule-forms-vertical/` — see `.claude/skills/rule-forms-vertical/SKILL.md`
- `skills/rule-frontend-app-pages/` — see `.claude/skills/rule-frontend-app-pages/SKILL.md`
- `skills/rule-frontend-components/` — see `.claude/skills/rule-frontend-components/SKILL.md`
- `skills/rule-frontend-e2e-tests/` — see `.claude/skills/rule-frontend-e2e-tests/SKILL.md`
- `skills/rule-frontend-hooks/` — see `.claude/skills/rule-frontend-hooks/SKILL.md`
- `skills/rule-frontend-i18n/` — see `.claude/skills/rule-frontend-i18n/SKILL.md`
- `skills/rule-frontend-services/` — see `.claude/skills/rule-frontend-services/SKILL.md`
- `skills/rule-frontend-storybook/` — see `.claude/skills/rule-frontend-storybook/SKILL.md`
- `skills/rule-frontend-styles/` — see `.claude/skills/rule-frontend-styles/SKILL.md`
- `skills/rule-frontend-tests/` — see `.claude/skills/rule-frontend-tests/SKILL.md`
- `skills/rule-frontend-types/` — see `.claude/skills/rule-frontend-types/SKILL.md`
- `skills/rule-frontend-utils/` — see `.claude/skills/rule-frontend-utils/SKILL.md`
- `skills/rule-github-issues/` — see `.claude/skills/rule-github-issues/SKILL.md`
- `skills/rule-infra/` — see `.claude/skills/rule-infra/SKILL.md`
- `skills/rule-makefile/` — see `.claude/skills/rule-makefile/SKILL.md`
- `skills/rule-openapi/` — see `.claude/skills/rule-openapi/SKILL.md`
- `skills/rule-performance/` — see `.claude/skills/rule-performance/SKILL.md`
- `skills/rule-security/` — see `.claude/skills/rule-security/SKILL.md`
