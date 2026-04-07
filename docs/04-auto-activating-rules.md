# Auto-Activating Rules Reference

> **Before reading this:** Familiarity with [How It Works](02-how-it-works.md) is helpful but not required. Each rule entry below is self-contained.

This is the complete reference for all 39 auto-activating rule files in the Simpler Grants toolkit. Each rule is a `.mdc` file under `.cursor/rules/` that Cursor loads automatically based on the file you are editing. The companion prose docs live under `documentation/cursor-tooling/rules/` and are the source of record when this reference and a companion guide disagree.

---

## How Auto-Activation Works

When you edit a file, Cursor matches its path against every rule's glob patterns. Matching rules load silently into the AI's context. No action is needed from you.

---

## Master Dispatch Table

The table below maps every file path pattern to its corresponding rule file.

| File path pattern | Rule file | Domain |
|---|---|---|
| `api/src/api/**/*.py` | `api-routes.mdc` | API Routes |
| `api/src/services/**/*.py` | `api-services.mdc` | API Services |
| `api/src/db/**/*.py` | `api-database.mdc` | API Database |
| `api/src/auth/**/*.py` | `api-auth.mdc` | API Auth |
| `api/src/validation/**/*.py` | `api-validation.mdc` | API Validation |
| `api/src/**/*.py` | `api-error-handling.mdc` | API Error Handling |
| `api/src/form_schema/**/*.py` | `api-form-schema.mdc` | API Forms |
| `api/src/adapters/**/*.py` | `api-adapters.mdc` | API Adapters |
| `api/src/search/**/*.py` | `api-search.mdc` | API Search |
| `api/src/task/**/*.py` | `api-tasks.mdc` | API Tasks |
| `api/src/workflow/**/*.py` | `api-workflow.mdc` | API Workflow |
| `api/tests/**/*.py` | `api-tests.mdc` | API Tests |
| `frontend/src/**/*.tsx`, `frontend/src/**/*.ts` | `accessibility.mdc` | Accessibility |
| `frontend/src/app/**/*.tsx`, `frontend/src/app/**/*.ts` | `frontend-app-pages.mdc` | Frontend Pages |
| `frontend/src/components/**/*` | `frontend-components.mdc` | Frontend Components |
| `frontend/src/hooks/**/*` | `frontend-hooks.mdc` | Frontend Hooks |
| `frontend/src/services/**/*` | `frontend-services.mdc` | Frontend Services |
| `frontend/src/i18n/**/*` | `frontend-i18n.mdc` | Frontend i18n |
| `frontend/tests/**/*` & `frontend/src/**/*.test.*` | `frontend-tests.mdc` | Frontend Tests |
| `frontend/tests/e2e/**/*` | `frontend-e2e-tests.mdc` | Frontend E2E Tests |
| `infra/**/*.tf` | `infra.mdc` | Infrastructure |
| `.github/**/*.yml` | `ci-cd.mdc` | CI/CD |
| `**/form*/**/*` | `forms-vertical.mdc` | Forms Cross-cut |
| `**/*` | `cross-domain.mdc` | Cross-cutting |

### Rule Precedence

Multiple rules can activate simultaneously. They do not conflict -- they stack. The AI sees all of them and applies all their directives together.

For example, editing a file at `api/src/api/forms/form_routes.py` would activate:

- **api-routes.mdc** (matches `api/src/api/**/*.py`)
- **api-error-handling.mdc** (matches `api/src/**/*.py`)
- **forms-vertical.mdc** (matches `**/form*/**/*`)
- **cross-domain.mdc** (matches `**/*`)

The AI receives directives from all four rules and follows them all.

### Specialist Integration (Phase 7 Enhancement)

Every domain rule now includes conditional specialist invocation from the Compound Engineering plugin. The invocation follows a three-tier model based on change complexity:

- **Simple changes** (< 20 lines, single function): Rule directives alone are sufficient — no specialist invocation
- **Moderate changes** (new function, refactoring): `codebase-conventions-reviewer` validates against project conventions
- **Complex changes** (new module, architectural decisions): Multiple specialists run in parallel (varies by domain)

Each rule's "Specialist Validation" section specifies which specialists apply. This requires the Compound Engineering plugin — see [Getting Started](03-getting-started.md) for installation.

---

## Rule-by-Rule Reference

### 1. api-routes.mdc

**Glob pattern:** `api/src/api/**/*.py`
**Activates when:** You edit any Python file under the API routes directory, including blueprints, route handlers, and schema definitions.

**Key directives:**

- **ALWAYS** organize domains under `api/src/api/<domain>/` with three files: blueprint, routes, schemas
- **ALWAYS** apply decorators in order: METHOD, input, output, doc, auth, db_session
- **ALWAYS** keep route handlers thin -- delegate business logic to service functions
- **ALWAYS** use `jwt_or_api_user_key_multi_auth` for new endpoints
- **ALWAYS** verify authenticated user matches URL `user_id` (use 403, not 401)
- **ALWAYS** wrap DB operations in `db_session.begin()`
- **ALWAYS** return `response.ApiResponse`

**Example -- How it shapes AI output:**

If you ask the AI to create a new endpoint, instead of putting all logic in the route handler, it will generate a thin handler that delegates to a service function:

```python
# The AI generates this (thin handler)
@routes.post("/users/<user_id>/applications")
@routes.input(ApplicationSchema)
@routes.output(ApplicationResponseSchema)
@routes.doc(...)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def create_application(user_id, db_session, json_data):
    with db_session.begin():
        result = create_user_application(db_session, user_id, json_data)
    return response.ApiResponse(message="Success", data=result)
```

---

### 2. api-services.mdc

**Glob pattern:** `api/src/services/**/*.py`
**Activates when:** You edit any Python file under the services directory, where business logic lives.

**Key directives:**

- **ALWAYS** place each service function in its own file within `api/src/services/{domain}/`
- **ALWAYS** accept `db_session` as the first parameter
- **NEVER** manage transaction boundaries in services (routes handle that)
- **ALWAYS** extract shared logic to `_utils.py` or `service_utils.py`
- **ALWAYS** use `raise_flask_error()` for errors
- **ALWAYS** use structured logging with static messages + `extra={}`

**Example -- How it shapes AI output:**

When you ask the AI to write a service function, it will never call `db_session.commit()` or `db_session.begin()` inside the service. Transaction boundaries stay in the route layer:

```python
# Service function -- no transaction management
def get_user_applications(db_session, user_id):
    logger.info("Fetching user applications", extra={"user_id": user_id})
    applications = db_session.query(Application).filter_by(user_id=user_id).all()
    if not applications:
        raise_flask_error(404, "No applications found")
    return applications
```

---

### 3. api-database.mdc

**Glob pattern:** `api/src/db/**/*.py`
**Activates when:** You edit any Python file under the database directory, including models, migrations, and lookup tables.

**Key directives:**

- **ALWAYS** inherit from `ApiSchemaTable` and `TimestampMixin`
- **ALWAYS** use UUID primary keys with `default=uuid.uuid4`
- **ALWAYS** use singular table names, `lk_` prefix for lookups, `link_` for junction tables
- **ALWAYS** use `Mapped[T]` with `mapped_column()` (never legacy `Column()`)
- **ALWAYS** use `back_populates` (never `backref`)
- Four-layer lookup table pattern: `StrEnum` then `LookupConfig` then `LookupTable` then `LookupColumn`

**Example -- How it shapes AI output:**

When you ask the AI to create a new model, it uses modern SQLAlchemy typing and project conventions:

```python
class Application(ApiSchemaTable, TimestampMixin):
    __tablename__ = "application"

    application_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("user.user_id"))
    status: Mapped[str] = mapped_column(nullable=False)

    user: Mapped["User"] = relationship(back_populates="applications")
```

---

### 4. api-auth.mdc

**Glob pattern:** `api/src/auth/**/*.py`
**Activates when:** You edit any Python file under the auth directory, including authentication and authorization logic.

**Key directives:**

- **ALWAYS** use `jwt_or_api_user_key_multi_auth` for new endpoints
- **ALWAYS** use Flask's native `@multi_auth.login_required` (not APIFlask's `@blueprint.auth_required`)
- **ALWAYS** call `.get_user()` on the same multi-auth object that decorates the endpoint
- Authorization checks **MUST** come after 404 checks (prevent information leakage)

**Example -- How it shapes AI output:**

When you ask the AI to add authorization to an endpoint, it places the 404 check before the authorization check to avoid leaking whether a resource exists:

```python
# Correct ordering: 404 first, then 403
resource = db_session.get(Resource, resource_id)
if not resource:
    raise_flask_error(404, "Resource not found")
if resource.owner_id != current_user.user_id:
    raise_flask_error(403, "Not authorized")
```

---

### 5. api-validation.mdc

**Glob pattern:** `api/src/validation/**/*.py`
**Activates when:** You edit any Python file under the validation directory, including validation schemas and error types.

**Key directives:**

- **ALWAYS** define validation error types in `ValidationErrorType(StrEnum)`
- **ALWAYS** include `type`, `message`, and `field` in `ValidationErrorDetail`
- The `type` field is the API-frontend contract -- it must be stable and well-defined

**Example -- How it shapes AI output:**

When you ask the AI to add a new validation rule, it creates a properly structured error type:

```python
class ValidationErrorType(StrEnum):
    REQUIRED = "required"
    INVALID_FORMAT = "invalid_format"
    TOO_LONG = "too_long"

ValidationErrorDetail(
    type=ValidationErrorType.REQUIRED,
    message="Organization name is required",
    field="organization_name"
)
```

---

### 6. api-error-handling.mdc

**Glob pattern:** `api/src/**/*.py`
**Activates when:** You edit any Python file anywhere under `api/src/`. This is the broadest API rule -- it applies to routes, services, database code, and everything else.

**Key directives:**

- **ALWAYS** use `raise_flask_error(status_code, message, validation_issues=[...])`
- **ALWAYS** use `ValidationErrorDetail` with `type` from `ValidationErrorType`
- **ALWAYS** log 4xx at info level, not warning
- **NEVER** use raw Flask `abort()`

**Example -- How it shapes AI output:**

When you ask the AI to handle an error, it never uses Flask's built-in `abort()`:

```python
# The AI generates this (project pattern)
raise_flask_error(
    400,
    "Invalid application data",
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.INVALID_FORMAT,
            message="Email must be a valid address",
            field="email"
        )
    ]
)
```

---

### 7. api-form-schema.mdc

**Glob pattern:** `api/src/form_schema/**/*.py`
**Activates when:** You edit any Python file under the form schema directory, where form definitions and schema builders live.

**Key directives:**

- Three-schema architecture: JSON schema (data), UI schema (rendering), Rule schema (validation)
- **ALWAYS** use `OUR_VALIDATOR` (custom JSON Schema validator), not the default `jsonschema` validator
- XML output must match legacy Grants.gov format exactly

**Example -- How it shapes AI output:**

When you ask the AI to define a new form section, it generates all three schema layers:

```python
# JSON schema -- what data the form collects
json_schema = {"type": "object", "properties": {"org_name": {"type": "string"}}}

# UI schema -- how the form renders
ui_schema = {"org_name": {"ui:widget": "text", "ui:label": "Organization Name"}}

# Rule schema -- validation constraints
rule_schema = {"org_name": {"maxLength": 200, "required": True}}
```

---

### 8. api-tests.mdc

**Glob pattern:** `api/tests/**/*.py`
**Activates when:** You edit any Python test file in the API test directory.

**Key directives:**

- **ALWAYS** use `Factory.build()` when no DB is needed, `Factory.create()` when DB is needed
- **ALWAYS** request `enable_factory_create` fixture when using `.create()`
- **NEVER** call `db_session.commit()` after `Factory.create()`
- **ALWAYS** write standalone test functions (not classes)
- Structure route tests as: create data, make HTTP request, assert status, assert body

**Example -- How it shapes AI output:**

When you ask the AI to write a test, it uses the correct factory pattern:

```python
def test_get_user_applications(client, enable_factory_create, db_session):
    # Create data
    user = UserFactory.create()
    ApplicationFactory.create(user_id=user.user_id)

    # HTTP request
    response = client.get(f"/v1/users/{user.user_id}/applications")

    # Assert status and body
    assert response.status_code == 200
    assert len(response.json["data"]) == 1
```

---

### 9. frontend-components.mdc

**Glob pattern:** `frontend/src/components/**/*`
**Activates when:** You edit any file under the frontend components directory, including React components, styles, and co-located tests.

**Key directives:**

- React Server Components by default; add `"use client"` only when the component needs browser APIs or state
- Domain-based directory organization (not organized by component type)
- **NO** barrel files (`index.ts` re-exports are forbidden)
- USWDS components from `@trussworks/react-uswds` are preferred over custom implementations
- Promise-as-props pattern for non-blocking data loading

**Example -- How it shapes AI output:**

When you ask the AI to create a component, it defaults to a Server Component and uses USWDS:

```tsx
// No "use client" -- Server Component by default
import { Alert } from "@trussworks/react-uswds";

export function ApplicationStatus({ statusPromise }) {
  const status = use(statusPromise);
  return <Alert type={status.type}>{status.message}</Alert>;
}
```

---

### 10. frontend-hooks.mdc

**Glob pattern:** `frontend/src/hooks/**/*`
**Activates when:** You edit any file under the frontend hooks directory, where custom React hooks are defined.

**Key directives:**

- `useClientFetch` pattern for client-side data fetching
- `useSearchParamUpdater` for URL state management
- Auth state via auth hooks

**Example -- How it shapes AI output:**

When you ask the AI to fetch data on the client side, it uses the project's established `useClientFetch` pattern rather than raw `useEffect` + `fetch`:

```tsx
function ApplicationList({ userId }) {
  const { data, loading, error } = useClientFetch(`/api/users/${userId}/applications`);
  // ...
}
```

For URL-driven state (filters, pagination), it uses `useSearchParamUpdater` instead of local state, keeping the URL as the source of truth.

---

### 11. frontend-services.mdc

**Glob pattern:** `frontend/src/services/**/*`
**Activates when:** You edit any file under the frontend services directory, where server-side fetchers and API clients live.

**Key directives:**

- `requesterForEndpoint()` factory for server-side fetchers
- `"server-only"` directive on server-side fetch files
- `X-SGG-Token` headers for authentication
- `cache()` wrapping for request deduplication

**Example -- How it shapes AI output:**

When you ask the AI to create a new API fetcher, it uses the factory pattern and marks the file as server-only:

```tsx
"server-only";

import { requesterForEndpoint } from "./requesterForEndpoint";
import { cache } from "react";

export const getApplications = cache(
  requesterForEndpoint("/v1/users/{userId}/applications", "GET")
);
```

---

### 12. frontend-i18n.mdc

**Glob pattern:** `frontend/src/i18n/**/*`
**Activates when:** You edit any file under the internationalization directory, where translated strings are maintained.

**Key directives:**

- Single centralized file: `frontend/src/i18n/messages/en/index.ts`
- PascalCase top-level keys, camelCase leaf keys
- English-only (no other language files)
- Content directly in values (no CMS, no markdown files)
- `useTranslations()` hook in components

**Example -- How it shapes AI output:**

When you ask the AI to add a new user-facing string, it adds it to the centralized file with proper casing:

```typescript
// In frontend/src/i18n/messages/en/index.ts
export const messages = {
  Application: {
    statusLabel: "Application Status",
    submitButton: "Submit Application",
    savedMessage: "Your application has been saved.",
  },
};
```

---

### 13. frontend-tests.mdc

**Glob pattern:** `frontend/tests/**/*` and `frontend/e2e/**/*`
**Activates when:** You edit any frontend test file, whether a unit test or an end-to-end test.

**Key directives:**

- `jest-axe` accessibility scan in every component test
- Jest + React Testing Library for unit tests
- Playwright for E2E tests (4 shards, blob report merging)
- Mock API calls, not implementation details

**Example -- How it shapes AI output:**

When you ask the AI to write a component test, it always includes an accessibility check:

```tsx
import { axe } from "jest-axe";

test("ApplicationCard is accessible", async () => {
  const { container } = render(<ApplicationCard application={mockApp} />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

For E2E tests, the AI uses Playwright and structures tests for the 4-shard parallel execution model. It mocks API calls at the network level rather than mocking internal implementation details.

---

### 14. infra.mdc

**Glob pattern:** `infra/**/*.tf`
**Activates when:** You edit any Terraform file in the infrastructure directory.

**Key directives:**

- Three-layer Terraform architecture: app-config, service, database
- Feature flags via SSM parameters
- Security group egress restrictions
- **MUST** create SSM parameters in all environments before merge

**Example -- How it shapes AI output:**

When you ask the AI to add a new feature flag, it creates an SSM parameter and reminds you about the multi-environment requirement:

```hcl
resource "aws_ssm_parameter" "enable_new_form" {
  name  = "/${var.environment}/simpler-grants/enable_new_form"
  type  = "String"
  value = "false"
}
```

The AI will note that this parameter must be created in dev, staging, and prod before the code referencing it can be merged.

---

### 15. ci-cd.mdc

**Glob pattern:** `.github/**/*.yml`
**Activates when:** You edit any YAML file under the GitHub Actions directory, including workflow definitions and reusable actions.

**Key directives:**

- Three-job pipeline structure: checks, deploy, notify
- Reusable workflows (shared workflow definitions)
- Docker image caching for faster builds
- Playwright test sharding (4 parallel shards)

**Example -- How it shapes AI output:**

When you ask the AI to add a new CI step, it follows the three-job pipeline structure and uses reusable workflows where possible:

```yaml
jobs:
  checks:
    uses: ./.github/workflows/reusable-checks.yml
  deploy:
    needs: checks
    uses: ./.github/workflows/reusable-deploy.yml
  notify:
    needs: deploy
    uses: ./.github/workflows/reusable-notify.yml
```

It will configure Docker layer caching and Playwright sharding rather than running tests sequentially.

---

### 16. cross-domain.mdc

**Glob pattern:** `**/*`
**Activates when:** You edit any file in the entire repository. This rule applies universally.

**Key directives:**

- Structured logging: static messages + `extra={}` (flat snake_case keys, no PII)
- Log level discipline: info for 4xx, warning for operational issues, error for system failures
- Boolean naming convention: `is_*`, `has_*`, `can_*`, `was_*`
- Factory pattern for test data
- **NEVER** use wildcard eager loading (`selectinload("*")` is forbidden)

**Example -- How it shapes AI output:**

When you ask the AI to add logging anywhere in the project, it uses structured logging with static messages:

```python
# Correct: static message + structured extra
logger.info("Application submitted", extra={"user_id": user_id, "application_id": app_id})

# The AI will never generate this:
logger.info(f"Application {app_id} submitted by user {user_id}")
```

When the AI names a boolean variable, it uses prefixes like `is_eligible`, `has_submitted`, `can_edit` -- never bare adjectives like `eligible` or `editable`.

---

### 17. forms-vertical.mdc

**Glob pattern:** `**/form*/**/*`
**Activates when:** You edit any file in a directory whose name starts with "form" -- this catches both `api/src/form_schema/` and `frontend/src/components/forms/` and any other form-related directories.

**Key directives:**

- Three-schema form definition (JSON schema, UI schema, Rule schema)
- Custom JSON schema validator `OUR_VALIDATOR`
- Non-blocking validation (validation does not prevent form submission)
- Test triad: minimal, full, empty (every form needs tests for all three states)

**Example -- How it shapes AI output:**

When you ask the AI to write form tests, it generates the test triad:

```python
def test_form_minimal():
    """Test with only required fields filled."""
    data = {"org_name": "Test Org"}
    assert OUR_VALIDATOR.is_valid(data, schema=form_schema)

def test_form_full():
    """Test with all fields filled."""
    data = {"org_name": "Test Org", "ein": "12-3456789", "address": "123 Main St"}
    assert OUR_VALIDATOR.is_valid(data, schema=form_schema)

def test_form_empty():
    """Test with no fields -- should list all required field errors."""
    errors = list(OUR_VALIDATOR.iter_errors({}, schema=form_schema))
    assert len(errors) > 0
```

It uses `OUR_VALIDATOR` rather than the default `jsonschema` validator and always tests all three states.

---

### 18. api-form-schema.mdc (revisited as distinct from forms-vertical)

Note: `api-form-schema.mdc` and `forms-vertical.mdc` both activate for files under `api/src/form_schema/`. They complement each other -- `api-form-schema.mdc` provides API-specific form schema directives (XML output, Grants.gov compatibility), while `forms-vertical.mdc` provides cross-cutting form patterns (test triad, non-blocking validation).

---

### 19. accessibility.mdc

**Glob pattern:** `frontend/src/**/*.tsx`, `frontend/src/**/*.ts`
**Activates when:** You edit any TypeScript or TSX file under the frontend source directory.

**Key directives:**

- **MUST** comply with WCAG 2.1 AA and Section 508 — legally mandated for this federal project
- **ALWAYS** use semantic HTML elements and ARIA attributes
- **ALWAYS** include `jest-axe` accessibility scans in component tests
- **ALWAYS** use USWDS components from `@trussworks/react-uswds` for accessible defaults

---

### 20. api-adapters.mdc

**Glob pattern:** `api/src/adapters/**/*.py`
**Activates when:** You edit any Python file under the external service adapters directory.

**Key directives:**

- Adapter patterns for wrapping external APIs and third-party services
- Error handling and retry logic conventions
- Structured logging for external service calls

---

### 21. api-search.mdc

**Glob pattern:** `api/src/search/**/*.py`
**Activates when:** You edit any Python file under the search directory, where OpenSearch integration lives.

**Key directives:**

- OpenSearch query construction patterns
- Index management conventions
- Search result transformation and pagination

---

### 22. api-tasks.mdc

**Glob pattern:** `api/src/task/**/*.py`
**Activates when:** You edit any Python file under the task directory, where background tasks live.

**Key directives:**

- Background task definition and scheduling patterns
- Task error handling and retry conventions
- Structured logging for task execution

---

### 23. api-workflow.mdc

**Glob pattern:** `api/src/workflow/**/*.py`
**Activates when:** You edit any Python file under the workflow directory, where orchestration logic lives.

**Key directives:**

- Workflow step definition and state management
- Multi-step process orchestration patterns
- Workflow error handling and recovery

---

### 24. frontend-app-pages.mdc

**Glob pattern:** `frontend/src/app/**/*.tsx`, `frontend/src/app/**/*.ts`
**Activates when:** You edit any TypeScript file under the Next.js App Router pages directory.

**Key directives:**

- React Server Components by default for pages and layouts
- Data fetching patterns using `requesterForEndpoint` factory
- Promise-as-props pattern for non-blocking data loading
- Page metadata and SEO conventions

---

### 25. frontend-e2e-tests.mdc

**Glob pattern:** `frontend/tests/e2e/**/*`
**Activates when:** You edit any file under the Playwright E2E test directory.

**Key directives:**

- Playwright test structure and organization
- 4-shard parallel execution model
- Network-level API mocking (not implementation mocking)
- Blob report merging for CI

---

### 26. api-cli.mdc

**Glob pattern:** `api/src/cli/**/*.py`
**Purpose:** Standardize Flask CLI commands.

**Key directives:**

- One command group per module; central registration
- Click typed options with help text
- `click.echo` / Click exceptions (no `print`, no raw `sys.exit`)
- `@flask_db.with_db_session()` + `with db_session.begin():`
- Structured logging; no PII
- `CliRunner` tests with mocked services

---

### 27. api-constants.mdc

**Glob pattern:** `api/src/constants/**/*.py`, `api/src/db/lookups/**/*.py`, `api/src/**/*_enum.py`
**Purpose:** Constants, StrEnum, and lookup table patterns.

**Key directives:**

- StrEnum for small immutable dev-time sets
- UPPER_SNAKE_CASE constants grouped by concern
- Four-tier lookup pattern (StrEnum -> LookupConfig -> LookupTable -> FK)
- Lookup rows changed only via migrations
- Single source of truth — no duplicated magic strings

---

### 28. api-logging.mdc

**Glob pattern:** `api/src/**/*.py`
**Purpose:** Structured logging conventions.

**Key directives:**

- `logger = logging.getLogger(__name__)`
- Static messages, dynamic values in `extra={}` with flat snake_case keys
- `info` for 4xx; `warning` only for alerts; `error`/`exception` with `exc_info`
- No PII or secrets in logs
- Request-scoped context via `add_extra_data_to_current_request_logs`

---

### 29. data-privacy.mdc

**Glob pattern:** `api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`, `infra/**/*.tf`
**Purpose:** PII classification and handling across the stack.

**Key directives:**

- Classify Public / Internal / Confidential / PII
- No PII in logs, analytics, error tracking, URLs, or client storage
- Field-level authorization in services
- Soft delete with scheduled hard delete per retention policy
- Third-party flows only through approved adapters within FedRAMP boundary

---

### 30. docker.mdc

**Glob pattern:** `**/Dockerfile`, `**/Dockerfile.*`, `**/docker-compose*.yml`
**Purpose:** Container image and compose conventions.

**Key directives:**

- Pinned, approved base images
- Multi-stage build; runtime excludes build tooling
- Non-root UID
- BuildKit secret mounts; no baked credentials
- HEALTHCHECK and SIGTERM handling

---

### 31. fedramp.mdc

**Glob pattern:** `api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`, `infra/**/*.tf`, `**/Dockerfile*`, `.github/workflows/**/*.yml`
**Purpose:** FedRAMP Moderate boundary alignment.

**Key directives:**

- No new outbound dependencies without SSP entry
- Least-privilege IAM, MFA, rotated secrets
- Tamper-evident audit logging; correlation IDs
- TLS 1.2+ in transit; KMS at rest
- SCA/SAST/container scanning gates

---

### 32. github-issues.mdc

**Glob pattern:** `.github/ISSUE_TEMPLATE/**/*`, `.github/PULL_REQUEST_TEMPLATE*`, `.github/workflows/**/*.yml`
**Purpose:** Issue/PR template and workflow conventions.

**Key directives:**

- YAML form issue templates
- PR template with linked issue, tests, screenshots, a11y + privacy notes
- Canonical labels, conventional commit titles
- Private advisory for security issues
- Workflows pinned by SHA with least-privilege permissions

---

### 33. makefile.mdc

**Glob pattern:** `**/Makefile`, `**/*.mk`
**Purpose:** Makefile task-runner conventions.

**Key directives:**

- `.PHONY` declared
- Namespaced targets with `help` default
- Thin dispatch to language tooling
- Same targets in CI and local
- No hardcoded secrets

---

### 34. openapi.mdc

**Glob pattern:** `api/src/api/**/*_schemas.py`, `api/src/api/**/*_routes.py`, `api/openapi.yaml`, `api/openapi.json`, `api/src/api/__init__.py`
**Purpose:** OpenAPI spec generation and documentation.

**Key directives:**

- Spec generated from code, never hand-edited
- `@blueprint.doc` with summary/description/responses/security/tags
- Field metadata descriptions and `required=True`
- URL-prefixed versioning; no in-place breaking changes
- Spectral linting in CI

---

### 35. performance.mdc

**Glob pattern:** `api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`
**Purpose:** Performance budgets and patterns.

**Key directives:**

- Explicit `selectinload(Model.rel)`
- Paginated, indexed list endpoints
- ISR vs `force-dynamic` chosen explicitly
- Lazy-loaded heavy client components
- p95 latency and Core Web Vitals budgets
- Background tasks for long-running work

---

### 36. security.mdc

**Glob pattern:** `api/src/**/*.py`, `frontend/src/**/*.{ts,tsx}`, `infra/**/*.tf`, `**/Dockerfile*`
**Purpose:** Application-level security controls.

**Key directives:**

- Multi-auth + 403 on identity mismatch
- Marshmallow edge validation; no string-interpolated SQL
- Secrets from SSM / Secrets Manager only
- SCA/SAST gating; CC0-compatible dependencies
- Secure cookies, strict CORS, rate limiting
- Vetted crypto, TLS 1.2+
- Security events logged without secrets

---

### 37. frontend-storybook.mdc

**Glob pattern:** `frontend/**/*.stories.tsx`, `frontend/**/*.stories.ts`, `frontend/**/*.stories.jsx`, `frontend/.storybook/**/*`
**Purpose:** Storybook story authoring conventions.

**Key directives:**

- Component Story Format 3 (CSF3) only — `Meta` and `StoryObj` from `@storybook/react`
- PREFER `args` over custom `render` functions
- Include accessibility (a11y) stories and visual regression baselines
- Story file colocated with component

**Companion guide:** `documentation/cursor-tooling/rules/frontend-storybook.md`

---

### 38. frontend-styles.mdc

**Glob pattern:** `frontend/src/styles/**/*.scss`, `frontend/src/**/*.module.scss`, `frontend/src/**/*.scss`
**Purpose:** SCSS, USWDS theme tokens, breakpoints, and print styles.

**Key directives:**

- Flat global styles directory; no subfolders
- Modern Sass `@forward` (NEVER legacy `@import`)
- USWDS theme token overrides over hardcoded values
- `at-media` mixin for responsive breakpoints
- Complements `frontend-components.mdc` (markup vs styling split)

**Companion guide:** `documentation/cursor-tooling/rules/frontend-styles.md`

---

### 39. frontend-types.mdc

**Glob pattern:** `frontend/src/**/*.ts`, `frontend/src/**/*.tsx`, `frontend/src/types/**/*`
**Purpose:** TypeScript type organization for the frontend.

**Key directives:**

- Shared types → `frontend/src/types/<domain>/`; component-local types stay inline or in sibling `Component.types.ts`
- Promote a type to `src/types/` when imported by 2+ files
- Distinguish API response types from UI state types in naming
- Discriminated unions for state machines
- Ambient/global declarations in `*.d.ts`

**Companion guide:** `documentation/cursor-tooling/rules/frontend-types.md`

---

### 40. frontend-utils.mdc

**Glob pattern:** `frontend/src/utils/**/*.ts`, `frontend/src/utils/**/*.tsx`, `frontend/src/**/*.ts`, `frontend/src/**/*.tsx`
**Purpose:** Frontend utility extraction and authoring conventions.

**Key directives:**

- INLINE single-use helpers; EXTRACT once used in 2+ files or contains non-trivial logic
- Pure functions only; edge-runtime safe (no Node-only APIs)
- Unit tests required for extracted utilities
- Domain-named files under `frontend/src/utils/`

**Companion guide:** `documentation/cursor-tooling/rules/frontend-utils.md`

---

> **Reference count check.** The toolkit ships **39** auto-activating rule files in `.cursor/rules/`. Each rule above maps to one file. If `ls .cursor/rules/*.mdc | wc -l` reports a different number, this reference is out of date — rerun the inventory step.

---

## When Multiple Rules Apply

Rules stack. When you edit a file that matches multiple glob patterns, the AI receives directives from all matching rules and follows them simultaneously. There is no priority ordering -- all active rules have equal weight.

**Worked example:** Editing `api/src/api/users/user_routes.py`

This file path matches three globs:

1. **api-routes.mdc** (`api/src/api/**/*.py`) -- The AI structures route handlers with thin delegation, correct decorator ordering, and `ApiResponse` returns.
2. **api-error-handling.mdc** (`api/src/**/*.py`) -- The AI uses `raise_flask_error()` instead of `abort()`, logs 4xx at info level, and structures validation errors with `ValidationErrorDetail`.
3. **cross-domain.mdc** (`**/*`) -- The AI uses structured logging with static messages, follows boolean naming conventions, and avoids wildcard eager loading.

The AI applies all three sets of directives together. The generated route will have thin handlers (from api-routes), proper error handling (from api-error-handling), and structured logging (from cross-domain).

Similarly, editing `frontend/src/components/forms/ApplicationForm.tsx` activates frontend-components + forms-vertical + cross-domain. Editing `api/src/form_schema/builders/section_builder.py` activates api-form-schema + api-error-handling + forms-vertical + cross-domain. In every case, the AI sees all matching rules and produces code that satisfies all of them.

---

## See Also

- [How It Works](02-how-it-works.md) -- how rules are loaded by Cursor
- [Agents Reference](05-agents-reference.md) -- manually invoked agent rules
- [Rule Files Quick Reference](appendix/rule-files-quick-reference.md) -- printable one-page summary
- [Back to documentation index](README.md)
