<!--
  document: 12-capabilities-and-limitations.md
  title: Capabilities and Limitations
  description: An honest assessment of what AI can and cannot do within the Simpler.Grants.gov codebase when using the AI Coding Toolkit
  audience: developers evaluating or actively using the toolkit
  last_updated: 2026-04-02
  toolkit_version: 1.0
  depends_on:
    - 01-what-is-this-toolkit.md
    - 08-prompt-engineering.md
    - 14-faq-for-skeptics.md
-->

# Capabilities and Limitations

This document is an honest assessment of what the AI can and cannot do when using the
Simpler.Grants.gov AI Coding Toolkit in Cursor IDE. Trust requires honesty -- if this
document only listed strengths, you would be right to distrust it. It categorizes AI
capabilities into three tiers with specific examples from real project patterns. Use this
to decide where AI assistance saves you time and where it costs you time.

---

## The Right Mental Model

Before reviewing specific capabilities, establish this mental model:

**The AI is a knowledgeable junior developer who has memorized every convention in the
codebase but lacks judgment.**

It knows that route decorators follow a specific top-to-bottom order. It knows that
`db_session` must be the first parameter of service functions. It knows that frontend
components default to React Server Components. It knows all of this because the toolkit's
39 domain rules, 51 agents, 25 skills, 6 notepads, and 15 code snippets encode these
conventions explicitly. The agents add a Quality Gate Pipeline on top of the rules so that
generated code is validated by 11 specialist subagents (PII, accessibility, SQL injection,
i18n, contract, etc.) before it reaches you.

What it does not know is *when to break the rules*. It cannot tell you whether a new
feature warrants a new service or should extend an existing one. It cannot evaluate whether
a database migration is safe to run against a production table with 10 million rows. It
cannot reason about FedRAMP compliance implications of a logging change.

Treat its output the way you would treat a PR from an enthusiastic junior developer who
has read every page of the team wiki: structurally correct, conventionally consistent, but
requiring review for judgment calls. This mental model sets the right expectations for
everything that follows.

---

## What the AI Is Good At

These are tasks where the toolkit-equipped AI produces output that is correct on the first
attempt in the majority of cases. "Good" means you will spend more time reviewing than
fixing.

### Following Established Patterns

The AI excels at reproducing patterns it has been taught. When the toolkit's rules specify
that a route handler must follow this decorator order:

```python
@opportunities_blueprint.post("/opportunities/v1")
@opportunities_blueprint.input(OpportunityCreateSchema)
@opportunities_blueprint.output(OpportunityResponseSchema)
@opportunities_blueprint.doc(description="Create an opportunity")
@opportunities_blueprint.auth_required(api_key_auth)
@flask_db.with_db_session()
def create_opportunity(db_session, body):
    ...
```

The AI will reproduce that order consistently. It will not put `@flask_db.with_db_session()`
above the input schema. It will not forget the `@blueprint.doc` decorator. It has seen the
pattern in the `api-routes.mdc` rule with explicit ALWAYS directives and PR references,
and it follows the pattern reliably.

This extends to the service layer convention (business logic in `api/src/services/`, thin
route handlers that delegate), factory-based test patterns (`UserFactory.build()` for unit
tests, `UserFactory.create()` for integration tests), and the three-schema form
architecture. Anywhere a pattern is codified in a rule, the AI follows it.

### Generating Boilerplate

Adding a new API endpoint touches at minimum six files: blueprint registration, route
handler, request/response schemas, service function, database queries, and tests. The
structural parts of each file -- imports, class definitions, decorator stacks, test
scaffolding -- are boilerplate that follows fixed conventions.

The AI generates this boilerplate accurately. Ask it to create a new endpoint for managing
grant applications, and it will produce:

- A blueprint file at `api/src/api/applications_v1/applications_blueprint.py` with the
  correct registration pattern
- A route file with properly ordered decorators and thin handler functions
- Marshmallow schemas with the project's field type conventions
- A service file with `db_session` as the first parameter
- Test files using `pytest` with factory fixtures

You fill in the business logic. The AI provides the scaffolding.

### Applying Conventions Consistently

Naming conventions, error handling patterns, and structured logging follow strict rules
in this codebase. The AI applies them without drift:

- Error responses always use `raise_flask_error()` with `ValidationErrorDetail`, never
  raw HTTP exceptions
- Log statements use structured logging with the project's format
- Database models use UUID primary keys, `TimestampMixin`, and singular table names
- Frontend components use `requesterForEndpoint()` for server-side data fetching
- Translation keys follow camelCase naming in the single translation file

These are exactly the kind of detail-oriented conventions that humans forget on the third
file of a long implementation session. The AI does not forget.

### Cross-Referencing Rules Across Domains

When a task spans multiple domains -- say, adding a form field that requires changes to
the API schema, database model, frontend component, and translation file -- the AI
activates multiple rules simultaneously and checks for consistency across them. If the
form field name is `grant_amount` in the database model, the AI carries that naming
through to the Marshmallow schema (`grant_amount`), the frontend type definition
(`grantAmount` in TypeScript), and the i18n key (`grantAmount`), applying each domain's
naming convention correctly.

### Catching Convention Violations in PR Review

The PR review skill routes changes to domain-specific checklists and catches violations
human reviewers sometimes miss: missing `downgrade()` in migrations, client-side hooks in
server components, raw SQL instead of ORM, missing `@flask_db.with_db_session()`, error
handling that bypasses `raise_flask_error()`. The AI does not get bored on its fifteenth
PR review of the day.

### Mechanical Codebase Transformations

With the `codemod` agent and the `skill-*` generators, the AI is reliably good at large-scale mechanical changes: AST-based renames across 5–50 files, import path rewrites, decorator swaps, JSX attribute renames. The codemod agent enforces a clean working tree, plans batches before touching anything, runs scoped tests after each batch, and rolls back on failure. This is in the "good at" tier *only when* the change is purely mechanical — anything requiring semantic judgment is handed off to `@agent-refactor`.

### Compliance, Security, and Privacy Drafting

With the new compliance agents (`fedramp-compliance-checker`, `authority-to-operate-checklist`, `privacy-impact-assessment`, `section-508-report-generator`), the AI is now reliably good at producing first-draft compliance artifacts: NIST 800-53 control mappings, PIA sections, VPAT 2.4 conformance prose, ATO bundles. These drafts are not finished documents — they are scaffolds that capture the structure and the obvious findings so a human can spend their time on the parts that need judgment.

### Multi-Agent Quality Gates

A capability that did not exist in the previous toolkit version: every workflow agent now runs a Quality Gate Pipeline that fans out to specialist subagents (PII, accessibility, SQL injection, contract, dependency health, test quality, i18n completeness, etc.). This is what makes generated code feel pre-reviewed rather than pre-typed. See [How It Works](02-how-it-works.md#the-quality-gate-pipeline-pattern).

---

## What the AI Is Mediocre At

These are tasks where the AI produces a reasonable starting point but requires significant
human correction. "Mediocre" means you will spend roughly equal time reviewing and fixing
as you would have spent writing from scratch -- but you may still benefit from the
structural scaffolding.

### Complex Business Logic Requiring Domain Understanding

The AI can create a service function that follows the correct conventions. It cannot
determine what the function should actually *do* when the business logic involves grant
eligibility rules, federal funding calculations, or compliance workflows. It will guess
based on function names and parameter types, and those guesses will be plausible but often
wrong in the details.

**Example -- the AI will suggest this:**

```python
def calculate_award_ceiling(opportunity, applicant_type):
    if applicant_type == "nonprofit":
        return opportunity.max_award * 0.85
    return opportunity.max_award
```

**But you should actually do this:** consult the program officer for the specific funding
opportunity's rules, because award ceiling calculations vary by program, by fiscal year,
and by statutory authority. There is no generic formula. The AI has no way to know this.

### Multi-Step Refactors Spanning Many Files

The AI can refactor a single file or a small cluster of related files effectively. When a
refactor spans 15+ files across multiple domains, the AI tends to lose track of the full
scope. It will handle the first eight files correctly and miss the ninth. For large
refactors, use the AI to identify all affected files, then make the changes yourself or
break the work into smaller, file-scoped AI-assisted tasks.

### Performance Optimization Without Profiling Data

The AI will suggest standard optimization patterns (adding indexes, caching, reducing N+1
queries) based on code structure. These suggestions are often structurally correct but may
not address the actual bottleneck. Without profiling data, the AI optimizes what looks
slow rather than what *is* slow.

**Example -- the AI will suggest this:** adding an index on a column in a WHERE clause.

**But you should actually do this:** run `EXPLAIN ANALYZE` on the actual query with
production-scale data. The column might already be indexed via a composite index, or the
bottleneck might be in serialization, not the database.

### Understanding Implicit Relationships Between Services

The codebase has services that interact through indirect paths -- event handlers, background
tasks, shared database state. The AI understands explicit imports and function calls but
does not reliably understand that `OpportunityService` and `SearchIndexService` are coupled
through a background job. Modifying one service may have downstream impacts the AI will
not flag.

---

## What the AI Is Bad At

These are tasks where the AI's output should not be trusted without thorough expert review.
"Bad" means the AI will produce something that looks correct but has a meaningful
probability of being wrong in ways that matter.

### Security Decisions

Auth flows, permission models, session management, and input sanitization require security
expertise that the AI does not have. The toolkit's `api-auth.mdc` rule encodes the
existing JWT + API key multi-auth pattern, so the AI can *reproduce* the current auth
pattern. It cannot evaluate whether a new endpoint needs different auth requirements,
whether a permission check is sufficient, or whether a change introduces a privilege
escalation vulnerability.

**Example -- the AI will suggest this:** applying the same `@api_key_auth` decorator that
other endpoints use.

**But you should actually do this:** evaluate whether this endpoint exposes data that
requires additional authorization checks beyond API key authentication. Some endpoints
need per-resource authorization (does this user have access to *this specific* grant
application?), which is a judgment call the AI cannot make.

### Architecture Decisions

When to create a new service versus extending an existing one, when to add a table versus
add columns, when to split a module -- these require understanding the project's
trajectory, not just its current state. The AI follows the existing architecture faithfully
but will not tell you when it is the wrong choice for a new requirement. If you ask it to
add email notifications, it will add them to the existing `NotificationService` even if
the correct decision is a separate `EmailService` because the existing service is already
overloaded.

### Database Migration Ordering With Complex Dependencies

Alembic migrations have a dependency chain, and the AI can generate syntactically correct
migrations. But when multiple developers are creating migrations simultaneously, or when a
migration depends on data that another migration creates, ordering becomes critical. The
AI does not understand the deployment sequence, the state of the staging database, or
whether a migration needs to be split into a schema change and a data migration.

**Example -- the AI will suggest this:** a single migration that adds a column and
backfills it with computed values.

**But you should actually do this:** split it into two migrations -- one that adds the
nullable column (deployable without downtime), and a separate data migration that backfills
values (runnable independently). This is a deployment safety pattern the AI does not
reason about.

### Understanding Federal Compliance Requirements

FedRAMP, FISMA, Section 508 accessibility, and other federal compliance requirements affect
how code is written, how data is stored, and how infrastructure is configured. The AI has
general knowledge of these frameworks but does not understand how they apply to the
Simpler.Grants.gov system's specific Authority to Operate (ATO) boundary. It will not flag
that an external API integration may need to be within the FedRAMP authorization boundary,
or that data may require encryption at rest under FISMA Moderate controls.

### Knowing When NOT to Follow a Pattern

This is the most subtle failure mode. The toolkit teaches the AI to follow patterns. Most
of the time, following patterns is correct. But every codebase has edge cases where the
standard pattern is the wrong choice.

**Example -- the AI will suggest this:** using the standard factory pattern for test data
when testing a migration.

**But you should actually do this:** use raw SQL inserts in migration tests, because
factory-generated objects use the *current* model definition, not the model definition at
the time of the migration. This is a well-known testing pitfall that requires judgment to
recognize.

---

## Task Reliability Guide

The following table maps common tasks to AI reliability levels, verification requirements,
and override guidance.

| Task | AI Reliability | What to Verify | When to Override |
|------|---------------|----------------|------------------|
| New route handler boilerplate | High | Decorator order matches current convention | Endpoint needs non-standard auth |
| Marshmallow schema definition | High | Field types match database column types | Custom serialization logic needed |
| Service function scaffolding | High | `db_session` first param, correct imports | Business logic is non-trivial |
| Factory test setup | High | `.build()` vs `.create()` used correctly | Testing migration-specific behavior |
| React Server Component scaffold | High | No client-side hooks imported | Component needs client interactivity |
| Structured logging statements | High | Log level appropriate, fields correct | Logging PII or security-sensitive data |
| Translation key additions | High | Key naming follows camelCase convention | Pluralization or interpolation needed |
| Code review (convention checks) | High | AI flagged actual violations, not false positives | PR intentionally deviates from convention |
| Database model definition | Medium | Relationships, constraints, index choices | Table has complex multi-table relationships |
| Alembic migration generation | Medium | `upgrade()` and `downgrade()` are inverses | Migration involves data transformation |
| Multi-file feature implementation | Medium | All files created, imports connected | Feature spans more than 3 domains |
| Bug fix in existing code | Medium | Fix addresses root cause, not just symptom | Bug involves race conditions or async behavior |
| Performance optimization | Low | Optimization targets actual bottleneck | Always -- profile first |
| Auth and permission logic | Low | Security review by qualified team member | Always -- do not trust AI for security |
| Architecture decisions | Low | Senior developer review | Always -- AI follows patterns, not judgment |
| Compliance-related changes | Low | Compliance officer or security team review | Always -- AI lacks regulatory context |

---

## How the Toolkit Improves Over Vanilla Cursor

Cursor without the toolkit is a capable AI coding assistant with general knowledge of
Python, TypeScript, Flask, Next.js, and other technologies. Cursor *with* the toolkit has
specific knowledge of how this team uses those technologies. The difference is meaningful.

| Scenario | Vanilla Cursor | Cursor + Toolkit |
|----------|---------------|------------------|
| Generate a new API route | Produces valid Flask route; wrong decorator order, missing `@flask_db.with_db_session()`, uses raw exception handling | Correct decorator stack, thin handler delegating to service layer, `raise_flask_error()` for errors |
| Create a database model | Generic SQLAlchemy model with integer PK and `__tablename__` | UUID primary key, `TimestampMixin`, `Mapped[T]` type syntax, singular table name |
| Write a test file | Uses `unittest.TestCase` or generic pytest; invents fixture patterns | Uses project's factory pattern with `.build()`/`.create()`, `db_session` fixture, correct test file location |
| Add a frontend component | Creates client component with `useState`; uses generic CSS | Creates React Server Component by default; uses USWDS components; follows domain-based directory structure |
| Handle an error | Returns ad-hoc JSON error response | Uses `raise_flask_error()` with `ValidationErrorDetail` and correct HTTP status codes |
| Review a PR | Generic code quality feedback | Domain-specific checklist based on which files changed; checks decorator ordering, migration completeness, RSC compliance |
| Add a translation | Invents i18n library usage | Adds key to the single translation file with camelCase naming following established patterns |
| Create a migration | Basic Alembic template | Includes both `upgrade()` and `downgrade()`, uses project's revision ID pattern, follows naming convention |

The toolkit does not make the AI smarter. It makes the AI *informed*. The difference
between "write a Flask route" and "write a Flask route following this project's specific
decorator ordering, error handling, and service delegation patterns" is the difference
between code that compiles and code that passes review. For practical techniques on
getting the best results, see [Prompt Engineering](08-prompt-engineering.md).

---

## Practical Implications

**Use AI assistance** for structurally repetitive tasks where conventions are well-defined:
new endpoints, new components, new test files, schema definitions, boilerplate code. Use
the PR review skill as a pre-review pass to catch convention violations before human
reviewers spend time on them.

**Be cautious** with tasks requiring domain expertise beyond code conventions: business
logic, security, compliance, performance. Use the AI for the structural shell, then fill
in critical logic yourself. Be especially cautious with refactors spanning many files.

**Skip AI assistance entirely** for security-critical code paths, compliance-sensitive
changes, and architectural decisions. The time spent reviewing AI output for correctness
in these areas exceeds the time saved by generating it.

This assessment reflects early 2026 capabilities specific to this codebase and toolkit.
If you find the AI performing better or worse than described here, update this document.
An accurate capability assessment is more valuable than an optimistic one.

For answers to common skeptic concerns, see [FAQ for Skeptics](14-faq-for-skeptics.md).

## Plugin Dependencies and Graceful Degradation

The toolkit's full capabilities depend on two Cursor plugins and the custom MCP server:

| Component | When Missing | Impact |
|-----------|-------------|--------|
| **Compound Engineering** | Specialist quality gates are skipped | Code generation still follows rule directives but lacks multi-specialist validation |
| **Compound Knowledge** | Knowledge lookups return nothing | AI loses access to indexed architecture docs and ADR context |
| **MCP server** (simpler-grants-context) | Context enrichment calls fail | Agents can't load architecture sections or discover applicable rules dynamically |
| **GitHub MCP server** | PR review can't access diffs | PR review skill requires manual diff pasting |

**The toolkit degrades gracefully.** Without plugins, rules still activate, conventions are still enforced via ALWAYS/NEVER/MUST directives, and code examples still guide generation. The plugins add a quality *amplification* layer on top of the base conventions — they don't replace them.

For the full experience, install all plugins per the [Getting Started](03-getting-started.md) guide.

---

## See Also

- [What Is This Toolkit?](01-what-is-this-toolkit.md) -- overview and components
- [Prompt Engineering](08-prompt-engineering.md) -- getting the best results from AI assistance
- [FAQ for Skeptics](14-faq-for-skeptics.md) -- addressing common concerns
- [Back to documentation index](README.md)

---

*Previous: [11 -- PR Review Guide](11-pr-review-guide.md)* | *Next: [13 -- Troubleshooting](13-troubleshooting.md)*
