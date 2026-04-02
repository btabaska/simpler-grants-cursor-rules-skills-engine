# How to Use the Simpler.Grants.gov AI Coding Toolkit

A hands-on guide for developers working on [HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov), from first-time AI coding users to experienced engineers who want to understand exactly what this tool does and how it works.

---

## Table of Contents

1. [What Is This Toolkit?](#1-what-is-this-toolkit)
2. [How It Works — Nothing Magic](#2-how-it-works--nothing-magic)
3. [Getting Started](#3-getting-started)
4. [Understanding Auto-Activating Rules](#4-understanding-auto-activating-rules)
5. [Using Agents — Step by Step](#5-using-agents--step-by-step)
6. [Using Notepads for Context](#6-using-notepads-for-context)
7. [Using Code Snippets](#7-using-code-snippets)
8. [Prompt Engineering — How to Talk to the AI](#8-prompt-engineering--how-to-talk-to-the-ai)
9. [Real-World Workflow Examples](#9-real-world-workflow-examples)
10. [Multi-File and Composer Workflows](#10-multi-file-and-composer-workflows)
11. [What the AI Can and Cannot Do](#11-what-the-ai-can-and-cannot-do)
12. [Troubleshooting](#12-troubleshooting)
13. [FAQ for Skeptics](#13-faq-for-skeptics)
14. [Glossary](#14-glossary)

---

## 1. What Is This Toolkit?

This toolkit gives Cursor IDE knowledge about how the simpler-grants-gov codebase works. Without it, Cursor's AI is a generalist — it knows Python and TypeScript, but it doesn't know *your* project's conventions. With it, the AI understands:

- The exact decorator stack order for API route handlers
- That service functions always take `db_session` as the first parameter
- That React components should be server components by default
- That all errors go through `raise_flask_error()` with `ValidationErrorDetail`
- That boolean fields use `is_*` / `has_*` prefixes
- That `Factory.build()` is preferred over `Factory.create()` in tests
- ...and 200+ other project-specific conventions

**The analogy:** Think of it as giving the AI a copy of the team's institutional knowledge — the stuff a senior engineer on the team would catch in code review. Instead of learning these patterns through months of PR feedback, the AI already knows them.

### What's in the toolkit?

| Component | What it does | How many |
|-----------|-------------|----------|
| **Rules** | Automatically activate when you edit files, telling the AI the conventions for that area of code | 18 domain rules + 1 cross-cutting |
| **Agents** | Manually invoked workflows for complex tasks (like creating a full endpoint or writing migrations) | 6 agents |
| **Notepads** | Pre-written context documents you can pull into chat for quick reference | 6 notepads |
| **Snippets** | Type `sgg-` and get code skeletons that follow project patterns | 15 snippets |
| **MCP Servers** | Background services that give the AI access to the architecture guide, GitHub, and rule documentation | 3 servers |

---

## 2. How It Works — Nothing Magic

If you're skeptical about AI coding tools, this section is for you. There is no black box here. Every part of this toolkit is a text file you can read, edit, and understand.

### Rules are just markdown files

Open any file in `.cursor/rules/` — for example, `api-routes.mdc`. You'll see:

```yaml
---
description: When working on API route handlers in api/src/api/
globs: ["api/src/api/**/*.py"]
---
```

The `globs` field tells Cursor: "When the developer is editing a file that matches `api/src/api/**/*.py`, load this rule into the AI's context." The rest of the file is plain markdown with conventions written as ALWAYS/NEVER/MUST directives, paired with real code examples from the actual codebase.

**That's it.** The AI doesn't have special powers — it's reading instructions, just like a new team member reading a wiki page. The difference is that the instructions are automatically loaded based on what file you're working on.

### Where the rules came from

These are not generic best practices pulled from the internet. Every rule in this toolkit was extracted from analysis of **1,459 merged pull requests** on the simpler-grants-gov repository over 12 months. The process:

1. **Extraction:** A script (`research/extract.py`) pulled every merged PR, its diff, and its review comments from GitHub
2. **Analysis:** An LLM analyzed the PRs in three passes — pattern discovery, pattern validation with cross-referencing, and documentation generation
3. **Human review:** Team members reviewed the generated patterns against their own knowledge
4. **Confidence scoring:** Each pattern was assigned a confidence level based on how consistently it appeared across PRs

The detailed research (including all intermediate analysis) lives in the `research/` directory. The full evidence for each rule — with PR numbers, code examples, and confidence levels — is in `documentation/rules/`.

### Agents are just longer rule files

An agent like `agent-new-endpoint.mdc` is the same format as a rule — markdown with instructions. The difference is that its `globs` field is empty (`[]`) and `alwaysApply` is `false`, which means it only activates when you explicitly invoke it. The content is a step-by-step workflow: "first create this file, then create that file, following these patterns."

### MCP Servers are context providers

The custom MCP server (`mcp-server/`) is a small Node.js program that reads the documentation files and serves specific sections on demand. When the AI needs to look up a rule or check the architecture guide, it calls the MCP server instead of dumping all 500KB of documentation into its context window. You can read the full source in `mcp-server/src/index.ts` — it's about 200 lines.

### You are always in control

- The AI never pushes code, creates PRs, or modifies files without your explicit approval in Cursor
- Every suggestion is a diff you can accept, reject, or edit
- Rules guide the AI's suggestions — they don't force anything
- You can read, modify, or disable any rule at any time

---

## 3. Getting Started

### Prerequisites

- [Cursor IDE](https://cursor.sh) installed
- A local clone of [HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov)
- Node.js 18+ installed
- A GitHub Personal Access Token (for the GitHub MCP server)

### Installation

```bash
# Clone this toolkit repo alongside your monorepo
git clone https://github.com/btabaska/simpler-grants-documentation-automation.git

# Run the setup script
cd simpler-grants-documentation-automation
./setup.sh

# Open the monorepo in Cursor
cursor ../simpler-grants-gov
```

The setup script creates symbolic links from this toolkit into your monorepo. Nothing is copied or modified in the monorepo itself. If you ever want to remove the toolkit, just delete the symlinks.

### Verifying it works

1. Open any Python file under `api/src/api/` in Cursor
2. Open the Cursor chat (Cmd+L / Ctrl+L)
3. Ask: "What conventions should I follow when writing a route handler in this project?"
4. The AI should respond with specific conventions about decorator stack order, thin handlers, structured logging, etc. — not generic Python advice

If you see project-specific guidance, the rules are working.

---

## 4. Understanding Auto-Activating Rules

### How rules activate

When you open or edit a file in Cursor, the IDE checks the file path against every rule's `globs` pattern. If there's a match, that rule's content is silently loaded into the AI's context. You don't need to do anything — it just works.

### Which rules activate for which files

| You're editing... | These rules activate |
|-------------------|---------------------|
| `api/src/api/users/user_routes.py` | `api-routes` + `api-error-handling` + `cross-domain` |
| `api/src/services/opportunities/create.py` | `api-services` + `api-error-handling` + `cross-domain` |
| `api/src/db/models/application.py` | `api-database` + `cross-domain` |
| `api/src/auth/multi_auth.py` | `api-auth` + `cross-domain` |
| `api/tests/src/api/test_users.py` | `api-tests` + `cross-domain` |
| `frontend/src/components/search/SearchBar.tsx` | `frontend-components` + `cross-domain` |
| `frontend/src/hooks/useClientFetch.ts` | `frontend-hooks` + `cross-domain` |
| `frontend/src/i18n/messages/en/index.ts` | `frontend-i18n` + `cross-domain` |
| `infra/api/service/main.tf` | `infra` + `cross-domain` |
| `.github/workflows/ci.yml` | `ci-cd` + `cross-domain` |

The `cross-domain` rule always activates — it contains conventions that apply everywhere (structured logging, boolean naming, error handling).

### What happens when you don't follow a convention

Nothing breaks. The rules are guidance, not enforcement. But when you ask the AI for help — generating code, refactoring, or reviewing — it will follow these conventions in its suggestions. If you write code that violates a convention and ask the AI to review it, the AI will flag it, just like a senior engineer would.

### How to see which rules are active

In Cursor, you can check which rules are loaded by looking at the rules indicator in the chat panel. You can also open any `.mdc` file directly to read what conventions it contains.

---

## 5. Using Agents — Step by Step

Agents are the most powerful part of this toolkit. They're pre-written workflows for complex, multi-file tasks.

### How to invoke an agent

In Cursor chat, reference the agent's rule file using `@`. For example:

```
@agent-new-endpoint I need to create a new API endpoint for managing user notifications
```

Or in Composer (Cmd+I / Ctrl+I):

```
@agent-new-endpoint Create a GET endpoint at /v1/users/<user_id>/notifications
that returns a user's notification preferences. It needs JWT auth.
```

### Agent Reference

#### `@agent-new-endpoint` — Create a Complete API Endpoint

**Use when:** You need to add a new API endpoint and want all the files created correctly the first time.

**What it does:** Walks through creating a blueprint, routes file (with correct decorator stack), schemas, service function, tests, and blueprint registration — 7 files total.

**Example prompts:**

```
@agent-new-endpoint Create a new endpoint for managing agency contacts.
- Domain: agencies
- Path: /v1/agencies/<agency_id>/contacts
- Methods: GET (list), POST (create)
- Auth: JWT + API key multi-auth
- Needs a new AgencyContact model with fields: name, email, phone, role
```

```
@agent-new-endpoint I need a DELETE endpoint at /v1/users/<user_id>/saved-searches/<search_id>
that soft-deletes a saved search. JWT auth required. The SavedSearch model already exists.
```

**What to expect:** The agent will ask clarifying questions if your prompt is ambiguous (e.g., "What fields does the model need?"), then generate each file in sequence. Review each file before accepting.

---

#### `@agent-code-generation` — Generate Code Following Project Patterns

**Use when:** You're writing any code and want the AI to automatically apply the right conventions for that area of the codebase.

**What it does:** Acts as a dispatch layer — it figures out which domain rules apply based on what you're building, then generates code that follows all of them.

**Example prompts:**

```
@agent-code-generation Write a service function that retrieves all active opportunities
for a given agency, with pagination support.
```

```
@agent-code-generation Create a React server component that displays a list of
grant applications with their status badges. Use USWDS components.
```

```
@agent-code-generation Write a Marshmallow schema for an endpoint that accepts
a list of opportunity IDs and a boolean flag for whether to include archived ones.
```

**When to use this vs. a specific agent:** Use `agent-code-generation` when you're writing a single file or function. Use `agent-new-endpoint` when you're creating a full endpoint across multiple files. Use `agent-test-generation` when you specifically need tests.

---

#### `@agent-test-generation` — Generate Tests

**Use when:** You've written code and need tests, or you want to add test coverage to existing code.

**What it does:** Generates tests following the project's specific patterns — factory `.build()` vs `.create()`, the `enable_factory_create` fixture, jest-axe accessibility scans, etc.

**Example prompts:**

```
@agent-test-generation Write tests for the get_agency_contacts service function.
It queries the database for contacts by agency_id and returns a list.
Include success, not-found, and empty-list cases.
```

```
@agent-test-generation Write tests for the AgencyContactCard component.
It receives a contact object as a prop and displays name, email, and role.
Include an accessibility scan.
```

```
@agent-test-generation I have this route handler [paste code].
Generate a complete test file covering 200, 404, 401, and 422 responses.
```

**Pro tip:** You can also point the agent at an existing file:

```
@agent-test-generation Write tests for the code in api/src/services/users/get_user.py
```

---

#### `@agent-migration` — Generate Database Migrations

**Use when:** You need to add or modify database tables and want the migration to follow project conventions.

**What it does:** Generates Alembic migrations with the correct naming convention, `schema="api"` declarations, UUID primary keys, and both `upgrade()` and `downgrade()` functions.

**Example prompts:**

```
@agent-migration I need to add a "phone_number" column (nullable text)
to the existing "user" table.
```

```
@agent-migration Create a new table called "agency_contact" with fields:
- agency_contact_id (UUID PK)
- agency_id (FK to agency table)
- name (text, required)
- email (text, nullable)
- role (text, nullable)
- is_primary (boolean, default false)
```

```
@agent-migration I need to add a lookup table for contact_type with values:
primary, billing, technical, grants_officer
```

---

#### `@agent-i18n` — Manage Translations

**Use when:** You need to add user-facing text to the frontend.

**What it does:** Generates translation keys following the centralized single-file pattern, with correct PascalCase/camelCase naming, and shows you how to use `useTranslations()` in your component.

**Example prompts:**

```
@agent-i18n I'm building a new "Saved Searches" page. I need translations for:
- Page title
- Header
- Empty state message ("You haven't saved any searches yet")
- Delete confirmation ("Are you sure you want to remove this saved search?")
- Success toast ("Saved search deleted")
```

```
@agent-i18n Add error messages for the application submission flow:
- Missing required fields
- Invalid date format
- File too large
- Submission successful
```

---

#### `@agent-adr` — Write Architecture Decision Records

**Use when:** You're making or documenting a significant technical decision.

**What it does:** Generates an ADR following the project's established format, with sections for context, decision, alternatives considered (with pros/cons/why-not), and consequences.

**Example prompts:**

```
@agent-adr We decided to use WebSockets instead of polling for real-time
notification delivery. The alternatives were SSE and long polling.
Key factors: FedRAMP compliance, browser support, and connection overhead.
```

```
@agent-adr Document the decision to add Redis as a caching layer
for the opportunity search endpoint. We chose Redis over Memcached
and application-level caching.
```

---

#### `@pr-review` — Review a Pull Request

**Use when:** You want a comprehensive code review that checks against all project conventions.

**What it does:** Identifies which rule files apply to the changed files, runs specialist review passes (security, performance, simplicity, architecture), checks accessibility, and produces review comments in a consistent format with severity levels.

**Example prompts:**

```
@pr-review Review the changes in this PR. The diff is:
[paste diff or provide PR URL]
```

```
@pr-review Review the files I've changed in this branch against
our codebase conventions. Focus on the API route handlers and service functions.
```

---

## 6. Using Notepads for Context

Notepads are pre-written reference documents you can pull into any chat conversation to give the AI relevant context.

### How to use a notepad

In Cursor chat, type `@` and search for the notepad name:

```
@new-api-endpoint I need to create an endpoint for...
```

Or add it alongside an agent:

```
@agent-new-endpoint @new-api-endpoint Create a CRUD endpoint for agency contacts
```

### Available Notepads

| Notepad | When to use it |
|---------|---------------|
| `@architecture-overview` | When you need the AI to understand the overall system design, tech stack choices, or project constraints (FedRAMP, USWDS, legacy coexistence) |
| `@new-api-endpoint` | When creating a new endpoint — provides a checklist and code skeletons |
| `@new-frontend-page` | When creating a new Next.js page — RSC patterns, data fetching, i18n |
| `@new-form-field` | When adding a form field — three-schema architecture, XML compatibility |
| `@new-database-table` | When adding a model — SQLAlchemy conventions, migration template |
| `@debug-api-error` | When debugging errors — error flow diagram, status codes, `raise_flask_error` patterns |

### When notepads help most

Notepads are especially useful when you're asking the AI an open-ended question and want it to answer in the context of this specific project:

```
@architecture-overview Why does this project use Flask instead of FastAPI?
```

```
@debug-api-error I'm getting a 422 error from the /v1/applications endpoint
but I don't understand the validation error format. Can you explain?
```

```
@new-database-table What's the correct way to add a many-to-many relationship
between users and organizations in this project?
```

---

## 7. Using Code Snippets

Snippets are the fastest way to scaffold code that follows project patterns. Type a prefix and Cursor autocompletes the template.

### How to use snippets

1. Start typing the snippet prefix (e.g., `sgg-route`)
2. Select the snippet from the autocomplete menu
3. Tab through the placeholders to fill in your specific values

### Python Snippets (for API code)

| Prefix | What it generates |
|--------|------------------|
| `sgg-route` | Complete route handler with decorator stack in the correct order |
| `sgg-service` | Service function with `db_session` parameter, logging, and error handling |
| `sgg-model` | SQLAlchemy model with `ApiSchemaTable`, `TimestampMixin`, UUID PK |
| `sgg-schema` | Marshmallow request/response schema pair |
| `sgg-test` | Route test with factory pattern and assertions |
| `sgg-migration` | Alembic migration with `upgrade()`/`downgrade()` and `schema="api"` |
| `sgg-log` | Structured log statement with `extra={}` dict |
| `sgg-error` | `raise_flask_error()` call with `ValidationErrorDetail` |

### TypeScript Snippets (for Frontend code)

| Prefix | What it generates |
|--------|------------------|
| `sgg-component` | React Server Component with `useTranslations` |
| `sgg-client-component` | Client component with `"use client"` directive |
| `sgg-hook` | Custom hook with state and callback |
| `sgg-fetcher` | `requesterForEndpoint()` server-side data fetcher |
| `sgg-i18n-key` | Translation key block for `messages/en/index.ts` |
| `sgg-test-component` | Component test with jest-axe accessibility scan |
| `sgg-test-e2e` | Playwright E2E test |

### Example: Using `sgg-route`

Type `sgg-route` in a Python file, press Tab, and you get:

```python
@domain_blueprint.get("/path")
@domain_blueprint.input(RequestSchema)
@domain_blueprint.output(ResponseSchema)
@domain_blueprint.doc(
    responses=[200, 401, 403, 404, 422], security=jwt_or_api_user_key_security_schemes
)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def handler_name(
    db_session: db.Session, params
) -> response.ApiResponse:
    result = service_module.service_function(db_session, args)
    return response.ApiResponse(message="Success", data=result)
```

Each placeholder (blueprint name, path, schema names, etc.) is highlighted for you to fill in by pressing Tab.

---

## 8. Prompt Engineering — How to Talk to the AI

The AI is only as good as what you ask it. Here are patterns that work well with this toolkit.

### Be specific about what you want

**Weak prompt:**
```
Write me an endpoint
```

**Strong prompt:**
```
Create a GET endpoint at /v1/agencies/<agency_id>/contacts that returns
a paginated list of contacts for an agency. Use JWT + API key multi-auth.
The AgencyContact model already exists with fields: name, email, phone, role, is_primary.
Include the service function and tests.
```

### Tell it what files you're working with

**Weak prompt:**
```
Fix this bug
```

**Strong prompt:**
```
The test test_get_opportunity_404 in api/tests/src/api/opportunities/test_opportunity_routes.py
is failing because the service function in api/src/services/opportunities/get_opportunity.py
returns None instead of raising a 404 error. Fix the service function to use raise_flask_error(404, ...).
```

### Ask for explanations when learning

```
I'm new to this codebase. Can you explain why the decorator stack on route handlers
has to be in a specific order? What breaks if I put @flask_db.with_db_session()
before the auth decorator?
```

```
@architecture-overview What is the "three-schema architecture" for forms
and why does this project use it instead of a simpler approach?
```

### Ask for reviews before committing

```
Review the code I just wrote in api/src/services/agencies/create_contact.py
against our project conventions. What did I miss?
```

### Use incremental prompts for complex tasks

Instead of one giant prompt, break it into steps:

```
Step 1: "Create the SQLAlchemy model for AgencyContact"
Step 2: "Now create the Alembic migration for this model"
Step 3: "Create the service function for listing contacts by agency"
Step 4: "Create the route handler with the correct decorator stack"
Step 5: "Generate tests for the route and service"
```

This gives you a chance to review and course-correct at each step.

### Reference specific conventions when the AI gets it wrong

```
This service function is missing db_session as the first parameter.
Per our api-services convention, all service functions must accept
db_session as their first parameter. Please fix this.
```

The AI knows the rules — sometimes it just needs a nudge to apply the right one.

---

## 9. Real-World Workflow Examples

### Example 1: Adding a new feature end-to-end

**Scenario:** You need to add a "saved searches" feature that lets users save and manage search queries.

```
Step 1 (in chat):
@agent-new-endpoint Create a full CRUD API for saved searches.
- Domain: saved_searches
- Base path: /v1/users/<user_id>/saved-searches
- Methods: GET (list), POST (create), DELETE (soft delete)
- Auth: JWT + API key multi-auth
- New model needed: SavedSearch with fields:
  - saved_search_id (UUID PK)
  - user_id (FK to user)
  - query_text (text, required)
  - filters_json (JSON, nullable)
  - name (text, required)
  - is_deleted (boolean, default false)
```

Review each generated file. Accept, modify, or reject.

```
Step 2 (in a frontend file):
@agent-i18n Add translations for a Saved Searches page with: page title,
header, empty state, save button, delete confirmation, success messages.
```

```
Step 3 (in chat):
@agent-code-generation Create a React server component at
frontend/src/components/search/SavedSearchList.tsx that fetches and
displays the user's saved searches using requesterForEndpoint().
Use USWDS Card components for each item.
```

```
Step 4 (in chat):
@agent-test-generation Write tests for the SavedSearchList component.
Include: renders with data, renders empty state, accessibility scan,
and delete button interaction.
```

### Example 2: Debugging an API error

**Scenario:** A frontend developer reports that the application submission endpoint returns a 422 error they don't understand.

```
@debug-api-error I'm getting this error response from POST /v1/applications/<id>/submit:

{
  "status_code": 422,
  "errors": [
    {
      "type": "notInProgress",
      "message": "Application cannot be submitted, not currently in progress",
      "field": null
    }
  ]
}

Where in the code does this error get raised, and what conditions trigger it?
```

### Example 3: Reviewing your own code before PR

**Scenario:** You've written a new service function and want to check it against conventions before submitting a PR.

```
@pr-review Review this service function I just wrote. Check it against
our API conventions, especially structured logging, error handling,
and the service layer patterns:

[paste your code]
```

### Example 4: Understanding unfamiliar code

**Scenario:** You're assigned to modify the forms system but have never worked in that area.

```
@architecture-overview @new-form-field
Explain the three-schema form architecture in this project.
I need to add a new "budget justification" textarea field to the
application form. Walk me through what files I need to touch and why.
```

---

## 10. Multi-File and Composer Workflows

Cursor's Composer feature (Cmd+I / Ctrl+I) can edit multiple files at once. This is where agents shine.

### Using Composer with agents

1. Open Composer (Cmd+I)
2. Reference an agent: `@agent-new-endpoint`
3. Describe what you need
4. Composer will propose changes across multiple files
5. Review each file's diff before accepting

### Composer best practices

**Start broad, then refine:**
```
@agent-new-endpoint Create a notifications endpoint for users.
```
Review what it generates, then follow up:
```
The service function needs to also check if the user has notification
permissions via the RBAC system. Add a verify_access() call.
```

**Use Composer for refactoring across files:**
```
Rename the "opportunity_status" field to "listing_status" across all
API models, schemas, services, and tests. Follow our naming conventions.
```

**Use Chat for single-file work:**
```
Add a new field "is_featured" to the Opportunity model.
Follow the api-database conventions.
```

### When to use Chat vs. Composer

| Task | Use |
|------|-----|
| Ask a question | Chat |
| Generate one file | Chat |
| Review code | Chat |
| Generate multiple related files | Composer |
| Refactor across files | Composer |
| Create a full endpoint (7 files) | Composer with `@agent-new-endpoint` |

---

## 11. What the AI Can and Cannot Do

### What it does well

- **Generating boilerplate** that follows project patterns (route handlers, service functions, models, tests, schemas)
- **Catching convention violations** in code you've written
- **Explaining codebase patterns** and the reasoning behind them
- **Scaffolding multi-file features** like new endpoints or database tables
- **Writing tests** that follow the factory pattern and include accessibility scans
- **Translating requirements** into code that fits the project's architecture

### What it cannot do

- **Push code, create PRs, or deploy** — all changes require your explicit approval in Cursor
- **Run tests or verify its code works** — you still need to run the test suite
- **Know about changes made since the rules were generated** — if a convention changed last week and the rules haven't been updated, the AI won't know
- **Replace code review** — the AI catches pattern violations, but it can't evaluate business logic correctness, user experience, or product requirements
- **Understand organizational context** — it doesn't know about sprint deadlines, stakeholder priorities, or inter-team agreements unless you tell it

### The right mental model

Think of the AI as a **junior-to-mid engineer who has memorized the team's wiki** but has never shipped a feature. It's fast, it knows the conventions, and it can generate solid scaffolding — but it needs your judgment for architecture decisions, edge cases, and "does this actually solve the problem?"

The best workflow is collaborative: let the AI handle the mechanical work (boilerplate, pattern compliance, test scaffolding), and focus your energy on the parts that require human judgment (design decisions, business logic, user experience).

---

## 12. Troubleshooting

### Rules aren't activating

**Symptom:** The AI gives generic advice instead of project-specific conventions.

**Fix:**
1. Verify symlinks exist: `ls -la ../simpler-grants-gov/.cursor/`
2. Re-run `./setup.sh` if symlinks are broken
3. Restart Cursor (sometimes needed after initial setup)
4. Check that you're editing a file that matches a rule's glob pattern

### MCP servers aren't connecting

**Symptom:** The AI can't access the architecture guide or GitHub data.

**Fix:**
1. Check Node.js is installed: `node --version`
2. Check your GitHub token: `echo $GITHUB_PAT`
3. Rebuild the custom MCP server: `cd mcp-server && npm run build`
4. Check Cursor's MCP settings panel for error messages

### The AI generates code that doesn't match conventions

**Symptom:** Generated code uses `Column()` instead of `Mapped[T]`, or puts business logic in route handlers.

**Fix:**
1. Reference the specific convention: "Per our api-database rules, use Mapped[T] syntax"
2. Reference the agent: `@agent-code-generation` forces rule loading
3. Check that the `.mdc` file for that domain exists and has correct glob patterns

### Snippets don't appear

**Symptom:** Typing `sgg-` doesn't show autocomplete suggestions.

**Fix:**
1. Verify snippet files exist: `ls .cursor/snippets/`
2. Check you're in the right file type (Python snippets won't appear in TypeScript files)
3. Restart Cursor

### The AI contradicts a rule

**Symptom:** The AI suggests something that violates a project convention (e.g., using `backref` instead of `back_populates`).

**Fix:** Tell it directly:
```
That's incorrect per our api-database convention. We use back_populates,
never backref. Please regenerate using the correct pattern.
```

The AI will correct itself. Rules are guidance — sometimes the AI needs a reminder to apply the right one.

---

## 13. FAQ for Skeptics

### "I don't trust AI to write my code."

You shouldn't trust it blindly — and this toolkit doesn't ask you to. Every suggestion is a diff you review before accepting. The AI is a fast first draft, not the final word. Think of it like autocomplete that understands your project's architecture.

### "Won't it generate code with bugs?"

It can, just like any developer. The difference is that this toolkit gives the AI knowledge of your project's patterns, making its output more consistent with what your team expects. You still need to review, test, and verify — but you start from a better baseline than a generic AI or a blank file.

### "I can write code faster by hand."

For a single function you've written dozens of times, maybe. But for generating a complete new endpoint (blueprint + routes + schemas + service + tests + factory + registration), the agent can produce a correct first draft across 7 files in seconds. Even if you spend 5 minutes reviewing and adjusting, that's faster than writing each file from scratch.

### "What if the rules are wrong?"

Every rule has a confidence level documented in `documentation/rules/`. Rules marked with a pending marker are awaiting team validation. If you find a rule that doesn't match current practice, that's valuable feedback — update the rule or flag it for the team.

### "This seems like a lot of complexity."

After running `./setup.sh` once, the day-to-day experience is simple: open Cursor, edit files, and the AI automatically knows your project's conventions. You don't need to use agents, notepads, or snippets if you don't want to — the auto-activating rules work silently in the background.

### "Won't this make developers lazy?"

The same concern was raised about IDEs, autocomplete, Stack Overflow, and every other tool that accelerated development. The mundane parts of coding (writing boilerplate, remembering decorator order, setting up test scaffolding) aren't where engineering judgment lives. Freeing developers from mechanical work lets them focus on design, architecture, and problem-solving.

### "How is this different from GitHub Copilot?"

Copilot is a general-purpose code completion tool — it knows Python and TypeScript, but it doesn't know *your* project. This toolkit adds project-specific knowledge: 200+ conventions extracted from your actual codebase, with real examples from your PRs. Copilot suggests generic Python; this toolkit suggests code that passes your team's code review.

### "I'm worried about sensitive code being sent to AI providers."

Cursor's AI processes code through Anthropic's and OpenAI's APIs. This is a valid concern for any AI coding tool. Review your organization's policies on AI tool usage. The rules in this toolkit are text files — they contain coding conventions, not sensitive data. The MCP servers run locally and only serve documentation files.

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **Rule (.mdc file)** | A markdown file with YAML frontmatter that tells Cursor when to load its content (based on file path patterns) and what conventions to follow. Lives in `.cursor/rules/`. |
| **Agent** | A rule file with empty `globs` that you invoke manually in chat. Contains multi-step workflows for complex tasks. |
| **Notepad** | A pre-written context document in `.cursor/notepads/` that you can reference in chat to give the AI background knowledge. |
| **Snippet** | A code template triggered by typing a prefix (e.g., `sgg-route`). Auto-fills with project-specific patterns. |
| **MCP Server** | A background service that gives the AI access to external data (GitHub, documentation, architecture guide). Defined in `.cursor/mcp.json`. |
| **Glob pattern** | A file path pattern like `api/src/api/**/*.py` that determines when a rule activates. `**` matches any directory depth, `*` matches any filename. |
| **Composer** | Cursor's multi-file editing mode (Cmd+I). Can create and modify multiple files in a single operation. |
| **`raise_flask_error()`** | The project's centralized error handling function. All API errors flow through it. |
| **`ValidationErrorDetail`** | A structured error object with `type`, `message`, and optional `field`. The `type` field is the API-frontend contract. |
| **`requesterForEndpoint()`** | The project's factory function for creating typed API fetch functions on the frontend. |
| **Factory `.build()` / `.create()`** | Test data creation methods. `.build()` creates in-memory objects (fast, no DB). `.create()` persists to the database (slower, needs `enable_factory_create` fixture). |
| **USWDS** | U.S. Web Design System — the legally required design system for federal government websites. Accessed via `@trussworks/react-uswds`. |
| **FedRAMP** | Federal Risk and Authorization Management Program — a compliance framework that constrains which cloud services and tools the project can use. |
| **ADR** | Architecture Decision Record — a document capturing a significant technical decision, its context, alternatives considered, and consequences. |
| **RSC** | React Server Component — the default rendering strategy in this project. Components render on the server unless they explicitly declare `"use client"`. |
