---
title: Prompt Cookbook
description: Copy-paste ready prompts for Simpler.Grants.gov development in Cursor IDE
audience: developers using the AI Coding Toolkit
prerequisites: docs/03-getting-started.md, docs/08-prompt-engineering.md
last_updated: 2026-04-02
---

# Prompt Cookbook

> Read [Prompt Engineering](../08-prompt-engineering.md) for the theory behind these prompts. Each prompt applies the four-component pattern (Context, Intent, Constraints, Examples) described in that guide.

This cookbook contains 42 copy-paste ready prompts for the most common development tasks on Simpler.Grants.gov. Each prompt references actual project conventions -- decorator stack order, `raise_flask_error`, `Mapped[T]`, `useTranslations`, factory patterns, and more.

**How to use:** Copy a prompt, replace all `{placeholders}` with your actual values, and paste into Cursor chat. Have the relevant source files open so auto-activating rules load the right context.

> **Slash commands are the preferred invocation method.** Where prompts below reference agents (e.g., `@agent-debugging`), you can use the corresponding slash command instead (e.g., `/debug`). Available commands: `/debug`, `/refactor`, `/new-endpoint`, `/generate`, `/test`, `/migration`, `/i18n`, `/adr`, `/review-pr`. The `@agent-name` syntax still works but slash commands are faster.

---

## 1. API Development

Prompts for Flask-based API work. All routes follow the decorator stack convention and delegate logic to the service layer.

New route handler -- use when adding a new endpoint to an existing blueprint:
```
Create a {http_method} route handler at /v1/{domain}/{endpoint_path} in api/src/api/{domain}_v1/{domain}_routes.py. Use jwt_or_api_user_key_multi_auth. Decorator stack order: METHOD -> input -> output -> doc -> auth -> db_session. Keep the handler thin -- delegate to a service function and return response.ApiResponse(message="Success", data=result).
```

New service function -- use when creating business logic that interacts with the database:
```
Create {function_name}(db_session: db.Session, {params}) in api/src/services/{domain}/{function_name}.py. Business rules: {rule_1}; {rule_2}. Use raise_flask_error({status_code}, "{message}") for errors. Add structured logging: logger.info("{action}", extra={"{id_field}": str({id_var})}). Follow the pattern in api/src/services/{domain}/{existing_service}.py.
```

Add Marshmallow validation schema -- use when defining request/response contracts:
```
Create request and response schemas in api/src/api/{domain}_v1/{domain}_schemas.py. Request: {SchemaName}RequestSchema with {fields}. Response: {SchemaName}ResponseSchema with {model_name}_id (UUID, dump_only), {fields}, created_at/updated_at (DateTime, dump_only). Use load_default=None for optional fields. Keep request and response schemas separate.
```

Add error handling -- use when a service function is missing proper error responses:
```
In api/src/services/{domain}/{service_file}.py, update {function_name} to use raise_flask_error(404, "{message}") when not found, raise_flask_error(403, "Forbidden") when unauthorized, and raise_flask_error(422, "{message}", validation_issues=[ValidationErrorDetail(type=ValidationErrorType.INVALID, message="{field_error}", field="{field_name}")]) for validation errors. Add structured logging at info level for 404s. Do not change the function signature.
```

Add or change authentication -- use when an endpoint needs a different auth type:
```
Update {http_method} /v1/{endpoint_path} in api/src/api/{domain}_v1/{domain}_routes.py. Change auth from {current_auth} to {target_auth}. Options: jwt_or_api_user_key_multi_auth, jwt_only_auth, api_key_only_auth. Also update .get_user() to use {target_auth}.get_user(). Keep decorator order: METHOD -> input -> output -> doc -> auth -> db_session.
```

Add query parameters -- use when adding filtering or sorting to a list endpoint:
```
Add query parameters to GET /v1/{domain}/{endpoint_path} in api/src/api/{domain}_v1/{domain}_routes.py. New params: {param_name} ({type}, filters by {description}), sort_by (one of [{values}]), sort_order ("asc"|"desc"). Add to input schema with location="query". Pass through to the service function and apply as SQLAlchemy filters.
```

Add pagination -- use when a list endpoint needs paginated responses:
```
Add pagination to GET /v1/{domain}/{endpoint_path}. Query params: page (int, default 1), page_size (int, default 25, max 100). Service returns {data, pagination_info: {page, page_size, total_records, total_pages}}. Use .offset() and .limit(). Separate count query for total_records. Return via response.ApiResponse.
```

Create a new API blueprint -- use when adding a brand new domain area:
```
Create a new blueprint for {domain}: 1) api/src/api/{domain}_v1/__init__.py with url_prefix="/v1/{domain}", 2) api/src/api/{domain}_v1/{domain}_routes.py with a GET health-check, 3) register in the app factory. Follow the opportunities or users blueprint pattern. Use snake_case for directory and file names.
```

## 2. Database

Prompts for SQLAlchemy models, Alembic migrations, and schema management. All models use `Mapped[T]` syntax and all migrations require `schema="api"`.

New model -- use when adding a new database table:
```
Create SQLAlchemy model {ModelName} in api/src/db/models/{model_name}.py. Inherit ApiSchemaTable + TimestampMixin. Use Mapped[T] with mapped_column(), not Column(). PK: {model_name}_id as Mapped[uuid.UUID] with default=uuid.uuid4. Columns: {column_name}: Mapped[{type}] = mapped_column({sa_type}). Use text_type for strings, prefix booleans with is_. Register import in api/src/db/models/__init__.py.
```

New Alembic migration -- use when you need a migration for schema changes:
```
Generate migration: cd api && alembic revision --autogenerate -m "{description}". Verify it includes schema="api" on ALL operations, a working downgrade(), column types matching models, and indexes for columns used in WHERE/JOIN. Fix anything autogenerate missed.
```

Add a lookup table -- use when adding enumeration or reference data:
```
Create lookup table {table_name} in api/src/db/models/lookup/{table_name}.py. Inherit LookupTable. Columns: {table_name}_id (Mapped[int], PK), description (Mapped[str], text_type). Seed with {values} via op.bulk_insert() in upgrade(). Downgrade deletes rows then drops table. All operations need schema="api".
```

Add a relationship -- use when connecting two models with a foreign key:
```
Add relationship between {ParentModel} and {ChildModel}. In child: add {parent}_id as Mapped[uuid.UUID] FK, add {parent}: Mapped["{ParentModel}"] = relationship(back_populates="{children}"). In parent: add {children}: Mapped[list["{ChildModel}"]] = relationship(back_populates="{parent}"). Generate a migration. Add index on FK column.
```

Add an index -- use when query performance needs improvement:
```
Create migration to add index: op.create_index("ix_{table}_{column}", "{table}", ["{column}"], schema="api"). Downgrade: op.drop_index("ix_{table}_{column}", table_name="{table}", schema="api"). Run: cd api && alembic revision --autogenerate -m "add index on {table}.{column}".
```

## 3. Frontend Development

Prompts for Next.js with React Server Components, USWDS design system, and next-intl translations. Default to server components; use "use client" only when interactivity is required.

New React Server Component page -- use when creating a new page:
```
Create RSC page at frontend/src/app/[locale]/{route_path}/page.tsx. Fetch data with requesterForEndpoint("/v1/{api_path}"). Use USWDS components from @trussworks/react-uswds. All text via useTranslations("{PageName}"). Handle empty state. Do NOT add "use client". Follow frontend/src/app/[locale]/search/page.tsx pattern.
```

New client component -- use when a component needs event handlers or state:
```
Create client component at frontend/src/components/{domain}/{ComponentName}.tsx. Add "use client" first line. Props: {prop_name}: {type}, on{Event}: ({params}) => void. Use USWDS {Component} from @trussworks/react-uswds. All text via useTranslations("{ComponentName}"). Include loading and error states. Keep as small as possible.
```

New custom hook -- use when extracting reusable stateful logic:
```
Create use{HookName} at frontend/src/hooks/use{HookName}.ts. "use client" first line. Accept {params}, manage state for {description}, return { {values} }. Handle loading/error/success states. Use useCallback for returned functions. Follow frontend/src/hooks/{existing_hook}.ts.
```

Add i18n translations -- use when adding user-facing text for a new component:
```
Add to frontend/src/i18n/messages/en/index.ts under "{ComponentName}" (PascalCase). Keys (camelCase): pageTitle: "{text}", heading: "{text}", {key}: "{text}", errorMessage: "{text}", emptyState: "{text}". Follow the "Opportunities" key pattern.
```

Add a form field -- use when adding a field to an existing form:
```
Add {field_type} field for "{field_name}" to frontend/src/components/{domain}/{FormComponent}.tsx. Use USWDS {USWDSComponent}. Label: t("{ComponentName}.{fieldLabel}"). Validation: {rules}. Error: t("{ComponentName}.{fieldError}"). Add translations to i18n file. Add "use client" if onChange or conditional display needed.
```

Add a USWDS component -- use when integrating a U.S. Web Design System element:
```
Add USWDS {ComponentName} to frontend/src/components/{domain}/{ParentComponent}.tsx. Import from "@trussworks/react-uswds". Config: {prop}: {value}. All text via useTranslations(). Check USWDS docs for required ARIA attributes. Interactive = client component. Display-only = server component.
```

Add server-side data fetching -- use when a server component needs API data:
```
Create fetcher at frontend/src/services/{domain}/{fetcher_name}.ts. Import "server-only" first. Use requesterForEndpoint("/v1/{api_path}"). Export async function returning typed data. In the page component, await the fetcher. No useEffect or useState -- server component only.
```

Add an error boundary -- use when a page needs graceful error handling:
```
Create error boundary at frontend/src/app/[locale]/{route_path}/error.tsx. Must be "use client". Receives { error, reset } props. Show useTranslations("{PageName}.error") message, "Try again" button calling reset(). Use USWDS Alert type="error". Never show raw error to users. Follow search/error.tsx pattern.
```

## 4. Testing

Prompts for pytest (API), Jest with Testing Library (frontend), jest-axe (accessibility), and Playwright (E2E). All tests use factory patterns for data setup.

Pytest route test -- use when testing an API endpoint handler:
```
Write pytest tests for {http_method} /v1/{endpoint_path} in api/tests/src/api/{domain}/test_{route_file}.py. Cases: test_{name}_200 (valid request), test_{name}_401 (unauthed), test_{name}_404 (missing resource), test_{name}_422 (bad input). Use {Model}Factory.create() with enable_factory_create fixture. Access data via response.get_json()["data"]. Compare UUIDs with str().
```

Pytest service test -- use when testing a service function directly:
```
Write tests for {function_name}(db_session, {params}) -> {return_type} in api/tests/src/services/{domain}/test_{function_name}.py. Cases: success, not_found (404), forbidden (403), empty list. Use Factory.create() with enable_factory_create for DB tests. Use Factory.build() for unit tests without DB persistence.
```

Jest component test -- use when testing a React component:
```
Write Jest tests for {ComponentName} in frontend/tests/components/{domain}/{ComponentName}.test.tsx. Cases: renders without errors, displays {content} with {props}, handles empty state, calls {callback} on {action}. Use role-based selectors (getByRole, getByLabelText). No data-testid. Mock translations with project i18n utilities.
```

Jest accessibility test -- use when adding a11y verification (project requirement):
```
Add jest-axe tests to frontend/tests/components/{domain}/{ComponentName}.test.tsx. Import { axe } from "jest-axe". Cases: default props, {variant}, error state. Pattern: const { container } = render(<{ComponentName} />); expect(await axe(container)).toHaveNoViolations(); Accessibility tests are required, not optional.
```

Playwright E2E test -- use when testing a complete user workflow:
```
Write Playwright test in frontend/e2e/{feature}.spec.ts. Steps: 1) goto({path}), 2) {action_1}, 3) {action_2}, 4) verify {outcome}. Use role-based selectors only: getByRole(), getByLabel(). No CSS selectors or data-testid. Use test.describe(). Base URL from playwright.config.ts. Use await expect(locator).toBeVisible() not waitForSelector.
```

Test factory -- use when setting up complex test data with relationships:
```
Create {ModelName}Factory in api/tests/src/factories/{file}.py. Inherit factory.alchemy.SQLAlchemyModelFactory. Use factory.LazyFunction(uuid.uuid4) for UUIDs, factory.Faker("{provider}") for text, factory.SubFactory({Related}Factory) for FKs. Meta: model={ModelName}, sqlalchemy_session_persistence="commit". Use .create() with enable_factory_create, .build() without DB.
```

## 5. Code Review

Prompts for AI-assisted code review. Use `@pr-review` agent for automated reviews, or paste these directly into chat with a diff.

Full PR review -- use before opening a PR to catch convention violations:
```
Review this diff against project conventions. Check: decorator stack order (METHOD -> input -> output -> doc -> auth -> db_session), raise_flask_error() not raw exceptions, Mapped[T] not Column(), structured logging with extra={}, Factory.create() with enable_factory_create, "use client" only when needed, useTranslations() for all text, role-based test selectors. Severity prefixes: bug:, suggestion:, nit:, positive:. [paste diff]
```

Review a specific file -- use for focused feedback on one file:
```
Review api/src/{file_path} against our {domain} conventions. Focus only on this file. Check: {concern_1}, {concern_2}, {concern_3}. Ignore formatting (linter handles it). Use severity prefixes: bug:, suggestion:, nit:, positive:.
```

Security-focused review -- use when changes touch auth, user data, or external input:
```
Security review of these changes. Check: authorization (user owns resource?), input validation, parameterized queries via SQLAlchemy, error messages not leaking internals, correct auth decorator (jwt_only vs jwt_or_api_key), verify_access() for role-gated endpoints. Ignore style. [paste diff]
```

Performance-focused review -- use when changes handle large datasets or high traffic:
```
Performance review of these changes. Check: N+1 queries (eager loading?), missing indexes on WHERE/JOIN columns, unbounded queries (paginated with max page_size?), unused fetched data, unnecessary client component re-renders. Ignore style. [paste diff]
```

## 6. Debugging

Prompts for using the AI as a debugging partner. Use `/debug` (or invoke the `@agent-debugging` subagent directly) for structured multi-step investigation with regression detection, or paste these directly into chat for quick debugging.

### Agent-Powered Debugging (Recommended)

These prompts invoke `/debug` (or `@agent-debugging`) for comprehensive investigation with regression checking, convention-aware fixes, and specialist validation.

Debug with full stack trace -- use for any error with a traceback:
```
@agent-debugging Here's the full error:

{paste complete stack trace or error output}

This started happening after {recent_change_or_PR}. It happens {consistently / intermittently}.
```

Debug intermittent E2E test failure -- use when Playwright tests flake:
```
@agent-debugging This E2E test is failing intermittently:

File: frontend/tests/e2e/{feature}/{test_file}.spec.ts
Test name: {test_name}
Tag: @{execution_tag}

It passes ~{percent}% of the time. Here's the failure output:
{paste Playwright error output}
```

Debug form submission error -- use for the complex forms domain:
```
@agent-debugging I'm getting a {status_code} error when submitting form {form_name}.

Error log:
{paste API error log}

The form uses form_schema {schema_name}. The submission endpoint is POST /v1/{endpoint}.
```

Debug CI-only failure -- use when it works locally but fails in GitHub Actions:
```
@agent-debugging The CI check '{workflow_name}' is failing but it passes locally.

CI error output:
{paste error}

I haven't changed {relevant_config}. This started failing on {date_or_PR}.
```

Debug migration failure -- use for Alembic or data migration issues:
```
@agent-debugging This migration is failing in {environment}:

{paste migration error}

The migration file is api/src/db/migrations/versions/{migration_file}.py.
```

### Quick Debugging (No Agent)

These prompts skip the full agent workflow for simpler issues.

Debug API error -- use when an endpoint returns an unexpected status code:
```
The {http_method} /v1/{endpoint_path} endpoint is returning {actual_status}
but should return {expected_status}.

Error output:
{paste error message or response body}

The route handler is in api/src/api/{domain}_v1/{domain}_routes.py.
The service function is in api/src/services/{domain}/{service_file}.py.
I suspect {hypothesis}.
Trace the request lifecycle from the route handler through the service function
and identify where the unexpected response originates.
```

Debug frontend rendering -- use when a component displays incorrectly or not at all:
```
The {ComponentName} component at frontend/src/components/{path}/{ComponentName}.tsx
is {problem_description}.

Expected behavior: {expected}
Actual behavior: {actual}
Console errors: {paste any browser console errors}

Check for:
- Server vs client component mismatch (missing or unnecessary "use client")
- Translation keys that do not exist in the i18n file
- Props not being passed correctly from the parent component
- Conditional rendering logic errors
```

Debug test failure -- use when a test fails and you need to understand why:
```
This test is failing:

File: {test_file_path}
Test name: {test_name}
Error:
{paste full error output}

The code under test is in {source_file_path}.
The test was passing before {what_changed}.
Identify the root cause -- is the test wrong, or is the code wrong?
If the test needs updating, show the corrected test.
If the code has a bug, show the fix.
```

Debug CI failure -- use when GitHub Actions fails but tests pass locally:
```
The GitHub Actions CI check '{check_name}' is failing with this error:

{paste CI error output}

The failing test/step is {location}.
The relevant source files are:
- {file_1}
- {file_2}

This passes locally but fails in CI. Common CI-specific causes to check:
- Database migration ordering or missing migrations
- Environment variable differences
- Timing/race conditions in async operations
- File path case sensitivity (CI runs Linux, local may be macOS)
What is causing the CI-only failure?
```

## 7. Refactoring

Prompts for improving existing code without changing external behavior. Always specify what should NOT change.

Extract service function -- use when a route handler contains business logic:
```
{handler_name} in api/src/api/{domain}_v1/{domain}_routes.py has business logic that belongs in a service. Extract to api/src/services/{domain}/{service_name}.py. Service takes db_session first, uses raise_flask_error() for errors, includes structured logging. Handler becomes thin: call service, return ApiResponse. Do not change external behavior.
```

Convert client to server component -- use when "use client" is unnecessary:
```
frontend/src/components/{path}/{ComponentName}.tsx has "use client" but uses no useState, useEffect, event handlers, or browser APIs. Remove "use client". Replace useEffect fetching with requesterForEndpoint. Extract any interactive children into separate small client components. Keep useTranslations(). Do not change visual output.
```

Update error handling -- use when a file uses raw exceptions instead of project utilities:
```
In api/src/{file_path}: replace HTTPException with raise_flask_error(), replace return None with raise_flask_error(404), add ValidationErrorDetail for 422s. Log levels: 404=info, 403=warning, 500=error with extra={"error": str(e)}. Import raise_flask_error from src.api.route_utils. Do not change signatures or happy path.
```

Modernize model syntax -- use when a model uses legacy Column() instead of Mapped[T]:
```
Update api/src/db/models/{model_file}.py to SQLAlchemy 2.0: Column(Type) -> Mapped[type] = mapped_column(sa_type), nullable=True -> Mapped[type | None], Boolean default -> Mapped[bool] = mapped_column(default=X). Ensure ApiSchemaTable + TimestampMixin inheritance, text_type for strings. Code-only refactor, no schema change, no migration needed.
```

### Agent-Powered Refactoring

These prompts invoke `/refactor` (or `@agent-refactor`) for multi-file structural changes with full blast radius tracking, phased execution, and quality gate validation.

Extract service function with full tracking -- use when business logic is scattered across route handlers:
```
@agent-refactor Extract the eligibility check logic from api/src/services/applications/{service_file}.py into a new api/src/services/applications/{new_service}.py. Multiple routes call this logic. Map all callers, update imports, and ensure tests follow the code.
```

Split oversized component -- use when a frontend component has grown too large:
```
@agent-refactor Split frontend/src/components/{path}/{ComponentName}.tsx into sub-components: {SubComponent1}, {SubComponent2}, {SubComponent3}. Keep the parent as a composition wrapper. Move tests alongside each new component. Preserve all accessibility attributes.
```

Consolidate duplicated patterns -- use when the same logic appears in multiple places:
```
@agent-refactor There are {N} implementations of {pattern_description} across {file_1}, {file_2}, {file_3}. Consolidate into a shared utility at {target_path}. Update all call sites. Ensure no behavioral difference.
```

Move logic between architectural layers -- use when code is in the wrong layer:
```
@agent-refactor Move the {description} logic from api/src/api/{domain}_v1/{domain}_routes.py into a service function at api/src/services/{domain}/{service_name}.py. The route handler should become thin: call service, return ApiResponse. Preserve all error handling and logging conventions.
```

Rename across codebase -- use when renaming a function, class, or variable used in many files:
```
@agent-refactor Rename {old_name} to {new_name} across all files that reference it. This includes imports, function calls, test assertions, and type references. Verify zero remaining references to the old name after completion.
```

## 8. Documentation

Prompts for technical writing. The AI produces good first drafts of structured documents when given clear outlines.

Write an ADR -- use when documenting a significant technical decision:
```
Write ADR-{number}: {short_title}. Status: {Proposed|Accepted|Deprecated}. Sections: Context (why needed), Decision (what and why), Alternatives Considered (rejected options with reasons), Consequences (positive and negative). Plain prose for Context and Decision. Audience: future developers.
```

Update API docs -- use when an endpoint has changed or a new one was added:
```
Document {http_method} /v1/{endpoint_path}. Include: path, method, auth type, request params/body, success response (200), error responses (401/403/404/422), example request and response as JSON blocks. Match existing API docs format.
```

Add inline documentation -- use when a function's purpose is not obvious from code:
```
Add documentation to {function_name} in {file_path}. Docstring with params and return value. Comments on non-obvious logic only (WHY not WHAT). Document side effects and preconditions. Do not change code. Google-style docstrings for Python, JSDoc for TypeScript.
```

---

## Tips

1. **Replace all `{placeholders}`** before pasting.
2. **Open relevant files** in Cursor so auto-activating rules load.
3. **Use agents** for multi-file tasks: `/new-endpoint` (or `@agent-new-endpoint`), `/test` (or `@agent-test-generation`), `/generate` (or `@agent-code-generation`).
4. **Iterate** on 80%-correct output rather than re-prompting from scratch.
5. **Name conventions explicitly** when the AI misses one: "Per our api-routes convention, reorder the decorators."

---

## See Also

- [Prompt Engineering](../08-prompt-engineering.md) -- theory behind prompt structure
- [Code Snippets Reference](../07-code-snippets-reference.md) -- tab-completion boilerplate
- [Workflow Examples](../09-workflow-examples.md) -- full multi-turn conversations
- [Agents Reference](../05-agents-reference.md) -- when to use agents over raw prompts
- [Back to documentation index](../README.md)
