> **Before reading this:** Familiarity with [Agents Reference](05-agents-reference.md) and [Prompt Engineering](08-prompt-engineering.md) will help you get the most from these examples.

# Workflow Examples

Nine complete development scenarios showing every prompt the developer types, what the AI produces, where codebase rules shaped the output, and where the developer needed to step in and correct course. These are not idealized demos -- they show the realistic back-and-forth of working with AI-assisted tooling on this project.

### How to Read These Scenarios

Each scenario follows the same structure:

- **Context** -- what the developer needs to accomplish and why
- **Turn N** -- the exact prompt the developer types (in a code block) followed by what the AI produces
- **Blockquotes (>)** -- annotations explaining why a prompt worked, why a correction was needed, or which rule files influenced the output
- **Reflection** -- what went well, what the AI missed, and what to learn from it

The code examples show representative output, not exact transcripts. Your results will vary based on the context window and what other files are open.

---

## Scenario 1: Adding a New API Endpoint

**Context:** A developer needs to add an endpoint for managing saved search queries. They need the full stack: model, migration, service, routes, schemas, tests. This is one of the most common multi-file tasks on the project, and the `@agent-new-endpoint` agent is purpose-built for it.

### Turn 1 -- Developer provides the full specification

```
@agent-new-endpoint Create a full CRUD API for saved searches.
- Domain: saved_searches
- Base path: /v1/users/<user_id>/saved-searches
- Methods: GET (list), POST (create), DELETE (soft delete by ID)
- Auth: JWT + API key multi-auth
- New model: SavedSearch
  - saved_search_id (UUID PK)
  - user_id (FK to user)
  - query_text (text, required)
  - filters_json (JSONB, nullable)
  - name (text, required)
  - is_deleted (boolean, default false)
```

> **Why this prompt works well:** It specifies the domain name, URL structure, HTTP methods, auth type, model fields with types, and nullability. This front-loads all the information the agent needs and avoids multiple round trips where the AI asks clarifying questions.

**What the AI produces -- seven files in a single pass:**

| File | Key details |
|------|------------|
| `saved_searches/__init__.py` | Blueprint with correct `url_prefix`, snake_case directory |
| `saved_search_routes.py` | Three handlers with correct decorator stack order: `@blueprint.route` > `@blueprint.auth_required` > `@blueprint.input` > `@blueprint.output` |
| `saved_search_schemas.py` | Marshmallow schemas for create request, response, and paginated list |
| `saved_search.py` model | Inherits `ApiSchemaTable` + `TimestampMixin`, UUID PK, `Mapped[T]` syntax |
| Alembic migration | `schema="api"`, `upgrade()`/`downgrade()`, columns match model |
| `test_saved_search_routes.py` | `enable_factory_create` fixture, `Factory.create()`, success + error cases |
| Blueprint registration | Import and registration in the app's blueprint registry |

**What the rules shaped:**

> - The **`api-routes`** rule ensured decorators were stacked in the correct order: `@blueprint.route` outermost, then `@blueprint.auth_required`, then `@blueprint.input`/`@blueprint.output`. Getting this wrong causes silent failures where auth is bypassed or input validation doesn't run.
> - The **`api-database`** rule forced UUID primary keys using the project's `Mapped[uuid.UUID]` syntax and ensured the model inherits from `ApiSchemaTable` + `TimestampMixin`, not raw `db.Model`.
> - The **`api-tests`** rule triggered the `enable_factory_create` fixture pattern and ensured test factories use `Factory.create()` for objects that need to exist in the database during the test.
> - The **`cross-domain`** rule added `is_deleted` for soft delete (not hard delete) and ensured all logging calls use structured logging with `logger.info("message", extra={"key": "value"})` format.

### Turn 2 -- Developer reviews and catches a missing authorization check

```
The routes look good but the DELETE handler should verify that the authenticated
user owns the saved search before soft-deleting it. Add user identity verification
following our api-routes convention.
```

> **Why this correction was needed:** The agent checked that the user was authenticated but did not verify the authenticated user's ID matched the `user_id` in the URL. User A could delete User B's saved searches -- a security gap the agent should have caught from the URL structure.

**What the AI does:** Adds ownership verification to the DELETE handler:

```python
user = jwt_or_api_user_key_multi_auth.get_user()
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")
```

This is placed after authentication but before the soft-delete logic. The AI also suggests adding the same check to POST and GET handlers (a user should only manage their own saved searches).

> The `api-error-handling` rule shaped the use of `raise_flask_error()` rather than a raw response. The `api-auth` rule shaped the `.get_user()` pattern.

### Turn 3 -- Developer asks for the factory

```
Good. Now add the factory for SavedSearch in the test factories file.
```

**What the AI produces:** A `SavedSearchFactory` in the existing factories file using `factory.LazyFunction(uuid.uuid4)` for the PK, `factory.LazyAttribute` for the FK to `UserFactory.create()`, and `factory.Faker` for text fields.

### Reflection

The agent produced ~90% correct code on the first pass. The missing piece -- ownership verification -- is a common gap: the AI generates structurally correct code but misses authorization logic that requires understanding URL parameter semantics. Always review auth logic manually.

**Total prompts:** 3 | **Time saved:** 30-45 minutes of manual scaffolding

---

## Scenario 2: Building a New Frontend Component

**Context:** A developer needs to create a component that displays a list of saved searches with delete functionality. This follows from Scenario 1 -- the API exists, and now the frontend needs a UI for it.

### Turn 1 -- Developer provides component specification

```
@agent-code-generation Create a React server component at
frontend/src/components/search/SavedSearchList.tsx that:
- Fetches the user's saved searches using requesterForEndpoint()
- Displays each search in a USWDS Card component
- Shows the search name, query text, and date created
- Has a delete button on each card
- Shows an empty state when there are no saved searches
- Uses translations from useTranslations("SavedSearches")
```

**What the AI produces:**

A server component with this general structure:

```tsx
// No "use client" — this is a React Server Component
import { Card, CardHeader, CardBody } from "@trussworks/react-uswds";
import { useTranslations } from "next-intl";
import { requesterForEndpoint } from "src/services/fetch";

export default async function SavedSearchList({ userId }: Props) {
  const t = useTranslations("SavedSearches");
  const searches = await requesterForEndpoint(`/v1/users/${userId}/saved-searches`);

  if (searches.length === 0) {
    return <p>{t("emptyState")}</p>;
  }

  return (
    <div>
      <h2>{t("header")}</h2>
      {searches.map((search) => (
        <Card key={search.saved_search_id}>
          <CardHeader><h3>{search.name}</h3></CardHeader>
          <CardBody>
            <p>{t("queryLabel")}: {search.query_text}</p>
            <p>{t("createdDateLabel")}: {search.created_at}</p>
            {/* Delete button will be extracted in Turn 2 */}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
```

**What the rules shaped:**
> - **`frontend-components`** -- server component default (no `"use client"`), domain-based file paths under `components/search/`, USWDS components from `@trussworks/react-uswds`
> - **`frontend-services`** -- `requesterForEndpoint()` instead of raw `fetch()` or client-side hooks like `useEffect` + `useState`
> - **`frontend-i18n`** -- `useTranslations()` for all visible text, camelCase keys, no hardcoded strings

### Turn 2 -- Developer identifies a server/client boundary issue

```
The delete button needs client-side interactivity (onClick handler, confirmation dialog).
The main list can stay as a server component, but extract the delete button into a
separate client component at frontend/src/components/search/DeleteSearchButton.tsx.
```

> **Why the developer caught this:** Server components cannot have event handlers. The AI followed the `frontend-components` rule's "default to server components" but missed that a delete button inherently needs client interactivity.

**What the AI does:** Creates `DeleteSearchButton.tsx` with `"use client"`, `onClick` handler, confirmation dialog, loading/error states, and translations. Updates the parent to render `<DeleteSearchButton />` inside each card while remaining a server component. This follows the rule's guidance: push interactivity into the smallest possible client component.

### Turn 3 -- Developer adds translations

```
@agent-i18n Add all the translations needed for the SavedSearchList component:
page title, header, empty state message, delete button label, delete confirmation,
delete success message, search name label, query label, created date label.
```

**What the AI produces:** Entries in the single translation file under a `"SavedSearches"` namespace with camelCase keys: `pageTitle`, `header`, `emptyState`, `deleteButton`, `deleteConfirmation`, `deleteSuccess`, plus labels for each displayed field. The `frontend-i18n` rule enforced the single-file approach and key naming convention.

### Turn 4 -- Developer requests tests

```
@agent-test-generation Write tests for both the SavedSearchList and
DeleteSearchButton components. Include jest-axe accessibility scans for both.
Mock the API call for the list component.
```

**What the AI produces:** Two test files -- `SavedSearchList.test.tsx` (mocks `requesterForEndpoint()`, tests rendering and empty state) and `DeleteSearchButton.test.tsx` (tests click, confirm, and cancel flows). Both include `jest-axe` accessibility scans, enforced by the `frontend-tests` rule.

### Reflection

The AI's instinct to keep everything server-side was correct per rules -- the developer overrode with a valid reason. This is the ideal pattern: let rules enforce defaults, then consciously deviate when needed.

**Total prompts:** 4 (across `@agent-code-generation`, `@agent-i18n`, `@agent-test-generation`)
**Key takeaway:** Specialized agents for each part of a feature produce better results than one agent doing everything.

---

## Scenario 3: Adding a Form Field to a Grant Application

**Context:** A developer needs to add a "budget justification" textarea to the grant application form. This project uses a three-schema architecture for forms (JSON Schema, UI Schema, Rule Schema), which is the most complex domain-specific pattern in the codebase.

### Turn 1 -- Developer describes the requirement

```
@new-form-field I need to add a "budget_justification" textarea field
to the grant application form. It should be required when the requested
amount exceeds $500,000. Maximum 5000 characters.
```

> **Note:** `@new-form-field` is a notepad, not an agent. Loading it provides the AI with the full three-schema architecture context, including how JSON Schema, UI Schema, and Rule Schema interact, and the custom validator the project uses.

**What the AI produces:** Guidance on updating all three schema files:

1. **JSON Schema** -- adds `budget_justification` with `type: "string"`, `maxLength: 5000`:
   ```json
   "budget_justification": {
     "type": "string",
     "maxLength": 5000,
     "description": "Justification for the requested budget amount"
   }
   ```
   Crucially, it is NOT added to the top-level `required` array -- that would make it always required regardless of amount.

2. **UI Schema** -- sets `ui:widget: "textarea"` with `rows: 8`, plus title and description for the form rendering.

3. **Rule Schema** -- adds a conditional: when `requested_amount` has `exclusiveMinimum: 500000`, then `budget_justification` becomes required:
   ```json
   {
     "if": { "properties": { "requested_amount": { "exclusiveMinimum": 500000 } } },
     "then": { "required": ["budget_justification"] }
   }
   ```

> **Rule influence:** The `api-form-schema` rule provided the three-schema architecture context. Without it, the AI might have put the conditional requirement directly in the JSON Schema file (valid per spec but violates this project's separation of concerns).

### Turn 2 -- Developer asks for actual code changes

```
Show me the actual code changes needed for each schema file.
Use our custom OUR_VALIDATOR, not the default jsonschema validator.
```

**What the AI produces:** Concrete diffs showing exact insertion points in each file, using `OUR_VALIDATOR.validate()` (the project's custom validator) instead of standard `jsonschema.validate()`.

### Turn 3 -- Developer requests tests

```
@agent-test-generation Write the test triad for this form field:
1. Minimal form (only required fields) — budget_justification NOT present
2. Full form (all fields) — budget_justification present with valid text
3. Empty form — verify budget_justification is required when amount > $500K
```

**What the AI produces:** Three test cases using `OUR_VALIDATOR.validate()`:
- **Minimal form** -- amount defaults to $100K, no `budget_justification`, validation passes
- **Full form** -- includes `budget_justification` with valid text, validation passes
- **Conditional requirement** -- sets `requested_amount` to $600K without `budget_justification`, asserts validation error

> **Rule influence:** The `api-form-schema` rule informed the test triad pattern (minimal, full, conditional) specific to form fields.

### Turn 4 -- Developer asks about XML compatibility

```
@new-form-field Will this field affect the XML output for legacy Grants.gov?
What do I need to check for XML compatibility?
```

**What the AI explains:** New form fields need a corresponding XML mapping entry in `field_mappings.py` or they are silently omitted from Grants.gov exports. The developer should check whether budget justification is expected in the legacy format and either add a mapping or explicitly flag the field as "API-only."

### Reflection

The `new-form-field` notepad provided context about the three-schema architecture, the custom validator, and XML compatibility the developer would not have considered otherwise. The conditional requirement (Rule Schema) is the trickiest part -- getting it wrong means always-required or never-required.

**Total prompts:** 4 | **Key takeaway:** Load the relevant notepad first for complex domain-specific tasks.

---

## Scenario 4: Debugging a Failing E2E Test

**Context:** A Playwright E2E test is failing intermittently in CI. It passes locally every time. The developer needs to figure out why and fix it. This scenario demonstrates using the AI as a debugging partner rather than a code generator.

### Turn 1 -- Developer describes the problem

```
The Playwright test "opportunity search — filters by status" in
frontend/e2e/search.spec.ts is failing intermittently in CI with:
"Timeout waiting for selector [data-testid='search-results']"
The test passes locally. It runs in shard 2 of 4.

Here's the test code:

test("filters by status", async ({ page }) => {
  await page.goto("/search");
  await page.click("[data-testid='status-filter-open']");
  await page.waitForSelector("[data-testid='search-results']");
  const results = await page.$$("[data-testid='search-result-card']");
  expect(results.length).toBeGreaterThan(0);
});

What could cause intermittent failures in CI but not locally?
```

> **Why this is a good debugging prompt:** It includes the exact error, test code, CI context (shard 2 of 4), and local behavior. Enough for the AI to reason about environmental differences.

**What the AI suggests** (ordered by likelihood):

1. **Network timing** -- CI is slower; API response may not arrive before the default timeout
2. **Race condition** -- component briefly unmounts results during re-fetch; `waitForSelector` catches the gap
3. **Selector convention violation** -- uses `data-testid` instead of role-based selectors (per `frontend-tests` rule); role-based selectors are more resilient with auto-waiting
4. **Shard isolation** -- previous test in shard 2 may leave unexpected state

> **Rule influence:** The `frontend-tests` rule flagged `data-testid` usage immediately. The `ci-cd` rule helped reason about shard-specific issues.

### Turn 2 -- Developer asks for a rewrite

```
How should I rewrite this test following our Playwright conventions?
Use role-based selectors and add appropriate waits.
```

**What the AI produces:**

```typescript
test("filters by status", async ({ page }) => {
  await page.goto("/search");

  // Wait for initial results before interacting (original raced against page render)
  await page.getByRole("list", { name: /search results/i }).waitFor();

  // Click the status filter using role-based selector
  await page.getByRole("checkbox", { name: /open/i }).click();

  // Wait for results to stabilize after re-fetch
  await page.getByRole("list", { name: /search results/i }).waitFor();

  // Use Playwright's auto-retry assertion instead of manual count
  const results = page.getByRole("article");
  await expect(results.first()).toBeVisible();
  expect(await results.count()).toBeGreaterThan(0);
});
```

Key changes:
- `getByRole()` replaces all `data-testid` selectors -- more resilient with auto-waiting
- Initial `waitFor()` ensures the page is loaded before interaction
- `toBeVisible()` with auto-retry replaces `waitForSelector` + manual length check

### Turn 3 -- Developer asks a clarifying question

```
Also, should I add a retry for the API call, or is the issue
in how the test waits for the response?
```

**What the AI explains:** The issue is in how the test waits, not the API call. Adding retries would mask the problem. Use Playwright's auto-waiting (which the rewritten test does). If the API is slow in CI, increase the test timeout rather than adding retry logic.

### Reflection

The convention violation (`data-testid` instead of role-based selectors) happened to also cause the functional issue. Fixing the convention fixed the bug.

**Total prompts:** 3 | **Key takeaway:** Paste full test code and error messages -- convention violations often coincide with bugs.

---

## Scenario 5: Self-Review Before Opening a PR

**Context:** A developer has finished implementing a notification preferences feature and wants to check their code against project conventions before requesting human review. This saves the reviewer's time by catching mechanical issues upfront.

### Turn 1 -- Developer requests a convention review

```
@pr-review I'm about to open a PR with changes to these files:
- api/src/api/users_v1/user_routes.py (added new route)
- api/src/services/users_v1/update_notification_prefs.py (new service)
- api/src/db/models/user.py (added notification_preferences column)
- api/tests/src/api/users/test_notification_prefs.py (new tests)
- api/src/db/migrations/2026_04_01_add_notification_prefs.py (migration)

Review my changes against our codebase conventions.
[paste diff]
```

**What the AI produces:** A structured review with rules activated (`api-routes`, `api-services`, `api-database`, `api-tests`, `api-error-handling`, `cross-domain`) and findings using severity prefixes:

| Severity | Finding | Rule |
|----------|---------|------|
| **bug:** | Decorator order reversed -- `@blueprint.auth_required` before `@blueprint.route` | `api-routes` |
| **suggestion:** | 15 lines of business logic in route handler; should be in service function | `api-routes` |
| **suggestion:** | Uses `Column(JSON)` instead of `Mapped[dict \| None]` with `mapped_column()` | `api-database` |
| **nit:** | `logger.warning()` for expected behavior (first-time setup); should be `logger.info()` | `cross-domain` |
| **positive:** | Tests correctly use `enable_factory_create`, cover success + error paths | `api-tests` |
| **positive:** | Migration uses `schema="api"`, includes `upgrade()`/`downgrade()` | `api-database` |

### Turn 2 -- Developer fixes and re-requests review

```
Thanks. I've fixed the decorator order and moved the logic to the service function.
Can you re-review just the route handler and service function?
```

**What the AI produces:** Focused re-review confirming fixes. One additional finding: the service function should accept `db_session` as its first parameter (per `api-services` rule) rather than importing it globally.

### Turn 3 -- Developer makes final adjustment

```
Fixed. The db_session parameter is added. Anything else before I open the PR?
```

**What the AI produces:** All-clear confirmation with no remaining violations. The AI also suggests:
- Mention the migration in the PR description so reviewers can verify migration safety
- Note whether the migration is reversible (it should be, since it only adds a column)
- Consider whether existing users need a default value for the new column

### Reflection

Self-review caught two convention violations and one style issue that would have triggered a review cycle. Fixing before PR saves everyone's time.

**Total prompts:** 3 | **Key takeaway:** Run `@pr-review` before opening a PR to catch mechanical issues upfront.

---

## Scenario 6: Learning Unfamiliar Code

**Context:** A developer who primarily works on the frontend has been asked to investigate and fix a bug in the API authentication system. They are unfamiliar with the backend auth code. This scenario demonstrates using the AI as a guide through an unfamiliar part of the codebase.

### Turn 1 -- Developer asks for an orientation

```
@architecture-overview I normally work on the frontend but I've been asked
to investigate a bug in the API authentication system. Can you give me
an overview of how auth works in this project?
```

**What the AI explains:** A layered walkthrough of the auth system:

1. **Multi-auth composition** -- custom `MultiHttpTokenAuth` class composes JWT + API key into one decorator
2. **Three auth decorators** -- `jwt_or_api_user_key_multi_auth` (either), `jwt_only_auth` (JWT only), `api_key_only_auth` (API key only)
3. **RBAC** -- `can_access()` and `verify_access()` check roles after authentication
4. **Key files** -- `multi_auth.py`, `jwt_handler.py`, `api_key_handler.py`, `rbac.py`

> **Rule influence:** The `api-auth` rule provided specific class names, decorator patterns, and file locations rather than generic auth explanations.

### Turn 2 -- Developer describes the bug

```
The bug is: users with API keys can access endpoints that should be JWT-only.
Where in the code should I look? What files handle auth configuration?
```

**What the AI suggests** (ordered simplest to deepest):

1. **Wrong decorator** -- endpoint may use `jwt_or_api_user_key_multi_auth` (accepts both) instead of `jwt_only_auth`
2. **Fallback logic bug** -- `MultiHttpTokenAuth` may not reject API keys properly when JWT is required
3. **Blueprint-level override** -- a blueprint default auth decorator may override the endpoint-level one

### Turn 3 -- Developer finds the issue

```
I found the issue — the endpoint is using jwt_or_api_user_key_multi_auth
but should only allow JWT. What's the correct pattern for a JWT-only endpoint
in this project?
```

**What the AI explains:** The correct JWT-only pattern:

```python
@blueprint.route("/v1/users/<user_id>/settings", methods=["PUT"])
@jwt_only_auth.login_required       # <-- changed from jwt_or_api_user_key_multi_auth
@blueprint.input(UserSettingsSchema)
@blueprint.output(UserSettingsResponseSchema)
def update_user_settings(user_id, json_data):
    user = jwt_only_auth.get_user()  # <-- also changed here
    # ... handler logic
```

The AI also warns: if any API key consumers depend on this endpoint, this change will break them -- verify before deploying.

> **Rule influence:** The `api-auth` rule provided the exact decorator name and import path, saving the developer from searching the codebase.

### Turn 4 -- Developer requests a regression test

```
@agent-test-generation Write a test that verifies this endpoint
returns 401 when called with an API key instead of a JWT token.
```

**What the AI produces:**

```python
@pytest.fixture
def api_key_headers():
    """Headers with a valid API key but no JWT."""
    api_key = ApiKeyFactory.create()
    return {"X-API-Key": api_key.key}

def test_update_user_settings_rejects_api_key(client, api_key_headers):
    """Verify that the endpoint requires JWT and rejects API key auth."""
    response = client.put(
        "/v1/users/some-user-id/settings",
        headers=api_key_headers,
        json={"email_notifications": True},
    )
    assert response.status_code == 401

def test_update_user_settings_accepts_jwt(client, jwt_headers):
    """Verify that the endpoint accepts JWT auth (positive control)."""
    response = client.put(
        "/v1/users/some-user-id/settings",
        headers=jwt_headers,
        json={"email_notifications": True},
    )
    assert response.status_code in (200, 204)
```

Both a negative test (API key rejected) and a positive test (JWT accepted) ensure the fix works without accidentally breaking JWT auth. Shaped by the `api-tests` rule's fixture and assertion patterns.

### Reflection

The developer went from "I don't know how auth works" to "found and fixed the bug with a regression test" in four prompts. The notepad provided orientation; the AI served as a guided tour, progressively narrowing from overview to specific fix.

**Total prompts:** 4 | **Key takeaway:** Load a notepad to get oriented in unfamiliar code, then ask progressively more specific questions.

---

## Key Patterns Across These Scenarios

Six scenarios, same underlying patterns:

### 1. Start broad, then narrow

Every scenario begins with a broad prompt that provides context -- what the developer is trying to do, what domain they are working in, what constraints apply. Later prompts get progressively more specific. This mirrors how you would explain a task to a colleague: context first, then details.

**Example progression from Scenario 6:**
- Turn 1: "How does auth work in this project?" (orientation)
- Turn 2: "Where should I look for this specific bug?" (narrowing)
- Turn 3: "What's the correct pattern to fix it?" (specific solution)
- Turn 4: "Write a regression test." (concrete artifact)

### 2. Review each generated artifact

In Scenario 1, the developer reviewed the generated route handler and caught a missing authorization check. In Scenario 2, the developer caught a server/client boundary issue. If they had accepted all generated files without review, both bugs would have shipped. The AI is most reliable for structural patterns (naming, imports, boilerplate) and least reliable for security and business logic.

### 3. Correct early, not late

When the AI produces something incorrect, correct it in the next prompt rather than waiting until the end. Each correction builds on prior context, so the AI's understanding improves incrementally. In Scenario 1, the authorization fix in Turn 2 informed the factory generation in Turn 3.

### 4. Load notepads for domain knowledge

Scenarios 3 and 6 both used notepads (`@new-form-field` and `@architecture-overview`) to load domain knowledge before asking the AI to generate anything. This is especially important for:
- Complex domains like the three-schema form architecture
- Unfamiliar code like the auth system
- Cross-cutting concerns like XML compatibility or migration safety

### 5. Self-review saves review cycles

Scenario 5 caught two convention violations and one style issue that would have required at least one additional review cycle. Running `@pr-review` on your own code takes 2-3 minutes and catches the mechanical issues that human reviewers otherwise spend time writing up.

### 6. Match the agent to the task

| Task | Tool | Why |
|------|------|-----|
| Full endpoint scaffolding | `@agent-new-endpoint` | Produces 7 coordinated files with correct cross-references |
| Single component or function | `@agent-code-generation` | Detects the layer and loads the right rules |
| Tests | `@agent-test-generation` | Knows project-specific test patterns (fixtures, factories, axe) |
| Translations | `@agent-i18n` | Enforces single-file structure and key naming |
| Pre-submission review | `@pr-review` | Checks against all relevant conventions |
| Understanding unfamiliar code | Notepad + conversation | Provides orientation before diving into specifics |

Using the wrong tool is not catastrophic, but using the right one produces better results with fewer corrections needed.

---

## Scenario 7: PR Preparation with `@agent-pr-preparation`

**Context:** A developer has finished a branch that adds a new endpoint and a small frontend change. They think they're done, but they want to catch convention violations, missing tests, and a sloppy PR title before opening the PR for human review.

### Turn 1 — Developer invokes the agent on the branch

```
@agent-pr-preparation prepare this branch for PR
```

The agent's Pre-Flight loads the cross-cutting conventions, runs `git status` and `git diff main...HEAD` to enumerate touched files, and calls `get_rules_for_file()` for each one. It then walks its procedure:

1. **Test selection.** It runs scoped tests via `skill-run-relevant-tests` — only the API and frontend test surfaces that touch the changed files. The pytest run flags one new endpoint that has no integration test.
2. **Convention sweep.** It calls `skill-check-conventions` across the diff. Two findings: a `print(...)` in a service file (`cross-domain.mdc` violation) and a missing `jest-axe` assertion in a new component test (`accessibility.mdc` violation).
3. **PII sweep.** It invokes `pii-leak-detector` against the diff. Clean.
4. **Title and description.** It checks the branch name against the `[Issue N] Description` format from `github-issues.mdc`, then drafts a PR description using the `pr-preparation` template — summary, screenshots placeholder, accessibility notes, privacy notes, and a self-review checklist.

### Turn 2 — Developer reviews the report

The agent returns a structured report:

> **Blockers (must fix before PR):**
> - `bug:` `api/src/services/notifications/notification_service.py:42` uses `print(...)` instead of structured logging. Per `cross-domain.mdc`, use `logger.info("Notification dispatched", extra={"notification_id": notification.notification_id})`.
> - `testing:` `frontend/tests/components/NotificationBanner.test.tsx` is missing the `jest-axe` accessibility assertion required by `frontend-tests.mdc`.
> - `testing:` `api/src/api/notifications_v1/notification_routes.py` has no integration test in `api/tests/api/notifications_v1/`.
>
> **Non-blocking suggestions:**
> - `nit:` Branch name `add-notifications` does not match `[Issue N] Description`. Consider renaming to `[1234] Add notification dispatch endpoint`.
>
> **Drafted PR description:** _(full markdown body, ready to paste into the PR template)_

> **Why the agent caught this and a `git push` would not.** The blockers are exactly the kind of things human reviewers spend their time on — and exactly the kind of things that make a PR bounce. Catching them before push means the human reviewer gets to focus on business logic instead of lint.

### Reflection

The agent does not push, does not commit, and does not edit files directly. It produces a checklist. The developer fixes the three blockers, runs the agent again to confirm, and then opens the PR by hand.

---

## Scenario 8: `/codemod` — Rename a Method Across 12 Files

**Context:** The team has decided to rename `Application.is_submitted` to `Application.has_been_submitted` to match the boolean naming convention in `cross-domain.mdc`. The attribute is referenced in 12 files across the API and tests. A manual rename would be tedious and error-prone.

### Turn 1 — Developer invokes the codemod

```
/codemod Rename Application.is_submitted to Application.has_been_submitted across api/src/ and api/tests/
```

The agent's Pre-Flight runs:

1. `get_architecture_section("api")` and `get_rules_for_file()` for `api/src/db/`, `api/src/services/`, `api/src/api/`, `api/tests/`.
2. Verifies `libcst` is importable.
3. Verifies the working tree is clean. **It is not — the developer has uncommitted changes in a frontend file.** The agent refuses:

> I won't run a codemod against a dirty working tree — rollback requires a clean base. Please commit or stash your frontend changes and re-invoke.

### Turn 2 — Developer stashes and re-invokes

```
git stash push -m "wip frontend"
/codemod Rename Application.is_submitted to Application.has_been_submitted across api/src/ and api/tests/
```

Now the agent proceeds:

1. **Discover.** `rg --files-with-matches "is_submitted" api/src/ api/tests/` returns 12 files. The agent reports the count and groups them by nearest common parent.
2. **Plan batches.** Two batches: 7 files in `api/src/` (model + service + routes), 5 files in `api/tests/`. Presents the plan for confirmation.
3. **Write codemod script.** A small `libcst.CSTTransformer` that renames the attribute access and the `Mapped[bool]` column. Saved to `.cursor/tmp/codemods/rename-is-submitted.py`. The agent shows the script to the developer.
4. **Execute batch 1.** Apply, run `ruff format` on the touched files, then `uv run pytest api/tests/api/applications_v1/ -x --no-header -q`. Tests pass. Fixup commit `codemod(applications): batch 1/2`.
5. **Execute batch 2.** Apply to test files, run the broader `make test-api` to confirm. Passes. Fixup commit `codemod(applications): batch 2/2`.
6. **Summary.** "Renamed `Application.is_submitted` to `Application.has_been_submitted` across 12 files in 2 batches. 2 fixup commits. Test surface clean. The Alembic migration to rename the column is *not* part of this codemod — invoke `@agent-migration` if you also need a DB rename."

### Reflection

The codemod agent is intentionally narrow: it does AST renames, not column renames. It hand-offs the part that requires judgment (the migration) to the agent that owns it. This is the "hand off, not heroics" principle from the prompt-engineering guide.

---

## Scenario 9: `@agent-interactive-codebase-tour` for a New Contributor

**Context:** A new developer is on day two and needs to understand how a form submission flows from the frontend through the API to the database and back. They invoke the read-only tour agent.

### Turn 1 — Developer asks for the form-submission tour

```
@agent-interactive-codebase-tour Trace what happens when a user submits the SF-424 form.
```

The agent's Pre-Flight loads `architecture-overview`, `forms-vertical.mdc`, `frontend-app-pages.mdc`, `api-form-schema.mdc`, and the relevant section of the architecture guide. Then it walks the developer through the request:

1. **Frontend page.** "The form lives in `frontend/src/app/applications/[applicationId]/forms/[formId]/page.tsx`. It's a Server Component that fetches the form schema and any saved answers via `requesterForEndpoint` (rule: `frontend-services.mdc`)."
2. **Form rendering.** "The three-schema form (JSON schema, UI schema, Rule schema) is defined in `api/src/form_schema/forms/sf424/` and rendered by `frontend/src/components/forms/JsonSchemaForm.tsx`. See rule `forms-vertical.mdc`."
3. **Submission.** "Clicking Submit posts to `POST /v1/applications/{application_id}/forms/{form_id}` (file `api/src/api/applications_v1/application_form_routes.py`). The route is thin (`api-routes.mdc`) and delegates to `submit_application_form` in `api/src/services/applications/application_form_service.py`."
4. **Validation.** "The service validates against `OUR_VALIDATOR` (custom JSON Schema validator from `api-form-schema.mdc`), persists the answers to `application_form` and `application_form_answer` tables, and emits a `form_submitted` event for downstream processing."
5. **Response.** "The route returns `response.ApiResponse(message='Form submitted', data=...)` and the frontend redirects to the application overview page."

After each step, the agent pauses and asks: "Want to dig into any of these layers, or keep going to the next one?"

### Reflection

The tour agent never edits files. It is read-only by design (`readonly: true` in its frontmatter). It cites real files at every step, references the rule that enforces the convention being shown, and offers to drill in. This is the "knowledgeable junior developer who has memorized every convention" mental model from the [Capabilities and Limitations](12-capabilities-and-limitations.md) doc, applied to onboarding instead of code generation.

The tour is the recommended way to ramp up on an unfamiliar area of the codebase before invoking any of the workflow agents that *write* code. A 15-minute tour saves an hour of bouncing PRs later.

---

## See Also

- [Prompt Engineering](08-prompt-engineering.md) -- the prompt patterns used in these scenarios
- [Multi-File Workflows](10-multi-file-workflows.md) -- handling complex multi-file changes
- [Agents Reference](05-agents-reference.md) -- full reference for every agent used above
- [Notepads Reference](06-notepads-reference.md) -- reference for the notepads used in Scenarios 3 and 6
- [Back to documentation index](README.md)
