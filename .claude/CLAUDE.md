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
