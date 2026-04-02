> **Before reading this:** This guide assumes you've completed [Getting Started](03-getting-started.md) and have the toolkit working in Cursor.

# Prompt Engineering for Simpler.Grants.gov

## Why Prompting Matters More With This Toolkit

The AI already has context about the project via auto-activating rules. This means your prompts can leverage that context instead of re-explaining conventions. A well-written prompt + loaded rules = output that passes code review. A vague prompt + loaded rules = better-than-generic output, but you'll still need heavy editing.

The rules tell the AI *how* the project works; your prompt tells it *what* you need right now.

---

## The Anatomy of a Good Prompt

Four components:

1. **Context** -- what you're working on, which files are involved
2. **Intent** -- what you want the AI to do (create, fix, refactor, explain, review)
3. **Constraints** -- what should/shouldn't change, edge cases to handle
4. **Examples** -- reference existing code, paste error messages, show expected output

You don't always need all four explicitly. If you're editing an open file, context is implicit. If you paste a traceback, intent and examples are covered. But when output quality drops, check which component is missing.

**Context** anchors the AI to the right part of the codebase. Include file paths, function names, and domain area (opportunities, users, agencies, applications).

**Intent** should be a single action. "Create," "fix," "refactor," "explain," and "review" produce very different outputs. Mixing them leads to unfocused results.

**Constraints** prevent the AI from over-reaching. "Only modify this file," "don't change existing tests," "keep backward compatibility."

**Examples** are the highest-signal input. Paste an error message, show expected JSON, reference a working endpoint. The AI pattern-matches well given a concrete target.

---

## The Anatomy of a Bad Prompt

Common mistakes and why they fail:

- **Too vague:** "Write me an endpoint" -- for which domain? What path? What auth? The AI fills in blanks with generic patterns that may not match project conventions.
- **Missing context:** "Fix this bug" -- what bug? In what file? What's the expected behavior? The AI can't read your screen or your mind.
- **Too broad:** "Refactor the entire API" -- the AI will lose coherence on anything this large. Token limits mean it literally cannot hold the whole API in working memory at once.
- **Contradictory:** Asking for client-side state management in a server component, or requesting both "keep it simple" and "handle every edge case."
- **Assuming memory:** Starting a new chat with "continue what we were doing." Each session starts fresh.

---

## Before/After Prompt Comparisons

The following pairs each show a weak prompt and a strong prompt for the same task. The annotations explain what the strong version adds and why it matters.

### 1. Creating a New API Route

**Weak:**
```
Create a route for getting agencies
```

**Strong:**
```
Create a GET route handler at /v1/agencies/<uuid:agency_id>/contacts
in api/src/api/agencies_v1/agency_routes.py.
Use JWT + API key multi-auth. Return a paginated list of AgencyContact objects.
The AgencyContact model already exists in api/src/db/models/agency_contact.py.
Follow the decorator ordering from our api-routes convention.
```

**Why it's better:** Specifies exact path, file location, auth method, response format, and existing model. The AI doesn't have to guess. Referencing the decorator ordering convention triggers the AI to apply the correct stack order.

---

### 2. Adding a Frontend Component

**Weak:**
```
Make a card component for opportunities
```

**Strong:**
```
Create a React server component at frontend/src/components/opportunity/OpportunityCard.tsx
that displays an opportunity summary. Props: opportunity object with title (string),
agency_name (string), close_date (string), status (OpportunityStatus enum).
Use USWDS Card component from @trussworks/react-uswds.
Get the translated status label from useTranslations("Opportunities.statuses").
Do not add "use client" -- this should remain a server component.
```

**Why it's better:** Specifies RSC (no "use client"), exact file path, props interface, USWDS requirement, and i18n integration.

---

### 3. Writing a Test

**Weak:**
```
Write tests for the user service
```

**Strong:**
```
Write tests for the get_user_saved_searches service function in
api/src/services/users/get_saved_searches.py.
The function signature is: get_user_saved_searches(db_session, user_id) -> list[SavedSearch].
Test cases:
- Returns empty list when no searches exist for the user
- Returns all saved searches for a valid user
- Raises 404 if user_id doesn't match any user
Use Factory.create() for database integration tests (include enable_factory_create fixture).
Use Factory.build() for the unit test of empty-list behavior.
Put the tests in api/tests/src/services/users/test_get_saved_searches.py.
```

**Why it's better:** Includes function signature, expected behavior for each case, and explicitly guides factory usage (create vs. build).

---

### 4. Adding a Database Migration

**Weak:**
```
Add a column to the user table
```

**Strong:**
```
Generate an Alembic migration to add a nullable 'notification_preferences' JSONB column
to the 'user' table. Include both upgrade() and downgrade() functions.
Remember to use schema="api" in all operations.
The downgrade should use op.drop_column("user", "notification_preferences", schema="api").
Run: cd api && alembic revision --autogenerate -m "add notification_preferences to user"
Then verify the generated migration before applying.
```

**Why it's better:** Specifies column type, nullability, the schema="api" requirement, and even the generation command. The downgrade hint prevents a common autogenerate mistake.

---

### 5. Fixing a Bug in Form Validation

**Weak:**
```
Fix the form validation
```

**Strong:**
```
In api/src/form_schema/validate.py, the validation function isn't catching
the case where a user submits a form with close_date before open_date.
Add a cross-field validation rule in the Rule Schema that requires
close_date > open_date when both are present. Use the OUR_VALIDATOR
custom validator, not the default jsonschema validator.
Here's the error users are seeing:
"Application submitted with close_date 2025-01-01 and open_date 2025-06-01 -- no error raised."
```

**Why it's better:** Points to exact file, describes exact bug with a concrete example, and names the custom validator to use.

---

### 6. Adding i18n Strings

**Weak:**
```
Add translations for the new page
```

**Strong:**
```
Add translations to frontend/src/i18n/messages/en/index.ts for a new
"SavedSearches" page. I need:
- pageTitle: "Saved Searches | Simpler.Grants.gov"
- header: "Your Saved Searches"
- emptyState: "You haven't saved any searches yet. Try searching for opportunities and saving your search."
- deleteConfirmation: "Are you sure you want to delete this saved search?"
- deleteSuccess: "Saved search deleted"
- errorLoading: "There was an error loading your saved searches. Please try again."
Use PascalCase for the top-level key ("SavedSearches"), camelCase for leaf keys.
Follow the pattern used by the existing "Opportunities" key in the same file.
```

**Why it's better:** Exact file, exact key names, exact text content, naming convention reminder, and a reference to an existing pattern.

---

### 7. Writing an E2E Test

**Weak:**
```
Write an end-to-end test
```

**Strong:**
```
Write a Playwright E2E test in frontend/e2e/opportunity-search.spec.ts that:
1. Navigates to /search
2. Types "climate" in the keyword search input
3. Selects "Posted" from the status filter
4. Clicks the search button
5. Verifies at least one result appears with a heading role element
6. Clicks the first result and verifies the opportunity detail page loads
Use role-based selectors (getByRole, getByLabel) instead of CSS selectors.
Use test.describe() to group related assertions.
The base URL is configured in playwright.config.ts -- don't hardcode it.
```

**Why it's better:** Exact test steps, semantic selector requirement, specific file path, and a reminder about base URL configuration.

---

### 8. Updating Infrastructure Configuration

**Weak:**
```
Add a new environment variable
```

**Strong:**
```
Add a new feature flag 'FEATURE_SAVED_SEARCHES_OFF' to the frontend
infra configuration. Following our infra.mdc conventions:
- Add SSM parameter in infra/frontend/app-config/env-config/environment_variables.tf
- Use manage_method = "manual"
- Set the secret_store_name pattern: /${var.app_name}/${var.environment}/feature-saved-searches-off
- Add the variable to the ECS task definition environment block
Make sure SSM parameters are created in all environments before merge.
The naming convention for feature flags is FEATURE_<NAME>_OFF (off by default).
```

**Why it's better:** Exact file, naming convention, management method, SSM path pattern, and a deployment reminder. Infrastructure mistakes are expensive.

---

### 9. Adding Error Handling

**Weak:**
```
Add error handling to this function
```

**Strong:**
```
This service function in api/src/services/applications/submit.py returns None
when the application isn't found. Per our api-error-handling convention,
it should raise_flask_error(404, "Application not found"). Also add
structured logging: logger.info("Application submission attempted",
extra={"application_id": str(application_id)}) at the top of the function.
Log at info level for the 404 case, not warning -- 404 is expected behavior
when users bookmark stale URLs.
```

**Why it's better:** References the specific convention by name, shows the exact error-raising pattern, and specifies log levels with rationale.

---

### 10. Debugging a CI Failure

**Weak:**
```
Why is CI failing?
```

**Strong:**
```
The GitHub Actions CI check 'api-checks' is failing with this error:

FAILED api/tests/src/api/opportunities/test_opportunity_routes.py::test_opportunity_create_422
AssertionError: assert 500 == 422

The failing test is test_opportunity_create_422 in
api/tests/src/api/opportunities/test_opportunity_routes.py.
It expects a 422 but gets 500. The route handler is in
api/src/api/opportunities_v1/opportunity_routes.py.
I suspect the validation error isn't being caught before it hits
the generic error handler. Can you identify what's causing the 500
and suggest a fix?
```

**Why it's better:** Includes the actual error output, identifies the failing test, points to the relevant source file, and offers a hypothesis for the AI to investigate.

---

### 11. Creating a Service Function

**Weak:**
```
Write a service for deleting saved searches
```

**Strong:**
```
Create a service function delete_saved_search(db_session, user_id, search_id) -> None
in api/src/services/users/delete_saved_search.py.
Business rules:
- Verify the saved search belongs to the requesting user (raise 403 if not)
- Raise 404 if search_id doesn't exist
- Use a soft delete: set is_deleted=True and deleted_at=datetime.now(tz=timezone.utc)
- Don't actually call db_session.delete()
Follow the pattern in api/src/services/users/delete_user.py for the soft delete approach.
```

**Why it's better:** Full function signature, business rules as a checklist, soft-delete clarification (the AI defaults to hard delete without this), and a reference implementation.

---

### 12. Reviewing a Pull Request

**Weak:**
```
Review this PR
```

**Strong:**
```
Review the changes in PR #482 focusing on:
1. Does the new opportunity_versions table migration include proper indexes?
2. Are the service functions using db_session.execute() with proper error handling?
3. Do the tests cover the version conflict case (two users editing simultaneously)?
4. Is the API response schema backward-compatible with v1 clients?
Don't review styling or formatting -- the linter handles that.
```

**Why it's better:** Scoped review criteria, specific concerns, and an explicit exclusion so the AI doesn't waste tokens on lint-level comments.

---

## Advanced Prompting Patterns

These patterns go beyond single prompts. They describe strategies for managing longer interactions with the AI.

### Incremental Prompting

Break complex tasks into steps. Review each step before proceeding:

```
Step 1: "Create the SQLAlchemy model for AgencyContact with fields:
         id (UUID), agency_id (UUID FK), name (str), email (str),
         phone (str nullable), role (str). Use TimestampMixin."
[review the model, accept or request changes]

Step 2: "Now create the Alembic migration for this model.
         Use schema='api' and add an index on agency_id."
[review the migration, accept or request changes]

Step 3: "Write the service functions: list_agency_contacts(db_session, agency_id)
         and create_agency_contact(db_session, agency_id, contact_data).
         Use the patterns from the existing user service functions."
[review the services, accept or request changes]

Step 4: "Now wire up the route handlers in agency_routes.py
         for GET /v1/agencies/<id>/contacts and POST /v1/agencies/<id>/contacts."
[review the routes, accept or request changes]
```

**Why this works:** Each step is small enough for the AI to get right. You catch mistakes early instead of unwinding a 200-line diff.

### Referencing Conventions Explicitly

When the AI misses a convention, name it:

```
Per our api-routes convention, the decorator stack must be in this order:
METHOD -> input -> output -> doc -> auth -> db_session. Please reorder the decorators.
```

```
Per our frontend-i18n convention, all user-facing strings must go through
useTranslations(). Replace the hardcoded "No results found" with t("Search.noResults").
```

Naming the convention triggers the AI to re-check its loaded rules and correct the output.

### Constraining Output

Tell the AI what NOT to change:

```
Modify only the service function in api/src/services/users/get_user.py.
Do not change the route handler, schema, or tests.
```

```
Refactor the pagination logic in this function only.
Don't extract it to a utility -- I want to keep it inline for now.
Don't change the function signature.
```

### Asking for Explanations Alongside Code

```
Implement the pagination logic for the opportunity list endpoint
and explain why you chose this approach over offset-based pagination.
```

```
Write the database query for full-text search on opportunity titles.
Explain the trade-offs between PostgreSQL tsvector vs. ILIKE for ~500K opportunities.
```

### Comparing Approaches

```
Show me two ways to implement the notification preferences endpoint:
1. Using a separate NotificationPreference model with its own table
2. Using a JSONB column on the User model
For each approach, show the model, migration, and one service function.
Which approach fits better with our existing database patterns?
```

### Chain-of-Thought Prompting

For debugging, ask the AI to think through the problem:

```
Walk me through the request lifecycle for POST /v1/applications/<id>/submit.
Start from the route handler, trace through the service function,
identify every place where an exception could be raised,
and tell me which ones would result in a 500 vs. a handled error response.
```

### Template Prompts

For repetitive tasks, create a template you reuse with different values:

```
Create a new CRUD service module for [ENTITY]:
- File: api/src/services/[domain]/[operation]_[entity].py
- Model: api/src/db/models/[entity].py (already exists)
- Operations needed: [list, get, create, update, delete]
- Auth: [auth requirements]
- Special business rules: [rules]
```

Fill in the brackets for each new entity. This ensures consistency across your service layer.

---

## Prompt Patterns by Task Type

Quick reference for the most common tasks:

| Task | Key things to include in your prompt |
|------|--------------------------------------|
| New API route | HTTP method, path, auth type, request/response schemas, file location |
| New component | Server vs. client component, props, USWDS components to use, i18n keys |
| Database migration | Table name, column types, nullability, indexes, schema="api" |
| Bug fix | Error message, expected vs. actual behavior, file path, reproduction steps |
| Test | Function under test, test cases, Factory.create() vs. Factory.build() |
| Refactor | What to change, what NOT to change, desired end state |
| Code review | Specific concerns, what to ignore, which files matter most |
| Infrastructure | Terraform file path, variable naming, environment considerations |

---

## Common Mistakes

1. **Assuming the AI remembers previous conversations.** Each new chat session starts fresh. Reference files and context explicitly every time. If you were working on something yesterday, re-state what you're working on.

2. **Pasting too much code.** Paste only the relevant function or section, not entire files. Point the AI to the file path and let it read what it needs.

3. **Not reviewing generated code.** Always read the diff before accepting. The AI gets things right 80-90% of the time. The other 10-20% can be subtle: wrong variable names, missing null checks, incorrect enum values.

4. **Fighting the conventions.** If you need to break a convention, explain why in your prompt: "I know we usually use Mapped[T], but this legacy table requires Column() because it maps to a pre-existing schema we can't modify." Without the explanation, the AI will keep "correcting" your intentional deviation.

5. **Using agents for trivial tasks.** For a one-line fix, just ask directly in Cmd+K inline edit mode. Agents are for multi-file, multi-step work.

6. **Not iterating.** If the first output isn't right, don't start over. Say what's wrong and ask for a correction: "The auth decorator is in the wrong position. Move it after @api_blueprint.doc." Iterating on a near-correct output is faster than re-prompting from scratch.

7. **Ignoring the rules that loaded.** When you open a file and see rules auto-activate in the Cursor sidebar, those rules are shaping the AI's output. If the output doesn't match what you expected, check which rules loaded -- you might need to reference a specific rule or open a file that triggers the right rule.

8. **Prompt bombing.** Asking for five unrelated things in one prompt ("add the migration, write the tests, update the docs, fix the linter error, and deploy to staging"). The AI will attempt all of them and do none of them well. One task per prompt, or use incremental prompting for related tasks.

---

## Measuring Prompt Effectiveness

How do you know if your prompts are good? Track these signals:

- **Acceptance rate:** How often do you accept the AI's first output without editing? Aim for 70%+.
- **Edit distance:** When you do edit, how much do you change? Small edits (variable names, minor logic) suggest good prompts. Large rewrites suggest bad ones.
- **Iteration count:** How many back-and-forth messages before the output is right? One or two is good. Five+ means your initial prompt was missing something.
- **Convention compliance:** Does the output follow project conventions without you having to remind? If you're constantly correcting decorator order or factory usage, your prompts are missing constraints.

---

## Quick Reference: Prompt Checklist

Before sending a prompt, mentally check:

- [ ] Did I specify the file path(s)?
- [ ] Did I state what action I want (create/fix/refactor/explain)?
- [ ] Did I mention constraints (what not to change)?
- [ ] Did I include an example or error message if relevant?
- [ ] Is this scoped to one task, not five?
- [ ] If this is a new chat, did I re-establish context?

---

## See Also

- [Workflow Examples](09-workflow-examples.md) -- see these patterns in full conversations
- [Prompt Cookbook](appendix/prompt-cookbook.md) -- 40+ copy-paste ready prompts
- [Agents Reference](05-agents-reference.md) -- when to use an agent instead of a raw prompt
- [Back to documentation index](README.md)
