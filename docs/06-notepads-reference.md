# Notepads Reference

> **Before reading this:** Read [Getting Started](03-getting-started.md) to ensure your toolkit is set up.

Notepads are pre-written context documents stored in `.cursor/notepads/` that you can reference in Cursor chat by typing `@notepad-name`. They provide background knowledge -- project architecture, coding patterns, checklists -- so you don't have to type it all out every time you start a conversation. This project includes six notepads, each focused on a specific domain.

---

## How to Use Notepads

1. Open Cursor Chat (Cmd+L or Ctrl+L).
2. Type `@` and search for the notepad name (e.g., `@architecture-overview`).
3. Select the notepad from the dropdown. Its full content is loaded into the context window.
4. Write your prompt as usual. The notepad content is injected as context alongside your message.

You can reference multiple notepads in a single prompt if your question spans multiple domains. For example, you might reference both `@architecture-overview` and `@new-api-endpoint` when creating an endpoint that touches an unfamiliar part of the system.

**Combining with agents:** You can reference a notepad and an agent in the same prompt. The notepad adds domain knowledge while the agent adds workflow instructions.

Example: `@agent-new-endpoint @new-api-endpoint Create a CRUD API for saved searches`

**Key distinction:**
- **Notepads** add context (facts, patterns, checklists)
- **Agents** add workflow instructions (step-by-step procedures)

## Quick Reference Table

| Notepad | Domain | Use For |
|---------|--------|---------|
| `@architecture-overview` | Full stack | Tech stack questions, constraint awareness, cross-cutting concerns |
| `@new-api-endpoint` | API (Python) | Creating routes, decorator order, service functions |
| `@new-frontend-page` | Frontend (Next.js) | Server components, data fetching, i18n, USWDS |
| `@new-form-field` | Forms | Three-schema fields, validation, XML compatibility |
| `@new-database-table` | Database | Models, migrations, factories, lookup tables |
| `@debug-api-error` | Debugging | Error tracing, status codes, error flow |

---

## Notepad Reference

### @architecture-overview

**Contains:** A condensed 2-page version of the full 50KB architecture guide. Covers the tech stack (Flask, Next.js, PostgreSQL), project directory structure, API and frontend architecture, infrastructure layout, testing patterns, and key constraints such as FedRAMP compliance, USWDS design system requirements, and legacy Grants.gov coexistence.

**When to reference it:**
- When asking about project architecture, tech stack decisions, or why a particular technology was chosen
- When the AI needs broad context about cross-cutting concerns before making a recommendation
- When evaluating whether a new dependency or pattern fits the project's constraints

**Example prompts:**
1. `@architecture-overview Why does this project use Flask instead of FastAPI?`
2. `@architecture-overview I need to understand the data flow from legacy Grants.gov to our PostgreSQL database`
3. `@architecture-overview What constraints should I be aware of when choosing a new dependency?`

**With vs. without this notepad:** Without it, the AI may suggest patterns or libraries that conflict with FedRAMP requirements or the existing tech stack. It might recommend a client-side state library when the project uses server components, or suggest a database that isn't FedRAMP-authorized. With it, the AI understands the full technology landscape and gives answers that respect project constraints, suggesting only compatible approaches.

---

### @new-api-endpoint

**Contains:** A checklist of all files needed for a new endpoint, the correct decorator stack order, a route handler skeleton, a service function skeleton, and the expected test structure.

**When to reference it:**
- When creating a new API endpoint and you want a quick reference for the required file set
- When you need to verify the correct decorator order on a route handler
- When writing a service function and want to follow the established pattern

**Example prompts:**
1. `@new-api-endpoint What's the correct decorator order for a POST route?`
2. `@new-api-endpoint I'm creating a new agencies endpoint - what files do I need?`
3. `@new-api-endpoint Show me the pattern for a service function that handles pagination`

**With vs. without this notepad:** Without it, the AI may guess at decorator order or miss required files (like the schema or factory). With it, the AI follows the exact project conventions and produces code that passes linting and tests on the first try.

---

### @new-frontend-page

**Contains:** The React Server Component page template, data fetching patterns using `requesterForEndpoint` and the Promise-as-props technique, component organization conventions, i18n integration with `next-intl`, and USWDS component guidance.

**When to reference it:**
- When creating a new Next.js page from scratch
- When you need to understand the data fetching pattern for server components
- When integrating translations or USWDS components into a new view

**Example prompts:**
1. `@new-frontend-page How do I fetch data in a server component?`
2. `@new-frontend-page I need to create a page that shows a list of opportunities with filters`
3. `@new-frontend-page What's the Promise-as-props pattern and when should I use it?`

**With vs. without this notepad:** Without it, the AI defaults to generic Next.js patterns -- it may use `useEffect` for data fetching instead of server components, skip the `requesterForEndpoint` factory, or omit translation keys entirely. With it, the AI uses the project's specific RSC data fetching pattern, wires up i18n correctly, and follows USWDS component conventions.

---

### @new-form-field

**Contains:** The three-schema architecture explanation (JSON Schema, UI Schema, and Rule Schema), custom validator information, XML compatibility warnings for legacy system integration, and the test triad approach (minimal, full, and empty payloads).

**When to reference it:**
- When adding a new field to a grant application form
- When implementing cross-field validation logic
- When modifying existing form fields and needing to understand XML compatibility constraints

**Example prompts:**
1. `@new-form-field I need to add a budget justification textarea to the application form`
2. `@new-form-field How do I add cross-field validation (field B required if field A is 'yes')?`
3. `@new-form-field What are the XML compatibility constraints I need to know about?`

**With vs. without this notepad:** Without it, the AI may only update the UI schema and miss the JSON Schema or Rule Schema, leading to broken validation. With it, the AI updates all three schemas in lockstep and accounts for XML compatibility with the legacy system.

---

### @new-database-table

**Contains:** The model definition checklist (inheriting from `ApiSchemaTable` and `TimestampMixin`, using UUID primary keys), naming conventions, column syntax with `Mapped[T]`, the lookup table pattern, an Alembic migration template, and a factory template for tests.

**When to reference it:**
- When adding a new database model or table
- When modifying existing database structure or adding relationships
- When creating lookup tables or implementing soft deletes

**Example prompts:**
1. `@new-database-table What's the correct way to define a many-to-many relationship?`
2. `@new-database-table I need to add a lookup table for notification_type`
3. `@new-database-table Show me the soft delete pattern for user-facing deletions`

**With vs. without this notepad:** Without it, the AI may use auto-increment integer IDs, skip `TimestampMixin`, or produce migrations that don't target the correct schema. With it, the AI generates models that match the project's ORM conventions exactly.

---

### @debug-api-error

**Contains:** An error flow diagram showing how errors propagate from `raise_flask_error` through `ValidationErrorDetail` to JSON and then to the frontend. Also includes a status code reference, common error patterns with their root causes, and a step-by-step debugging checklist.

**When to reference it:**
- When investigating an API error and you need to trace it through the stack
- When you want to understand why a specific status code or error type is returned
- When the frontend displays an unexpected error and you need to find where it originates

**Example prompts:**
1. `@debug-api-error I'm getting a 422 with type 'notInProgress'. Where does this error originate?`
2. `@debug-api-error How does the frontend know which error message to display for a given error type?`
3. `@debug-api-error Why are 404 errors logged at info level instead of warning?`

**With vs. without this notepad:** Without it, the AI has to guess at the error handling architecture and may point you to the wrong layer. With it, the AI can trace errors through the exact flow used in this project and pinpoint the file and function where the error is raised.

---

## Combining Notepads with Agents

You can reference a notepad and an agent in the same prompt for maximum context. The agent defines the workflow (what steps to follow), while the notepad provides the reference material (what patterns to use).

| Combination | What it does |
|-------------|-------------|
| `@agent-new-endpoint @new-api-endpoint` | Agent drives the multi-file workflow; notepad provides the decorator order and skeleton |
| `@agent-migration @new-database-table` | Agent handles the migration steps; notepad provides model and factory templates |
| `@agent-new-endpoint @architecture-overview` | Agent creates the endpoint; notepad ensures it fits the broader architecture |

**Example combined prompts:**
- `@agent-new-endpoint @new-api-endpoint Create a CRUD API for saved searches`
- `@agent-migration @new-database-table Add a new agency_contact table with name, email, and phone columns`
- `@agent-new-endpoint @debug-api-error The /opportunities endpoint returns a 500 on empty filters -- fix it`

---

## Tips for Getting the Most Out of Notepads

- **Start broad, then narrow.** If you are new to a part of the codebase, reference `@architecture-overview` first to orient yourself, then switch to a task-specific notepad like `@new-api-endpoint` when you start building.
- **Pair notepads with file references.** You can reference a notepad alongside a specific file: `@new-api-endpoint @opportunities_route.py Add a PATCH endpoint for updating status`. The notepad provides the pattern; the file provides the concrete context.
- **Don't stack too many.** Two notepads is usually the sweet spot. More than three can fill the context window and reduce the quality of the AI's response.
- **Use notepads for review, too.** Notepads are not just for generating code. Try: `@new-api-endpoint Review this route handler for convention violations` to get a review grounded in project standards.

---

## See Also

- [Agents Reference](05-agents-reference.md) -- manually invoked workflow agents
- [Prompt Engineering](08-prompt-engineering.md) -- how to write effective prompts
- [Back to documentation index](README.md)
