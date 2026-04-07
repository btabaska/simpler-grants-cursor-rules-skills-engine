# `pattern-catalog` Agent — Usage Guide

## Purpose

Browse a curated catalog of simpler-grants-gov implementation patterns. For each request the agent quotes a real anti-pattern alongside the real correct pattern with file paths and line ranges, and cites the governing rule file. Read-only.

## When to Use

- Mid-implementation, you want a reference for correct structure
- During code review, you want to point at a pattern instead of explaining it
- Onboarding a frontend or backend engineer to recurring patterns
- Learning the three-schema forms architecture

## When NOT to Use

- For convention text only (use `@agent-convention-quick-lookup`)
- For *why* a pattern exists (use `@agent-architecture-decision-navigator`)
- For full request flow tracing (use `@agent-interactive-codebase-tour`)
- For debugging

## Pattern Coverage

- **API:** `api-route-thin`, `service-function`, `database-query`, `lookup-table`, `error-response`, `soft-delete-query`
- **Frontend:** `server-component`, `server-fetch`, `client-fetch`, `domain-organization`, `ssr-safe-uswds-wrapper`
- **Database:** `model-structure`, `migration-naming`
- **Forms:** `three-schema-form`, `form-validation`

## Invocation

```
/pattern-catalog
@agent-pattern-catalog <pattern name or keyword>
```

## Examples

### Example 1 — Pattern name
```
@agent-pattern-catalog api-route-thin
```

### Example 2 — Keyword
```
@agent-pattern-catalog soft delete
```

### Example 3 — Layer
```
@agent-pattern-catalog forms validation
```

## Output Shape

Pattern name, layer, governing rule, real anti-pattern snippet (with citation), real correct-pattern snippet (with citation), key differences, source rule section, and 2 related patterns.

## Tips

- Ask for one pattern per invocation
- The agent will clearly label any synthesized snippet — real code is the default
- Pair with `@agent-code-review-learning-mode` when a reviewer cites a pattern by name

## Pitfalls

- Will not generate new patterns
- Will not invent file paths or line numbers
- Will tell you when no true anti-pattern exists in the repo and clearly label any hypothetical
