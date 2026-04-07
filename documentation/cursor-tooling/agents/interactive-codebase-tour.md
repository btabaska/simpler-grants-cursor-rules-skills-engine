# `interactive-codebase-tour` Agent — Usage Guide

## Purpose

Trace one canonical request flow through simpler-grants-gov from the frontend page to the database and back, layer by layer, with file paths and rule citations. Complements `contributor-onboarding`, which tours a feature area instead of a single request.

## When to Use

- New contributor onboarding to the full stack
- Mapping a frontend form field to a database column
- Learning the three-schema forms architecture
- Understanding "where does this data come from?" for an unfamiliar response

## When NOT to Use

- Code generation or refactors
- Debugging a failing test (use `@agent-debugging`)
- Architectural rationale (use `@agent-architecture-decision-navigator`)
- Feature-area tours (use `@agent-contributor-onboarding`)

## Built-In Flows

| Flow | Trace |
|---|---|
| `login-and-fetch-opportunities` | Login form → auth callback → session hook → `GET /v1/opportunities` → search service → OpenSearch adapter → `Opportunity` model |
| `submit-grant-application` | Application form → three-schema forms → `POST /v1/applications` → application service → form validation → `Application` model + DB write |
| `search-for-grants` | Search page → `useClientFetch` → `GET /v1/opportunities/search` → search service → OpenSearch query |

## Invocation

```
/interactive-codebase-tour
@agent-interactive-codebase-tour <flow name or "default">
```

## Examples

### Example 1 — Default
```
@agent-interactive-codebase-tour default
```

### Example 2 — Built-in
```
@agent-interactive-codebase-tour submit-grant-application
```

### Example 3 — Custom
```
@agent-interactive-codebase-tour trace what happens when I click Save Draft on /apply/123
```

## Output Shape

Markdown with one section per layer, each citing the file path, line range, governing `.cursor/rules/*.mdc`, and the architectural constraint (FedRAMP, USWDS, accessibility, Grants.gov coexistence) it satisfies. Closes with a payload round-trip and a "Where to Go Next" list.

## Tips

- Pick one flow per invocation
- After the tour, drill into the layer that confused you most
- Pair with `@agent-architecture-decision-navigator` to read the ADRs behind each layer

## Pitfalls

- Will refuse to write code
- Will stall on ambiguous custom flows rather than guess
- Does not cover infrastructure (Terraform, CI/CD)
