# Cross-Domain Patterns -- Pattern Review

**Reviewer(s):** chouinar, doug-s-nava
**Domains synthesized:** 14
**Cross-cutting patterns:** 10
**Inconsistencies requiring resolution:** 7

---

> **IMPORTANT: A note on inconsistencies**
>
> This extraction will surface patterns that are inconsistent -- where the codebase
> does things two or three different ways. Some of these inconsistencies may be
> intentional (different contexts warranting different approaches) or evolutionary
> (the team moved from approach A to approach B but hasn't migrated everything).
>
> A big part of this review is resolving that ambiguity -- deciding which patterns
> are canonical, which are legacy, and which represent intentional variation.
> Please don't assume that the most common pattern is automatically the right one.

---

## How to Review

For each pattern, inconsistency, or coverage gap below, use the checkbox block to record your assessment:

- **Accurate?** -- Does this rule correctly describe what the team does (or should do)?
- **Canonical?** -- Should this be a documented, enforced rule going forward?
- **Wording** -- Is the rule statement clear, or does it need revision?
- **Missing context** -- Is there nuance or exception the extraction missed?

For inconsistencies, you are being asked to **make a decision** about which approach is canonical.

---

## Cross-Cutting Patterns

### CCP-1: Structured Logging -- Static Messages, Variable Data in `extra={}`

**Domains:** api-auth, api-routes, api-services, api-validation

**Rule:** ALWAYS use static log message strings. ALWAYS put dynamic values (IDs, counts, statuses) in the `extra={}` dict. NEVER embed dynamic data in log message strings. NEVER log PII (emails, names).

**Sub-rule:** ALWAYS use flat snake_case keys (e.g., `user_id`, `opportunity_id`). NEVER use dotted/nested keys (e.g., `user.id`, `application.application_id`). The `auth.` prefix is a documented exception for auth-specific fields.

**Evidence:**
- api-auth: PR #4965 corrected `"user.id"` dotted keys to flat `user_id`
- api-routes: Dedicated cleanup PR #4965 renamed nested keys project-wide
- api-services: 10+ explicit reviewer corrections; reviewer chouinar: "Avoid putting variable data in log messages, makes it harder to find them"
- api-validation: PR #5146 shows correct structured logging in validation functions

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-2: Log Level Discipline -- `info` for 4xx, `warning` for Operational Concerns Only

**Domains:** api-auth, api-routes, api-validation

**Rule:** NEVER use `logger.warning()` for expected client errors (401, 403, 404, 422). ALWAYS use `logger.info()`. Warning-level logs trigger alerts in New Relic and should be reserved for actual operational problems.

**Evidence:**
- api-auth: PR #4936 reviewer chouinar: "Warning logs will alert us, we don't want to be alerted for 4xx errors"
- api-routes: Same enforcement in PR #4936 review
- api-validation: Corrective enforcement in PRs #4936, #5146

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-3: Factory Pattern for Test Data -- `.build()` for Unit, `.create()` for Integration

**Domains:** api-tests, api-services, api-validation, api-form-schema, frontend-tests, frontend-services, frontend-components

**Rule:** ALWAYS use factory `.build()` when no database/persistence is needed. Use `.create()` only when records must exist in the database. On the frontend, use centralized typed fixtures in `fixtures.ts`.

**Evidence:**
- api-tests: PR #8614 reviewer chouinar: "If we don't want anything in the DB / want to keep it simple, use `.build()`"
- api-services: Same reviewer guidance across multiple PRs
- frontend-tests: Consistent use of `src/utils/testing/fixtures.ts` across 25+ PRs

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-4: `raise_flask_error()` with `ValidationErrorDetail` for All API Errors

**Domains:** api-routes, api-services, api-validation

**Rule:** ALWAYS use `raise_flask_error(status_code, message, validation_issues=[...])` for error responses. Each `ValidationErrorDetail` MUST include a `type` from the centralized `ValidationErrorType` StrEnum and a human-readable message. The `type` field is the API-frontend contract for localized message mapping.

**Evidence:**
- api-validation: 7/10 PRs modify `ValidationErrorType`; reviewer chouinar explicitly defined the frontend contract role
- api-routes: All error-handling code uses this pattern
- api-services: ~85% of service functions with error cases use `raise_flask_error`

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-5: Thin Handlers / Service Layer Separation

**Domains:** api-routes, api-services, api-validation

**Rule:** ALWAYS keep route handlers thin. Business logic, validation, and DB queries MUST live in service functions under `src/services/<domain>/`. Route handlers contain only: logging setup, auth/identity verification, a `db_session.begin()` block calling the service, and `response.ApiResponse` return.

**Evidence:**
- api-routes: 100% of examined handlers follow this; enforced in PRs #4513, #5611, #4989
- api-services: One function per file, organized by domain subdirectory
- api-validation: Validation logic always in `application_validation.py`, never in routes

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-6: Boolean Fields Named as Questions (`is_`, `has_`, `can_`, `was_`)

**Domains:** api-routes, api-services, api-database

**Rule:** ALWAYS name boolean fields and parameters using question-form prefixes (`is_`, `has_`, `can_`, `was_`).

**Evidence:**
- api-routes: Enforced by reviewer in PR #4493; `has_active_opportunity`, `is_test_agency`, `is_deleted`
- api-services: PR #4493 renamed `active` to `has_active_opportunity`

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-7: Accessibility Testing as Mandatory First-Class Concern

**Domains:** frontend-tests, frontend-components, frontend-services

**Rule:** ALWAYS include a `jest-axe` accessibility scan (`toHaveNoViolations()`) for every new frontend component. E2E tests run across Chromium, Firefox, WebKit, and Mobile Chrome.

**Evidence:**
- frontend-tests: Present in ~30+ PRs, nearly every new component test suite
- frontend-components: Documented as part of the standard test structure
- ci-cd: Multi-browser Playwright configuration enforced in e2e workflows

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-8: Feature Flags Gated via Environment Variables / SSM

**Domains:** ci-cd, infra, frontend-services

**Rule:** ALWAYS gate new capabilities behind feature flags. API flags use `ENABLE_{FEATURE}_ENDPOINTS` in Terraform. Frontend flags use `FEATURE_{NAME}_OFF` backed by SSM parameters with `manage_method = "manual"`. Flags MUST be set in all environments before merge.

**Evidence:**
- infra: 10+ PRs adding `FEATURE_*_OFF` entries to `environment_variables.tf`
- ci-cd: PR #6542 shows CommonGrants endpoint flag
- frontend-services: `withFeatureFlag` HOC pattern; PR #8336 shows flag cleanup

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-9: No Wildcard Eager Loading -- Explicit `selectinload()` Only

**Domains:** api-auth, api-services

**Rule:** NEVER use `selectinload("*")`. ALWAYS specify exact relationships to load.

**Evidence:**
- api-auth: Corrective PR #5048 fixed wildcard loading that caused query explosion
- api-services: PR #8620 reviewer: "don't do selectinload('*') - that fetches every relationship from an opportunity which ends up being about half the DB"

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### CCP-10: SSM Parameters Must Exist Before Merge

**Domains:** infra, ci-cd

**Rule:** ALWAYS create SSM parameters in all environments (dev, staging, training, prod) before merging a PR that references them. Even placeholder values are acceptable. Deploys will fail if parameters are missing.

**Evidence:**
- infra: Enforced in multiple review threads (PRs #8392, #6465)
- ci-cd: Feature flags backed by SSM must be pre-created

```
- [ ] Accurate -- correctly describes the pattern
- [ ] Canonical -- should be an enforced rule
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

## Architectural Principles

### AP-1: Fail Loudly, Never Silently

The project consistently rejects silent failures, fallbacks, and placeholder values:
- **api-form-schema** (Rule 3): Invalid JSON schemas MUST propagate as 500s, not produce undefined behavior
- **api-form-schema** (Rule 17): "If data is malformed just let it error" (reviewer chouinar)
- **api-validation**: Precondition checks raise immediately; only form validation aggregates errors
- **infra** (Pattern 5): Missing SSM parameters cause deploy failures -- by design

```
- [ ] Accurate -- correctly describes the principle
- [ ] Canonical -- should be documented as an architectural principle
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### AP-2: Separation of Concerns via Layered Architecture

Every domain exhibits clear layering:
- **API:** Routes (HTTP contract) -> Services (business logic) -> Models (data) -> Migrations (schema)
- **Frontend:** Pages (data fetching) -> Components (presentation) -> Services/Hooks (API integration) -> Types (contracts)
- **Infra:** app-config (pure configuration, no AWS calls) -> service (resource creation) -> modules (reusable components)
- **Forms:** JSON Schema (validation) -> UI Schema (rendering) -> Rule Schema (business rules) -> XML Transform (output)

```
- [ ] Accurate -- correctly describes the principle
- [ ] Canonical -- should be documented as an architectural principle
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### AP-3: Convention Over Configuration, Enforced by Review

The project relies heavily on reviewer-enforced conventions rather than automated tooling:
- Naming conventions (boolean question-form, singular table names, PascalCase namespaces) are enforced in code review, not linting
- Several domains note "should this be an ESLint/lint rule?" as open questions but have not yet implemented them
- The primary enforcer across API domains is **chouinar**; across frontend domains is **doug-s-nava**

```
- [ ] Accurate -- correctly describes the principle
- [ ] Canonical -- should be documented as an architectural principle
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### AP-4: Database as Source of Truth, Code as Configuration

- Form schemas are static Python objects, NOT database-fetched (api-form-schema Rule 1)
- Lookup values are declared in Python code and auto-synced to DB (api-database Rule 8)
- Feature flags are SSM-backed but declared in Terraform (infra Pattern 6)
- Translation strings live in a single TypeScript file, not a CMS (frontend-i18n Rule 1)

```
- [ ] Accurate -- correctly describes the principle
- [ ] Canonical -- should be documented as an architectural principle
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### AP-5: Non-Blocking UX for Complex Federal Forms

- Form validation returns warnings during editing; only blocks at submission (api-form-schema Rule 4, api-services Rule 24)
- Soft deletes preserve data for audit trails and un-delete flows (api-routes Rule 14)
- Promise-as-props pattern enables non-blocking data loading in the frontend (frontend-components Rule 4)

```
- [ ] Accurate -- correctly describes the principle
- [ ] Canonical -- should be documented as an architectural principle
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### AP-6: Infrastructure Abstraction -- No Provider Names in Public APIs

- Auth class names must not reference AWS, Login.gov, or other providers (api-auth Pattern 12)
- Internal S3 URLs must not appear in API responses (api-services Rule 20)
- Feature flags abstract deployment details from runtime behavior

```
- [ ] Accurate -- correctly describes the principle
- [ ] Canonical -- should be documented as an architectural principle
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

### AP-7: Legacy Grants.gov Compatibility as Hard Constraint

- XML output must match legacy element order, namespace declarations, and attribute values (api-form-schema Rules 6-8)
- Enum values sourced from `UniversalCodes-V2.0.xsd` (api-form-schema Rule 11)
- UI section labels match PDF form numbering, not legacy instructions (api-form-schema Rule 5)

```
- [ ] Accurate -- correctly describes the principle
- [ ] Canonical -- should be documented as an architectural principle
- [ ] Wording is clear
- [ ] Missing context: _______________
- [ ] Recommended change: _______________
```

---

## Inconsistencies Requiring Resolution

Each inconsistency below requires a **tech lead decision**. Please select the canonical approach or document why intentional variation is acceptable.

### INC-1: Feature Flag Naming Convention

Three different patterns coexist:

| Domain | Convention | Example |
|--------|-----------|---------|
| Infra (frontend) | `FEATURE_{NAME}_OFF` with SSM `manage_method = "manual"` | `FEATURE_USER_ADMIN_OFF` |
| Infra (API) | `ENABLE_{FEATURE}_ENDPOINTS = 1` as plain env var | `ENABLE_COMMON_GRANTS_ENDPOINTS = 1` |
| Local dev | `ENABLE_{FEATURE}=TRUE` | `ENABLE_AUTH_ENDPOINT=TRUE` |

Three different naming patterns and three different truthy values (`1`, `TRUE`, SSM-managed).

**Decision needed:** Which naming pattern and truthy value should be canonical for all new feature flags?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: canonical approach is _______________
- [ ] Intentional variation -- different contexts warrant different approaches because: _______________
- [ ] Additional context: _______________
```

---

### INC-2: File Naming -- Singular vs. Plural

- API routes: `agency_schema.py` (singular) vs. `user_schemas.py` (plural)
- API routes: `competition_route.py` vs. `user_routes.py`
- No enforcement mechanism exists; noted as an open question in api-routes Rule 18

**Decision needed:** Should file names use singular or plural? Should this be documented?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: canonical approach is _______________
- [ ] Intentional variation -- different contexts warrant different approaches because: _______________
- [ ] Additional context: _______________
```

---

### INC-3: Validation Framework Dual Stack

Four validation libraries across the stack:
- **API route-level validation:** Marshmallow schemas with `@validates_schema` for cross-field validation
- **API service-level validation:** Pydantic `BaseModel` with `model_validate()` for input parsing
- **Form validation:** JSON Schema Draft 2020-12 with custom `OUR_VALIDATOR`
- **Frontend server actions:** Zod schemas with `safeParse()`

The Marshmallow/Pydantic dual-use in the API is explicitly acknowledged but not resolved.

**Decision needed:** Is the four-library approach intentional (each layer has a different need), or should the API consolidate on one of Marshmallow or Pydantic?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: canonical approach is _______________
- [ ] Intentional variation -- different contexts warrant different approaches because: _______________
- [ ] Additional context: _______________
```

---

### INC-4: Auth Object Name Evolution

The multi-auth object naming evolved over time: `jwt_or_key_multi_auth` -> `jwt_or_api_user_key_multi_auth`. Older endpoints have not been migrated. The API routes document flags this as needing tech lead resolution.

**Decision needed:** Should older endpoints be migrated to the new auth object name, or is the old name acceptable where it exists?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: canonical approach is _______________
- [ ] Intentional variation -- different contexts warrant different approaches because: _______________
- [ ] Additional context: _______________
```

---

### INC-5: `server only` vs. `server-only` Directive

Frontend service files inconsistently use `"server only"` (with space) and `"server-only"` (with hyphen). The Next.js official package is `server-only` (with hyphen).

**Decision needed:** Which form should be canonical?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: canonical approach is _______________
- [ ] Intentional variation -- different contexts warrant different approaches because: _______________
- [ ] Additional context: _______________
```

---

### INC-6: Test File Location (Frontend)

Frontend tests are in flux between two patterns:
- **Traditional:** `frontend/tests/components/<path>/<Component>.test.tsx`
- **Co-located:** `frontend/src/components/<path>/<Component>.test.tsx`

Both patterns coexist. No formal decision has been documented.

**Decision needed:** Should new tests be co-located with components, or placed in `tests/`? Is there an active migration?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: canonical approach is _______________
- [ ] Intentional variation -- different contexts warrant different approaches because: _______________
- [ ] Additional context: _______________
```

---

### INC-7: Authorization Utility Duplication

The API has both `verify_access()` and `check_user_access()` doing overlapping work (flagged in PR #8632).

**Decision needed:** Should these be consolidated? Which function should be kept?

```
- [ ] This inconsistency is real and needs resolution
- [ ] Decision: canonical approach is _______________
- [ ] Intentional variation -- different contexts warrant different approaches because: _______________
- [ ] Additional context: _______________
```

---

## Coverage Gaps

Each gap below asks: **Should we create a convention for this?**

### GAP-1: No Automated Enforcement of Naming Conventions

Multiple domains note that naming conventions (boolean question-form, camelCase translation keys, singular table names, flat log keys) are enforced only by reviewer diligence. No ESLint rules, Ruff rules, or custom linters enforce these. Suggested rules include:
- `react/destructuring-assignment` (frontend-components Rule 2)
- `eqeqeq` (frontend-components Rule 13)
- camelCase check for i18n keys (frontend-i18n Rule 3)
- Boolean naming lint rule (api-services Rule 18)

```
- [ ] Should create a convention / lint rules for this
- [ ] Not worth the effort -- reviewer enforcement is sufficient
- [ ] Specific rules to implement: _______________
```

---

### GAP-2: No Centralized Feature Flag Registry

Feature flags are scattered across Terraform configs, SSM parameters, and code references. There is no single registry showing all active flags, their current state per environment, or their cleanup status.

```
- [ ] Should create a convention for this
- [ ] Not worth the effort right now
- [ ] Notes: _______________
```

---

### GAP-3: No Formal API Versioning Strategy

The API uses path-based versioning (`/v1/`, `/alpha/`) but there is no documented strategy for when to promote alpha to v1, when to create v2, or how breaking changes are managed.

```
- [ ] Should create a convention for this
- [ ] Not worth the effort right now
- [ ] Notes: _______________
```

---

### GAP-4: No Database Query Performance Guidelines

While `selectinload("*")` is banned, there are no documented guidelines for:
- When to use `selectinload` vs. `joinedload` vs. `subqueryload`
- Query complexity limits or N+1 detection
- Index creation conventions beyond "add index to FK columns"

```
- [ ] Should create a convention for this
- [ ] Not worth the effort right now
- [ ] Notes: _______________
```

---

### GAP-5: No Error Monitoring / Alert Level Documentation

The "info for 4xx, warning for ops concerns" rule is clear, but there is no documented guidance on:
- When to use `logger.error()` vs. `logger.exception()`
- What constitutes an "operational concern" warranting a warning
- How New Relic alert policies map to log levels

```
- [ ] Should create a convention for this
- [ ] Not worth the effort right now
- [ ] Notes: _______________
```

---

### GAP-6: No Frontend Error Boundary Strategy

The frontend uses `<TopLevelError />` and `<NotFound />` for page-level errors, and `parseErrorStatus()` for status code extraction. But there is no documented strategy for:
- Component-level error boundaries
- Retry behavior for transient failures
- User-facing error message standards beyond the i18n pattern

```
- [ ] Should create a convention for this
- [ ] Not worth the effort right now
- [ ] Notes: _______________
```

---

### GAP-7: No Dependency Update Policy

Vulnerability scanning is well-documented (ci-cd Pattern 10), but there is no policy for:
- How frequently dependencies are updated
- Who is responsible for reviewing `.trivyignore` / `.dockleignore` suppressions
- SLA for addressing discovered vulnerabilities

```
- [ ] Should create a convention for this
- [ ] Not worth the effort right now
- [ ] Notes: _______________
```

---

### GAP-8: No Migration Rollback Strategy

Database migrations use Alembic with `upgrade()` and `downgrade()` functions, but there is no documented policy for:
- When and how to roll back migrations in production
- How to handle data migrations that cannot be cleanly reversed
- Testing downgrade paths

```
- [ ] Should create a convention for this
- [ ] Not worth the effort right now
- [ ] Notes: _______________
```

---

## Reviewer Authority Map

The following map summarizes who has authority over which patterns, based on observed review enforcement. Please confirm or adjust.

### API Domains

| Reviewer | Authority Areas | Enforcement Style |
|----------|----------------|-------------------|
| **chouinar** | Database architecture, service layer patterns, logging conventions, auth design, query patterns, transaction management, naming conventions, form schema architecture | Primary authority across all API domains. Decisive, frequently corrects patterns. Authored foundational patterns for lookup tables, validation, and service layer. |
| **joshtonava** | Schema validation, fail-loud behavior | Requested fail-loud schema validation in api-form-schema; co-enforcer with chouinar |
| **mikehgrantsgov** | Auth multi-auth patterns, route correctness | Caught auth object mismatch bugs; enforcer of multi-auth user retrieval patterns |
| **doug-s-nava** | Form UI schema alignment, PDF matching | Enforcer of PDF-aligned section labels; caught instruction inconsistencies |
| **mdragon** | CI/CD workflows, deployment ordering | Enforced prod-first deployment ordering; primary CI/CD authority |

```
- [ ] Accurate -- these authority areas are correct
- [ ] Adjustments needed: _______________
```

### Frontend Domains

| Reviewer | Authority Areas | Enforcement Style |
|----------|----------------|-------------------|
| **doug-s-nava** | Component architecture, i18n conventions, code style, props patterns, test patterns, server action usage | Primary frontend authority. Frequently provides architectural guidance. Authored code style documentation. |
| **andycochran** | USWDS compliance, design system alignment, i18n content structure | Enforces USWDS utility class usage and proper element styling |
| **acouch** | Design token precision, USWDS color tokens | Precise enforcement of design system tokens (e.g., `text-gray-50`) |
| **ErinPattisonNava** | Conditional rendering patterns | Advocated for ternary over `&&` standardization |

```
- [ ] Accurate -- these authority areas are correct
- [ ] Adjustments needed: _______________
```

### Infrastructure

| Reviewer | Authority Areas | Enforcement Style |
|----------|----------------|-------------------|
| **chouinar** | Environment variables, SSM patterns, secret management | Enforces the two-tier env var pattern; rejects custom SSM resources |
| **sean-navapbc** | Terraform module design, variables vs. locals | Enforced "prefer variables over locals always" |
| **mdragon** | CI/CD pipeline design, deployment ordering, cross-repo patterns | Primary CI/CD pipeline authority |
| **pcraig3** | NOFOs-specific deployment patterns | Co-maintainer of NOFOs pipeline |

```
- [ ] Accurate -- these authority areas are correct
- [ ] Adjustments needed: _______________
```
