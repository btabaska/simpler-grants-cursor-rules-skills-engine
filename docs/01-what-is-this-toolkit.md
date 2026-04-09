# What Is This Toolkit?

The Simpler.Grants.gov AI Coding Toolkit gives your AI assistant deep, specific knowledge of the
[HHS/simpler-grants-gov](https://github.com/HHS/simpler-grants-gov) codebase. It ships for
**either Cursor or Claude Code** (or both side-by-side) — the same rules, agents, skills, slash
commands, hooks, and MCP servers, translated into each assistant's native file layout. Pick your
assistant at install time with `./setup.sh --target=cursor|claude|both`. See
[`16-claude-code-vs-cursor.md`](16-claude-code-vs-cursor.md) for the parity matrix and known gaps.

The toolkit was built by systematically analyzing 1,459 merged pull requests from the project
over a 12-month period.

The result is not a generic "Python best practices" guide or a "Next.js tutorial." It is
a distilled encoding of how *this team* writes code — the decorator ordering in route
handlers, the three-schema form architecture, the service layer conventions, the way tests
are structured — captured in a format that either Cursor or Claude Code can use when
generating or reviewing code.

This document explains what the toolkit contains, how it was built, what it is not, and
why you might (or might not) find it useful.

---

## The Problem

Every mature codebase accumulates conventions that exist nowhere in official documentation. On simpler-grants-gov, those conventions are substantial:

**Tribal knowledge is the bottleneck.** The project has a Python + Flask backend, a Next.js + TypeScript frontend, Terraform infrastructure, and a PostgreSQL database accessed through SQLAlchemy with Alembic migrations. Each layer has its own patterns. A new developer has to learn that API route decorators must follow a specific top-to-bottom order (`@blueprint.METHOD`, `@blueprint.input`, `@blueprint.output`, `@blueprint.doc`, auth decorator, `@flask_db.with_db_session()`). They have to learn that frontend services use `requesterForEndpoint()` and live in server-only modules. They have to learn that form schemas use a three-layer architecture. None of this is obvious from reading the framework documentation.

Consider what happens when a developer needs to add a new API endpoint. They need to create files in `api/src/api/<domain>_v1/` following a specific naming convention (`<domain>_blueprint.py`, `<domain>_routes.py`, `<domain>_schemas.py`). The route handler must be thin — business logic belongs in the service layer under `api/src/services/`. The service function must take `db_session` as its first parameter. The Marshmallow schemas must use specific field types and validation patterns. The tests must use factory fixtures with `.build()` for unit tests and `.create()` for integration tests. That is six or seven files, each with its own conventions, for a single endpoint.

**Inconsistent conventions slow everyone down.** When two developers implement the same pattern differently, code review becomes a negotiation instead of a verification. Pull requests bounce back and forth over style and structure issues that could have been prevented if the conventions were explicit and available at the point of authoring. Reviewers spend time writing the same comments they wrote last week on a different PR, explaining the same conventions that exist only in their memory.

**Onboarding takes too long.** A developer joining the project faces weeks of ramp-up before they can confidently write code that passes review on the first attempt. That cost multiplies across every new team member and every contractor rotation. On a government project with periodic team changes, this is not a one-time cost — it is a recurring tax on delivery velocity.

**Generic AI gives generic advice.** Without project-specific context, an AI coding assistant will generate technically valid Python or TypeScript that violates every convention the team has established. It will use raw SQLAlchemy sessions instead of the `@flask_db.with_db_session()` decorator. It will create React client components when the project defaults to React Server Components. It will structure tests with `unittest` when the team uses `pytest` with factory-based fixtures. It will create error responses with ad-hoc JSON structures instead of using `raise_flask_error()` with `ValidationErrorDetail`. The code compiles, but it does not belong in this codebase.

---

## What the Toolkit Provides

The toolkit is organized as a **five-primitive system**. Every artifact in `.cursor/` belongs to exactly one of these primitives, and every primitive has a single activation model:

1. **Rules** (`.cursor/rules/*.mdc`) — passive context, auto-loaded by file glob.
2. **Agents** (`.cursor/agents/*.md`) — multi-step workflows, invoked by slash command, `@agent-name`, or by another agent as a quality-gate subagent.
3. **Skills** (`.cursor/skills/*/SKILL.md`) — reusable capabilities, invoked by agents or directly.
4. **Commands** (`.cursor/commands/*.md`) — slash-command entry points that bind a name to an agent or skill.
5. **Hooks** (`.cursor/hooks.json` + `.cursor/hooks/`) — deterministic, event-driven enforcement that runs without the AI choosing to.

The sections below walk each primitive in turn, plus three supporting layers (notepads, code snippets, MCP servers) that pre-date the five-primitive system but still ship with the toolkit.

### 39 Auto-Activating Domain Rules

These are `.mdc` files in `.cursor/rules/` that activate automatically based on the file you are editing. When you open a file matching `api/src/api/**/*.py`, the `api-routes.mdc` rule loads and tells the AI about decorator stack ordering, blueprint organization, thin route handlers, and the project's specific patterns — complete with code examples extracted from actual merged PRs.

The 39 rules cover the full stack: `api-routes`, `api-services`, `api-database`, `api-auth`, `api-validation`, `api-error-handling`, `api-form-schema`, `api-tests`, `api-adapters`, `api-search`, `api-tasks`, `api-workflow` on the backend; `frontend-components`, `frontend-hooks`, `frontend-services`, `frontend-i18n`, `frontend-tests`, `frontend-app-pages`, `frontend-e2e-tests`, `accessibility` on the frontend; plus `infra`, `ci-cd`, `cross-domain`, and `forms-vertical` for infrastructure, pipelines, shared conventions, and the forms subsystem respectively.

Each rule contains concrete directives like "ALWAYS use `raise_flask_error()` instead of raising raw HTTP exceptions" and "NEVER import client-side hooks in React Server Components," backed by references to the PRs where those patterns were established or enforced.

You do not need to memorize which rules exist or when they apply. Cursor reads the `globs` field in each `.mdc` file and loads the relevant rules automatically when you open a matching file. Edit a file in `api/src/api/`, and the API rules are silently loaded. Edit a file in `front/src/`, and the frontend rules activate instead. The AI's behavior changes based on context without any manual configuration.

### 51 Agents

Agents are Cursor subagents in `.cursor/agents/` that orchestrate multi-step workflows. Unlike auto-activating rules that provide passive context, agents actively guide the AI through a sequence of file creation and modification steps.

The `new-endpoint` agent, for example, asks you for a domain name, endpoint path, HTTP methods, and auth requirements, then walks the AI through creating the blueprint file, route handler, request/response schemas, service layer function, database queries, and tests — all following the project's conventions. The `test-generation` agent understands the difference between `pytest` patterns on the backend (factory `.build()` vs `.create()`, `db_session` fixtures) and Jest/Playwright patterns on the frontend (jest-axe accessibility checks, `render()` utilities).

The 52 agents fall into four categories:

- **9 original workflow agents** — `orchestrator`, `new-endpoint`, `code-generation`, `test-generation`, `migration`, `i18n`, `adr`, `debugging`, `refactor`.
- **26 extended workflow agents** — `pr-preparation`, `codemod`, `feature-flag`, `api-docs-sync`, `dependency-update`, `incident-response`, `runbook-generator`, `release-notes-drafter`, `changelog-generator`, `regression-detector`, `performance-audit`, `e2e-scenario-builder`, `visual-regression`, `test-plan-generator`, `load-test-generator`, `user-guide-updater`, `glossary-auto-updater`, `sprint-summary-generator`, `technical-rfc-template`, `adr-from-pr`, `good-first-issue`, `contributor-onboarding`, `authority-to-operate-checklist`, `fedramp-compliance-checker`, `privacy-impact-assessment`, `section-508-report-generator`.
- **11 quality-gate specialist subagents** — `accessibility-auditor`, `api-contract-checker`, `dependency-health-reviewer`, `documentation-staleness-detector`, `form-schema-validator`, `i18n-completeness-checker`, `pii-leak-detector`, `responsive-design-checker`, `sql-injection-scanner`, `test-quality-analyzer`, `uat-criteria-validator`. These are not invoked directly by users — they are called as quality gates by other agents.
- **6 read-only onboarding / learning agents** — `architecture-decision-navigator`, `code-review-learning-mode`, `convention-quick-lookup`, `good-first-issue-assistant`, `interactive-codebase-tour`, `pattern-catalog`. These never modify the working tree.

To invoke an agent, use the corresponding slash command (e.g., `/new-endpoint`, `/debug`, `/refactor`) or reference it by name in Cursor chat. The agent file contains the full workflow instructions, so the AI knows which questions to ask and which steps to follow.

### 25 Skills

Skills are reusable capabilities under `.cursor/skills/`, each containing a `SKILL.md` and (sometimes) supporting files. Unlike agents that orchestrate multi-step workflows, skills encapsulate focused capabilities that can be invoked standalone or called by agents.

The toolkit ships **4 multi-file workflow skills**:

- **PR Review** (`pr-review/`) — structured code review with a dispatch table, severity guide, voice guide, and checklist template
- **Quality Gate Pipeline** (`quality-gate/`) — multi-gate validation using Compound Engineering specialists, run by all agents after code generation; includes a specialist map, gate checklist, and parallel-execution guide
- **Feature Flag Cleanup** (`flag-cleanup/`) — workflow for safely removing fully-rolled-out feature flags, with a cleanup checklist and blast-radius template
- **Developer Onboarding** (`onboarding/`) — guided onboarding with setup checklist, architecture tour, and first-PR guide

Plus **21 single-file `skill-*` skills** for focused, repeatable tasks: `skill-accessibility-check`, `skill-api-contract-test`, `skill-bundle-size-check`, `skill-check-conventions`, `skill-cross-browser-checklist`, `skill-dead-code-finder`, `skill-diff-summary`, `skill-explain-codebase-area`, `skill-explain-pattern`, `skill-feature-flag-audit`, `skill-generate-factory`, `skill-generate-mock`, `skill-generate-story`, `skill-generate-test-data`, `skill-impact-analysis`, `skill-migration-safety-check`, `skill-openapi-sync`, `skill-run-relevant-tests`, `skill-sql-explain`, `skill-uat-checklist`, `skill-update-translations`.

See the [Skills Reference](skills-reference.md) for invocation details and use cases.

### 64 Slash Commands

Slash commands in `.cursor/commands/` provide quick invocation entry points. The toolkit ships one command per agent and one per `skill-*`, plus the original 12 commands (`/debug`, `/refactor`, `/new-endpoint`, `/generate`, `/test`, `/migration`, `/i18n`, `/adr`, `/review-pr`, `/check-conventions`, `/tooling-health-check`, `/explain-architecture`). The full command set is one-to-one with the agent and skill catalogs in `.cursor/agents/` and `.cursor/skills/`.

### 6 Hook Lifecycle Events

The hooks system in `.cursor/hooks.json` provides event-driven automation that runs automatically during development:

- **beforeShellExecution** — blocks dangerous commands, protects sensitive files
- **beforeMCPExecution** — restricts MCP tool access to project scope
- **beforeReadFile** — redacts secrets, blocks production credentials
- **beforeSubmitPrompt** — audit logging for session tracking
- **afterFileEdit** — auto-formatting, convention checks, import validation, accessibility checks, TODO scanning
- **stop** — session summary, test runner, coverage reporter, audit log finalization

Hooks run transparently via TypeScript dispatchers executed by Bun runtime.

### 6 Notepads

Notepads are pre-loaded context documents you can attach to a Cursor conversation to give the AI a dense briefing on a specific topic. They are not rules or instructions — they are reference material.

The `architecture-overview` notepad provides a condensed map of the entire project structure. The `new-api-endpoint` notepad is a checklist covering every file that needs to be created or modified when adding an endpoint. The `debug-api-error` notepad documents the error flow from `raise_flask_error()` through `ValidationErrorDetail` to the JSON response format, so the AI can help you trace failures through the stack.

The remaining notepads cover `new-frontend-page` (Next.js App Router conventions, USWDS component usage, server vs. client component decisions), `new-form-field` (the three-schema form architecture with form definition, API schema, and database schema), and `new-database-table` (SQLAlchemy model definition, UUID primary keys, `TimestampMixin`, and the corresponding Alembic migration).

The distinction between notepads and rules is intentional. Rules tell the AI what to do. Notepads give the AI (and you) background knowledge to draw on during a conversation. You can attach multiple notepads to a single conversation when working on a task that spans domains.

### 15 Code Snippets

Standard Cursor/VS Code snippets triggered by prefix. Type `sgg-route` and tab-complete to get a route handler skeleton that already has the correct decorator order, type hints, and docstring format. Type `sgg-service` for a service function with `db_session` as its first parameter. Type `sgg-model` for a SQLAlchemy model with UUID primary key and the project's `TimestampMixin`.

The full list: `sgg-route`, `sgg-service`, `sgg-model`, `sgg-schema`, `sgg-test`, `sgg-migration`, `sgg-log`, `sgg-error`, `sgg-component`, `sgg-client-component`, `sgg-hook`, `sgg-fetcher`, `sgg-i18n-key`, `sgg-test-component`, `sgg-test-e2e`.

These are intentionally minimal scaffolds. They give you the structure; you fill in the logic. Snippets and rules work together: the snippet gives you the skeleton, and the auto-activating rule ensures the AI fills in the details correctly when you ask it to expand the scaffold.

The snippet files are stored in `.cursor/snippets/` as standard VS Code `.code-snippets` JSON files — `python-api.code-snippets` for backend snippets and `typescript-frontend.code-snippets` for frontend snippets. You can inspect, modify, or extend them like any other snippet file.

### 3 MCP Servers

Model Context Protocol servers extend the AI's ability to fetch live context during a conversation. The toolkit configures three:

- **GitHub MCP** — allows the AI to read issues, PRs, and repository contents from `HHS/simpler-grants-gov` directly during a conversation.
- **Filesystem MCP** — gives the AI read access to local project files beyond the currently open editor tabs.
- **Custom `simpler-grants-context` MCP** — a project-specific server that provides structured data about the codebase architecture, module boundaries, and conventions that do not fit neatly into rule files.

MCP servers are configured in `.cursor/mcp.json`. They run as local processes and communicate with Cursor over stdin/stdout. The AI decides when to call them during a conversation — you do not need to invoke them manually.

### PR Review Skill

The `pr-review.mdc` rule implements a structured code review workflow with a dispatch table that routes different types of changes (API routes, database migrations, frontend components, infrastructure) to specialist sub-agents with domain-specific review logic. When reviewing a PR, the AI applies domain-specific checklists rather than generic "looks good" feedback: it checks decorator ordering on route handlers, verifies that migrations include both `upgrade()` and `downgrade()`, confirms that new frontend components default to server components, and validates that error handling uses the project's `raise_flask_error()` pattern.

The dispatch table works by examining which files were changed in the PR. A PR that modifies files in `api/src/api/` triggers the API route review checklist. A PR that adds an Alembic migration triggers the database migration review checklist. A PR that touches both gets both reviews. This means the review feedback is proportional to the scope of the change and specific to the domains involved, rather than running a generic checklist against every PR regardless of content.

### Required Cursor Plugins

The toolkit's quality gate pipelines depend on two Cursor community plugins:

- **Compound Engineering** — provides 15 specialist sub-agents (security-sentinel, architecture-strategist, codebase-conventions-reviewer, and 12 more). Every agent runs a multi-gate quality pipeline using these specialists. Every domain rule invokes specialists conditionally for complex changes.
- **Compound Knowledge** — provides documentation knowledge indexing. Rules and agents reference indexed project documentation for architectural context enrichment.

Without these plugins, the toolkit still works — rules activate, conventions are enforced, code examples are shown. But the specialist quality validation and knowledge-enriched context that make the toolkit exceptional will be missing.

---

## The Tech Stack

For reference, these are the technologies the toolkit encodes conventions for:

| Layer | Technology |
|-------|------------|
| Backend | Python 3 + Flask/APIFlask + SQLAlchemy + Marshmallow + Alembic |
| Frontend | Next.js + TypeScript + React Server Components + USWDS |
| Database | PostgreSQL on Amazon RDS |
| Infrastructure | Terraform + Docker on AWS ECS Fargate |
| Testing | pytest (backend), Jest + jest-axe (frontend unit), Playwright (E2E) |
| CI/CD | GitHub Actions with a three-job pipeline |

Key project constraints that influence many of the rules:

- **FedRAMP compliance** — security and audit requirements affect auth patterns, logging, and infrastructure configuration.
- **USWDS (U.S. Web Design System)** — legally required for the frontend; the toolkit's component rules enforce USWDS usage rather than custom styling.
- **Open source under CC0** — the entire codebase is public domain, which affects how dependencies are selected and how code is structured.
- **Legacy coexistence** — simpler-grants-gov runs alongside the legacy Grants.gov system (Oracle database), with data flowing through AWS DMS into PostgreSQL. The toolkit's database rules account for this migration context.

---

## At a Glance

For quick reference, here is everything in the toolkit:

| Component | Count | Location | Activation |
|-----------|-------|----------|------------|
| Auto-activating rules | 39 | `.cursor/rules/*.mdc` | Automatic (file glob match) |
| Agents (workflow + subagents + onboarding) | 51 | `.cursor/agents/*.md` | Slash command, `@agent-name`, or invoked by another agent |
| Skills | 25 | `.cursor/skills/*/SKILL.md` | Invoked by agents or directly |
| Slash commands | 64 | `.cursor/commands/*.md` | `/command-name` in chat |
| Hook lifecycle events | 6 | `.cursor/hooks.json` | Automatic (event-driven) |
| Notepads | 6 | `.cursor/notepads/*.md` | Attach to conversation |
| Code snippets | 15 | `.cursor/snippets/*.code-snippets` | Tab-completion (`sgg-` prefix) |
| MCP servers | 3 | `.cursor/mcp.json` | Automatic (AI-initiated) |
| MCP server tools | 10 | `mcp-server/src/index.ts` | AI-initiated during conversation |

The sections above explain each component in detail. The sections below explain how
they were created and what their limitations are.

---

## How This Was Built

The toolkit was not written from memory or from reading documentation. It was systematically extracted from the project's actual development history through a four-phase process.

### Phase 1: GitHub PR Extraction

The `research/extract.py` script pulled 1,459 merged pull requests from `HHS/simpler-grants-gov` via the GitHub API. For each PR, it captured the title, description, diff, file list, review comments, and review decisions. This raw data was stored in `research/extracted_data/`.

The extraction was scoped to merged PRs only — not open PRs, not closed-without-merge PRs. Merged PRs represent decisions the team actually made, not proposals that were abandoned. The review comments were particularly valuable: they reveal what reviewers corrected, which is a direct signal of what the team's conventions actually are versus what contributors initially assumed.

### Phase 2: Multi-Pass LLM Analysis

The extracted PR data was processed through multiple analysis passes using `research/prepare_batch.py`:

1. **Pattern discovery** — identify recurring code structures, naming conventions, file organization patterns, and review feedback themes across the full corpus of PRs.
2. **Validation** — cross-reference discovered patterns against the current state of the codebase to confirm they are still active (not deprecated or superseded by later PRs).
3. **Documentation generation** — produce structured rule files with concrete examples, directive language, and PR references.

The intermediate analysis outputs are in `research/analysis/`. This multi-pass approach is important because single-pass extraction tends to over-index on the most common patterns while missing less frequent but equally important conventions. The validation pass catches patterns that appear in the PR history but have since been superseded by architectural changes.

### Phase 3: Human Review

Generated rules were reviewed by team members who work in the codebase daily. Reviewers validated that the extracted patterns were accurate, that the directive language matched actual team expectations, and that no critical conventions were missing. Review artifacts are in `research/review/`.

This step matters. LLM-extracted patterns can be confidently wrong. A pattern that appeared in 40 PRs might have been deprecated by a single architectural decision. Human review catches those cases.

### Phase 4: Confidence Scoring and Rule Codification

Validated patterns were encoded as directives using explicit confidence language:

- **ALWAYS** — the pattern is universal in the codebase with no known exceptions. Example: "ALWAYS use UUID primary keys on database models."
- **NEVER** — the anti-pattern has been corrected in code review multiple times. Example: "NEVER use raw SQL queries; use SQLAlchemy ORM."
- **MUST** — the pattern is required for correctness, not just style. Example: "MUST include both `upgrade()` and `downgrade()` functions in Alembic migrations."

Each directive references the PRs that establish or enforce the pattern, so a developer who wants to understand *why* a rule exists can trace it back to the source.

Each directive also carries an implicit confidence level based on the number of PRs that support it and the recency of those PRs. A pattern supported by 50+ PRs over the last 6 months has higher confidence than one supported by 3 PRs from 11 months ago. This weighting influenced which patterns became ALWAYS/NEVER/MUST directives versus softer PREFER/CONSIDER recommendations.

The final rules were written as `.mdc` files in `research/cursor-rules-generated/`, then
copied into `.cursor/rules/` for use by the IDE.

### The Pipeline Is Repeatable

This is not a one-time extraction. The entire pipeline — `extract.py`, `prepare_batch.py`,
the analysis passes, the rule generation — can be re-run against new PR data. The
`research/refresh.sh` script automates this process. As the codebase evolves and new
conventions emerge from recent PRs, the rules can be updated to reflect the current state
of the project rather than a historical snapshot.

This repeatability is a deliberate design choice. A toolkit that cannot be updated is a
toolkit that will eventually mislead developers. The extraction pipeline ensures that
updating the rules is a mechanical process (run the scripts, review the output, merge the
changes) rather than a heroic effort that requires someone to manually audit the entire
codebase.

---

## What This Is NOT

Being clear about limitations is more useful than overselling capabilities.

**This is not a replacement for code review.** The toolkit helps you write code that is closer to correct on the first attempt. It does not eliminate the need for a human reviewer who understands the business logic, security implications, and architectural direction of the change. Use the PR review skill as a pre-review that catches convention violations before a human reviewer has to.

**This is not infallible.** The rules were extracted from historical PRs and validated by humans, but they can be wrong. Patterns evolve. A convention that was correct six months ago may have been superseded. If a rule conflicts with what a senior developer tells you, the senior developer is right. File an issue so the rule can be updated.

**This is not a substitute for understanding the code.** If you use the toolkit to generate code you do not understand, you are creating a maintenance problem. The toolkit accelerates developers who understand what they are building. It does not replace the need to understand it. Read the generated code. Understand why each line exists. If you cannot explain it, do not commit it.

**This is not sending your code anywhere for AI training.** The toolkit runs entirely within Cursor IDE on your local machine. The `.mdc` rule files are plain text in the repository. The MCP servers run locally. The snippets are standard VS Code snippet files. Cursor's own AI requests are subject to Cursor's privacy policy (and Cursor offers a privacy mode that prevents your code from being used for training) — the toolkit itself does not add any additional data transmission, telemetry, or external API calls beyond what Cursor already does.

**This is not a lock-in.** The toolkit is a collection of text files in standard formats. The `.mdc` rule files are Markdown with YAML frontmatter. The snippet files are VS Code JSON. The MCP configuration is a JSON file. If you decide to stop using the toolkit, you delete the `.cursor/` directory and nothing else changes. If you want to migrate to a different AI coding tool, the rule content is human-readable text that can be adapted to any format.

---

## For the Skeptic

If you are experienced and skeptical of AI coding tools, that skepticism is reasonable. Most AI coding demos show trivial examples that fall apart on real codebases. Here is what is different about this toolkit, addressed directly.

**"AI-generated code is always wrong in subtle ways."** Generic AI code frequently is. That is precisely the problem this toolkit solves. When the AI knows that route decorators must be in a specific order, that `db_session` must be the first parameter to service functions, and that frontend components must default to React Server Components, the "subtle wrongness" surface area shrinks significantly. The rules encode the project's actual patterns, not generic best practices. You should still review the output.

**"I can write code faster without AI getting in the way."** Perhaps. The toolkit is most valuable for tasks that are structurally repetitive but detail-sensitive: adding a new endpoint that touches seven files across three layers, writing tests that follow the project's factory pattern, creating a migration that needs both `upgrade()` and `downgrade()`. If you can write all of that from memory without checking existing examples, the toolkit saves you less time. If you occasionally have to look at an existing endpoint to remember the decorator order, the toolkit saves you more.

**"Rules go stale. This will be wrong in three months."** Correct, if not maintained. The extraction pipeline (`research/extract.py` and `research/prepare_batch.py`) is repeatable. When conventions change, the rules can be re-extracted from recent PRs, re-validated, and updated. Whether the team actually does this maintenance is an organizational decision, not a technical limitation. The `research/refresh.sh` script exists for exactly this purpose.

**"I don't want an AI making architectural decisions."** Neither does the toolkit. The rules encode existing decisions made by the team. The agents follow established patterns. The notepads provide reference information. Nothing in the toolkit invents new architecture. If you ask the AI to "design a new auth system," it will follow the existing JWT + API key multi-auth pattern documented in `api-auth.mdc` — because that is what the team has decided. If you want a different architecture, you override the AI and make that decision yourself.

**"How do I know the rules are actually correct?"** Every directive references the PRs it was extracted from. The rules in `.cursor/rules/` are plain text files you can read in five minutes. The extraction pipeline in `research/` is fully auditable. If a rule looks wrong, read it, check the referenced PRs, and either confirm it or fix it. There is no black box.

**"What if I disagree with a rule?"** Change it. The rules are text files in the
repository, version-controlled like everything else. If a convention has changed or a rule
is wrong, update the `.mdc` file, open a PR, and get it reviewed like any other code
change. The toolkit is a living document, not a decree.

**"This seems like a lot of overhead for an AI tool."** The overhead is front-loaded. The
extraction pipeline ran once and produced the initial rule set. Day-to-day usage requires
zero configuration — you open a file and the relevant rules load automatically. Periodic
maintenance (re-running the extraction pipeline when conventions change) is a team decision
about how current you want the rules to be. If you never update them, they still work;
they just gradually drift from current practice.

**"What about hallucinations?"** The toolkit reduces hallucinations by constraining the
AI's output space. Instead of inventing patterns, the AI follows documented conventions
with concrete examples. It can still hallucinate — particularly for business logic that
rules cannot capture — but it is significantly less likely to hallucinate *structural*
patterns like file organization, decorator ordering, or test setup. The rules act as
guardrails, not as a guarantee.

---

## Getting Started

If you have read this far and want to try the toolkit, the next step is the setup guide.
It takes about 10 minutes and includes verification exercises so you can confirm that the
rules are loading and the AI is following project conventions.

See [Getting Started](03-getting-started.md) for the step-by-step walkthrough.

If you want to understand the technical internals first — how rules are parsed, how MCP
servers communicate, how the dispatch table routes PR reviews — see
[How It Works](02-how-it-works.md).

---

## See Also

- [How It Works](02-how-it-works.md) — technical deep dive into every layer
- [Getting Started](03-getting-started.md) — setup and first-use walkthrough
- [FAQ for Skeptics](14-faq-for-skeptics.md) — answers to common concerns
- [Back to documentation index](README.md)
