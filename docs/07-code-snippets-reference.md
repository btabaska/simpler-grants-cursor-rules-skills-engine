# Code Snippets Reference

> **Before reading this:** Ensure your toolkit is set up per [Getting Started](03-getting-started.md). Snippets require the `.cursor/snippets/` directory to be symlinked.

Code snippets are triggered by typing a prefix (like `sgg-route`) in a code file. Cursor shows the snippet in autocomplete, and selecting it inserts a project-specific code template with tabstop placeholders you can fill in.

---

## How Snippets Work

1. Start typing the prefix (e.g., `sgg-route`) in a code file.
2. Cursor shows the snippet in the autocomplete dropdown.
3. Select it with Enter or Tab.
4. Tab through the highlighted placeholders to fill in your values.
5. A final Tab exits the snippet and places your cursor after the inserted code.

**File type filtering:** Python snippets (prefixed `sgg-`) only appear in `.py` files. TypeScript snippets only appear in `.ts` and `.tsx` files. This prevents irrelevant suggestions from cluttering your autocomplete.

---

## Python Snippets (API)

### sgg-route

**Prefix:** `sgg-route`
**Generates:** A complete route handler with the full decorator stack in the correct order.

```python
@domain_blueprint.get("/path")
@domain_blueprint.input(RequestSchema)
@domain_blueprint.output(ResponseSchema)
@domain_blueprint.doc(
    responses=[200, 401, 403, 404, 422], security=jwt_or_api_user_key_security_schemes
)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def handler_name(db_session: db.Session, params) -> response.ApiResponse:
    result = service_module.service_function(db_session, args)
    return response.ApiResponse(message="Success", data=result)
```

**Placeholders:** blueprint name, HTTP method, path, schemas, handler name, service call.

**Conventions encoded:**
- Decorator order: route, input, output, doc, auth, db_session
- Thin handler pattern (logic lives in the service layer, not here)
- Standardized `ApiResponse` return format
- Auth via `jwt_or_api_user_key_multi_auth`

**When to use:** Every time you create a new route handler. The decorator order matters and is easy to get wrong from memory.

---

### sgg-service

**Prefix:** `sgg-service`
**Generates:** A service function with imports, logger setup, `db_session` parameter, structured logging, a query pattern, and error handling.

```python
import logging

import sqlalchemy

from src.api import response
from src.api.route_utils import raise_flask_error

logger = logging.getLogger(__name__)


def service_function(db_session: db.Session, param):
    logger.info("Performing action", extra={"param_id": str(param.id)})

    result = db_session.execute(
        sqlalchemy.select(Model).where(Model.field == param)
    ).scalars().all()

    if not result:
        raise_flask_error(404, message="Resource not found")

    return result
```

**Placeholders:** function name, parameter, model, query conditions.

**Conventions encoded:**
- `db_session` is always the first parameter
- Structured logging with `extra={}` dict (never f-strings in log messages)
- Error handling via `raise_flask_error` (never raw HTTP exceptions)

**When to use:** When writing any new business logic function that interacts with the database.

---

### sgg-model

**Prefix:** `sgg-model`
**Generates:** A SQLAlchemy model class with the project's base classes and column conventions.

```python
class ModelName(ApiSchemaTable, TimestampMixin):
    __tablename__ = "model_name"

    model_name_id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(text_type)
    description: Mapped[str | None] = mapped_column(text_type)
    is_active: Mapped[bool] = mapped_column(default=True)
```

**Placeholders:** class name, table name, columns.

**Conventions encoded:**
- Inherits from `ApiSchemaTable` and `TimestampMixin`
- UUID primary keys (never auto-increment integers)
- `Mapped[T]` type annotation syntax
- Boolean columns prefixed with `is_`

**When to use:** When adding a new database table. Ensures the model inherits correctly and uses the right column patterns.

---

### sgg-schema

**Prefix:** `sgg-schema`
**Generates:** A Marshmallow request and response schema pair.

```python
class ModelRequestSchema(Schema):
    name = fields.String(required=True)
    description = fields.String(load_default=None)


class ModelResponseSchema(Schema):
    model_id = fields.UUID(dump_only=True)
    name = fields.String()
    description = fields.String()
    created_at = fields.DateTime(dump_only=True)
```

**Placeholders:** schema name, fields.

**Conventions encoded:**
- Separate request and response schemas (never one schema for both)
- `dump_only=True` for server-generated fields
- `load_default` instead of `missing` for optional fields

**When to use:** When defining the input/output contract for a route handler.

---

### sgg-test

**Prefix:** `sgg-test`
**Generates:** A route test with factory-based data setup and assertion patterns.

```python
def test_handler_name_200(self, client, db_session, enable_factory_create):
    record = ModelFactory.create()

    response = client.get(
        f"/v1/domain/{record.model_id}",
        headers={"X-Auth": "token"},
    )

    assert response.status_code == 200
    data = response.get_json()["data"]
    assert str(record.model_id) == data["model_id"]
```

**Placeholders:** test name, factory, endpoint path, assertions.

**Conventions encoded:**
- Factory pattern for test data (`ModelFactory.create()`)
- `enable_factory_create` fixture required in test signature
- UUID comparison via `str()` conversion
- Response data accessed through `["data"]` key

**When to use:** When writing tests for any API endpoint.

---

### sgg-migration

**Prefix:** `sgg-migration`
**Generates:** An Alembic migration with the correct schema declaration and both upgrade/downgrade functions.

```python
"""description of migration

Revision ID: abc123
Revises: def456
Create Date: 2024-01-01 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

revision = "abc123"
down_revision = "def456"


def upgrade():
    op.create_table(
        "table_name",
        sa.Column("id", sa.UUID, primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        schema="api",
    )


def downgrade():
    op.drop_table("table_name", schema="api")
```

**Placeholders:** description, table name, columns.

**Conventions encoded:**
- `schema="api"` on all table operations
- Every migration must be reversible (downgrade is not optional)
- Matches the column types used in the model layer

**When to use:** When creating a migration by hand or when the auto-generated migration needs manual adjustments.

---

### sgg-log

**Prefix:** `sgg-log`
**Generates:** A structured log statement with an `extra={}` dictionary.

```python
logger.info("Action completed successfully", extra={"record_id": str(record.id), "action": "create"})
```

**Placeholders:** log level, message, extra keys.

**Conventions encoded:**
- Static string messages (never f-strings or format strings)
- Context passed via `extra={}` dict with flat, snake_case keys
- IDs converted to `str()` for JSON serialization

**When to use:** Any time you add a log statement. The `extra={}` pattern is required by the project's logging infrastructure.

---

### sgg-error

**Prefix:** `sgg-error`
**Generates:** A `raise_flask_error` call with `ValidationErrorDetail` and `ValidationErrorType`.

```python
raise_flask_error(
    422,
    message="Detailed error description",
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.INVALID,
            message="Field-level error message",
            field="field_name",
        )
    ],
)
```

**Placeholders:** status code, message, error type, field name.

**Conventions encoded:**
- Centralized error handling through `raise_flask_error`
- `ValidationErrorType` enum for consistent error categorization
- Field-level error details for frontend consumption

**When to use:** When you need to return a structured error from a service function or route handler.

---

## TypeScript Snippets (Frontend)

### sgg-component

**Prefix:** `sgg-component`
**Generates:** A React Server Component with translation support.

```tsx
import { useTranslations } from "next-intl";

export default function ComponentName() {
  const t = useTranslations("ComponentName");

  return (
    <div>
      <h1>{t("heading")}</h1>
    </div>
  );
}
```

**Conventions encoded:** Server component by default (no "use client"), i18n integration via `next-intl`.

**When to use:** When creating any new component. Start here and add "use client" only if needed.

---

### sgg-client-component

**Prefix:** `sgg-client-component`
**Generates:** A client component with the "use client" directive and `useState`.

```tsx
"use client";

import { useState } from "react";

export default function ComponentName() {
  const [value, setValue] = useState("");

  return (
    <div>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
    </div>
  );
}
```

**Conventions encoded:** Explicit "use client" directive at the top, client-side state management. Only use when the component genuinely requires browser APIs or interactivity.

**When to use:** Only when a component needs `useState`, `useEffect`, event handlers, or browser APIs.

---

### sgg-hook

**Prefix:** `sgg-hook`
**Generates:** A custom React hook with state and `useCallback`.

```tsx
"use client";

import { useState, useCallback } from "react";

export function useHookName() {
  const [state, setState] = useState(initialValue);

  const action = useCallback(() => {
    setState(newValue);
  }, []);

  return { state, action };
}
```

**Conventions encoded:** Hooks are always client-side, named with `use` prefix, return an object.

**When to use:** When extracting reusable stateful logic from a component.

---

### sgg-fetcher

**Prefix:** `sgg-fetcher`
**Generates:** A server-only data fetcher using `requesterForEndpoint()`.

```tsx
import "server-only";
import { requesterForEndpoint } from "src/services/fetch";

const fetchResource = requesterForEndpoint("/v1/domain/resource");

export async function getResource(params) {
  const response = await fetchResource(params);
  return response.data;
}
```

**Conventions encoded:** The `"server-only"` import prevents accidental client-side usage, `requesterForEndpoint` is the project's fetch factory.

**When to use:** When creating a new data fetching function for a server component.

---

### sgg-i18n-key

**Prefix:** `sgg-i18n-key`
**Generates:** A translation key block following the project's naming conventions.

```json
{
  "ComponentName": {
    "heading": "Page Heading",
    "description": "Page description text",
    "submitButton": "Submit"
  }
}
```

**Conventions encoded:** Top-level key in PascalCase (matches component name), child keys in camelCase, flat structure within each component namespace.

**When to use:** When adding translations for a new component or page.

---

### sgg-test-component

**Prefix:** `sgg-test-component`
**Generates:** A component test with `jest-axe` accessibility scanning.

```tsx
import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import ComponentName from "./ComponentName";

describe("ComponentName", () => {
  it("renders without errors", () => {
    const { getByRole } = render(<ComponentName />);
    expect(getByRole("heading")).toBeInTheDocument();
  });

  it("passes accessibility scan", async () => {
    const { container } = render(<ComponentName />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

**Conventions encoded:** Accessibility testing is mandatory (not optional), role-based selectors preferred over test IDs, `jest-axe` integration.

**When to use:** When writing unit tests for any React component. The accessibility test is a project requirement.

---

### sgg-test-e2e

**Prefix:** `sgg-test-e2e`
**Generates:** A Playwright end-to-end test with page navigation and role-based selectors.

```tsx
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
  test("completes user workflow", async ({ page }) => {
    await page.goto("/path");

    await expect(page.getByRole("heading", { name: "Page Title" })).toBeVisible();
    await page.getByRole("button", { name: "Action" }).click();
    await expect(page.getByRole("alert")).toContainText("Success");
  });
});
```

**Conventions encoded:** Role-based selectors (`getByRole`) instead of CSS selectors or test IDs, user-centric test descriptions, `expect` for assertions.

**When to use:** When writing end-to-end tests that verify a full user workflow through the browser.

---

## Snippets vs Agents: When to Use Which

| Situation | Use |
|-----------|-----|
| Quick boilerplate for one file | Snippet |
| Full endpoint across 7 files | Agent |
| Starting a function with the right structure | Snippet |
| Need the AI to make decisions about your code | Agent |
| Know exactly what you need, just want the skeleton | Snippet |
| Unsure about the right approach | Agent |

**Rule of thumb:** If you are working in a single file and know what you want, use a snippet. If the task spans multiple files or requires judgment, use an agent. You can also combine them -- use a snippet to scaffold the first file, then let an agent handle the rest.

---

## See Also

- [Agents Reference](05-agents-reference.md) -- for when snippets aren't enough
- [Prompt Engineering](08-prompt-engineering.md) -- prompting alongside snippets
- [Back to documentation index](README.md)
