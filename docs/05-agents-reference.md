> **Before reading this:** Read [How It Works](02-how-it-works.md) to understand what agents are and how they differ from auto-activating rules.

# Agents Reference

## What Are Agents?

Agents are rule files with empty glob patterns -- they don't activate automatically. You invoke them by name when you need a structured, multi-step workflow. They're like having a senior engineer's playbook for specific tasks. Unlike auto-activating rules that fire whenever you touch a matching file, agents sit idle until you explicitly call on them. This gives you full control over when their conventions and scaffolding logic kick in.

## How to Invoke an Agent

There are two methods:

1. **In Chat (Cmd+L):** Type `@agent-name` followed by your request. The agent's rules load into context and guide the AI through the workflow.
2. **In Composer (Cmd+I):** Same syntax, but Composer can create and edit multiple files in a single pass, which is ideal for agents that produce several artifacts.

Both methods work identically in terms of which rules load. The difference is only in how the AI applies the output -- Chat explains and suggests, Composer directly writes files.

---

## Agent Reference

### @agent-new-endpoint

**Purpose:** Creates a complete new API endpoint from scratch, producing a full set of scaffolded files: blueprint, routes, schemas, service layer, tests, factory, and blueprint registration. Seven files in one invocation, all following project conventions for naming, structure, and patterns.

**When to use:**
- Creating a brand new endpoint that doesn't exist yet
- You need full CRUD or a subset of CRUD operations for a new resource
- You want all the boilerplate generated consistently in one shot

**When NOT to use:**
- Adding a new route to an existing blueprint (just edit the route file directly)
- Making changes to existing endpoint behavior (modify the relevant file by hand or with `@agent-code-generation`)
- The endpoint already exists and you need to extend it

**How to invoke:**
```
@agent-new-endpoint <describe the endpoint, methods, model, and auth requirements>
```

**Example prompts (simple to complex):**

1. **Basic list endpoint:**
   `@agent-new-endpoint Create a GET endpoint at /v1/agencies that lists all agencies`

2. **With authentication:**
   `@agent-new-endpoint Create a POST /v1/users/<user_id>/saved-searches endpoint with JWT auth that saves a search query`

3. **With full model definition:**
   `@agent-new-endpoint Create CRUD endpoints for a new AgencyContact model with fields: name (text), email (text, nullable), phone (text, nullable), role (text), is_primary (boolean)`

4. **Soft delete pattern:**
   `@agent-new-endpoint Create a DELETE /v1/users/<user_id>/saved-searches/<search_id> that soft-deletes. The SavedSearch model exists.`

5. **Multi-endpoint with relationships:**
   `@agent-new-endpoint Create endpoints for managing organization invitations. Domain: organizations. Endpoints: POST /v1/organizations/<org_id>/invitations (create), GET (list), PUT /<invitation_id> (accept/decline). New model: OrganizationInvitation with user_id FK, organization_id FK, status (lookup: pending/accepted/declined), invited_by_user_id FK, message (text, nullable), is_deleted.`

**What the agent produces:**
- `api/src/api/<domain>/<resource>/__init__.py` -- Blueprint definition
- `api/src/api/<domain>/<resource>/routes.py` -- Route handlers
- `api/src/api/<domain>/<resource>/schemas.py` -- Marshmallow request/response schemas
- `api/src/services/<domain>/<resource>.py` -- Service layer functions
- `tests/src/api/<domain>/<resource>/test_routes.py` -- Route-level tests
- `tests/src/db/models/factories.py` -- Factory additions for the new model
- Blueprint registration in the app's blueprint registry

**Tips for better results:**
- Be explicit about model fields, types, and nullability
- Mention whether models already exist or need to be created
- Specify which HTTP methods you need (GET, POST, PUT, DELETE)
- State auth requirements clearly -- mention JWT, API key, or both

**Common pitfalls:**
- If you don't specify auth, the agent defaults to JWT + API key, which may not be what you want
- If you don't mention fields, the agent will ask -- save a round trip by including them upfront
- Don't forget to specify foreign key relationships if the resource belongs to another

---

### @agent-code-generation

**Purpose:** Domain-aware code generation that automatically loads the right rules based on what layer you're working in. It detects whether you're writing a route, service, model, component, or schema and applies the corresponding project conventions without you having to remember them.

**When to use:**
- Writing a single file or function where you want conventions applied automatically
- Building a component, service function, schema, or model in isolation
- You know exactly what layer you're working in and need one piece of it

**When NOT to use:**
- Creating a multi-file feature from scratch (use `@agent-new-endpoint` instead)
- Writing tests specifically (use `@agent-test-generation` for better test patterns)
- The task is so simple that loading an agent adds more overhead than value

**How to invoke:**
```
@agent-code-generation <describe what you're building and which layer it belongs to>
```

**Example prompts (simple to complex):**

1. **Service function:**
   `@agent-code-generation Write a service function that retrieves all active opportunities for an agency with pagination`

2. **Frontend component:**
   `@agent-code-generation Create a USWDS Card component that displays an opportunity summary with title, agency, close date, and status badge`

3. **Marshmallow schemas:**
   `@agent-code-generation Write Marshmallow request/response schemas for an endpoint that searches opportunities by keyword, status, and agency`

4. **SQLAlchemy model:**
   `@agent-code-generation Create a SQLAlchemy model for tracking user activity: activity_id UUID PK, user_id FK, action (text), target_type (text), target_id UUID, metadata JSON nullable`

5. **React hook:**
   `@agent-code-generation Write a custom React hook useOpportunityFilters that manages filter state from URL search params`

**What the agent produces:**
- A single file (or function) in the appropriate layer, following project conventions
- Correct imports, naming patterns, and structural conventions for that layer
- Type annotations (Python) or TypeScript types (frontend) as appropriate

**Tips for better results:**
- Tell the agent what layer you're working in (route, service, model, component, hook)
- Reference existing models and types by name so the agent uses the right imports
- Mention relationships to other parts of the codebase when relevant

**Common pitfalls:**
- Can produce overly complex code for simple tasks -- for quick one-offs, just write it yourself
- If you don't specify the layer, the agent may guess wrong
- Won't create associated test files -- use `@agent-test-generation` separately

---

### @agent-test-generation

**Purpose:** Generates tests following the project's exact testing patterns, including factory `build`/`create` usage, `enable_factory_create` fixtures, `jest-axe` accessibility checks, and Playwright E2E conventions. Produces tests that look like a team member wrote them, not generic AI output.

**When to use:**
- After writing code that needs test coverage
- Adding tests to existing code that lacks coverage
- You want tests that follow project-specific patterns out of the box

**When NOT to use:**
- When the test is trivial enough to write by hand in under a minute
- For testing third-party library behavior (write those manually)

**How to invoke:**
```
@agent-test-generation <describe what to test, including function signatures and expected behavior>
```

**Example prompts (simple to complex):**

1. **Route tests:**
   `@agent-test-generation Write tests for GET /v1/agencies/<agency_id>/contacts covering 200, 404, and 401`

2. **Service tests:**
   `@agent-test-generation Write tests for the update_opportunity service function. It accepts db_session, user, opportunity_id, data dict and returns updated Opportunity or raises 404/403`

3. **Component tests with accessibility:**
   `@agent-test-generation Write tests for the OpportunityCard component. Props: opportunity (object with title, agency_name, close_date, status). Include accessibility scan.`

4. **Tests from existing file:**
   `@agent-test-generation Write tests for the code in api/src/services/applications/submit_application.py`

5. **End-to-end Playwright test:**
   `@agent-test-generation Write a Playwright E2E test for the opportunity search flow: go to /search, enter keyword, apply status filter, verify results show`

**What the agent produces:**
- Test file(s) with proper imports, fixtures, and factory usage
- Tests covering happy path, error cases, and edge cases
- Accessibility scans for frontend components (using `jest-axe`)
- Proper use of `build()` vs `create()` based on whether DB persistence is needed

**Tips for better results:**
- Mention the function signature and what it returns
- For frontend components, describe the props interface
- Specify which status codes or error cases to cover
- Reference the source file path so the agent can read the implementation

**Common pitfalls:**
- May use `.create()` when `.build()` suffices -- `create()` hits the database, `build()` doesn't
- Check whether `enable_factory_create` is actually needed for your test
- Generated assertions may be too loose -- tighten them if the test should verify specific values

---

### @agent-migration

**Purpose:** Generates Alembic database migrations with correct naming conventions, `schema="api"`, UUID primary keys, and proper `upgrade()`/`downgrade()` functions. Follows the project's migration patterns exactly so you don't have to remember the boilerplate.

**When to use:**
- Adding a new table to the database
- Adding, removing, or modifying columns on an existing table
- Adding indexes, constraints, or foreign keys
- Creating lookup tables with seed data

**When NOT to use:**
- The change doesn't touch the database schema
- You're adding new values to an existing lookup/enum -- those don't need migrations
- You're changing application logic without schema changes

**How to invoke:**
```
@agent-migration <describe the database change needed>
```

**Example prompts (simple to complex):**

1. **Add a column:**
   `@agent-migration Add a nullable 'phone_number' text column to the user table`

2. **New table:**
   `@agent-migration Create a table 'agency_contact' with agency_contact_id UUID PK, agency_id FK, name text not null, email text nullable, is_primary boolean default false`

3. **Lookup table:**
   `@agent-migration Add a lookup table for contact_type with values: primary, billing, technical, grants_officer`

4. **Add index:**
   `@agent-migration Add an index on user.email for the user table`

5. **Soft delete column:**
   `@agent-migration Add is_deleted boolean column with server_default false to the saved_search table`

**What the agent produces:**
- A single migration file at `api/src/db/migrations/versions/<timestamp>_<description>.py`
- Correct `revision` and `down_revision` chaining
- `upgrade()` function with the schema change
- `downgrade()` function that cleanly reverses it
- `schema="api"` on all operations

**Tips for better results:**
- Always specify nullability for new columns
- Mention foreign key targets explicitly (e.g., "agency_id FK to agency.agency_id")
- For lookup tables, list all initial values
- Specify default values when they matter

**Common pitfalls:**
- New lookup enum values don't need migrations -- they're inserted via seed data
- Always verify that `downgrade()` correctly reverses what `upgrade()` does
- Don't forget `schema="api"` -- the agent handles this, but verify if editing manually

---

### @agent-i18n

**Purpose:** Manages translations in the project's centralized single-file pattern with correct key naming conventions. Ensures all user-facing text follows the established structure with PascalCase top-level keys and camelCase nested keys.

**When to use:**
- Adding any new user-facing text to the frontend
- Creating translations for a new page or feature
- Adding error messages, form labels, or status text that users will see

**When NOT to use:**
- For text that isn't user-facing (log messages, internal error codes, API-only messages)
- For text that's already translated and just needs a code reference

**How to invoke:**
```
@agent-i18n <describe the feature/page and what text is needed>
```

**Example prompts (simple to complex):**

1. **New page translations:**
   `@agent-i18n Add translations for a new SavedSearches page: title, header, empty state, search button`

2. **Error messages:**
   `@agent-i18n Add error messages for application validation: missing required fields, invalid date, file too large`

3. **Form labels:**
   `@agent-i18n Add form field labels for the agency contact form: name, email, phone, role, primary contact checkbox`

4. **Dynamic content:**
   `@agent-i18n Add translations for opportunity status badges: posted, closed, archived, forecasted`

5. **Full page with multiple sections:**
   `@agent-i18n Add all translations needed for an Events page showing upcoming and past events with title, date, description, and registration link`

**What the agent produces:**
- New entries in `frontend/src/i18n/messages/en/index.ts`
- Correctly structured keys under the appropriate PascalCase namespace
- Type-safe translation keys that integrate with the existing i18n setup

**Tips for better results:**
- Describe the feature or page the text belongs to -- the agent maps it to the correct top-level key
- List all the text variants you need (labels, placeholders, errors, empty states)
- Mention if any text includes dynamic values (e.g., "Showing {count} results")

**Common pitfalls:**
- Don't create separate translation files -- everything goes in `messages/en/index.ts`
- Don't use snake_case for keys -- PascalCase for top-level, camelCase for nested
- Don't forget empty states and error states -- they're easy to miss

---

### @agent-adr

**Purpose:** Writes Architecture Decision Records following the project's established format. ADRs capture the "why" behind significant technical decisions, making it easy for future team members to understand the context, constraints, and alternatives that were considered.

**When to use:**
- Documenting a significant technical decision (new technology, pattern change, architectural trade-off)
- Recording why a particular approach was chosen over alternatives
- Capturing decisions driven by external constraints (FedRAMP, accessibility, open-source mandate)

**When NOT to use:**
- Minor implementation decisions that don't affect the broader architecture
- Decisions that are easily reversible and low-impact
- Style or formatting preferences (those belong in linting rules)

**How to invoke:**
```
@agent-adr <describe the decision, alternatives, and key constraints>
```

**Example prompts (simple to complex):**

1. **Technology choice:**
   `@agent-adr Document our decision to use Redis for caching. Alternatives: Memcached, application-level caching. Key factors: FedRAMP compliance, connection pooling, data structure support.`

2. **Pattern change:**
   `@agent-adr Document the decision to migrate from class-based views to function-based route handlers in the API`

3. **Infrastructure decision:**
   `@agent-adr Document adding a CDN (CloudFront) in front of the Next.js frontend. Alternatives: no CDN, Cloudflare. Constraints: FedRAMP, HHS AWS relationship.`

4. **Architecture shift:**
   `@agent-adr Document the decision to use event-driven architecture for notification delivery instead of synchronous API calls`

5. **Deprecation record:**
   `@agent-adr Document deprecating the v0 opportunity search endpoint in favor of v1 with OpenSearch integration`

**What the agent produces:**
- A markdown file at `documentation/decisions/adr/NNNN-<title>.md`
- Standard sections: Title, Status, Context, Decision, Alternatives Considered, Consequences
- Correct sequential numbering based on existing ADRs

**Tips for better results:**
- State the decision clearly and concisely upfront
- Mention at least two alternatives you considered
- Include the constraints that drove the decision (FedRAMP, accessibility, open-source, performance)
- Describe the consequences, both positive and negative

**Common pitfalls:**
- Don't skip the "Alternatives Considered" section -- it's the most valuable part of an ADR
- Don't write ADRs for decisions that haven't been made yet (those are RFCs)
- Don't be vague about constraints -- name the specific requirement that rules out alternatives

---

### @pr-review

**Purpose:** Comprehensive PR review that checks all project conventions with specialist review passes. It examines API patterns, frontend conventions, testing standards, database conventions, and cross-cutting concerns in a structured, multi-pass review.

**When to use:**
- Reviewing PRs against team conventions before merging
- Self-review before opening a PR to catch convention violations early
- Checking specific aspects of a PR (API compliance, accessibility, i18n)

**When NOT to use:**
- Quick look at a single function (just ask in chat without invoking an agent)
- Reviewing non-code changes (documentation-only PRs)

**How to invoke:**
```
@pr-review <describe what to review or paste the diff>
```

See [PR Review Guide](11-pr-review-guide.md) for the full deep dive on how this agent works.

**Example prompts (simple to complex):**

1. **Full review:**
   `@pr-review Review the changes in this PR: [paste diff]`

2. **Self-review:**
   `@pr-review Review the files I've changed in this branch`

3. **Focused review:**
   `@pr-review Check only the API convention compliance in these changes`

4. **Convention check:**
   `@pr-review Are there any violations of our cross-domain rules (structured logging, boolean naming, error handling) in this diff?`

5. **Frontend-focused review:**
   `@pr-review Review this frontend PR focusing on accessibility, USWDS usage, and i18n conventions`

**What the agent produces:**
- A structured review organized by category (API, frontend, tests, database, cross-cutting)
- Specific line-level feedback referencing the conventions being violated
- Severity levels (blocking, suggestion, nit) for each finding
- A summary of overall convention compliance

**Tips for better results:**
- Provide the full diff, not just file names
- Mention which areas you're most concerned about
- For large PRs, ask the agent to focus on specific directories or file types

**Common pitfalls:**
- The agent reviews against project conventions, not general code quality -- it won't catch logic bugs
- Very large diffs may exceed context limits -- break them into focused reviews if needed
- Don't rely solely on agent review -- human review still catches intent and design issues

---

## Choosing the Right Agent

| Task | Best Agent |
|------|-----------|
| Full new endpoint (7 files) | `@agent-new-endpoint` |
| Single file or function | `@agent-code-generation` |
| Tests for existing code | `@agent-test-generation` |
| Database schema change | `@agent-migration` |
| User-facing text | `@agent-i18n` |
| Technical decision document | `@agent-adr` |
| Code review | `@pr-review` |
| Quick question about conventions | No agent needed -- just ask in chat |

**Decision shortcuts:**
- If your task touches **7 files across multiple layers**, start with `@agent-new-endpoint`.
- If your task touches **1 file**, start with `@agent-code-generation` or `@agent-test-generation`.
- If your task touches **0 code files** (just a decision or translation), use `@agent-adr` or `@agent-i18n`.
- If you're **reviewing** rather than **writing**, use `@pr-review`.

---

## See Also

- [How It Works](02-how-it-works.md) -- how agents work under the hood
- [Workflow Examples](09-workflow-examples.md) -- end-to-end scenarios using agents
- [Prompt Cookbook](appendix/prompt-cookbook.md) -- more copy-paste ready prompts
- [Back to documentation index](README.md)
