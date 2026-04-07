> **Before reading this:** Read [How It Works](02-how-it-works.md) to understand what agents are and how they differ from auto-activating rules.

# Agents Reference

> **Source prompts:** The 19 multi-step agents and 11 specialist subagents documented below were generated from the prompt backlog under [`cursor-tooling-prompts/agents/`](../cursor-tooling-prompts/agents/) and [`cursor-tooling-prompts/subagents/`](../cursor-tooling-prompts/subagents/). Each prompt follows the 10-section contract in [`cursor-tooling-prompts/_META_PROMPT.md`](../cursor-tooling-prompts/_META_PROMPT.md) and is the contract-of-record if this reference and the prompt ever disagree.

## What Are Agents?

Agents are structured, multi-step workflows that live in `.cursor/agents/` as proper Cursor subagents (not rule files with empty globs as in the earlier flat `.mdc` layout). You invoke them by name when you need a structured, multi-step workflow. They're like having a senior engineer's playbook for specific tasks. Unlike auto-activating rules that fire whenever you touch a matching file, agents sit idle until you explicitly call on them. This gives you full control over when their conventions and scaffolding logic kick in.

### Quality Gate Pipelines (Phase 7 Enhancement)

Every agent now includes two major enhancements:

**Pre-Flight Context Loading:** Before generating code, agents call MCP server tools to load architectural context:
- `get_architecture_section()` — loads relevant architecture guide sections
- `get_rules_for_file()` — discovers applicable conventions
- `get_conventions_summary()` — loads cross-cutting standards
- Compound Knowledge — consults indexed project documentation

**Quality Gate Pipeline:** After generating code, agents run a multi-gate specialist validation using Compound Engineering:

| Gate | What | Specialist |
|------|------|-----------|
| Gate 1 | Convention compliance | `codebase-conventions-reviewer` |
| Gate 2 | Domain-specific validation | Varies by agent (see below) |
| Gate 3 | Language quality | `kieran-python-reviewer` or `kieran-typescript-reviewer` |
| Gate 4+ | Conditional checks | Context-dependent specialists |

If any gate finds issues, the agent fixes them before presenting output. This means agent-generated code has been validated by multiple expert reviewers before you see it.

These features require the Compound Engineering and Compound Knowledge plugins — see [Getting Started](03-getting-started.md) for installation.

## How to Invoke an Agent

Agents are discovered automatically by Cursor as subagents. There are three methods for invoking them:

1. **Slash commands (preferred):** Use the corresponding slash command -- `/debug`, `/refactor`, `/new-endpoint`, `/generate`, `/test`, `/migration`, `/i18n`, `/adr`, `/review-pr`. This is the fastest invocation method.
2. **In Chat (Cmd+L):** Type `@agent-name` followed by your request. The agent's rules load into context and guide the AI through the workflow. This still works as before.
3. **In Composer (Cmd+I):** Same syntax as Chat, but Composer can create and edit multiple files in a single pass, which is ideal for agents that produce several artifacts.

All methods work identically in terms of which rules load. The difference is only in how the AI applies the output -- Chat explains and suggests, Composer directly writes files.

---

## Agent Reference

### @agent-new-endpoint (`/new-endpoint`)

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

### @agent-code-generation (`/generate`)

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

### @agent-test-generation (`/test`)

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

### @agent-migration (`/migration`)

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

### @agent-i18n (`/i18n`)

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

### @agent-adr (`/adr`)

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

### @agent-adr-from-pr (`/adr-from-pr`)

**Purpose:** Extracts an architectural decision that has already been made inside a pull request and emits a properly formatted, sequentially-numbered ADR. Sibling to `@agent-adr`, but specialized for back-filling from PR bodies, `gh pr view` output, or commit messages with a `Decision:` block.

**When to use:**
- A PR introduces a non-trivial pattern, technology, or trade-off and a reviewer asked "can you write an ADR for this?"
- You're back-filling ADRs for already-merged decisions
- You have the PR description and want a draft ADR without manually filling the template

**When NOT to use:**
- The decision has not been made yet (write an RFC, or use `@agent-adr` in Proposed mode)
- The PR is a pure refactor with no architectural impact
- You don't actually have the rationale -- this agent extracts, it does not invent alternatives

**How to invoke:**
```
@agent-adr-from-pr <paste PR body or `gh pr view <num> --json title,body,commits,files`>
```

**Example prompts (simple to complex):**

1. **From the GitHub CLI:**
   `@agent-adr-from-pr $(gh pr view 4321 --json title,body,commits,files)`

2. **From a pasted PR body:**
   `@agent-adr-from-pr Title: Switch cache layer from Memcached to Redis. Why: need pub/sub + sorted sets. Alternatives considered: stay on Memcached, app-level cache. Constraint: FedRAMP-authorized managed offering.`

3. **Supersession of an existing ADR:**
   `@agent-adr-from-pr This PR removes the v0 opportunity-search endpoint and routes all traffic to v1/OpenSearch. Supersedes ADR-0021.`

**What the agent produces:**
- A markdown file at `documentation/decisions/adr/NNNN-<title>.md` with the next sequential number
- Standard ADR sections plus a `Source:` line citing the originating PR
- Cross-references to related or superseded ADRs

**Tips for better results:**
- Prefer `gh pr view --json` output over copy-paste; it parses more reliably
- Have a second alternative ready -- if the PR mentions only one, the agent will ask
- Name the specific constraint (FedRAMP, accessibility, USWDS, open-source, performance) that ruled out each alternative

**Common pitfalls:**
- Don't let the agent fabricate alternatives the PR didn't mention
- Don't skip the supersession check -- orphaned ADRs are this repo's most common ADR defect
- Don't use this agent for forward-looking RFCs

---

### @agent-api-docs-sync (`/api-docs-sync`)

**Purpose:** Detects drift between APIFlask route handlers / Marshmallow schemas and the committed OpenAPI spec, then updates the spec, docstrings, and endpoint examples to match the code. Code is the source of truth; the spec follows the code.

**When to use:**
- You added or modified a route handler and want the spec updated in the same PR
- You changed a Marshmallow schema (added, removed, renamed fields, changed validators)
- You're reviewing a PR and suspect the spec is stale
- You want a one-shot drift audit before a release cut

**When NOT to use:**
- You want to refactor route handlers or schemas (use `@agent-refactor`)
- You're bumping API versions (`v1` → `v2`) — manual ADR required
- You want to publish or deploy the spec

**How to invoke:**
```
@agent-api-docs-sync <route file, endpoint description, PR number, or `audit`>
```

**Example prompts (simple to complex):**

1. **New endpoint:**
   `@agent-api-docs-sync I added POST /v1/applications/<app_id>/submit taking ApplicationSubmissionRequest and returning 200/400/403.`

2. **Schema field added:**
   `@agent-api-docs-sync api/src/api/opportunities/schemas.py: added assistance_listing_numbers: list[str] to OpportunitySearchResponse`

3. **Full audit:**
   `@agent-api-docs-sync audit`

4. **Breaking change (will be flagged):**
   `@agent-api-docs-sync I removed the deprecated agency_code field from OpportunityResponse`

**What the agent produces:**
- A unified diff against the OpenAPI spec, classified additive / modifying / breaking
- Updated `components/schemas` references (re-used, not duplicated)
- Preserved hand-written examples and descriptions
- A drift report when run in `audit` mode

**Tips for better results:**
- Name the specific file or endpoint rather than requesting a full audit
- Pair breaking changes with `/adr-from-pr` so the rationale is captured
- Run after the route changes are committed, so the agent reads the final state

**Common pitfalls:**
- If your repo has multiple OpenAPI files, confirm which is canonical when prompted
- Hand-edited `components/schemas` will drift back if you keep editing them outside this agent
- The agent will not change route handlers — if the docstring is wrong, it updates the spec from the docstring

---

### @agent-changelog-generator (`/changelog`)

**Purpose:** Drafts a categorized, human-readable release section for `CHANGELOG.md` from the merged PRs since a given cutoff (date, version tag, or PR count). Matches the project's voice and never invents version numbers or release dates.

**When to use:**
- Cutting a release and you want a first-pass changelog draft
- Auditing what shipped in a date range
- Preparing release notes for a stakeholder summary

**When NOT to use:**
- Backfilling past release sections (the agent only appends to the top)
- Tagging or publishing a release (out of scope)
- Internal sprint summaries (use `@agent-sprint-summary-generator`)

**How to invoke:**
```
@agent-changelog-generator <cutoff + version + date>
```

**Example prompts (simple to complex):**

1. **Since a date:** `@agent-changelog-generator Generate v1.2.0 dated 2026-04-15 from PRs merged since 2026-03-01`
2. **Since a version tag:** `@agent-changelog-generator Generate v1.2.0 dated today since v1.1.0`
3. **Scoped by label:** `@agent-changelog-generator Generate v1.2.0-frontend dated 2026-04-15 since 2026-03-01, only label:frontend`
4. **Audit only:** `@agent-changelog-generator Show all merged PRs since 2026-03-01 grouped by category, do not write`

**What the agent produces:**
- A new section at the top of `CHANGELOG.md` with categories ordered Security → Breaking Changes → Features → Bug Fixes → Performance → Accessibility → Documentation → Infrastructure
- Per-category PR counts presented before write
- External-contributor `@login` credit; internal authors uncredited
- A `## Needs Triage` block for any PR whose title and body are too opaque to summarize

**Tips for better results:**
- Run after the release branch is cut and frozen so the PR set is stable
- Always supply version and date — the agent will not invent them
- For Security entries, re-read manually for embargoed CVE detail before publishing

**Common pitfalls:**
- The agent never silently drops a PR — count mismatches are defects, not features
- Empty categories are omitted from output
- Don't use this for sprint summaries — use the dedicated sprint-summary agent

---

### @agent-codemod (`/codemod`)

**Purpose:** Executes mechanical, large-scale codebase transformations in batches with scoped test runs and rollback on failure. Uses `libcst` for Python and `ts-morph` for TypeScript. Does not make judgment calls about business logic — for semantic refactors use `@agent-refactor`.

**When to use:**
- Renaming a function, class, method, or variable across more than ~5 files
- Rewriting import paths after a module move
- Swapping one decorator for another across a directory
- Renaming React hooks or JSX attributes en masse

**When NOT to use:**
- The refactor requires semantic reasoning (use `@agent-refactor`)
- Database schema migrations (use `@agent-migration`)
- Cross-language refactors in a single run — run once per language
- Public API renames without an ADR (pair with `/adr-from-pr` first)

**How to invoke:**
```
@agent-codemod <transformation> in <scope>
```

**Example prompts (simple to complex):**

1. **Function rename:** `@agent-codemod Rename get_opportunity_details to fetch_opportunity_details in api/src/services/`
2. **Import path rewrite:** `@agent-codemod Rewrite imports from api.legacy.forms to api.forms across api/src/`
3. **Decorator swap:** `@agent-codemod Replace @require_auth with @require_auth(scope="user") on all route handlers in api/src/api/applications/`
4. **JSX attribute rename:** `@agent-codemod Rename JSX attribute testId to data-testid in frontend/src/components/`

**What the agent produces:**
- A `libcst` or `ts-morph` script under `.cursor/tmp/codemods/` shown before the first batch
- 5–10-file batches grouped by nearest common parent directory
- One fixup commit per batch (`codemod(<scope>): batch N/total`)
- Scoped test run after every batch; `git restore` rollback on failure
- A final broad domain test pass and a summary

**Tips for better results:**
- Start on a clean working tree (the agent will refuse otherwise)
- Run on a dedicated branch with nothing else in flight
- Narrow the scope — per-domain beats whole-repo

**Common pitfalls:**
- Files under `api/src/db/migrations/` and anything matching `*.generated.*`, `openapi.yaml`, or `schema.graphql` are skipped by design
- Public API renames without an ADR will be refused — pair with `/adr-from-pr`
- Don't mix Python and TypeScript in one invocation

---

### @agent-contributor-onboarding (`/onboarding`)

**Purpose:** Gives a new contributor a guided, full-stack, code-reading tour of a single feature — frontend page through API route, service, repository, and model, and back. Read-only. Cites the exact file paths, line ranges, and governing rule file at every layer, plus the architectural constraint (FedRAMP, USWDS, accessibility, Grants.gov coexistence) that each layer exists to satisfy.

**When to use:**
- Day one on the project
- Entering an unfamiliar area of the codebase (frontend dev touching the API, or vice versa)
- Reviewing a PR in a feature area you don't own
- Preparing to implement a similar feature and wanting to see the canonical example

**When NOT to use:**
- You need to write or modify code (use `@agent-code-generation`, `@agent-new-endpoint`, or `@agent-refactor`)
- You need environment setup help (see the contributor guide)
- You're debugging a failure (use `@agent-debugging`)

**How to invoke:**
```
@agent-contributor-onboarding <tour name, feature name, or URL>
```

**Built-in tours:** `opportunity-search` (default), `apply-for-grant`, `login`, `agency-profile`.

**Example prompts (simple to complex):**

1. **Default tour:** `@agent-contributor-onboarding default`
2. **Named built-in:** `@agent-contributor-onboarding apply-for-grant`
3. **Custom feature:** `@agent-contributor-onboarding Trace how agency users edit their profile, from the settings page to the database`
4. **From a URL:** `@agent-contributor-onboarding Trace what happens when I POST the form at /apply/123`

**What the agent produces:**
- A markdown tour with one section per layer (entry point → hook → HTTP → route → service → repository → model → return flow)
- Exact file paths with line ranges
- Rule file citation per layer
- Example payload traced back up the stack
- A "Where to Go Next" list

**Tips for better results:**
- Name the feature specifically — "how does the whole app work" will not produce a useful tour
- Tell the agent your background (frontend, backend, infra) to get layer weighting that matches your gaps
- Pair with the `architecture-decision-navigator` onboarding skill to read the ADRs behind each layer

**Common pitfalls:**
- This agent is read-only and will refuse to edit files
- For features with no clean single entry point, the tour will stall on ambiguity rather than guess
- Infrastructure (Terraform, CI/CD) is out of scope — use the infra agents and rules

---

### @agent-dependency-update (`/dependency-update`)

**Purpose:** Upgrades a single Python (uv/poetry) or JavaScript (npm) dependency end-to-end: fetches the changelog, flags breaking changes, updates the manifest and lock file, patches affected call sites, runs scoped tests, and drafts a PR description. One package per invocation.

**When to use:**
- Routine patch or minor bumps
- Major-version upgrades where you want breaking changes surfaced and call sites found
- Back-filling a version bump a reviewer flagged

**When NOT to use:**
- Bulk upgrades across many packages (run once per package)
- Security vulnerability triage (Dependabot owns that)
- Pre-release / beta / rc opt-in without explicit go-ahead

**How to invoke:**
```
@agent-dependency-update <package> from <current> to <target> in <api|frontend>
```

**Example prompts:**

1. **Patch bump:** `@agent-dependency-update ruff from 0.6.3 to 0.6.8 in api`
2. **Minor with deprecation:** `@agent-dependency-update marshmallow from 3.19 to 3.22 in api`
3. **Major bump:** `@agent-dependency-update SQLAlchemy from 2.0 to 2.1 in api`
4. **Frontend major:** `@agent-dependency-update next from 14 to 15 in frontend`

**What the agent produces:**
- A manifest + lock-file checkpoint commit
- A follow-up commit patching affected call sites
- A PR draft with changelog summary, breaking-change classification, risk assessment, and recommended reviewers

**Tips for better results:**
- Let the agent read every intermediate version — skipping misses deprecations
- Pair major bumps with `/adr-from-pr` if the upgrade changes an architectural constraint
- Major bumps to auth / crypto / database driver / logging packages trigger a mandatory `pii-leak-detector` gate

**Common pitfalls:**
- Refuses to run on a dirty working tree
- Refuses bulk upgrades
- Manifest and lock file always move together — don't hand-split them after the run

---

### @agent-e2e-scenario-builder (`/e2e-scenario`)

**Purpose:** Generates a Playwright end-to-end test for a described user workflow, matching the conventions of `frontend/tests/e2e/`. Reads sibling specs first, uses existing auth fixtures, applies role/label/testid locator priority, and tags scenarios per the smoke / core-regression policy.

**When to use:**
- You shipped a feature and need a `@smoke` or `@core-regression` scenario
- You fixed a bug and want a regression E2E test
- You're back-filling E2E coverage

**When NOT to use:**
- Visual regression (use `@agent-visual-regression`)
- Performance / load testing (use `@agent-load-test-generator`)
- API contract tests (use the `api-contract-test` skill)
- Component tests with mocked APIs

**How to invoke:**
```
@agent-e2e-scenario-builder <workflow + role + outcome + tags>
```

**Example prompts:**

1. **Smoke happy path:** `@agent-e2e-scenario-builder @smoke: guest searches opportunities, filters by agency, views details`
2. **Error flow:** `@agent-e2e-scenario-builder @core-regression: applicant submits with missing required field, expects validation error`
3. **Multi-role:** `@agent-e2e-scenario-builder @core-regression: agency reviewer approves a submitted application`
4. **Regression for a bug:** `@agent-e2e-scenario-builder @core-regression: regression for #4512 — search pagination preserves filters across pages`

**What the agent produces:**
- A new `.spec.ts` file under `frontend/tests/e2e/<area>/` following sibling conventions
- Role → label → testid locator priority, no CSS selectors
- Every interaction `await`-ed; no `waitForTimeout`
- At least one URL assertion and one content assertion per `test`
- A `--list` dry run confirming the spec parses

**Tips for better results:**
- Name the user role and expected outcome up front
- Keep `@smoke` scenarios under ~30s and within a single feature area
- Let the agent pick the auth fixture; don't hand-roll login flows

**Common pitfalls:**
- API mocks are forbidden in E2E — use component tests for that
- Raw English string assertions drift; follow the i18n strategy of sibling specs
- Don't tag slow / cross-feature scenarios `@smoke`

---

### @agent-feature-flag (`/feature-flag`)

**Purpose:** Scaffolds a boolean feature flag end-to-end: Terraform SSM parameter, API config loader + branching, frontend `useFeatureFlag` hook call, `.env.development` toggle, and a cleanup-tracker entry. Boolean flags only.

**When to use:**
- Gating a feature behind a kill switch before merge
- Staged rollout of a risky refactor
- Parallel v2 paths that should be off by default

**When NOT to use:**
- A/B testing, percentage rollouts, multivariate (out of scope)
- Analytics / event instrumentation
- Removing a flag (use the `flag-cleanup` skill)
- Auditing existing flags (use the `feature-flag-audit` skill)

**How to invoke:**
```
@agent-feature-flag <flag + affected files + owner + cleanup date>
```

**Example prompts:**

1. **Full-stack flag:** `@agent-feature-flag opportunity_search_v2; backend: api/src/services/search.py; frontend: frontend/src/components/search/SearchPage.tsx; owner: @jdoe; cleanup: 2026-06-01`
2. **API-only:** `@agent-feature-flag async_notification_delivery; backend: api/src/services/notifications.py; owner: @kteam; cleanup: 2026-05-15`
3. **Frontend-only:** `@agent-feature-flag new_nav_ia; frontend: frontend/src/components/layout/GlobalHeader.tsx; owner: @designsys; cleanup: 2026-04-30`
4. **Refactor kill switch:** `@agent-feature-flag use_sqlalchemy_2_query_api; backend: api/src/db/queries/; owner: @infra; cleanup: 2026-05-01`

**What the agent produces:**
- Terraform SSM parameter in the correct namespace
- API config loader entry and minimal branching at each named backend file
- Frontend hook call and identical off-path render
- `.env.development` update with dev default
- Cleanup-tracker entry in `documentation/feature-flags/active.md` with owner, date, affected files, and `/flag-cleanup` cross-link

**Tips for better results:**
- A target cleanup date is mandatory — no date, no flag
- Keep branching to ~3 sites per layer; extract a helper otherwise
- Cross-link from the feature's ADR if one exists

**Common pitfalls:**
- Production defaults of `true` are refused
- The agent will not modify existing flags in the same invocation
- If the four wiring points can't all be located, the agent stops and asks — it does not invent infra

---

### @agent-debugging (`/debug`)

**Purpose:** Debugging assistant that traces errors through the codebase, identifies root causes, checks for regressions, and suggests convention-compliant fixes. Handles Python stack traces, frontend errors, test failures, build errors, CI/CD failures, database issues, and infrastructure errors.

**When to use:**
- You have a stack trace, error message, or failing test and need help diagnosing it
- A test passes locally but fails in CI
- You're seeing unexpected behavior and want to trace the execution path
- A migration is failing in staging or production
- You want to understand why an error is happening, not just fix the symptom

**When NOT to use:**
- The error message is self-explanatory and the fix is obvious
- You need to write new code (use `@agent-code-generation` instead)
- You're reviewing code quality, not debugging a specific error (use `@pr-review` instead)

**How to invoke:**
```
@agent-debugging <paste the error, stack trace, or description of unexpected behavior>
```

**Example prompts:**

1. **API stack trace:**
   `@agent-debugging Here's a stack trace from the API: [paste traceback]. What's wrong?`

2. **Intermittent E2E failure:**
   `@agent-debugging This E2E test is failing intermittently: test_search_filters in search.spec.ts. Can you investigate?`

3. **Form submission error:**
   `@agent-debugging I'm getting a 500 error when submitting a form. Here's the error log: [paste log]`

4. **CI-only failure:**
   `@agent-debugging The CI build is failing with this error: [paste error]. Works fine locally.`

5. **Migration failure:**
   `@agent-debugging This migration is failing in staging: [paste error]. What's the issue?`

**What the agent does:**
1. **Classifies** the error type and loads relevant domain context via MCP tools
2. **Investigates** by reading files in the stack trace and tracing the call chain
3. **Checks for regressions** using `git-history-analyzer` to identify when the issue was introduced
4. **Presents root cause** with specific file paths, line numbers, and evidence
5. **Suggests a fix** that follows project conventions, with code changes
6. **Validates the fix** through a quality gate pipeline with domain-specific specialists

**What the agent has access to:**
- All 32 domain rule files for convention-aware debugging
- MCP server tools (`get_architecture_section`, `get_rules_for_file`, `get_conventions_summary`)
- Compound Engineering specialists (conventions reviewer, language reviewers, security, performance, data integrity)
- Compound Knowledge base for historical context and ADR rationale
- `git-history-analyzer` for regression detection

**Tips for better results:**
- Include the **full** stack trace or error output, not just the last line
- Mention if the error is **intermittent** or **consistent**
- Note any **recent changes** that might have caused it
- Specify if it happens **locally, in CI, or in a deployed environment**
- Include the **test name** if it's a test failure

**Common pitfalls:**
- Don't paste truncated errors — the agent needs the full context to trace the call chain
- Don't assume it's a code bug — it might be a configuration, environment, or data issue
- If the agent asks a clarifying question, answer it rather than re-pasting the same error

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

### @agent-refactor (`/refactor`)

**Purpose:** Refactoring assistant that plans and executes multi-file structural changes safely. It maps the full blast radius, executes across all affected files in the correct phase order, updates imports and tests, and verifies nothing broke -- all while following project conventions exactly.

**When to use:**
- Extracting shared logic into a new file, function, hook, or component
- Splitting an oversized file or module into smaller, focused pieces
- Moving logic between architectural layers (e.g., route handler to service layer)
- Renaming a function, class, or variable across all usages in the codebase
- Consolidating duplicated patterns into a single shared implementation
- Changing a function's interface/signature and updating all callers
- Removing dead code, unused exports, or deprecated patterns

**When NOT to use:**
- Simple one-line renames within a single file (just do it by hand)
- Adding new functionality (use `@agent-code-generation` or `@agent-new-endpoint`)
- Fixing a bug (use `@agent-debugging` to find the root cause first)
- The refactor is really a rewrite -- if behavior changes, it's not a refactor

**How to invoke:**
```
@agent-refactor <describe the structural change you want to make>
```

**Example prompts:**

1. **Extract shared logic:**
   `@agent-refactor Extract the eligibility check logic from api/src/services/applications/submit.py into a new api/src/services/applications/eligibility.py`

2. **Split oversized component:**
   `@agent-refactor Split ApplicationForm.tsx into sub-components: FormHeader, FormFields, FormActions, and FormValidation`

3. **Move between layers:**
   `@agent-refactor Move the email sending logic from the route handler in api/src/api/users_v1/users_routes.py into a service function`

4. **Rename across codebase:**
   `@agent-refactor Rename useFormData to useApplicationFormData across all files that import it`

5. **Consolidate duplicated patterns:**
   `@agent-refactor There are 4 different pagination implementations across the API services. Consolidate them into a shared utility.`

**What the agent does:**
1. **Classifies** the refactor type (Extract, Split, Move, Rename, Consolidate, Restructure, Delete)
2. **Maps the blast radius** -- every file that will be affected, including tests and barrel files
3. **Assesses risk** (Low/Medium/High) based on scope and caller count
4. **Presents a plan** with a full file table and waits for your approval
5. **Executes in phases** -- Create Before Delete → Update Source → Update Callers → Update Tests → Update Types → Clean Up
6. **Verifies** with linting, type checking, test suite, and import verification
7. **Checks for regressions** via `git-history-analyzer`
8. **Runs quality gates** -- convention compliance, language quality, domain validation, code simplicity, pattern consistency

**Tips for better results:**
- Be specific about what's moving and where it's going
- Mention if there are callers you know about that should be updated
- For renames, specify whether it's just the function or the file too
- For consolidation, point to at least two of the duplicate implementations

**Common pitfalls:**
- Don't approve the plan without checking the blast radius is complete
- For High risk refactors, consider breaking into smaller steps
- The agent preserves behavior exactly -- if you also want behavioral changes, do those separately

---

## Choosing the Right Agent

| Task | Slash Command (preferred) | Agent Name |
|------|--------------------------|-----------|
| Full new endpoint (7 files) | `/new-endpoint` | `@agent-new-endpoint` |
| Single file or function | `/generate` | `@agent-code-generation` |
| Tests for existing code | `/test` | `@agent-test-generation` |
| Database schema change | `/migration` | `@agent-migration` |
| User-facing text | `/i18n` | `@agent-i18n` |
| Technical decision document | `/adr` | `@agent-adr` |
| Debugging an error or failure | `/debug` | `@agent-debugging` |
| Multi-file structural change | `/refactor` | `@agent-refactor` |
| Code review | `/review-pr` | `@pr-review` |
| Quick question about conventions | No agent needed -- just ask in chat | -- |

**Decision shortcuts:**
- If your task touches **7 files across multiple layers**, start with `/new-endpoint` (or `@agent-new-endpoint`).
- If your task touches **1 file**, start with `/generate` (or `@agent-code-generation`) or `/test` (or `@agent-test-generation`).
- If your task touches **0 code files** (just a decision or translation), use `/adr` (or `@agent-adr`) or `/i18n` (or `@agent-i18n`).
- If you're **debugging** an error, stack trace, or failing test, use `/debug` (or `@agent-debugging`).
- If you're **restructuring** existing code across multiple files, use `/refactor` (or `@agent-refactor`).
- If you're **reviewing** rather than **writing**, use `/review-pr` (or `@pr-review`).

---

### @agent-good-first-issue (`/good-first-issue`)

**Purpose.** Find small, well-scoped contribution opportunities and draft GitHub issue markdown with acceptance criteria, rule references, and a named learning outcome.

**When to use.** Seeding the good-first-issue backlog before an onboarding cohort; turning a theme ("missing docstrings in API services") into concrete, achievable tasks.

**When NOT to use.** Real features or endpoints (`@agent-new-endpoint`); cross-file refactors (`@agent-refactor`); posting to GitHub directly (this agent is read-only).

**How to invoke.**
```
/good-first-issue
@agent-good-first-issue Find <N> good first issues in <area> focused on <theme>
```

**Example prompts.**
- `@agent-good-first-issue Find 3 good first issues in api/src/services focused on ValidationErrorDetail coverage`
- `@agent-good-first-issue Find a good first issue in frontend/src/components focused on aria-label gaps`

**What the agent produces.** Markdown issue drafts with labels, acceptance criteria, learning outcome, and rule-file links. No GitHub side effects.

**Tips.** Narrow the area; pair themes 1:1 with a rule file so the learning outcome is crisp.

**Common pitfalls.** Drafts whose scope crosses more than one file; invented example-PR numbers.

---

### @agent-incident-response (`/incident-response`)

**Purpose.** Triage a production incident: classify severity, trace the likely code path, propose an immediate mitigation, enumerate root-cause hypotheses, and draft a post-mortem.

**When to use.** Live incident triage; immediately after resolution for a post-mortem draft; correlating an incident with a recent PR.

**When NOT to use.** Executing remediation; customer comms; non-production debugging (`@agent-debugging`).

**How to invoke.**
```
/incident-response
@agent-incident-response <symptom, time window, logs>
```

**Example prompts.**
- `@agent-incident-response 500s on POST /v1/opportunities starting 14:23 UTC. Logs show QueuePool limit reached.`
- `@agent-incident-response Search p99 jumped from 300ms to 8s at 16:00 UTC.`

**What the agent produces.** Severity classification, code-path trace, recommended mitigation, hypotheses, investigation plan, post-mortem at `documentation/incidents/YYYY-MM-DD-<slug>.md`.

**Tips.** Paste raw logs (the PII scrub runs automatically). Name suspect PRs if you have them.

**Common pitfalls.** Treating hypothetical root cause as confirmed; skipping the PII gate before sharing.

---

### @agent-load-test-generator (`/load-test`)

**Purpose.** Generate runnable k6 or Locust load test scenarios from the OpenAPI spec with realistic ramp stages, think time, and SLO assertions.

**When to use.** New endpoint needs a load scaffold; reproducible load scenario for CI; validating a performance hypothesis under concurrency.

**When NOT to use.** Running the test or analyzing results; functional E2E coverage (`@agent-e2e-scenario-builder`); capacity planning.

**How to invoke.**
```
/load-test
@agent-load-test-generator Generate a k6 load test for <workload> with <load shape>
```

**Example prompts.**
- `@agent-load-test-generator k6 load test for GET /v1/opportunities search. 100 VUs, 5 min ramp, 20 min steady.`
- `@agent-load-test-generator Locust journey: list → detail → apply. 50 users, 10 min steady.`

**What the agent produces.** `tests/load/<slug>.{js,py}` with stages, thresholds, and a usage header.

**Tips.** Describe full journeys, not isolated endpoints. Use env vars for auth, never hardcode tokens.

**Common pitfalls.** Targeting prod without the env gate; skipping ramp-down.

---

### @agent-performance-audit (`/performance-audit`)

**Purpose.** Audit a specific endpoint or page for N+1 queries, missing indexes, wasteful re-renders, bundle bloat, and unoptimized images via `performance-oracle` and `pattern-recognition-specialist`.

**When to use.** A latency complaint needs a targeted review; proactive audit before shipping; narrowing the suspect surface after rising p95.

**When NOT to use.** Applying fixes (`@agent-refactor`); end-to-end measurement (`@agent-load-test-generator`); infra or capacity planning.

**How to invoke.**
```
/performance-audit
@agent-performance-audit Audit <target> for <concern>
```

**Example prompts.**
- `@agent-performance-audit Audit GET /v1/opportunities?search=<q> for n+1 queries`
- `@agent-performance-audit Audit frontend/src/app/opportunities/page.tsx for re-renders`

**What the agent produces.** Prioritized report grouped by impact and effort, with file:line evidence, recommended fix patterns, and rule references. Read-only.

**Tips.** Name a concern to sharpen the scan; feed the report to `@agent-refactor` to execute the fix.

**Common pitfalls.** Treating static findings as latency measurements; applying indexes without migration planning.

---

### @agent-pr-preparation (`/prepare-pr`)

**Purpose.** Validate a branch for PR submission with scoped tests, per-file convention checks, title validation, description drafting, and a self-review checklist.

**When to use.** Final pass before opening a PR; consistent house-style descriptions; catching convention violations before reviewers do.

**When NOT to use.** Opening the PR on GitHub; architectural review; authoring CHANGELOG (`@agent-changelog-generator`).

**How to invoke.**
```
/prepare-pr
@agent-pr-preparation Prepare this branch for PR
```

**Example prompts.**
- `@agent-pr-preparation Prepare this branch. Title: "feat(api): add opportunity filter by funding status"`
- `@agent-pr-preparation Prepare for PR`

**What the agent produces.** Test results, convention report, validated title, PR description draft, self-review checklist, PII scan, recent-PR conflict scan.

**Tips.** Run `/changelog` first when user-visible behavior changes; pair with `/regression-detector`.

**Common pitfalls.** Treating clean gates as a substitute for human review; dirty working tree (the agent will refuse).

---

### @agent-refactor (`/refactor`)

**Purpose.** Plan and execute multi-file refactors — extracts, splits, moves, renames, consolidations, restructures, deletions — with blast-radius analysis, phased execution, import updates, and specialist review gates.

**When to use.** Renames touching many files; splitting large modules; moving logic between architectural layers; consolidating duplicated patterns.

**When NOT to use.** Mechanical transforms at scale (`@agent-codemod`); schema migrations (`@agent-migration`); new features (`@agent-new-endpoint`); cross-language single-run refactors.

**How to invoke.**
```
/refactor
@agent-refactor <what to refactor and why>
```

**Example prompts.**
- `@agent-refactor Extract eligibility logic out of opportunity_service into its own eligibility_service`
- `@agent-refactor Rename get_opportunity_details to fetch_opportunity_details everywhere`

**What the agent produces.** Blast-radius plan (awaits approval), phased execution, updated imports and tests, specialist gates, summary report with coverage delta.

**Tips.** Describe both what and why; review the plan carefully before approving.

**Common pitfalls.** Mixing refactor with behavior change; dirty working tree; skipping the plan step.

---

### @agent-regression-detector (`/regression-detector`)

**Purpose.** Predict PR regressions via diff call-graph mapping, untested-branch detection, and specialist delegation to `pattern-recognition-specialist`, `performance-oracle`, and `api-contract-checker`.

**When to use.** Before opening a PR; before merging someone else's; after rebasing; small diffs touching load-bearing subsystems.

**When NOT to use.** Executing tests (`@agent-pr-preparation`); applying fixes; documentation-only diffs.

**How to invoke.**
```
/regression-detector
@agent-regression-detector Analyze this diff for regressions
```

**Example prompts.**
- `@agent-regression-detector Analyze this diff`
- `@agent-regression-detector Focus on performance. I changed the opportunity search index.`

**What the agent produces.** Risk-grouped report, predicted failing tests, manual regression scenarios, contract delta list.

**Tips.** Narrow focus when you suspect a category; feed predicted failures to `/prepare-pr`.

**Common pitfalls.** Treating a clean report as a merge approval; ignoring manual scenarios.

---

### @agent-test-plan-generator (`/test-plan`)

**Purpose.** Produce QA-executable manual test plans across happy path, edge, error, accessibility, browser, responsive, and locale buckets.

**When to use.** A feature is entering QA; structuring a test plan from an issue; baking in accessibility coverage without writing it by hand.

**When NOT to use.** Automated test code (`@agent-e2e-scenario-builder`, `@agent-test-generation`); performance testing (`@agent-load-test-generator`).

**How to invoke.**
```
/test-plan
@agent-test-plan-generator Generate a test plan for <feature>
```

**Example prompts.**
- `@agent-test-plan-generator Plan for the new opportunity filter UI (agency, funding status, type)`
- `@agent-test-plan-generator Smoke plan for the search page`

**What the agent produces.** `documentation/test-plans/<slug>.md` with scenarios per bucket, each with preconditions, steps, expected outcome, and pass/fail checkboxes. Scenario counts summarized.

**Tips.** Provide acceptance criteria verbatim; name locales when i18n is in scope.

**Common pitfalls.** Skipping the a11y bucket for UI features; embedding real credentials in preconditions.

---

### @agent-user-guide-updater (`/user-guide-update`)

**Purpose.** Find user-facing documentation affected by a feature change and draft paragraph-level updates preserving the guide's voice, flagging screenshots and translations as human follow-ups.

**When to use.** A user-visible workflow changed and you need a doc sweep; a noun was renamed product-wide; a UI flow was reordered.

**When NOT to use.** API reference drift (`@agent-api-docs-sync`); image refresh; translation authoring; changelog entries.

**How to invoke.**
```
/user-guide-update
@agent-user-guide-updater I changed <feature>. Update affected guides.
```

**Example prompts.**
- `@agent-user-guide-updater I refactored the opportunity search filters into a new sidebar UI. Update affected guides.`
- `@agent-user-guide-updater We renamed "applications" to "submissions" across the product.`

**What the agent produces.** Before/after diff blocks per affected guide section, a summary of files touched, and follow-up items for screenshots and translations.

**Tips.** Describe changes in the guide's own nouns; provide before/after summaries.

**Common pitfalls.** Rewrites whose tone drifts from surrounding paragraphs; touching API docs or translations directly.

---

### @agent-visual-regression (`/visual-regression`)

**Purpose.** Scaffold Storybook stories and visual regression baselines for a frontend component across viewports, states, themes, and locales with threshold configuration aligned to the existing harness.

**When to use.** A new component needs visual coverage; existing stories are incomplete; introducing visual regression to a previously untested area.

**When NOT to use.** Running visual tests or approving baselines; unit/interaction tests (`@agent-test-generation`); functional E2E (`@agent-e2e-scenario-builder`).

**How to invoke.**
```
/visual-regression
@agent-visual-regression Set up visual tests for <component>
```

**Example prompts.**
- `@agent-visual-regression Set up visual tests for OpportunityCard`
- `@agent-visual-regression Scaffold stories for ApplicationFormField including all validation states`

**What the agent produces.** `<Component>.stories.tsx` next to the component with Default, Loading, Error, Disabled, Hover, Focus, Selected, and overflow stories at mobile/tablet/desktop, theme and locale variants, visual regression parameters.

**Tips.** Let the agent read the props interface; keep thresholds conservative; mask dynamic regions.

**Common pitfalls.** Overwriting existing stories; capturing non-deterministic content unmasked; skipping the a11y gate on interactive components.

---

### @agent-architecture-decision-navigator (`/architecture-decision-navigator`)

**Purpose.** Answer "why did we choose X?" by reading the simpler-grants-gov ADR catalog and surfacing Context, Decision, Rationale, Alternatives, and Consequences.

**When to use.** Onboarding to architectural philosophy; reviewing a PR that touches a decision boundary; evaluating whether an existing constraint still applies.

**When NOT to use.** Proposing new ADRs; convention text (`@agent-convention-quick-lookup`); implementation walkthroughs (`@agent-interactive-codebase-tour`).

**How to invoke.**
```
/architecture-decision-navigator
@agent-architecture-decision-navigator <question or technology>
```

**What the agent produces.** Per-ADR markdown with status, file, governing rule, Context, Decision, Rationale, Alternatives, Consequences, Related ADRs, and where the decision shows up in code.

**Tips.** Ask one decision at a time. Pair with `@agent-convention-quick-lookup`.

**Common pitfalls.** Read-only; will not propose or supersede ADRs; treats `Proposed` ADRs as non-authoritative.

---

### @agent-code-review-learning-mode (`/code-review-learning-mode`)

**Purpose.** Convert a reviewer comment into a teaching moment by surfacing the underlying rule, its rationale, real before/after snippets, and a mapping to the contributor's code.

**When to use.** Pattern-based review feedback; mentoring; self-review.

**When NOT to use.** Style/taste comments; debating rule validity (`@agent-architecture-decision-navigator`); debugging.

**How to invoke.**
```
/code-review-learning-mode
@agent-code-review-learning-mode "<reviewer comment>"
```

**What the agent produces.** Rule name and file, what-it-says, why-it-exists, anti-pattern and correct-pattern snippets with citations, mapping to the contributor's code, and 2–3 related rules.

**Tips.** Quote the comment verbatim; provide a file path for grounding.

**Common pitfalls.** Read-only; will not edit your PR; will not invent rule names.

---

### @agent-convention-quick-lookup (`/convention-quick-lookup`)

**Purpose.** Return the canonical "how do we handle X?" answer with `.cursor/rules/*.mdc` citations.

**When to use.** Mid-implementation; verifying a decorator stack or hook signature; following a reviewer's rule citation.

**When NOT to use.** "Why" questions (`@agent-architecture-decision-navigator`); end-to-end walkthroughs (`@agent-interactive-codebase-tour`); pattern browsing (`@agent-pattern-catalog`).

**How to invoke.**
```
/convention-quick-lookup
@agent-convention-quick-lookup "<question or keyword>"
```

**What the agent produces.** Layer, rule file, one-paragraph canonical answer, 3-line snippet, source citation, see-also list.

**Tips.** Be specific about the layer.

**Common pitfalls.** Read-only; surfaces conflicting rules rather than picking silently; says so when no rule applies.

---

### @agent-good-first-issue-assistant (`/good-first-issue-assistant`)

**Purpose.** Walk a new contributor through a `good-first-issue`: read the issue, map it to code, scaffold the change as a diff (not applied), draft a sample test, and produce PR submission steps.

**When to use.** First contribution; cohort onboarding; onboarding buddy walkthroughs.

**When NOT to use.** Multi-file refactors; complex feature work; debugging; issues without the `good-first-issue` label.

**How to invoke.**
```
/good-first-issue-assistant
@agent-good-first-issue-assistant <issue url or number>
```

**What the agent produces.** Issue summary, affected files, governing rules, diff scaffold, sample test, PR walkthrough, and pre-submission checklist.

**Tips.** Pair with `@agent-pattern-catalog` for unfamiliar patterns.

**Common pitfalls.** Read-only; will not apply diffs, push branches, or open PRs; will refuse over-scoped issues.

---

### @agent-interactive-codebase-tour (`/interactive-codebase-tour`)

**Purpose.** Trace one canonical request flow through simpler-grants-gov from the frontend to the database and back, layer by layer, with file paths and rule citations.

**When to use.** Full-stack onboarding; mapping form fields to columns; learning the three-schema forms architecture.

**When NOT to use.** Code generation; debugging; feature-area tours (`@agent-contributor-onboarding`).

**How to invoke.**
```
/interactive-codebase-tour
@agent-interactive-codebase-tour <flow name or "default">
```

**What the agent produces.** Markdown with one section per layer (entry point → service/hook → transport → route → service → adapter → model → return), each citing file path, line range, governing rule, and architectural constraint. Closes with a payload round-trip and Where-to-Go-Next list.

**Tips.** One flow per invocation; drill into the layer that confused you most.

**Common pitfalls.** Read-only; will stall on ambiguous custom flows rather than guess; does not cover infrastructure.

---

### @agent-pattern-catalog (`/pattern-catalog`)

**Purpose.** Return real anti-pattern vs. correct-pattern snippets sourced from the repo for ~15 codified patterns across API, frontend, database, and forms layers.

**When to use.** Mid-implementation reference; pointing reviewers at a pattern by name; onboarding to recurring patterns; learning the three-schema forms architecture.

**When NOT to use.** Convention text only (`@agent-convention-quick-lookup`); rationale (`@agent-architecture-decision-navigator`); end-to-end walkthroughs (`@agent-interactive-codebase-tour`).

**How to invoke.**
```
/pattern-catalog
@agent-pattern-catalog <pattern name or keyword>
```

**What the agent produces.** Pattern name, layer, governing rule, real anti-pattern with citation, real correct pattern with citation, key differences, source rule section, and 2 related patterns.

**Tips.** One pattern per invocation; the agent labels any synthesized snippet clearly.

**Common pitfalls.** Read-only; will not invent file paths; will say so when no true anti-pattern exists in the repo.

---

## Quality Gate Subagents (invoked programmatically by other agents)

The subagents below are not invoked directly by users. They run as Gate 2 (and occasionally other gate) validators inside the agents listed above. Each takes a structured input and returns JSON findings that the calling agent uses to decide whether to fix issues, surface warnings, or block output. See [How It Works](02-how-it-works.md) for the quality-gate pipeline overview.

### `accessibility-auditor`
Invoked by: visual-regression (Gate 2), e2e-scenario-builder (Gate 2), test-plan-generator (Gate 2), codebase-conventions-reviewer (optional)
Checks: accessible names, semantic HTML, form label associations, focus visibility, heading order, USWDS conformance, jest-axe presence, form schema label integrity.
Output: JSON with `status`, severity summary, per-finding `wcag` code, `rule_violated`, `suggested_fix`.

---

### `api-contract-checker`
Invoked by: api-docs-sync (Gate 2), regression-detector, load-test-generator (Gate 2), new-endpoint (optional)
Checks: operation presence, path/query params, request/response schemas, status code coverage from `raise_flask_error`, auth decorator parity, error envelope shape; classifies changes as additive/modifying/breaking.
Output: JSON with `operation`, `classification`, severity, `rule_violated`.

---

### `dependency-health-reviewer`
Invoked by: dependency-update (Gate 2), pr-preparation (optional)
Checks: license allowlist (MIT/BSD/Apache/ISC/CC0/MPL-2.0/Python-2.0), known CVEs, duplicate installs, unexpected downgrades, major bumps on sensitive packages, missing integrity hashes.
Output: JSON with `package`, `ecosystem`, severity, `rule_violated`.

---

### `documentation-staleness-detector`
Invoked by: api-docs-sync, user-guide-updater, codemod, refactor, migration, new-endpoint (all optional)
Checks: stale symbols in prose, broken code examples, env var/route/flag drift, superseded ADRs, docstrings describing old behavior.
Output: JSON with `symbol`, `file`, `line`, severity.

---

### `form-schema-validator`
Invoked by: new-endpoint, codemod, refactor, api-docs-sync (all optional; when `api/src/form_schema/**` changes)
Checks: cross-schema field parity, PDF label exactness, required-field vs visibility consistency, widget/type match, XML namespace and ordering, round-trip data loss.
Output: JSON with `form_id`, `field`, severity.

---

### `i18n-completeness-checker`
Invoked by: i18n (Gate 2), user-guide-updater, codemod, new-endpoint, refactor (optional)
Checks: hardcoded strings, missing keys per locale, orphan keys, ICU placeholder parity, namespace consistency, localized validation messages.
Output: JSON with `file`, `line`, severity, `rule_violated`.

---

### `pii-leak-detector`
Invoked by: pr-preparation (Gate 2, hard block), incident-response (Gate 2), changelog-generator (Gate 2 on Security), dependency-update, debugging
Checks: AWS keys, JWTs, private keys, API keys, DB URLs with passwords, emails/SSN/EIN/phones, IP addresses, embargoed CVE content, f-string logging of user data, committed `.env`.
Output: JSON with `category`, severity, `rule_violated`; secret values redacted to first 4 chars.

---

### `responsive-design-checker`
Invoked by: visual-regression (Gate 2), codebase-conventions-reviewer, new-endpoint (optional)
Checks: 320px horizontal scroll, 44x44 touch targets (WCAG 2.5.5), hardcoded pixel layout widths, missing mobile/tablet/desktop stories, non-USWDS tokens, responsive image attributes.
Output: JSON with `breakpoint`, `file`, `line`, severity.

---

### `sql-injection-scanner`
Invoked by: codebase-conventions-reviewer, kieran-python-reviewer, new-endpoint, debugging (all optional; when DB code touched)
Checks: `text(f"...")`, `.execute(f"...")`, concatenated SQL, missing bindparams, `literal_column(user_input)`, dynamic order_by without allowlist, raw-SQL file concatenation, OpenSearch DSL injection.
Output: JSON with `file`, `line`, severity, `rule_violated`.

---

### `test-quality-analyzer`
Invoked by: test-generation (Gate 2), test-plan-generator (Gate 2), regression-detector, codebase-conventions-reviewer (optional)
Checks: meaningful assertions, factory_boy `.build()` usage, `jest-axe` presence, RTL query preference, `time.sleep()` flake, Playwright tagging, mock seam appropriateness.
Output: JSON with `test_name`, `file`, `line`, severity.

---

### `uat-criteria-validator`
Invoked by: test-plan-generator (Gate 2), e2e-scenario-builder (Gate 2), pr-preparation (optional)
Checks: specificity, testability, measurable thresholds, happy/failure path pair, traceability to ADR/issue, accessibility path on UI criteria, security negative cases, persona alignment, Given/When/Then structure.
Output: JSON with `criterion_index`, `criterion`, severity, `suggested_fix`.

---

## Cursor Five-Primitive System

The project has migrated from a flat `.mdc` rule file structure to Cursor's five-primitive system. Here is how the primitives map to this toolkit:

| Primitive | Directory | Purpose | Example |
|-----------|-----------|---------|---------|
| **Rules** | `.cursor/rules/` | Auto-activating convention files (glob-matched) | `api-routes.mdc`, `frontend-components.mdc` |
| **Agents** | `.cursor/agents/` | Subagents invoked by name or slash command | `agent-new-endpoint.md`, `agent-debugging.md` |
| **Skills** | `.cursor/skills/` | Reusable, focused capabilities with their own directories | `pr-review/SKILL.md` |
| **Commands** | Slash commands | Quick invocation entry points for agents and skills | `/debug`, `/refactor`, `/new-endpoint`, `/generate`, `/test`, `/migration`, `/i18n`, `/adr`, `/review-pr` |
| **Hooks** | `.cursor/hooks/` | Event-driven automation (e.g., pre-commit checks) | Triggered automatically on specific events |

**Key migration changes:**
- Agent files moved from `.cursor/rules/agent-*.mdc` to `.cursor/agents/*.md`. They are now discovered by Cursor as proper subagents.
- The PR review agent moved from `.cursor/rules/pr-review.mdc` to `.cursor/skills/pr-review/SKILL.md`.
- Slash commands (`/debug`, `/refactor`, etc.) are now the preferred invocation method, though `@agent-name` references still work.
- Agents are invoked as subagents, not via `@agent-name .mdc` references.

---

## See Also

- [How It Works](02-how-it-works.md) -- how agents work under the hood
- [Workflow Examples](09-workflow-examples.md) -- end-to-end scenarios using agents
- [Prompt Cookbook](appendix/prompt-cookbook.md) -- more copy-paste ready prompts
- [Back to documentation index](README.md)
