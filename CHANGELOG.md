# Changelog

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
