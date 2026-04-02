<!--
title: PR Review Guide
description: Deep dive into the PR review skill — invocation, dispatch table, specialist protocol, example output, customization, and limitations.
-->

> **Before reading this:** Familiarity with [How It Works](02-how-it-works.md) (especially the PR Review section) and [Auto-Activating Rules](04-auto-activating-rules.md) will help. Neither is strictly required.

# PR Review Guide

The `pr-review.mdc` rule is the most complex artifact in the toolkit. It is a manually invoked agent -- roughly 300 lines of structured instructions -- that turns Cursor's AI into a multi-perspective code reviewer trained on the Simpler.Grants.gov codebase conventions.

This document covers everything: how to invoke the review, what happens behind the scenes, what the output looks like, how to customize it, and where it falls short.

---

## How to Invoke a PR Review

The rule file lives at `.cursor/rules/pr-review.mdc`. Its frontmatter:

```yaml
---
description: "Comprehensive PR review for simpler-grants-gov. Invoke manually when reviewing a pull request."
globs: []
alwaysApply: false
---
```

Because `globs` is empty and `alwaysApply` is false, the rule never activates on its own. You must invoke it explicitly.

### Method 1: Chat Invocation (Most Common)

Open Cursor Chat (Cmd+L / Ctrl+L) and type:

```
@pr-review Review this PR: <paste diff or describe changed files>
```

If you have the GitHub MCP server configured (see [How It Works](02-how-it-works.md)), you can reference a PR number:

```
@pr-review Review PR #482
```

The AI fetches the diff via the MCP server, loads the `pr-review.mdc` instructions, and begins the review.

### Method 2: Self-Review Before Opening a PR

You can review your own changes before pushing. In Chat:

```
@pr-review Review the diff of my current branch against main
```

Or paste the output of `git diff main...HEAD` directly into the chat. This is useful for catching convention violations before your teammates see them.

### Method 3: Scoped Review

If you only want feedback on a specific area:

```
@pr-review Review only the backend changes in this diff: <paste diff>
```

```
@pr-review Focus on accessibility in these frontend component changes: <paste diff>
```

The AI still loads the full review protocol but narrows its attention to what you asked for.

---

## What Happens When You Invoke It

The AI processes the review in four phases. Understanding these phases helps you interpret the output and know what to trust.

### Phase 1: Dispatch Table Matching

The AI reads the diff, identifies which files changed, and maps each file to its governing rule files using the dispatch table defined in `pr-review.mdc`. The full table is documented in [How It Works](02-how-it-works.md) and mirrors the [Auto-Activating Rules](04-auto-activating-rules.md) master dispatch table. The short version: backend files activate the matching `api-*.mdc` rules, frontend files activate `frontend-*.mdc` rules, infrastructure activates `infra.mdc`, CI config activates `ci-cd.mdc`, form-related paths activate `forms-vertical.mdc`, and `cross-domain.mdc` applies to every file.

A PR that touches `api/src/api/opportunities/opportunity_routes.py` and `frontend/src/components/OpportunityCard.tsx` activates `api-routes.mdc`, `api-error-handling.mdc`, `frontend-components.mdc`, and `cross-domain.mdc`. The AI loads and enforces every directive from those files.

### Phase 2: Specialist Execution Protocol

The AI reviews the diff from multiple specialist perspectives. These are not separate processes or API calls -- they are structured passes where a single AI analyzes the same diff through different lenses, then merges findings.

**Mandatory core specialists (every PR):** `codebase-conventions-reviewer` (dispatch table rules, highest priority), `security-sentinel` (auth, input validation, secrets), `performance-oracle` (query/render performance, N+1 risks), `code-simplicity-reviewer` (YAGNI, unnecessary abstraction), `architecture-strategist` (layer boundaries, pattern compliance).

**Language-specific specialists:** `kieran-python-reviewer` activates for Python files, `kieran-typescript-reviewer` for TypeScript/JavaScript files. If both languages appear, both run.

**Auto-activated specialists:** `data-integrity-guardian`, `data-migration-expert`, and `schema-drift-detector` activate for database migrations and model changes. `julik-frontend-races-reviewer` activates for frontend async/lifecycle changes. `pattern-recognition-specialist` activates for cross-module duplication concerns. If a specialist clearly does not apply, the AI skips it.

### Phase 3: Conflict Resolution and De-duplication

Multiple specialists often flag the same issue from different angles. The AI merges duplicate findings and prioritizes by impact:

1. Correctness, security, data loss (highest)
2. Regressions
3. Maintainability
4. Style (lowest)

The final output reads as one reviewer voice. You will not see specialist names in the comments -- everything is converted to the project's collaborative tone.

### Phase 4: Checklist and Output

The AI works through a nine-category checklist:

0. Codebase Convention Compliance (always runs first)
1. Code Quality and Readability
2. Potential Bugs and Edge Cases
3. Unit Testing Opportunities
4. Potential Regressions
5. Accessibility (frontend changes)
6. USWDS Component Usage (frontend changes)
7. Code Reuse and DRY Principles
8. Additional Quality Checks

Categories that do not apply to the PR are skipped.

---

## Complete Example Review

Here is what the output looks like for a hypothetical PR that adds a new `GET /v1/agencies/{agency_id}` endpoint and an `AgencyDetail` frontend component.

### Output: Rules Scan

> **Codebase rules scan:** Activated `api-routes.mdc`, `api-error-handling.mdc`, `api-services.mdc`, `frontend-components.mdc`, `cross-domain.mdc`. Found two convention violations in the route handler and one accessibility gap in the component.

### Output: Summary

> Overall, this PR adds a clean agency detail endpoint and a matching frontend component. The backend service layer looks solid and the test coverage is good. Two things need attention before merge: the decorator stack order in the route handler is wrong, and the component is using `"use client"` without needing client-side interactivity.

### Output: Inline Comments

> **File:** `api/src/api/agencies/agency_routes.py` **Line(s):** 14-22
>
> **bug:** Per our `api-routes` convention (Rule: Decorator Stack Order), decorators must go in this order: `@blueprint.get()`, `@blueprint.input()`, `@blueprint.output()`, `@blueprint.doc()`, auth decorator, `@flask_db.with_db_session()`. Right now `@blueprint.doc()` is above `@blueprint.output()`. We'll want to swap those two.

> **File:** `api/src/api/agencies/agency_routes.py` **Line(s):** 25-31
>
> **suggestion:** Per our `api-routes` convention (Rule: Thin Route Handlers), business logic should live in the service layer. The `if not agency: raise_flask_error(404, ...)` pattern is fine here since it's just a guard clause, but the `agency.to_dict()` transformation on line 29 should probably live in the service function. Would it make sense to move that?

> **File:** `api/src/services/agencies/get_agency.py` **Line(s):** 8
>
> **bug:** Per our `api-services` convention (Rule: db_session as First Parameter), service functions must always accept `db_session` as their first parameter. This function has `agency_id` first -- we'll want to swap the parameter order so the signature reads `def get_agency(db_session: db.Session, agency_id: uuid.UUID) -> Agency:`.

> **File:** `frontend/src/components/agencies/AgencyDetail.tsx` **Line(s):** 1
>
> **suggestion:** Per our `frontend-components` convention (Rule: Server Components by Default), this component doesn't appear to need `useState`, `useEffect`, or event handlers. Would it make sense to remove the `"use client"` directive and keep this as a React Server Component?

> **File:** `frontend/src/components/agencies/AgencyDetail.tsx` **Line(s):** 18
>
> **a11y:** The agency name is rendered as a `<div>` with a large font size. It should probably be a heading element (`<h1>` or `<h2>` depending on where it appears in the page hierarchy). Screen readers use heading structure for navigation.

> **File:** `api/tests/src/api/agencies/test_get_agency.py` **Line(s):** 12-40
>
> **testing:** The happy path test looks good. I don't see a test for the 404 case (requesting an agency that doesn't exist). That's a common edge case we'll want coverage for.

---

## How to Customize

### Adjusting Severity Levels

The severity policy is defined in the rule file itself. The defaults:

- High-confidence rule violation (no pending marker) -- `bug:` severity
- Medium-confidence rule violation (pending validation) -- `suggestion:` severity
- Low-confidence / emerging convention -- `nit:` severity

To change these, edit the "Codebase Convention Violations -- Severity Policy" section in `.cursor/rules/pr-review.mdc`. For example, if your team wants all convention violations treated as non-blocking during an adoption period, change the high-confidence mapping from `bug:` to `suggestion:`.

### Adding Domain-Specific Checks

To add a new domain to the dispatch table:

1. Create a new rule file, e.g., `.cursor/rules/api-notifications.mdc`, with the conventions for that domain.
2. Add a row to the dispatch table in `pr-review.mdc`:

```markdown
| `api/src/notifications/**/*.py` | `api-notifications.mdc` |
```

3. If you have a custom MCP server, update its `FILE_RULE_MAP` to include the same pattern.

The AI will now enforce your new rule file whenever a PR touches files in that directory.

### Adding Custom Checklist Items

The review checklist in `pr-review.mdc` has nine categories (numbered 0-8). Add new items to an existing category or create a new category:

```markdown
### 9. Performance Budget (Frontend Changes)

- Does the change add new client-side JavaScript bundles?
- Are images optimized and using next/image?
- Is any new third-party dependency larger than 50KB gzipped?
```

### Integrating with GitHub

With the GitHub MCP server configured, the AI can fetch PR diffs directly. The server is configured in `.cursor/mcp.json`:

```json
"github": {
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_PERSONAL_ACCESS_TOKEN": "${env:GITHUB_PAT}"
  }
}
```

Once configured, `@pr-review Review PR #482` fetches the diff, reads PR description and comments, and produces a review with full context. The AI cannot post comments back to GitHub -- all output stays in your Cursor chat window. You copy relevant comments to the PR manually.

---

## Interpreting Results

### Severity Prefixes

| Prefix | What it means | What to do |
|---|---|---|
| `bug:` | Likely functional, security, or data issue. Often tied to a high-confidence codified rule. | Fix before merge. These are team-agreed conventions, not opinions. |
| `a11y:` | Accessibility issue. Section 508 / WCAG 2.1 AA compliance gap. | Fix for user-facing changes. Federal projects have legal accessibility requirements. |
| `testing:` | Missing test coverage for new behavior or edge cases. | Add the suggested tests. Untested code is a regression waiting to happen. |
| `suggestion:` | Meaningful improvement. May reference a pending-validation convention. | Consider seriously, but non-blocking. Use your judgment. |
| `question:` | The AI is uncertain and wants clarification. | Answer the question. If the AI is confused, future reviewers might be too. |
| `nit:` | Minor style or preference. | Address if convenient. Never block a merge over a nit. |

### When to Override the AI

Override confidently when:

- The AI flags a convention violation, but the code intentionally deviates for a documented reason (add a comment explaining why).
- The AI suggests a pattern that doesn't apply to your specific case (e.g., suggesting `raise_flask_error()` in a CLI script that doesn't use Flask).
- The AI flags a performance concern that you have already benchmarked.
- The AI recommends extracting a shared utility, but the "duplication" is coincidental, not structural.

Investigate before overriding when:

- The AI flags a `bug:` severity item. These map to high-confidence, team-agreed rules. If you disagree, discuss with the team rather than silently dismissing.
- The AI flags a security concern. Even false positives are worth a second look.
- The AI identifies a missing `await` or unhandled promise rejection. These are easy to miss in manual review and the AI is often right.

---

## Common Review Patterns

### API Endpoint Review

When the diff includes files under `api/src/api/`, expect the AI to check:

- **Decorator stack order** -- `@blueprint.METHOD`, `@blueprint.input`, `@blueprint.output`, `@blueprint.doc`, auth decorator, `@flask_db.with_db_session()`. Exact top-to-bottom order.
- **Thin route handlers** -- no business logic in the handler, delegation to service functions under `src/services/<domain>/`.
- **Error handling** -- `raise_flask_error()` for all error responses, never bare `abort()` or `return jsonify({"error": ...})`.
- **Auth pairing** -- `@blueprint.doc(security=...)` paired with `@jwt_or_api_user_key_multi_auth.login_required`.
- **Type hints** -- `Mapped[T]` for model columns, proper schema types.

### Frontend Component Review

When the diff includes files under `frontend/src/components/`, expect:

- **Server Components by default** -- `"use client"` only when the component needs `useState`, `useEffect`, or event handlers.
- **USWDS compliance** -- USWDS components and design tokens preferred over custom CSS.
- **Accessibility** -- ARIA labels, keyboard navigation, heading hierarchy, `jest-axe` test coverage.
- **Domain-based organization** -- components live under `components/<domain>/`, not a flat directory.
- **Translation strings** -- externalized via the i18n system, not hardcoded English text.

### Infrastructure Review

When the diff includes files under `infra/`, expect:

- **Three-layer Terraform architecture** -- modules, environments, and shared resources at the correct layer.
- **No hardcoded values** -- configuration via variables, secrets via references, never inline.
- **State management** -- remote state configuration, no local state files committed.

### Database Migration Review

When the diff includes Alembic migration files, the AI auto-activates additional specialists:

- **`data-integrity-guardian`** -- checks for data loss risks in column drops or type changes.
- **`data-migration-expert`** -- checks for reversibility and existing data handling.
- **`schema-drift-detector`** -- checks that the migration matches the SQLAlchemy model definitions.

Expect the AI to ask whether the migration is reversible and whether it handles existing data gracefully.

### Three-Schema Form Review

When the diff includes files matching `**/form*/**/*`, the AI enforces `forms-vertical.mdc`:

- **Three-schema pattern** -- API schema, form schema, and UI schema remain separate.
- **Custom validator usage** -- validation logic in the correct schema layer.
- **Field mapping** -- consistent field naming across all three schemas.

---

## Limitations of AI Review

### What It Catches Well

- Convention violations against codified rules (decorator order, thin handlers, `db_session` parameter order, RSC default, `raise_flask_error` usage)
- Obvious bugs: missing null checks, unhandled promise rejections, missing `await`
- Accessibility gaps: missing ARIA labels, heading hierarchy, missing alt text
- Missing test coverage for new code paths
- Style and naming inconsistencies
- Common security antipatterns: SQL injection via string formatting, missing auth checks, exposed secrets

### What It Misses

- **Business logic correctness.** The AI does not know whether your grant application state machine should allow transitions from "submitted" to "withdrawn." It checks patterns, not domain semantics.
- **Performance at scale.** It flags N+1 patterns and missing indexes but cannot run benchmarks. A structurally fine query may be slow against 2 million rows.
- **Race conditions in distributed systems.** It catches obvious frontend race conditions (missing `useEffect` cleanup) but cannot reason about concurrent API requests, database locks, or cache invalidation.
- **Integration behavior.** It reviews files in isolation. It does not run the application or verify that component A works with service B.
- **Design intent.** It checks USWDS usage, not whether the page layout makes sense for users.
- **Subtle type issues.** It catches missing types and obvious `any` usage but may miss advanced generics bugs or conditional type edge cases.
- **Context beyond the diff.** It reviews changed lines and may not grasp implications for untouched code in distant modules.

### The Right Mental Model

Treat AI review as a thorough first pass from a reviewer who has memorized all the project's convention docs but has never run the application. It catches the things that are easy to miss when you are deep in implementation -- the decorator that is out of order, the missing `await`, the `"use client"` that is not needed. It does not replace the review from a teammate who understands the feature's purpose and can test it manually.

Use AI review to handle the mechanical checks so human reviewers can focus on design, correctness, and user experience.

---

## Cross-References

- [Auto-Activating Rules](04-auto-activating-rules.md) -- the rule files that the dispatch table references
- [Agents Reference](05-agents-reference.md) -- other manually invoked agents and how they differ from the PR review skill
- [Prompt Engineering](08-prompt-engineering.md) -- techniques for writing effective prompts, including scoped review requests
- [How It Works](02-how-it-works.md) -- the technical foundation: how rules load, how MCP servers provide context

---

[Previous: Multi-File Workflows](10-multi-file-workflows.md) | [Next: Capabilities and Limitations](12-capabilities-and-limitations.md) | [Back to documentation index](README.md)
