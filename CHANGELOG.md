# Changelog

## v1.1.0 — 2026-04-06

### Cursor Five-Primitive Migration

Migrated from a flat `.mdc` rule file layout to Cursor's five-primitive system (Rules, Agents, Skills, Commands, Hooks).

**New Domain Rules (6 files added, total now 24)**
- `accessibility` — WCAG 2.1 AA / Section 508 compliance for frontend code
- `api-adapters` — External service adapter patterns
- `api-search` — OpenSearch integration patterns
- `api-tasks` — Background task patterns
- `api-workflow` — Workflow orchestration patterns
- `frontend-app-pages` — Next.js App Router pages and layouts
- `frontend-e2e-tests` — Playwright E2E test patterns
- Removed `pr-review.mdc` from rules (moved to skills)

**Standalone Agents (9 files, migrated from `.cursor/rules/agent-*.mdc` to `.cursor/agents/*.md`)**
- Existing agents migrated: new-endpoint, code-generation, test-generation, migration, i18n, adr
- New agents added: `orchestrator` (task routing), `debugging` (error investigation), `refactor` (multi-file structural changes)
- All agents now include pre-flight MCP context loading and quality gate pipelines

**Skills (4 new, in `.cursor/skills/`)**
- `pr-review` — Comprehensive code review with dispatch table and specialist passes
- `quality-gate` — Multi-gate validation pipeline using Compound Engineering specialists
- `flag-cleanup` — Feature flag removal workflow
- `onboarding` — Guided developer onboarding

**Slash Commands (12 new, in `.cursor/commands/`)**
- `/debug`, `/refactor`, `/new-endpoint`, `/generate`, `/test`, `/migration`, `/i18n`, `/adr`
- `/review-pr`, `/check-conventions`, `/tooling-health-check`, `/explain-architecture`

**Hook Lifecycle Events (6 new, in `.cursor/hooks/`)**
- `beforeShellExecution` — Dangerous command guard, environment protection
- `beforeMCPExecution` — Scope guard for MCP tool access
- `beforeReadFile` — Secret redaction and sensitive file protection
- `beforeSubmitPrompt` — Prompt audit logging
- `afterFileEdit` — Auto-format, convention checks, import validation, accessibility, TODO scanning
- `stop` — Session summary, test runner, coverage reporter, audit log finalization

**MCP Server Enhancements (5 new tools, total now 10)**
- `list_agents()`, `list_commands()`, `list_skills()`, `get_agent_detail()`, `get_skill_detail()`

**Documentation**
- Added `docs/hooks-reference.md` and `docs/hook-coverage-matrix.md`
- Documentation library now contains 20 files (15 numbered guides + 2 hook docs + 2 appendices + index)

---

## v1.0.0 — 2026-04-02

### Initial Release

**Domain Rules (18 files)**
- API: routes, services, database, auth, validation, error-handling, form-schema, tests
- Frontend: components, hooks, services, i18n, tests
- Infrastructure: infra, ci-cd
- Cross-cutting: cross-domain, forms-vertical, pr-review

**Custom Agents (6 files)**
- `agent-new-endpoint` — Complete API endpoint generation workflow
- `agent-code-generation` — Domain-aware code generation with rule dispatch
- `agent-test-generation` — pytest and Jest/Playwright test patterns
- `agent-migration` — Alembic migration generation
- `agent-i18n` — Translation management
- `agent-adr` — Architecture Decision Record writing

**Notepads (6 files)**
- architecture-overview, new-api-endpoint, new-frontend-page, new-form-field, new-database-table, debug-api-error

**Code Snippets (15 snippets)**
- Python: sgg-route, sgg-service, sgg-model, sgg-schema, sgg-test, sgg-migration, sgg-log, sgg-error
- TypeScript: sgg-component, sgg-client-component, sgg-hook, sgg-fetcher, sgg-i18n-key, sgg-test-component, sgg-test-e2e

**MCP Servers**
- GitHub server for PR review and issue lookup
- Filesystem server for documentation access
- Custom `simpler-grants-context` server with architecture section retrieval, file-to-rule dispatch, and conventions summary

**Infrastructure**
- `setup.sh` — Team onboarding script with symlink deployment
- `refresh.sh` — Rule refresh pipeline
- `.githooks/pre-commit` — Opt-in convention validation
- `.github/workflows/cursor-rules-check.yml` — CI validation
- README.md and CONTRIBUTING.md
