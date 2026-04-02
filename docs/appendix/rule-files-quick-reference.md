---
title: Rule Files Quick Reference
type: appendix
toolkit: Simpler.Grants.gov AI Coding Toolkit
layout: one-page reference card
---

# Rule Files Quick Reference

Printable one-page reference for all rule files in the Simpler.Grants.gov AI Coding Toolkit.

---

## Auto-Activating Rules (18 total)

Rules load automatically when you edit a file matching the glob pattern.

### API Rules

| # | Rule File | Glob Pattern | Top 3 Directives |
|---|-----------|-------------|-------------------|
| 1 | `api-routes.mdc` | `api/src/api/**/*.py` | Decorator order: METHOD, input, output, doc, auth, db_session; thin handlers delegate to services; return `ApiResponse` |
| 2 | `api-services.mdc` | `api/src/services/**/*.py` | `db_session` as first param; no transaction management in services; use `raise_flask_error()` |
| 3 | `api-database.mdc` | `api/src/db/**/*.py` | `Mapped[T]` with `mapped_column()` only; UUID PKs; singular table names, `lk_` for lookups |
| 4 | `api-auth.mdc` | `api/src/auth/**/*.py` | Use `jwt_or_api_user_key_multi_auth`; Flask native `@multi_auth.login_required`; 404 before 403 |
| 5 | `api-validation.mdc` | `api/src/validation/**/*.py` | Types in `ValidationErrorType(StrEnum)`; include type, message, field; type is API-frontend contract |
| 6 | `api-error-handling.mdc` | `api/src/**/*.py` | Use `raise_flask_error()` with `ValidationErrorDetail`; log 4xx at info; never raw `abort()` |
| 7 | `api-form-schema.mdc` | `api/src/form_schema/**/*.py` | Three-schema architecture (JSON, UI, Rule); use `OUR_VALIDATOR`; XML matches Grants.gov format |
| 8 | `api-tests.mdc` | `api/tests/**/*.py` | `Factory.build()` for unit, `.create()` for integration; `enable_factory_create` fixture; standalone functions |

### Frontend Rules

| # | Rule File | Glob Pattern | Top 3 Directives |
|---|-----------|-------------|-------------------|
| 9 | `frontend-components.mdc` | `frontend/src/components/**/*` | RSC by default, `"use client"` only when needed; no barrel files; prefer USWDS |
| 10 | `frontend-hooks.mdc` | `frontend/src/hooks/**/*` | `useClientFetch` for data fetching; `useSearchParamUpdater` for URL state; auth hooks |
| 11 | `frontend-services.mdc` | `frontend/src/services/**/*` | `requesterForEndpoint()` factory; `"server-only"` directive; `cache()` for deduplication |
| 12 | `frontend-i18n.mdc` | `frontend/src/i18n/**/*` | Single file `messages/en/index.ts`; PascalCase top-level, camelCase leaf; `useTranslations()` |
| 13 | `frontend-tests.mdc` | `frontend/tests/**/*`, `frontend/e2e/**/*` | `jest-axe` in every test; Jest + RTL for unit, Playwright for E2E; mock API calls only |

### Infrastructure and Cross-Cutting Rules

| # | Rule File | Glob Pattern | Top 3 Directives |
|---|-----------|-------------|-------------------|
| 14 | `infra.mdc` | `infra/**/*.tf` | Three-layer Terraform: app-config, service, database; SSM feature flags; SSM in all envs before merge |
| 15 | `ci-cd.mdc` | `.github/**/*.yml` | Three-job pipeline: checks, deploy, notify; reusable workflows; Docker caching + Playwright 4-shard |
| 16 | `forms-vertical.mdc` | `**/form*/**/*` | Three-schema form definition; custom `OUR_VALIDATOR`; test triad: minimal, full, empty |
| 17 | `cross-domain.mdc` | `**/*` | Structured logging: static messages + `extra={}`; boolean names: `is_*`, `has_*`, `can_*`; no wildcard eager loading |
| 18 | `pr-review.mdc` | _(manual only)_ | Multi-pass convention review; severity: blocking, suggestion, nit; organized by category |

---

## Agent Rules (6 total)

Agents are invoked manually by name. They do not auto-activate.

| Agent | Purpose | Invocation Hint |
|-------|---------|-----------------|
| `@agent-new-endpoint` | Scaffold complete API endpoint (7 files) | `@agent-new-endpoint Create POST /v1/users/<id>/searches with JWT auth` |
| `@agent-code-generation` | Domain-aware single-file generation | `@agent-code-generation Write a service function for ...` |
| `@agent-test-generation` | Tests with factory, jest-axe, Playwright patterns | `@agent-test-generation Write tests for GET /v1/agencies/<id>/contacts` |
| `@agent-migration` | Alembic migration with schema="api" and UUID PKs | `@agent-migration Add nullable phone_number to user table` |
| `@agent-i18n` | Add translations to centralized i18n file | `@agent-i18n Add translations for SavedSearches page` |
| `@agent-adr` | Architecture Decision Record with standard sections | `@agent-adr Document decision to use Redis for caching` |

---

## Key Conventions at a Glance

- **Decorator stack order:**
  `@bp.METHOD` then `@bp.input` then `@bp.output` then `@bp.doc` then `@bp.auth_required` then `with_db_session`

- **Service functions:**
  `db_session` as the first parameter; no transaction management inside services (routes own transactions)

- **Models:**
  `Mapped[T]` syntax with `mapped_column()`; UUID primary keys with `default=uuid.uuid4`; singular table names (`user`, not `users`)

- **Tests:**
  `Factory.build()` for unit tests (no DB); `Factory.create()` for integration tests (requires `enable_factory_create` fixture)

- **Frontend:**
  React Server Components by default; add `"use client"` only when the component needs browser APIs or state

- **Error handling:**
  `raise_flask_error(status_code, message, validation_issues=[...])` with `ValidationErrorDetail`; never use raw `abort()`

- **i18n:**
  Single translation file at `messages/en/index.ts`; PascalCase top-level keys, camelCase leaf keys

- **Logging:**
  Structured with static messages and `extra={}` (flat snake_case keys, no PII); 4xx at info, operational at warning, system at error

- **Infrastructure:**
  Three-layer Terraform (app-config, service, database); feature flags via SSM parameters created in all environments before merge

- **CI/CD:**
  Three-job pipeline (checks, deploy, notify); reusable workflows; Docker layer caching; Playwright 4-shard parallel execution

---

## Rule Stacking

Multiple rules activate simultaneously and do not conflict. Example for `api/src/api/forms/form_routes.py`:

- `api-routes.mdc` -- route handler conventions
- `api-error-handling.mdc` -- error handling patterns
- `forms-vertical.mdc` -- form-specific patterns
- `cross-domain.mdc` -- logging, naming, general conventions

All directives apply together.

---

## Specialist Integration Summary

Every rule and agent invokes Compound Engineering specialists for quality validation:

**Agent Quality Gate Pipelines:**

| Agent | Specialists in Pipeline |
|-------|----------------------|
| `agent-new-endpoint` | conventions, architecture, security, python, performance (conditional) |
| `agent-code-generation` | conventions, domain-specific, language, pattern-recognition (conditional) |
| `agent-test-generation` | conventions, performance, language, data-integrity (conditional) |
| `agent-migration` | conventions, migration-expert, data-integrity, schema-drift, deployment (conditional) |
| `agent-i18n` | conventions, pattern-recognition, typescript |
| `agent-adr` | conventions, architecture, git-history (conditional) |

**Domain Rule Specialist Dispatch:**

| Domain | Primary Specialist | Secondary Specialist |
|--------|-------------------|---------------------|
| API Routes | `architecture-strategist` | `security-sentinel` |
| API Services | `architecture-strategist` | `code-simplicity-reviewer` |
| API Database | `data-integrity-guardian` | `schema-drift-detector` |
| API Auth | `security-sentinel` | `architecture-strategist` |
| Frontend Components | `architecture-strategist` | `code-simplicity-reviewer` |
| Frontend Hooks | `julik-frontend-races-reviewer` | `code-simplicity-reviewer` |
| Infrastructure | `deployment-verification-agent` | `security-sentinel` |
| CI/CD | `deployment-verification-agent` | `performance-oracle` |
| Forms | `schema-drift-detector` | `data-integrity-guardian` |

Requires the **Compound Engineering** plugin. See [Getting Started](../03-getting-started.md).

---

For full details, see [Auto-Activating Rules Reference](../04-auto-activating-rules.md) and [Agents Reference](../05-agents-reference.md).

[Back to documentation index](../README.md)
