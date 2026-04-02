<!--
  document: 15-glossary.md
  title: Glossary
  description: Definitions of project-specific and AI-tooling terms used throughout the Simpler.Grants.gov AI Coding Toolkit documentation
  category: reference
  audience: all toolkit users
  last_updated: 2026-04-02
  toolkit_version: 1.0
-->

# Glossary

Alphabetical reference of project-specific and AI-tooling terms used in this
documentation. Each entry links to the doc where the concept is covered in depth.

---

### ADR (Architecture Decision Record)
A short document capturing a significant technical decision, its context, and its
consequences so future contributors understand *why* a choice was made.

### Agent (Cursor)
A reusable, named prompt configuration invoked by typing `@agent-name` in Cursor's
chat or Composer panel. Agents encapsulate a persona, instructions, and optional
file-context scoping. See [Agents Reference](05-agents-reference.md).

### Auto-activating rule
A Cursor rule stored as a `.mdc` file that fires automatically when the developer
opens or edits a file matching a configured glob pattern. The toolkit ships 18
auto-activating rules. See [Auto-Activating Rules](04-auto-activating-rules.md).

### Blueprint (Flask)
A Flask/APIFlask construct that groups related routes under a single namespace. Each
domain in the Simpler.Grants.gov API has its own blueprint registered in the
application factory. See [Auto-Activating Rules](04-auto-activating-rules.md#1-api-routesmdc).

### Compound Engineering (plugin)
A Cursor plugin that extends AI capabilities with multi-step code generation and
refactoring pipelines. Listed as an optional enhancement in the toolkit configuration.

### Compound Knowledge (plugin)
A Cursor plugin that gives the AI richer codebase-level context by indexing project
structure and dependencies, complementing the toolkit's glob-scoped rule files.

### Cursor IDE
An AI-native code editor built on VS Code supporting rules, agents, notepads, code
snippets, and MCP servers. The entire toolkit runs inside Cursor. See
[What Is This Toolkit?](01-what-is-this-toolkit.md) and [Getting Started](03-getting-started.md).

### Decorator stack
The required ordering of Python decorators on an APIFlask route handler:
`@blueprint.route` > `@blueprint.auth_required` > `@blueprint.input` >
`@blueprint.output` > `@blueprint.doc`. Misordering causes silent failures. See
[Auto-Activating Rules](04-auto-activating-rules.md#1-api-routesmdc) and
[Code Snippets Reference](07-code-snippets-reference.md).

### Dispatch table (PR review)
A routing mechanism in the PR review agent that maps changed file paths to the
appropriate rule file(s) via glob-pattern matching, then evaluates the diff against
those conventions. See [PR Review Guide](11-pr-review-guide.md).

### Factory pattern (.build() vs .create())
The test data convention in the API. `.build()` constructs an in-memory object;
`.create()` persists it via SQLAlchemy and requires the `enable_factory_create` fixture.
See [Auto-Activating Rules](04-auto-activating-rules.md#8-api-testsmdc) and
[Workflow Examples](09-workflow-examples.md).

### FedRAMP (Federal Risk and Authorization Management Program)
A US government program that standardizes security assessment for cloud services.
FedRAMP compliance influences infrastructure and CI/CD decisions in the project.

### Glob pattern
A file-matching syntax using wildcards (`*`, `**`, `?`). Cursor uses glob patterns in
`.mdc` files to determine which rules auto-activate. Example: `api/src/api/**/*.py`.
See [Auto-Activating Rules](04-auto-activating-rules.md).

### JWT (JSON Web Token)
A compact, URL-safe token format used for API authentication. The `api-auth.mdc` rule
encodes JWT handling conventions including the `.get_user()` pattern. See
[Auto-Activating Rules](04-auto-activating-rules.md#4-api-authmdc).

### LLM (Large Language Model)
A neural network trained on large text corpora that generates human-like text. Cursor
uses an LLM as its backend; the toolkit shapes its output to match project conventions.
See [How It Works](02-how-it-works.md).

### Mapped[T] syntax
The SQLAlchemy 2.0 type-annotation style for model columns, e.g.,
`status: Mapped[str] = mapped_column(nullable=False)`. The `api-database.mdc` rule
enforces this over legacy `Column()`. See
[Auto-Activating Rules](04-auto-activating-rules.md#3-api-databasemdc).

### Marshmallow (schema library)
A Python serialization and validation library. The API uses Marshmallow schemas via
APIFlask to define request and response shapes. See
[Auto-Activating Rules](04-auto-activating-rules.md#1-api-routesmdc).

### MCP (Model Context Protocol)
An open protocol that lets AI assistants call external tools and data sources during a
conversation. See [What Is This Toolkit?](01-what-is-this-toolkit.md) and
[Getting Started](03-getting-started.md#exercise-5-mcp-server).

### MCP Server
A process implementing the Model Context Protocol that exposes tools or data to the AI.
The toolkit configures up to three: GitHub (issues/PRs), `simpler-grants-context`
(conventions), and optionally Postgres (live queries). See
[What Is This Toolkit?](01-what-is-this-toolkit.md).

### .mdc file
The Cursor rule definition format. Each `.mdc` file has YAML-like frontmatter (glob
pattern, description) followed by Markdown instructions. The toolkit ships 18 `.mdc`
files. See [Auto-Activating Rules](04-auto-activating-rules.md).

### Notepad (Cursor feature)
A named block of reference text loaded into the AI's context via `@notepad-name`.
Unlike agents, notepads supply passive context (architecture diagrams, domain
explanations) rather than instructions. See [Notepads Reference](06-notepads-reference.md).

### PR review skill
An agent workflow that reviews a pull request by mapping each changed file to relevant
auto-activating rules, then checking the diff against those conventions. See
[PR Review Guide](11-pr-review-guide.md).

### RSC (React Server Component)
A React component that renders on the server. The frontend defaults to Server
Components; the `frontend-components.mdc` rule requires an explicit `"use client"`
directive only when client interactivity is needed. See
[Auto-Activating Rules](04-auto-activating-rules.md#9-frontend-componentsmdc).

### Rule file
A `.mdc` file providing domain-specific instructions to the AI. Rule files can be
auto-activating (glob-triggered), manually invoked, or always-on. The 18 rule files
are the toolkit's core mechanism. See [Auto-Activating Rules](04-auto-activating-rules.md)
and [How It Works](02-how-it-works.md).

### Service layer
The architectural layer containing business logic between route handlers and database
models. Each service module exposes functions (not classes). See
[Auto-Activating Rules](04-auto-activating-rules.md#2-api-servicesmdc).

### Snippet (code snippet)
A reusable code template demonstrating a project-specific pattern with placeholders.
Covers route handlers, models, test factories, form fields, and more. See
[Code Snippets Reference](07-code-snippets-reference.md).

### SQLAlchemy
The Python ORM used by the API. The project uses SQLAlchemy 2.0 conventions: `Mapped[T]`
annotations, `mapped_column()`, and the `ApiSchemaTable` base class. See
[Auto-Activating Rules](04-auto-activating-rules.md#3-api-databasemdc).

### Symlink deployment
The installation method used by `setup.sh`. Instead of copying files, symbolic links
connect `.cursor/rules/` to the toolkit's source files, allowing independent updates.
See [Getting Started](03-getting-started.md).

### Three-schema form architecture
The frontend form pattern using three schema files: **JSON Schema** (field definitions),
**UI Schema** (layout/widgets), and **Rule Schema** (conditional logic/validation). The
most complex domain-specific pattern in the codebase. See
[Workflow Examples](09-workflow-examples.md) and
[Auto-Activating Rules](04-auto-activating-rules.md#7-api-form-schemamdc).

### USWDS (US Web Design System)
A US government design system for accessible, responsive UI. The frontend uses USWDS
via `@trussworks/react-uswds`; the `frontend-components.mdc` rule enforces it over
custom implementations. See
[Auto-Activating Rules](04-auto-activating-rules.md#9-frontend-componentsmdc).

### ValidationErrorDetail
A structured error object in API validation responses containing `type` (from
`ValidationErrorType`), `message`, and `field`. Always used with `raise_flask_error()`.
See [Auto-Activating Rules](04-auto-activating-rules.md#5-api-validationmdc).

### raise_flask_error()
The project's standard function for HTTP error responses, replacing raw Flask `abort()`.
Called as `raise_flask_error(status_code, message, validation_issues=[...])` when
validation errors are present. See
[Auto-Activating Rules](04-auto-activating-rules.md#6-api-error-handlingmdc) and
[Workflow Examples](09-workflow-examples.md).

---

## See Also

- [What Is This Toolkit?](01-what-is-this-toolkit.md) -- overview and components
- [Auto-Activating Rules](04-auto-activating-rules.md) -- full rule reference
- [Code Snippets Reference](07-code-snippets-reference.md) -- reusable code templates
- [Troubleshooting](13-troubleshooting.md) -- symptom-based problem solving
- [Back to documentation index](README.md)

---

*Previous: [13 -- Troubleshooting](13-troubleshooting.md)* | *Next: (end of docs)*
