# Phase 9: Gap Analysis — Missing Rules, Agents, Specialists, and Skills

**Date:** 2026-04-06
**Scope:** HHS/simpler-grants-gov monorepo
**Baseline:** 24 .mdc rule files, 6 agents, 15 specialists

---

## 1. Directory Coverage Map

### Covered Directories (18 glob patterns across 24 rules)

| Directory | Rule File | File Count |
|---|---|---|
| `api/src/api/` | `api-routes.mdc` | 151 |
| `api/src/services/` | `api-services.mdc` | 242 |
| `api/src/db/` | `api-database.mdc` | 409 |
| `api/src/auth/` | `api-auth.mdc` | 23 |
| `api/src/validation/` | `api-validation.mdc` | 4 |
| `api/src/form_schema/` | `api-form-schema.mdc`, `forms-vertical.mdc` | 76 |
| `api/tests/` | `api-tests.mdc` | ~500+ |
| `api/src/**/*.py` (any) | `api-error-handling.mdc` | all API |
| `frontend/src/components/` | `frontend-components.mdc` | 411 |
| `frontend/src/hooks/` | `frontend-hooks.mdc` | 21 |
| `frontend/src/services/` | `frontend-services.mdc` | 65 |
| `frontend/src/i18n/` | `frontend-i18n.mdc` | 7 |
| `frontend/tests/` | `frontend-tests.mdc` | ~280+ |
| `infra/**/*.tf` | `infra.mdc` | 392 |
| `.github/**/*.yml` | `ci-cd.mdc` | 57 |
| `**/*` | `cross-domain.mdc` | all |
| `**/form*/**/*` | `forms-vertical.mdc` | cross-cutting |
| (manual) | `pr-review.mdc` | N/A |

### Uncovered Directories (19 gaps identified)

| Directory | File Count | Value Rating | Tier |
|---|---|---|---|
| `api/src/task/` | 35 | VERY HIGH | 1 |
| `api/src/adapters/` | 36 | VERY HIGH | 1 |
| `api/src/workflow/` | 36 | VERY HIGH | 1 |
| `api/src/search/` | 8 | HIGH | 1 |
| `frontend/src/app/` | 160 | HIGH | 1 |
| `frontend/tests/e2e/` | 79 | HIGH | 1 |
| (cross-cutting accessibility) | all frontend | HIGH (legal) | 1 |
| `api/src/data_migration/` | 24 | MEDIUM-HIGH | 2 |
| `api/src/legacy_soap_api/` | 30 | MEDIUM | 2 |
| `frontend/stories/` + `.storybook/` | 27 | MODERATE | 2 |
| `api/src/util/` | 13 | MEDIUM | 3 |
| `api/src/logging/` | 7 | MEDIUM | 3 |
| `api/src/constants/` | 4 | MEDIUM | 3 |
| `api/src/pagination/` | 5 | LOW-MEDIUM | 3 |
| `api/src/cli/` | 1 | LOW | 3 |
| `frontend/src/utils/` | 47 | MODERATE-HIGH | 3 |
| `frontend/src/types/` | 26 | MODERATE | 3 |
| `frontend/src/constants/` | 9 | LOW | 3 |
| `frontend/src/styles/` | 4 | LOW | 3 |

---

## 2. Proposed Domain Rules

### Tier 1 — Build Now

#### 2.1 `api-tasks.mdc`
- **Globs:** `api/src/task/**/*.py`
- **File count:** 35
- **Priority:** HIGH (foundational framework used by forms, notifications, SAM extracts, analytics, certificates)
- **Top conventions:**
  1. All tasks inherit from `Task` base class with `run_task()` lifecycle method
  2. Define `Metrics` as a `StrEnum` — auto-initialized to 0
  3. Use `SubTask` for batch processing with `has_more_to_process()` loop
  4. `JobLog` database model tracks execution (STARTED -> COMPLETED/FAILED)
  5. Error handling in `finally` block updates job status
  6. `time.perf_counter()` for performance measurement
  7. Notification tasks inherit `BaseNotificationTask` with Pinpoint adapter
  8. ECS background task decorator for container execution
  9. Metrics aggregation via `increment()` method
  10. Structured logging with task-specific extra fields

#### 2.2 `api-adapters.mdc`
- **Globs:** `api/src/adapters/**/*.py`
- **File count:** 36
- **Priority:** HIGH (AWS S3, SES, SQS, Pinpoint, API Gateway; OAuth; OpenSearch; SAM.gov; NewRelic)
- **Top conventions:**
  1. Config classes inherit `PydanticBaseEnvConfig`
  2. Retry with `tenacity`: `@retry(stop=stop_after_attempt(N), wait=wait_random_exponential())`
  3. Factory pattern for adapter instantiation (e.g., `sam_gov/factory.py`)
  4. Dedicated mock clients for testing (e.g., `mock_login_gov_oauth_client.py`)
  5. Session objects passed explicitly for database consistency
  6. Type decorators for PostgreSQL-specific types
  7. Client classes encapsulate external API communication
  8. Config uses env prefix pattern (`S3_`, `OPENSEARCH_`, etc.)
  9. Structured error mapping from external errors to internal exceptions
  10. No direct external calls from service layer — always through adapters

#### 2.3 `api-workflow.mdc`
- **Globs:** `api/src/workflow/**/*.py`
- **File count:** 36
- **Priority:** HIGH (opportunity publishing, approval flows, state persistence)
- **Top conventions:**
  1. State machines use `python-statemachine` `StateChart` base class
  2. `atomic_configuration_update = True` for single-state transitions
  3. `catch_errors_as_events = False` — exceptions bubble up
  4. Metrics pattern identical to Task (StrEnum, increment)
  5. Event model: `StateMachineEvent`, `SQSMessageContainer`
  6. Database-backed persistence via `BaseStatePersistenceModel`
  7. Listener/observer pattern: `workflow_audit_listener`, `workflow_approval_email_listener`
  8. Registry pattern for workflow and client registration
  9. NewRelic custom transaction integration
  10. Workflow background task decorator for ECS execution

#### 2.4 `api-search.mdc`
- **Globs:** `api/src/search/**/*.py`
- **File count:** 8 (+ adapter integration in adapters/search/)
- **Priority:** HIGH (OpenSearch powers the primary search experience)
- **Top conventions:**
  1. Custom analyzers with Snowball stemming in `DEFAULT_INDEX_ANALYSIS`
  2. Index creation with configurable shards and replicas
  3. Structured DSL query construction via `opensearch_query_builder`
  4. Typed `SearchResponse` objects for response transformation
  5. Batch indexing via load tasks (agencies, opportunities)
  6. Query explain endpoint for debugging
  7. Count optimization with `count(DISTINCT(primary_key))`
  8. Analyzer configuration centralized, not per-index

#### 2.5 `frontend-app-pages.mdc`
- **Globs:** `frontend/src/app/**/*.tsx`, `frontend/src/app/**/*.ts`
- **File count:** 160
- **Priority:** HIGH (every page and API route in the application)
- **Top conventions:**
  1. Async `generateMetadata()` with `next-intl` translation integration
  2. ISR via `export const revalidate = 600` (10-minute default)
  3. `export const dynamic = "force-dynamic"` for dynamic pages
  4. Layout metadata inheritance — page-specific overrides via `generateMetadata()`
  5. Async params: `Promise<{id: string; locale: string}>`
  6. Server components by default at page level
  7. Locale routing via `[locale]/(base)/` and `[locale]/(print)/`
  8. API routes use `respondWithTraceAndLogs()` middleware wrapper
  9. Error boundaries via `error.tsx`, loading states via `loading.tsx`
  10. No business logic in pages — delegate to components and services

#### 2.6 `frontend-e2e-tests.mdc`
- **Globs:** `frontend/tests/e2e/**/*`
- **File count:** 79
- **Priority:** HIGH (sophisticated testing infrastructure)
- **Top conventions:**
  1. Every test MUST have exactly ONE execution tag: `@smoke`, `@core-regression`, `@full-regression`, or `@extended`
  2. Feature tags are optional: `@grantor`, `@grantee`, `@opportunity-search`, `@apply`, `@static`, `@auth`, `@user-management`
  3. Tag definitions centralized in `tags.ts` enum
  4. Utility-based page objects (functions, not OOP classes)
  5. `happy-path-*` and `failure-path-*` test file naming
  6. Feature-based directory organization (apply/, search/, saved-opportunities/)
  7. Sharding: 4 shards via `TOTAL_SHARDS`/`CURRENT_SHARD` env vars
  8. Timeouts: 75s local, 120s staging/prod
  9. Retries: 0 local, 3 CI
  10. BDD `.feature` files alongside `.spec.ts`

#### 2.7 `accessibility.mdc`
- **Globs:** `frontend/src/**/*.tsx`, `frontend/src/**/*.ts`
- **Priority:** HIGH (legally mandated — Section 508 / WCAG 2.1 AA for federal project)
- **Top conventions:**
  1. Every component test MUST include `jest-axe` scan with `toHaveNoViolations()`
  2. All interactive elements MUST have proper ARIA labels and roles
  3. Keyboard navigation MUST be maintained (focus management, tab order)
  4. Use `focus-trap-react` for modals/dialogs/drawers
  5. Heading hierarchy MUST be logical (h1 > h2 > h3, no skipped levels)
  6. USWDS components preferred for built-in accessibility
  7. Form inputs MUST be associated with labels
  8. Dynamic content changes MUST be announced to screen readers (aria-live)
  9. pa11y-ci runs desktop + mobile configs in CI
  10. Color contrast sufficient; information not conveyed solely by color

---

### Tier 2 — Build Next

#### 2.8 `api-data-migration.mdc`
- **Globs:** `api/src/data_migration/**/*.py`
- **File count:** 24
- **Priority:** MEDIUM-HIGH
- **Key conventions:** AbstractTransformSubTask inheritance, batch processing (max 100), explicit `db_session.begin()` per batch, Oracle foreign tables via `postgres_fdw`, transform constants for legacy code mapping

#### 2.9 `api-legacy-soap.mdc`
- **Globs:** `api/src/legacy_soap_api/**/*.py`
- **File count:** 30
- **Priority:** MEDIUM
- **Key conventions:** BaseSOAPClient with operation routing, XML/MTOM serialization via SOAPPayload, Pydantic schemas for SOAP requests/responses, typed fault responses, diff support for proxy comparison

#### 2.10 `frontend-storybook.mdc`
- **Globs:** `frontend/stories/**/*`, `frontend/.storybook/**/*`
- **File count:** 27
- **Priority:** MODERATE
- **Key conventions:** I18nStoryWrapper for localization, @storybook/nextjs-vite framework, Chromatic CI integration, colocated story files, SCSS preprocessor paths for USWDS

---

### Tier 3 — Consider Later

| Rule | Globs | Files | Rationale |
|---|---|---|---|
| `api-pagination.mdc` | `api/src/pagination/**/*.py` | 5 | Simple, stable, infrequently modified |
| `api-logging.mdc` | `api/src/logging/**/*.py` | 7 | Mostly covered by cross-domain structured logging |
| `api-constants.mdc` | `api/src/constants/**/*.py` | 4 | Simple StrEnum patterns, low file count |
| `frontend-utils.mdc` | `frontend/src/utils/**/*` | 47 | Domain-based utility organization; moderate value |
| `frontend-types.mdc` | `frontend/src/types/**/*` | 26 | Standard TypeScript patterns |

---

## 3. Proposed Agent Workflows

### Tier 2

| Agent | Purpose | Steps | Priority |
|---|---|---|---|
| `agent-component-creation` | Scaffold a new frontend component end-to-end | 1) Create component file 2) Create test with jest-axe 3) Create Storybook story 4) Add i18n keys 5) Add types | MEDIUM |

### Tier 3

| Agent | Purpose | Priority |
|---|---|---|
| `agent-search-integration` | Add/modify OpenSearch integration (index mapping + query + API endpoint) | LOW |
| `agent-debugging` | Assist with debugging failing tests or runtime errors | LOW |
| `agent-storybook` | Create or update Storybook stories for components | LOW |

**Rejected proposals:**
- `agent-accessibility-audit` — Covered by `accessibility.mdc` rule + `accessibility-auditor` specialist. A full agent is overkill; the rule + specialist combination provides sufficient automation.
- `agent-local-testing` — The existing `api-tests.mdc`, `frontend-tests.mdc`, and new `frontend-e2e-tests.mdc` rules cover testing conventions. Local test orchestration is a developer workflow, not an AI agent workflow.
- `agent-uat-validation` — UAT is a process concern. The E2E tag system (@smoke, @core-regression, @full-regression, @extended) IS the UAT mechanism. The new `frontend-e2e-tests.mdc` rule documents this.
- `agent-feature-flag` — Feature flags span infra/API/frontend but the pattern is simple (SSM parameter + Python check + JS check). A rule reference in cross-domain is sufficient.
- `agent-api-documentation` — OpenAPI spec is auto-generated. Documentation is a CI concern, not an agent workflow.
- `agent-dependency-update` — Renovate handles this. Manual dependency updates are rare.

---

## 4. Proposed Specialists

### Tier 1

| Specialist | Purpose | Activates On | Checks | Priority |
|---|---|---|---|---|
| `accessibility-auditor` | Deep WCAG 2.1 AA / Section 508 compliance review | Frontend component/test changes (*.tsx, *.ts) | ARIA patterns, focus management, color contrast, keyboard nav, screen reader announcements, heading hierarchy, jest-axe test presence, pa11y config, USWDS compliance | HIGH |

### Tier 2

| Specialist | Purpose | Priority |
|---|---|---|
| `form-schema-validator` | Validate three-schema consistency (JSON Schema + UI Schema + Rule Schema) | MEDIUM |
| `api-contract-checker` | Verify API response shape changes reflected in frontend types | MEDIUM |
| `i18n-completeness-checker` | Verify all user-facing strings externalized, key naming correct | MEDIUM |

### Tier 3

| Specialist | Purpose | Priority |
|---|---|---|
| `logging-compliance-checker` | Verify structured logging conventions and PII absence | LOW |
| `test-coverage-analyzer` | Analyze whether new code has adequate test coverage | LOW |
| `documentation-completeness` | Verify code changes accompanied by doc updates | LOW |
| `dependency-safety-reviewer` | Audit new dependencies for security/license/maintenance | LOW |

**Rejected proposals:**
- `uat-criteria-validator` — UAT is process, not code validation. The E2E tag system handles this.
- `local-test-orchestrator` — Test execution is a developer tool concern, not a PR review specialist.

---

## 5. Proposed Skills

### Tier 2

| Skill | Purpose | Priority |
|---|---|---|
| `skill-run-tests` | Determine and run relevant tests for current file/change | MEDIUM |

### Tier 3

| Skill | Purpose | Priority |
|---|---|---|
| `skill-generate-factory` | Generate a factory_boy factory for a SQLAlchemy model | LOW |
| `skill-generate-story` | Generate a Storybook story for a component | LOW |
| `skill-a11y-check` | Run accessibility audit on specific component/page | LOW |
| `skill-update-translations` | Add/update i18n translation keys | LOW |
| `skill-check-conventions` | On-demand conventions check for current file | LOW |
| `skill-explain-pattern` | Explain why a pattern exists, pulling from ADRs | LOW |
| `skill-openapi-sync` | Sync OpenAPI spec with route definitions | LOW |
| `skill-feature-flag-check` | Verify feature flag consistency across infra/API/frontend | LOW |
| `skill-uat-checklist` | Generate UAT checklist from issue acceptance criteria | LOW |

---

## 6. Deep Dive: Accessibility

### Current State
- **jest-axe:** 50+ component test files with `toHaveNoViolations()`
- **pa11y-ci:** Two configs (`.pa11yci-desktop.json`, `.pa11yci-mobile.json`) using axe runner, timeout 240s, ignoring color-contrast
- **CI workflow:** `ci-frontend-a11y.yml` runs on all PRs modifying `/frontend/**`
- **USWDS:** `@trussworks/react-uswds` v11 provides accessible component defaults
- **Focus management:** `focus-trap-react` v11 for modals/dialogs
- **ARIA usage:** 106+ occurrences in TSX files
- **Legal requirement:** WCAG 2.1 AA / Section 508 per CLAUDE.md

### Coverage Assessment
Accessibility is currently scattered across three rules:
- `frontend-components.mdc` mentions USWDS usage but has no ARIA/focus directives
- `frontend-tests.mdc` requires jest-axe but doesn't cover accessibility patterns
- `pr-review.mdc` has a Section 5 (Accessibility) checklist but no specialist enforcement

### Recommendation: **All three needed**
1. **`accessibility.mdc`** (domain rule) — Codifies ARIA patterns, focus management, heading hierarchy, USWDS compliance, jest-axe requirements
2. **`accessibility-auditor`** (specialist) — Deep review activating on frontend changes, checking WCAG 2.1 AA compliance
3. Agent NOT needed — The rule + specialist combination provides sufficient automation without a multi-step orchestrator

---

## 7. Deep Dive: Local Testing

### Current State
- **API:** `make test` (pytest, excludes audit/xml_validation), `make test-coverage` (80% threshold), `make init` (DB + search + LocalStack + mocks)
- **Docker services:** PostgreSQL 17.5, OpenSearch 2.x, LocalStack (S3/SQS), mock-oauth2-server, mock-applicants-soap-api
- **Pytest markers:** `@audit`, `@xml_validation`, `@sf424`
- **Frontend:** Jest with next/jest, jsdom environment
- **E2E:** Playwright with sharding (4 shards), tag-based selection, multi-browser support
- **E2E tags:** `@smoke` (PRs), `@core-regression` (main push), `@full-regression` (daily), `@extended` (weekly)

### Coverage Assessment
- `api-tests.mdc` covers pytest conventions, factory patterns, fixture usage — **sufficient**
- `frontend-tests.mdc` covers Jest/RTL/jest-axe — **sufficient for unit tests**
- E2E testing is a **gap** — tag system, sharding, page object utilities, playwright config have no rule

### Recommendation
1. **`frontend-e2e-tests.mdc`** (domain rule) — Dedicated rule for Playwright E2E conventions
2. Agent NOT needed — Local testing is a developer workflow, not an AI orchestration target
3. Skill `skill-run-tests` deferred to Tier 2 — useful but not critical

---

## 8. Deep Dive: UAT

### Current State
- **Issue templates:** Internal Deliverable template has required acceptance criteria + metrics fields
- **PR template:** Has "Validation steps" section (manual testing instructions, screenshots)
- **E2E organization:** Feature-based directories (apply/, search/, saved-opportunities/)
- **Staging workflows:** `e2e-staging.yml`, `e2e-daily.yml` (6-7am EST), `e2e-weekly.yml` (Sundays)
- **Tag system:** Feature tags + execution tags provide tiered UAT coverage

### Coverage Assessment
The E2E tag system IS the UAT mechanism:
- `@smoke` = PR-level validation
- `@core-regression` = merge-to-main validation
- `@full-regression` = daily UAT
- `@extended` = weekly comprehensive UAT

### Recommendation
1. UAT is a **process concern**, not a tooling gap
2. The new `frontend-e2e-tests.mdc` rule documents the tag system and testing tiers
3. No dedicated agent, specialist, or skill needed for UAT
4. A `skill-uat-checklist` is deferred to Tier 3 as a nice-to-have

---

## 9. Prioritized Recommendations

### Tier 1 — Build Now (8 items)

| # | Type | Name | Purpose | Effort | Integrates With |
|---|---|---|---|---|---|
| 1 | Rule | `api-tasks.mdc` | Background task framework patterns | Medium | api-services, cross-domain |
| 2 | Rule | `api-adapters.mdc` | External service integration patterns | Medium | api-services, api-search |
| 3 | Rule | `api-workflow.mdc` | State machine orchestration patterns | Medium | api-tasks, api-services |
| 4 | Rule | `api-search.mdc` | OpenSearch integration patterns | Small | api-adapters, api-database |
| 5 | Rule | `frontend-app-pages.mdc` | Next.js App Router patterns | Medium | frontend-components, frontend-services |
| 6 | Rule | `frontend-e2e-tests.mdc` | Playwright E2E patterns | Medium | frontend-tests, ci-cd |
| 7 | Rule | `accessibility.mdc` | WCAG 2.1 AA / Section 508 | Medium | frontend-components, frontend-tests |
| 8 | Specialist | `accessibility-auditor` | Deep a11y compliance review | Small | pr-review.mdc |

### Tier 2 — Build Next (8 items)

| # | Type | Name | Purpose | Effort |
|---|---|---|---|---|
| 1 | Rule | `api-data-migration.mdc` | Data migration transform patterns | Medium |
| 2 | Rule | `api-legacy-soap.mdc` | SOAP compatibility layer patterns | Medium |
| 3 | Rule | `frontend-storybook.mdc` | Storybook story patterns | Small |
| 4 | Specialist | `form-schema-validator` | Three-schema consistency | Medium |
| 5 | Specialist | `api-contract-checker` | API/frontend type consistency | Medium |
| 6 | Specialist | `i18n-completeness-checker` | String externalization | Small |
| 7 | Agent | `agent-component-creation` | Scaffold component + test + story + i18n | Medium |
| 8 | Skill | `skill-run-tests` | Determine and run relevant tests | Medium |

### Tier 3 — Consider Later (14 items)

| # | Type | Name | Purpose | Effort |
|---|---|---|---|---|
| 1 | Rule | `api-pagination.mdc` | Offset-based paginator | Small |
| 2 | Rule | `api-logging.mdc` | Logging config | Small |
| 3 | Rule | `api-constants.mdc` | StrEnum constants | Small |
| 4 | Rule | `frontend-utils.mdc` | Utility organization | Small |
| 5 | Rule | `frontend-types.mdc` | Type definitions | Small |
| 6 | Agent | `agent-search-integration` | OpenSearch integration workflow | Large |
| 7 | Agent | `agent-debugging` | Debugging assistance | Large |
| 8 | Agent | `agent-storybook` | Storybook story creation | Small |
| 9 | Skill | `skill-generate-factory` | Factory generation | Small |
| 10 | Skill | `skill-generate-story` | Story generation | Small |
| 11 | Specialist | `logging-compliance-checker` | Structured logging / PII | Small |
| 12 | Specialist | `test-coverage-analyzer` | Test coverage analysis | Medium |
| 13 | Specialist | `documentation-completeness` | Doc update verification | Small |
| 14 | Specialist | `dependency-safety-reviewer` | Dependency audit | Medium |

---

## 10. Summary

| Category | Current | After Tier 1 | After All Tiers |
|---|---|---|---|
| Domain rules | 18 | 25 | 30 |
| Agent rules | 6 | 6 | 7 |
| Total .mdc files | 24 | 31 | 37 |
| Specialists | 15 | 16 | 20 |
| Skills | 0 | 0 | 10 |
| Directory coverage | ~60% | ~85% | ~95% |
