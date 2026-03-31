# Cross-Domain Synthesis -- Pass 3

**Source:** 13 Pass 2 codification documents (api-auth, api-database, api-form-schema, api-routes, api-services, api-tests, api-validation, ci-cd, infra, frontend-components, frontend-i18n, frontend-services, frontend-tests)
**Analysis date:** 2026-03-30

---

## Cross-Cutting Patterns

These patterns appear consistently across 3 or more domains. Each is supported by concrete evidence from the Pass 2 documents.

### CCP-1: Structured Logging -- Static Messages, Variable Data in `extra={}`

**Domains:** api-auth (Pattern 10, AP-4), api-routes (Rule 6), api-services (Rules 6-7), api-validation (Patterns 14-15)

**Rule:** ALWAYS use static log message strings. ALWAYS put dynamic values (IDs, counts, statuses) in the `extra={}` dict. NEVER embed dynamic data in log message strings. NEVER log PII (emails, names).

**Evidence:**
- api-auth: PR #4965 corrected `"user.id"` dotted keys to flat `user_id`
- api-routes: Dedicated cleanup PR #4965 renamed nested keys project-wide
- api-services: 10+ explicit reviewer corrections; reviewer chouinar: "Avoid putting variable data in log messages, makes it harder to find them"
- api-validation: PR #5146 shows correct structured logging in validation functions

**Additional sub-rule:** ALWAYS use flat snake_case keys (e.g., `user_id`, `opportunity_id`). NEVER use dotted/nested keys (e.g., `user.id`, `application.application_id`). The `auth.` prefix is a documented exception for auth-specific fields.

### CCP-2: Log Level Discipline -- `info` for 4xx, `warning` for Operational Concerns Only

**Domains:** api-auth (Pattern 14), api-routes (Rule 8), api-validation (Pattern 14)

**Rule:** NEVER use `logger.warning()` for expected client errors (401, 403, 404, 422). ALWAYS use `logger.info()`. Warning-level logs trigger alerts in New Relic and should be reserved for actual operational problems.

**Evidence:**
- api-auth: PR #4936 reviewer chouinar: "Warning logs will alert us, we don't want to be alerted for 4xx errors"
- api-routes: Same enforcement in PR #4936 review
- api-validation: Corrective enforcement in PRs #4936, #5146

### CCP-3: Factory Pattern for Test Data -- `.build()` for Unit, `.create()` for Integration

**Domains:** api-tests (Rules 1-2), api-services (Rule 17), api-validation (Pattern 10), api-form-schema (Rule 15), frontend-tests (Pattern 6), frontend-services (Pattern 12), frontend-components (Rule 14)

**Rule:** ALWAYS use factory `.build()` when no database/persistence is needed. Use `.create()` only when records must exist in the database. On the frontend, use centralized typed fixtures in `fixtures.ts`.

**Evidence:**
- api-tests: PR #8614 reviewer chouinar: "If we don't want anything in the DB / want to keep it simple, use `.build()`"
- api-services: Same reviewer guidance across multiple PRs
- frontend-tests: Consistent use of `src/utils/testing/fixtures.ts` across 25+ PRs

### CCP-4: `raise_flask_error()` with `ValidationErrorDetail` for All API Errors

**Domains:** api-routes (Rule 8), api-services (Rule 8), api-validation (Pattern 3)

**Rule:** ALWAYS use `raise_flask_error(status_code, message, validation_issues=[...])` for error responses. Each `ValidationErrorDetail` MUST include a `type` from the centralized `ValidationErrorType` StrEnum and a human-readable message. The `type` field is the API-frontend contract for localized message mapping.

**Evidence:**
- api-validation: 7/10 PRs modify `ValidationErrorType`; reviewer chouinar explicitly defined the frontend contract role
- api-routes: All error-handling code uses this pattern
- api-services: ~85% of service functions with error cases use `raise_flask_error`

### CCP-5: Thin Handlers / Service Layer Separation

**Domains:** api-routes (Rule 4), api-services (Rules 1-3), api-validation (Pattern 2)

**Rule:** ALWAYS keep route handlers thin. Business logic, validation, and DB queries MUST live in service functions under `src/services/<domain>/`. Route handlers contain only: logging setup, auth/identity verification, a `db_session.begin()` block calling the service, and `response.ApiResponse` return.

**Evidence:**
- api-routes: 100% of examined handlers follow this; enforced in PRs #4513, #5611, #4989
- api-services: One function per file, organized by domain subdirectory
- api-validation: Validation logic always in `application_validation.py`, never in routes

### CCP-6: Boolean Fields Named as Questions (`is_`, `has_`, `can_`, `was_`)

**Domains:** api-routes (Rule 16), api-services (Rule 18), api-database (implicit in all models)

**Rule:** ALWAYS name boolean fields and parameters using question-form prefixes.

**Evidence:**
- api-routes: Enforced by reviewer in PR #4493; `has_active_opportunity`, `is_test_agency`, `is_deleted`
- api-services: PR #4493 renamed `active` to `has_active_opportunity`

### CCP-7: Accessibility Testing as Mandatory First-Class Concern

**Domains:** frontend-tests (Pattern 2), frontend-components (Rule 10), frontend-services (Pattern 13)

**Rule:** ALWAYS include a `jest-axe` accessibility scan (`toHaveNoViolations()`) for every new frontend component. E2E tests run across Chromium, Firefox, WebKit, and Mobile Chrome.

**Evidence:**
- frontend-tests: Present in ~30+ PRs, nearly every new component test suite
- frontend-components: Documented as part of the standard test structure
- ci-cd: Multi-browser Playwright configuration enforced in e2e workflows

### CCP-8: Feature Flags Gated via Environment Variables / SSM

**Domains:** ci-cd (Pattern 18), infra (Pattern 6), frontend-services (Pattern 14)

**Rule:** ALWAYS gate new capabilities behind feature flags. API flags use `ENABLE_{FEATURE}_ENDPOINTS` in Terraform. Frontend flags use `FEATURE_{NAME}_OFF` backed by SSM parameters with `manage_method = "manual"`. Flags MUST be set in all environments before merge.

**Evidence:**
- infra: 10+ PRs adding `FEATURE_*_OFF` entries to `environment_variables.tf`
- ci-cd: PR #6542 shows CommonGrants endpoint flag
- frontend-services: `withFeatureFlag` HOC pattern; PR #8336 shows flag cleanup

### CCP-9: No Wildcard Eager Loading -- Explicit `selectinload()` Only

**Domains:** api-auth (Pattern 9, AP-1), api-services (Rule 10)

**Rule:** NEVER use `selectinload("*")`. ALWAYS specify exact relationships to load.

**Evidence:**
- api-auth: Corrective PR #5048 fixed wildcard loading that caused query explosion
- api-services: PR #8620 reviewer: "don't do selectinload('*') - that fetches every relationship from an opportunity which ends up being about half the DB"

### CCP-10: SSM Parameters Must Exist Before Merge

**Domains:** infra (Pattern 5), ci-cd (Pattern 18)

**Rule:** ALWAYS create SSM parameters in all environments (dev, staging, training, prod) before merging a PR that references them. Even placeholder values are acceptable. Deploys will fail if parameters are missing.

**Evidence:**
- infra: Enforced in multiple review threads (PRs #8392, #6465)
- ci-cd: Feature flags backed by SSM must be pre-created

---

## Architectural Principles

These are higher-level design philosophies inferred from the accumulated patterns across all domains.

### AP-1: Fail Loudly, Never Silently

The project consistently rejects silent failures, fallbacks, and placeholder values:
- **api-form-schema** (Rule 3): Invalid JSON schemas MUST propagate as 500s, not produce undefined behavior
- **api-form-schema** (Rule 17): "If data is malformed just let it error" (reviewer chouinar)
- **api-validation**: Precondition checks raise immediately; only form validation aggregates errors
- **infra** (Pattern 5): Missing SSM parameters cause deploy failures -- by design

### AP-2: Separation of Concerns via Layered Architecture

Every domain exhibits clear layering:
- **API:** Routes (HTTP contract) -> Services (business logic) -> Models (data) -> Migrations (schema)
- **Frontend:** Pages (data fetching) -> Components (presentation) -> Services/Hooks (API integration) -> Types (contracts)
- **Infra:** app-config (pure configuration, no AWS calls) -> service (resource creation) -> modules (reusable components)
- **Forms:** JSON Schema (validation) -> UI Schema (rendering) -> Rule Schema (business rules) -> XML Transform (output)

### AP-3: Convention Over Configuration, Enforced by Review

The project relies heavily on reviewer-enforced conventions rather than automated tooling:
- Naming conventions (boolean question-form, singular table names, PascalCase namespaces) are enforced in code review, not linting
- Several domains note "should this be an ESLint/lint rule?" as open questions but have not yet implemented them
- The primary enforcer across API domains is **chouinar**; across frontend domains is **doug-s-nava**

### AP-4: Database as Source of Truth, Code as Configuration

- Form schemas are static Python objects, NOT database-fetched (api-form-schema Rule 1)
- Lookup values are declared in Python code and auto-synced to DB (api-database Rule 8)
- Feature flags are SSM-backed but declared in Terraform (infra Pattern 6)
- Translation strings live in a single TypeScript file, not a CMS (frontend-i18n Rule 1)

### AP-5: Non-Blocking UX for Complex Federal Forms

- Form validation returns warnings during editing; only blocks at submission (api-form-schema Rule 4, api-services Rule 24)
- Soft deletes preserve data for audit trails and un-delete flows (api-routes Rule 14)
- Promise-as-props pattern enables non-blocking data loading in the frontend (frontend-components Rule 4)

### AP-6: Infrastructure Abstraction -- No Provider Names in Public APIs

- Auth class names must not reference AWS, Login.gov, or other providers (api-auth Pattern 12)
- Internal S3 URLs must not appear in API responses (api-services Rule 20)
- Feature flags abstract deployment details from runtime behavior

### AP-7: Legacy Grants.gov Compatibility as Hard Constraint

- XML output must match legacy element order, namespace declarations, and attribute values (api-form-schema Rules 6-8)
- Enum values sourced from `UniversalCodes-V2.0.xsd` (api-form-schema Rule 11)
- UI section labels match PDF form numbering, not legacy instructions (api-form-schema Rule 5)

---

## Inter-Domain Inconsistencies

### INC-1: Feature Flag Naming Convention

| Domain | Convention | Example |
|--------|-----------|---------|
| Infra (frontend) | `FEATURE_{NAME}_OFF` with SSM `manage_method = "manual"` | `FEATURE_USER_ADMIN_OFF` |
| Infra (API) | `ENABLE_{FEATURE}_ENDPOINTS = 1` as plain env var | `ENABLE_COMMON_GRANTS_ENDPOINTS = 1` |
| Local dev | `ENABLE_{FEATURE}=TRUE` | `ENABLE_AUTH_ENDPOINT=TRUE` |

Three different naming patterns and three different truthy values (`1`, `TRUE`, SSM-managed). This should be unified.

### INC-2: File Naming -- Singular vs. Plural

- API routes: Inconsistent between `agency_schema.py` (singular) and `user_schemas.py` (plural)
- API routes: `competition_route.py` vs. `user_routes.py`
- No enforcement mechanism exists; noted as an open question in api-routes Rule 18

### INC-3: Validation Framework Dual Stack

- **API route-level validation:** Marshmallow schemas with `@validates_schema` for cross-field validation
- **API service-level validation:** Pydantic `BaseModel` with `model_validate()` for input parsing
- **Form validation:** JSON Schema Draft 2020-12 with custom `OUR_VALIDATOR`
- **Frontend server actions:** Zod schemas with `safeParse()`

Four different validation libraries across the stack. The Marshmallow/Pydantic dual-use in the API is explicitly acknowledged but not resolved.

### INC-4: Auth Object Name Evolution

The multi-auth object naming evolved over time: `jwt_or_key_multi_auth` -> `jwt_or_api_user_key_multi_auth`. Older endpoints have not been migrated. The API routes document flags this as needing tech lead resolution.

### INC-5: `server only` vs. `server-only` Directive

Frontend service files inconsistently use `"server only"` (with space) and `"server-only"` (with hyphen). The Next.js official package is `server-only` (with hyphen). This should be standardized.

### INC-6: Test File Location (Frontend)

Frontend tests are in flux between two patterns:
- **Traditional:** `frontend/tests/components/<path>/<Component>.test.tsx`
- **Co-located:** `frontend/src/components/<path>/<Component>.test.tsx`

Both patterns coexist. No formal decision has been documented.

### INC-7: Authorization Utility Duplication

The API has both `verify_access()` and `check_user_access()` doing overlapping work (flagged in PR #8632). Tech lead resolution is needed.

---

## Coverage Gaps

### GAP-1: No Automated Enforcement of Naming Conventions

Multiple domains note that naming conventions (boolean question-form, camelCase translation keys, singular table names, flat log keys) are enforced only by reviewer diligence. No ESLint rules, Ruff rules, or custom linters enforce these. Suggested rules include:
- `react/destructuring-assignment` (frontend-components Rule 2)
- `eqeqeq` (frontend-components Rule 13)
- camelCase check for i18n keys (frontend-i18n Rule 3)
- Boolean naming lint rule (api-services Rule 18)

### GAP-2: No Centralized Feature Flag Registry

Feature flags are scattered across Terraform configs, SSM parameters, and code references. There is no single registry showing all active flags, their current state per environment, or their cleanup status. This was noted as an open question in ci-cd Pattern 18.

### GAP-3: No Formal API Versioning Strategy

The API uses path-based versioning (`/v1/`, `/alpha/`) but there is no documented strategy for when to promote alpha to v1, when to create v2, or how breaking changes are managed. The form schema domain's `static_value` pattern (Rule 7) explicitly avoids versioning problems, suggesting awareness but not a formal strategy.

### GAP-4: No Database Query Performance Guidelines

While `selectinload("*")` is banned, there are no documented guidelines for:
- When to use `selectinload` vs. `joinedload` vs. `subqueryload`
- Query complexity limits or N+1 detection
- Index creation conventions beyond "add index to FK columns"

### GAP-5: No Error Monitoring / Alert Level Documentation

The "info for 4xx, warning for ops concerns" rule is clear, but there is no documented guidance on:
- When to use `logger.error()` vs. `logger.exception()`
- What constitutes an "operational concern" warranting a warning
- How New Relic alert policies map to log levels

### GAP-6: No Frontend Error Boundary Strategy

The frontend uses `<TopLevelError />` and `<NotFound />` for page-level errors, and `parseErrorStatus()` for status code extraction. But there is no documented strategy for:
- Component-level error boundaries
- Retry behavior for transient failures
- User-facing error message standards beyond the i18n pattern

### GAP-7: No Dependency Update Policy

Vulnerability scanning is well-documented (ci-cd Pattern 10), but there is no policy for:
- How frequently dependencies are updated
- Who is responsible for reviewing `.trivyignore` / `.dockleignore` suppressions
- SLA for addressing discovered vulnerabilities

### GAP-8: No Migration Rollback Strategy

Database migrations use Alembic with `upgrade()` and `downgrade()` functions, but there is no documented policy for:
- When and how to roll back migrations in production
- How to handle data migrations that cannot be cleanly reversed
- Testing downgrade paths

---

## Forms Domain Assessment

**Question:** Does the grant application forms domain (SF-424, CD511, attachments, budget narratives) warrant a dedicated cross-cutting rule set?

**Assessment: Yes.** The forms domain has a rich, self-contained set of patterns that span multiple API layers and have unique characteristics not shared by other domains:

### Unique Patterns Exclusive to Forms

1. **Three-Schema Architecture** (JSON Schema + UI Schema + Rule Schema) -- no other domain uses this pattern
2. **Declarative XML Transform Rules** with mandatory namespace ordering -- directly driven by legacy Grants.gov compatibility
3. **PDF-Aligned Section Labels** -- a forms-specific requirement with its own source-of-truth hierarchy (PDF > XSD > legacy instructions)
4. **Non-Blocking Validation with Warnings** -- only forms use the "save with warnings, block at submission" pattern
5. **Recursive Rule Schema Processing** with handler mapping -- a forms-specific DSL
6. **Shared Schemas with URI-Based $ref Resolution** -- custom JSON Schema resolution infrastructure
7. **Code-Label Enum Format** (`"XX: Full Name"`) -- forms-specific convention sourced from `UniversalCodes-V2.0.xsd`
8. **DAT-to-Schema CLI Pipeline** -- forms-specific tooling
9. **Minimal/Full/Empty Test Triad** -- forms-specific test pattern
10. **Legacy XML Fidelity Tests** -- forms-specific regression testing

### Cross-Layer Impact

The forms domain touches:
- **Database models:** `Application`, `ApplicationForm`, `CompetitionForm`, `Form`, `ApplicationAttachment`
- **Service layer:** `update_application_form`, `submit_application`, `validate_forms`
- **Route layer:** Application form endpoints with non-blocking validation responses
- **Validation layer:** JSON Schema validation + rule processing + submission-time blocking
- **Infrastructure:** XML generation for Grants.gov submission

### Recommendation

Create a dedicated **"Forms Domain Architecture Guide"** as a Tier 1 document covering:
- The three-schema architecture and how to add a new form
- XML transform configuration requirements (namespaces, element ordering, static values)
- The validation lifecycle (save with warnings -> submit with blocking)
- Shared schema / $ref resolution patterns
- PDF alignment requirements and source-of-truth hierarchy

---

## Reviewer Authority Map

### API Domains

| Reviewer | Authority Areas | Enforcement Style |
|----------|----------------|-------------------|
| **chouinar** | Database architecture, service layer patterns, logging conventions, auth design, query patterns, transaction management, naming conventions, form schema architecture | Primary authority across all API domains. Decisive, frequently corrects patterns. Authored foundational patterns for lookup tables, validation, and service layer. |
| **joshtonava** | Schema validation, fail-loud behavior | Requested fail-loud schema validation in api-form-schema; co-enforcer with chouinar |
| **mikehgrantsgov** | Auth multi-auth patterns, route correctness | Caught auth object mismatch bugs; enforcer of multi-auth user retrieval patterns |
| **doug-s-nava** | Form UI schema alignment, PDF matching | Enforcer of PDF-aligned section labels; caught instruction inconsistencies |
| **mdragon** | CI/CD workflows, deployment ordering | Enforced prod-first deployment ordering; primary CI/CD authority |

### Frontend Domains

| Reviewer | Authority Areas | Enforcement Style |
|----------|----------------|-------------------|
| **doug-s-nava** | Component architecture, i18n conventions, code style, props patterns, test patterns, server action usage | Primary frontend authority. Frequently provides architectural guidance. Authored code style documentation. |
| **andycochran** | USWDS compliance, design system alignment, i18n content structure | Enforces USWDS utility class usage and proper element styling |
| **acouch** | Design token precision, USWDS color tokens | Precise enforcement of design system tokens (e.g., `text-gray-50`) |
| **ErinPattisonNava** | Conditional rendering patterns | Advocated for ternary over `&&` standardization |

### Infrastructure

| Reviewer | Authority Areas | Enforcement Style |
|----------|----------------|-------------------|
| **chouinar** | Environment variables, SSM patterns, secret management | Enforces the two-tier env var pattern; rejects custom SSM resources |
| **sean-navapbc** | Terraform module design, variables vs. locals | Enforced "prefer variables over locals always" |
| **mdragon** | CI/CD pipeline design, deployment ordering, cross-repo patterns | Primary CI/CD pipeline authority |
| **pcraig3** | NOFOs-specific deployment patterns | Co-maintainer of NOFOs pipeline |

---

## Recommendations for Tier 1 Architecture Guide

Based on the cross-domain synthesis, the following themes should be highlighted in the top-level architecture guide:

### 1. The Layered Architecture Contract

Document the explicit boundaries between layers (routes/services/models in API; pages/components/services in frontend; app-config/service/modules in infra). The key rule: each layer has a specific responsibility and violations are caught in review.

### 2. The Logging Standard

This is the most frequently enforced cross-cutting rule. Document it once, prominently:
- Static messages + `extra={}` for dynamic data
- Flat snake_case keys
- `info` for client errors, `warning` for operational concerns only
- No PII in logs

### 3. The Validation Lifecycle

Document the full validation flow across the stack:
- Marshmallow (route-level schema validation)
- Pydantic (service-level input parsing)
- JSON Schema + Rule Schema (form-level validation)
- `ValidationErrorType` as the API-frontend contract
- Non-blocking (warnings) during save, blocking at submission

### 4. The Auth Architecture

Document the multi-auth composition pattern, the auth scheme registration process, the user retrieval rules, and the authorization check ordering (404 -> auth -> business logic).

### 5. The Feature Flag Lifecycle

Unify the three naming conventions, document the creation-to-cleanup lifecycle, and establish a central registry.

### 6. The Forms Domain

As assessed above, this warrants its own dedicated guide due to its unique three-schema architecture, XML compatibility requirements, and cross-layer impact.

### 7. The Testing Pyramid

Document the project's testing strategy across domains:
- **API:** Factory-based tests, `.build()` vs `.create()`, `enable_factory_create` gate, pytest-only, SQLAlchemy 2.0 query style
- **Frontend unit:** Jest + RTL, accessibility tests mandatory, shared i18n mocks, direct invocation for async server components
- **Frontend E2E:** Playwright, multi-browser, sharded, spoofed auth, Page Object Model for forms
- **All domains:** Centralized fixtures, factory pattern, role-based test queries

### 8. Key Technical Decisions to Document

These are decisions that were made explicitly and should not be revisited without discussion:
- UUID primary keys for all new tables (api-database Rule 2)
- `back_populates` over `backref` (api-database Rule 6)
- Server components by default, `"use client"` only when required (frontend-components Rule 3)
- No barrel files (frontend-components Rule 12)
- Single translation file, English-only (frontend-i18n Rules 1, 9)
- JSON Schema Draft 2020-12 with custom validator (api-form-schema Rule 2)
- PUT = full replacement (api-services Rule 14)
- Soft deletes for user-facing deletions (api-routes Rule 14)
