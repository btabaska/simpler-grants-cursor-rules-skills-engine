# `convention-quick-lookup` Agent — Usage Guide

## Purpose

Give contributors fast, citable answers to "how do we handle X?" by searching the `.cursor/rules/*.mdc` files and the architecture guide. Read-only.

## When to Use

- Mid-implementation, you need the canonical pattern
- A reviewer cites a rule and you want the source
- Writing tests and looking for the structure convention
- Verifying the decorator stack or hook signature

## When NOT to Use

- For *why* a convention exists (use `@agent-architecture-decision-navigator`)
- For end-to-end implementation walkthroughs (use `@agent-interactive-codebase-tour`)
- For browsing before/after examples (use `@agent-pattern-catalog`)
- For debugging (use `@agent-debugging`)

## Invocation

```
/convention-quick-lookup
@agent-convention-quick-lookup "<question or keyword>"
```

## Examples

### Example 1 — How-to question
```
@agent-convention-quick-lookup how do we structure error responses
```

### Example 2 — Keyword
```
@agent-convention-quick-lookup decorator stack
```

### Example 3 — Layer
```
@agent-convention-quick-lookup frontend hooks fetch pattern
```

## Output Shape

Layer, rule file, one-paragraph canonical answer, a 3-line snippet quoted from the rule or a real source file, source citation, and a "see also" list of adjacent rules.

## Tips

- Be specific about the layer (api, frontend, forms, database)
- If the agent surfaces conflicting rules it will surface both rather than pick silently
- Pair with `/architecture-decision-navigator` to read the ADR behind a rule

## Pitfalls

- Will not generate new conventions
- Will not enforce conventions in CI — that is pre-commit and code review
- Will explicitly say so if no rule covers the topic
