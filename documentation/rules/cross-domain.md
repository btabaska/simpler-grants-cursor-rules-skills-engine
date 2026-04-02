# Cross-Domain Patterns — Conventions & Rules

> **Status:** Draft — pending tech lead validation. Items marked (⏳) are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

This document captures patterns that span three or more domains in the Simpler Grants codebase. These cross-cutting conventions form the project's architectural backbone — they are the shared norms that every contributor encounters regardless of which application layer they work in. The 10 cross-cutting patterns (CCP-1 through CCP-10) were identified through synthesis of 13 Pass 2 codification documents covering api-auth, api-database, api-form-schema, api-routes, api-services, api-tests, api-validation, ci-cd, infra, frontend-components, frontend-i18n, frontend-services, and frontend-tests.

Beyond individual patterns, this document also captures 7 architectural principles that emerge from the accumulated patterns, 7 inter-domain inconsistencies that need resolution, and 8 coverage gaps where conventions are missing or undocumented. The project relies heavily on reviewer-enforced conventions — **chouinar** is the primary authority across all API domains, **doug-s-nava** across frontend domains, and **mdragon** for CI/CD pipeline design.

For domain-specific rules, see [Infrastructure Conventions](infra.md), [CI/CD Conventions](ci-cd.md), and [Forms Vertical](forms-vertical.md).

## Rules

### Logging & Observability

#### Rule: CCP-1 — Structured Logging with Static Messages and Variable Data in `extra={}`
**Confidence:** High
**Observed in:** 4 domains (api-auth, api-routes, api-services, api-validation) | PR refs: #4965, #5146

ALWAYS use static log message strings. ALWAYS put dynamic values (IDs, counts, statuses) in the `extra={}` dict. NEVER embed dynamic data in log message strings. NEVER log PII (emails, names). ALWAYS use flat snake_case keys (e.g., `user_id`, `opportunity_id`). NEVER use dotted/nested keys (e.g., `user.id`). The `auth.` prefix is a documented exception for auth-specific fields.

**DO:**
```python
# From PR #4965 — correct structured logging with flat keys
logger.info(
    "User login completed successfully",
    extra={"user_id": user.user_id, "auth_method": "jwt"},
)
```

**DON'T:**
```python
# Anti-pattern — dynamic data in message string, dotted keys
logger.info(
    f"User {user.user_id} login completed",  # WRONG: dynamic data in message
    extra={"user.id": user.user_id},  # WRONG: dotted key
)
```

> **Rationale:** Static messages are searchable in log aggregation tools. Dynamic data in `extra={}` enables structured querying. Reviewer chouinar: "Avoid putting variable data in log messages, makes it harder to find them." PR #4965 corrected dotted keys project-wide.

---

#### Rule: CCP-2 — Log Level Discipline: `info` for 4xx, `warning` for Operational Concerns Only
**Confidence:** High
**Observed in:** 3 domains (api-auth, api-routes, api-validation) | PR refs: #4936, #5146

NEVER use `logger.warning()` for expected client errors (401, 403, 404, 422). ALWAYS use `logger.info()`. Warning-level logs trigger alerts in New Relic and should be reserved for actual operational problems.

**DO:**
```python
# From PR #4936 — info level for expected client error
logger.info(
    "Authentication failed: invalid token",
    extra={"auth_method": "jwt", "status_code": 401},
)
```

**DON'T:**
```python
# Anti-pattern — warning for client errors triggers alerts
logger.warning(
    "Authentication failed: invalid token",  # WRONG: 401 is expected, not an operational concern
    extra={"auth_method": "jwt"},
)
# Reviewer chouinar: "Warning logs will alert us, we don't want to be alerted for 4xx errors"
```

> **Rationale:** Warning-level logs trigger alerts in New Relic. Client errors (4xx) are expected and should not cause operational alerts. Only genuine operational concerns (degraded service, unexpected failures) warrant warning level.

---

### Test Data & Factories

#### Rule: CCP-3 — Factory Pattern for Test Data: `.build()` for Unit, `.create()` for Integration
**Confidence:** High
**Observed in:** 7 domains (api-tests, api-services, api-validation, api-form-schema, frontend-tests, frontend-services, frontend-components) | PR refs: #8614, #6846

ALWAYS use factory `.build()` when no database/persistence is needed. Use `.create()` only when records must exist in the database. On the frontend, use centralized typed fixtures in `fixtures.ts`.

**DO:**
```python
# From PR #8614 — using .build() for in-memory-only tests
def make_application(attachments=None, forms=None):
    """Build an Application with explicit attachment and form lists.
    We set the lists directly after building because the factory's RelatedFactory
    traits hit the DB; here we just want in-memory objects.
    """
    app = ApplicationFactory.build()
    app.application_attachments = attachments or []
    app.application_forms = forms or []
    return app
```

**DON'T:**
```python
# Anti-pattern — using .create() when no DB is needed
# Reviewer chouinar in PR #8614: "If we don't want anything in the DB /
# want to keep it simple, use `.build()`"
app = ApplicationFactory.create()  # WRONG: unnecessary DB round-trip
```

> **Rationale:** `.build()` is faster (no DB round-trip), does not require `enable_factory_create`, and keeps tests isolated from database state. On the frontend, centralized fixtures in `src/utils/testing/fixtures.ts` ensure consistency across 25+ PRs.

---

### Error Handling

#### Rule: CCP-4 — `raise_flask_error()` with `ValidationErrorDetail` for All API Errors
**Confidence:** High
**Observed in:** 3 domains (api-routes, api-services, api-validation) | PR refs: #4513, #5146

ALWAYS use `raise_flask_error(status_code, message, validation_issues=[...])` for error responses. Each `ValidationErrorDetail` MUST include a `type` from the centralized `ValidationErrorType` StrEnum and a human-readable message. The `type` field is the API-frontend contract for localized message mapping.

**DO:**
```python
# From PR #5146 — correct error response with ValidationErrorDetail
raise_flask_error(
    422,
    "Validation failed",
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.REQUIRED,
            message="'name' is a required property",
            field="$.name",
        )
    ],
)
```

**DON'T:**
```python
# Anti-pattern — raw Flask abort without structured error details
from flask import abort
abort(422)  # WRONG: no validation details, no type for frontend mapping
```

> **Rationale:** 7/10 PRs in the api-validation domain modify `ValidationErrorType`. Reviewer chouinar explicitly defined the `type` field as the API-frontend contract for localized message mapping. ~85% of service functions with error cases use `raise_flask_error`.

---

### Architecture

#### Rule: CCP-5 — Thin Handlers / Service Layer Separation
**Confidence:** High
**Observed in:** 3 domains (api-routes, api-services, api-validation) | PR refs: #4513, #5611, #4989

ALWAYS keep route handlers thin. Business logic, validation, and DB queries MUST live in service functions under `src/services/<domain>/`. Route handlers contain only: logging setup, auth/identity verification, a `db_session.begin()` block calling the service, and `response.ApiResponse` return.

**DO:**
```python
# From PR #4513 — thin route handler delegating to service
@app.route("/v1/applications/<application_id>/forms/<form_id>", methods=["PUT"])
@login_required
def update_application_form(application_id, form_id):
    logger.info("PUT application form", extra={"application_id": application_id})
    with db_session.begin():
        result = update_application_form_service(db_session, application_id, form_id, request.json)
    return response.ApiResponse(result)
```

**DON'T:**
```python
# Anti-pattern — business logic in route handler
@app.route("/v1/applications/<application_id>/forms/<form_id>", methods=["PUT"])
def update_application_form(application_id, form_id):
    form = db_session.query(Form).get(form_id)  # WRONG: DB query in handler
    if not form:
        raise_flask_error(404, "Form not found")
    validate_json_schema(request.json, form.json_schema)  # WRONG: validation in handler
    # ... more business logic ...
```

> **Rationale:** 100% of examined handlers follow this pattern. One function per file in the service layer, organized by domain subdirectory. Validation logic always in dedicated validation modules, never in routes.

---

#### Rule: CCP-6 — Boolean Fields Named as Questions (`is_`, `has_`, `can_`, `was_`)
**Confidence:** High
**Observed in:** 3 domains (api-routes, api-services, api-database) | PR refs: #4493

ALWAYS name boolean fields and parameters using question-form prefixes: `is_`, `has_`, `can_`, `was_`.

**DO:**
```python
# From PR #4493 — boolean with question-form prefix
has_active_opportunity = Column(Boolean, default=False)
is_test_agency = Column(Boolean, default=False)
is_deleted = Column(Boolean, default=False)
```

**DON'T:**
```python
# Anti-pattern — boolean without question-form prefix
# PR #4493 renamed 'active' to 'has_active_opportunity'
active = Column(Boolean, default=False)  # WRONG: ambiguous name
```

> **Rationale:** Question-form booleans are self-documenting: `if agency.is_test_agency` reads naturally. Reviewer enforced this rename in PR #4493.

---

#### Rule: CCP-7 — Accessibility Testing as Mandatory First-Class Concern
**Confidence:** High
**Observed in:** 3 domains (frontend-tests, frontend-components, frontend-services) | PR refs: #7346, #5008

ALWAYS include a `jest-axe` accessibility scan (`toHaveNoViolations()`) for every new frontend component. E2E tests run across Chromium, Firefox, WebKit, and Mobile Chrome.

**DO:**
```tsx
// From PR #7346 — accessibility test for InviteLegacyUsersButton
import { axe } from "jest-axe";

it("should not have accessibility violations", async () => {
  const { container } = render(
    <InviteLegacyUsersButton organizationId="org-123" />,
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**DON'T:**
```tsx
// Anti-pattern — component test suite without accessibility scan
describe("InviteLegacyUsersButton", () => {
  it("renders the button", () => {
    render(<InviteLegacyUsersButton organizationId="org-123" />);
    // WRONG: no accessibility test — all component suites must include jest-axe
  });
});
```

> **Rationale:** The project serves government users and must meet Section 508 accessibility standards. Present in ~30+ PRs, nearly every new component test suite.

---

### Feature Flags & Configuration

#### Rule: CCP-8 — Feature Flags Gated via Environment Variables / SSM
**Confidence:** High
**Observed in:** 3 domains (ci-cd, infra, frontend-services) | PR refs: #6542, #6419, #8336

ALWAYS gate new capabilities behind feature flags. API flags use `ENABLE_{FEATURE}_ENDPOINTS` in Terraform. Frontend flags use `FEATURE_{NAME}_OFF` backed by SSM parameters with `manage_method = "manual"`. Flags MUST be set in all environments before merge.

**DO:**
```hcl
# From PR #6419 — frontend feature flag via SSM
# infra/frontend/app-config/env-config/environment_variables.tf
FEATURE_USER_ADMIN_OFF = {
  manage_method     = "manual"
  secret_store_name = "/${var.app_name}/${var.environment}/feature-user-admin-off"
},
```

**DON'T:**
```python
# Anti-pattern — feature gated by code comment or hardcoded boolean
SHOW_USER_ADMIN = True  # WRONG: no environment-level control, no runtime toggling
```

> **Rationale:** Feature flags decouple deployment from release. SSM-backed flags enable runtime toggling without redeployment. 10+ PRs add `FEATURE_*_OFF` entries to `environment_variables.tf`.

---

### Database & ORM

#### Rule: CCP-9 — No Wildcard Eager Loading: Explicit `selectinload()` Only
**Confidence:** High
**Observed in:** 2 domains (api-auth, api-services) | PR refs: #5048, #8620

NEVER use `selectinload("*")`. ALWAYS specify exact relationships to load.

**DO:**
```python
# From PR #8620 — explicit relationship loading
query = select(Opportunity).options(
    selectinload(Opportunity.current_opportunity_summary),
    selectinload(Opportunity.agency),
)
```

**DON'T:**
```python
# Anti-pattern — wildcard loading causes query explosion
query = select(Opportunity).options(
    selectinload("*"),  # WRONG: fetches every relationship, "about half the DB"
)
# Reviewer in PR #8620: "don't do selectinload('*') - that fetches every relationship
# from an opportunity which ends up being about half the DB"
```

> **Rationale:** Corrective PR #5048 fixed wildcard loading that caused query explosion. Wildcard loading defeats the purpose of lazy loading and can cause serious performance problems on models with many relationships.

---

### Infrastructure Safety

#### Rule: CCP-10 — SSM Parameters Must Exist Before Merge
**Confidence:** High
**Observed in:** 2 domains (infra, ci-cd) | PR refs: #8392, #6465

ALWAYS create SSM parameters in all environments (dev, staging, training, prod) before merging a PR that references them. Even placeholder values are acceptable. Deploys will fail if parameters are missing.

**DO:**
```text
# From PR #8392 — reviewer enforcement by chouinar:
# "Have you added values for all of these into parameter store for every env?
#  Even if we don't have actual values yet, if they don't exist, deploys will fail
#  as it tries to fetch them."
#
# Author responded with a screenshot confirming parameters were created
# in dev, staging, training, and prod.
```

**DON'T:**
```text
# Anti-pattern — merging a PR that references new SSM parameters without
# creating them first. The deployment pipeline fetches all SSM parameters
# during terraform apply; missing parameters cause immediate deploy failure.
```

> **Rationale:** The deployment pipeline fetches all SSM parameters during `terraform apply`. Missing parameters cause immediate deploy failure across all environments. Creating parameters before merge is a safety gate enforced by reviewer diligence.

---

## Architectural Principles

These are higher-level design philosophies inferred from the accumulated patterns across all domains.

### AP-1: Fail Loudly, Never Silently

The project consistently rejects silent failures, fallbacks, and placeholder values:
- **api-form-schema (Rule 3):** Invalid JSON schemas MUST propagate as 500s, not produce undefined behavior
- **api-form-schema (Rule 17):** "If data is malformed just let it error" (reviewer chouinar)
- **api-validation:** Precondition checks raise immediately; only form validation aggregates errors
- **infra (Pattern 5):** Missing SSM parameters cause deploy failures — by design

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

- Form validation returns warnings during editing; only blocks at submission (api-form-schema Rule 4)
- Soft deletes preserve data for audit trails and un-delete flows (api-routes Rule 14)
- Promise-as-props pattern enables non-blocking data loading in the frontend (frontend-components Rule 4)

### AP-6: Infrastructure Abstraction — No Provider Names in Public APIs

- Auth class names must not reference AWS, Login.gov, or other providers (api-auth Pattern 12)
- Internal S3 URLs must not appear in API responses (api-services Rule 20)
- Feature flags abstract deployment details from runtime behavior

### AP-7: Legacy Grants.gov Compatibility as Hard Constraint

- XML output must match legacy element order, namespace declarations, and attribute values (api-form-schema Rules 6-8)
- Enum values sourced from `UniversalCodes-V2.0.xsd` (api-form-schema Rule 11)
- UI section labels match PDF form numbering, not legacy instructions (api-form-schema Rule 5)

---

## Anti-Patterns

### Validation Framework Dual Stack (INC-3)
The project uses four different validation libraries across the stack:
- **API route-level:** Marshmallow schemas with `@validates_schema`
- **API service-level:** Pydantic `BaseModel` with `model_validate()`
- **Form validation:** JSON Schema Draft 2020-12 with custom `OUR_VALIDATOR`
- **Frontend server actions:** Zod schemas with `safeParse()`

The Marshmallow/Pydantic dual-use in the API is explicitly acknowledged but not resolved.

### Authorization Utility Duplication (INC-7)
The API has both `verify_access()` and `check_user_access()` doing overlapping work (flagged in PR #8632). Tech lead resolution is needed.

### Complex Inline Ternary Expressions in YAML
The CD workflow environment matrix expression is a deeply nested ternary that has caused multiple bugs (PR #8402). It should be refactored into a composite action or shell script.

---

## Known Inconsistencies

### INC-1: Feature Flag Naming Convention

| Domain | Convention | Example |
|--------|-----------|---------|
| Infra (frontend) | `FEATURE_{NAME}_OFF` with SSM `manage_method = "manual"` | `FEATURE_USER_ADMIN_OFF` |
| Infra (API) | `ENABLE_{FEATURE}_ENDPOINTS = 1` as plain env var | `ENABLE_COMMON_GRANTS_ENDPOINTS = 1` |
| Local dev | `ENABLE_{FEATURE}=TRUE` | `ENABLE_AUTH_ENDPOINT=TRUE` |

Three different naming patterns and three different truthy values (`1`, `TRUE`, SSM-managed). This should be unified.

### INC-2: File Naming — Singular vs. Plural

- API routes: Inconsistent between `agency_schema.py` (singular) and `user_schemas.py` (plural)
- API routes: `competition_route.py` vs. `user_routes.py`
- No enforcement mechanism exists

### INC-3: Validation Framework Dual Stack

Four different validation libraries across the stack (Marshmallow, Pydantic, JSON Schema, Zod). The Marshmallow/Pydantic dual-use in the API is explicitly acknowledged but not resolved.

### INC-4: Auth Object Name Evolution

The multi-auth object naming evolved: `jwt_or_key_multi_auth` -> `jwt_or_api_user_key_multi_auth`. Older endpoints have not been migrated.

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
Multiple domains note that naming conventions are enforced only by reviewer diligence. No ESLint rules, Ruff rules, or custom linters enforce boolean question-form, camelCase translation keys, singular table names, or flat log keys.

### GAP-2: No Centralized Feature Flag Registry
Feature flags are scattered across Terraform configs, SSM parameters, and code references. There is no single registry showing all active flags, their current state per environment, or their cleanup status.

### GAP-3: No Formal API Versioning Strategy
The API uses path-based versioning (`/v1/`, `/alpha/`) but there is no documented strategy for when to promote alpha to v1, when to create v2, or how breaking changes are managed.

### GAP-4: No Database Query Performance Guidelines
While `selectinload("*")` is banned, there are no documented guidelines for when to use `selectinload` vs. `joinedload` vs. `subqueryload`, query complexity limits, or N+1 detection.

### GAP-5: No Error Monitoring / Alert Level Documentation
The "info for 4xx, warning for ops concerns" rule is clear, but there is no documented guidance on when to use `logger.error()` vs. `logger.exception()`, what constitutes an "operational concern," or how New Relic alert policies map to log levels.

### GAP-6: No Frontend Error Boundary Strategy
The frontend uses `<TopLevelError />` and `<NotFound />` for page-level errors, but there is no documented strategy for component-level error boundaries, retry behavior, or user-facing error message standards.

### GAP-7: No Dependency Update Policy
Vulnerability scanning is well-documented, but there is no policy for update frequency, `.trivyignore` review cadence, or SLA for addressing discovered vulnerabilities.

### GAP-8: No Migration Rollback Strategy
Database migrations use Alembic with `upgrade()` and `downgrade()` functions, but there is no documented policy for production rollback, irreversible data migrations, or downgrade path testing.

---

## Related Documents

- [Infrastructure Conventions](infra.md) — Terraform patterns, SSM secrets, three-layer architecture
- [CI/CD Conventions](ci-cd.md) — Deployment workflows, environment promotion, vulnerability scanning
- [Forms Vertical](forms-vertical.md) — Forms-specific patterns (three-schema architecture, XML transforms, non-blocking validation)
- `analysis/pass3/cross-domain-synthesis.md` — Full Pass 3 synthesis with reviewer authority map
