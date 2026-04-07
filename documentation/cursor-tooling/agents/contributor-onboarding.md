# `contributor-onboarding` Agent — Usage Guide

## Purpose

Give a new contributor a guided, full-stack, code-reading tour of a single feature in simpler-grants-gov. Read-only by design — this agent shortens the "where do I even start" phase by walking real files in a deliberate order and explaining patterns at each layer.

## When to Use

- Day one on the project
- Entering an unfamiliar area of the codebase (frontend dev touching the API, or vice versa)
- Reviewing a PR in a feature area you don't own
- Preparing to implement a similar feature and wanting to see the canonical example

## When NOT to Use

- You need to write or modify code (use `@agent-code-generation`, `@agent-new-endpoint`, or `@agent-refactor`)
- You need environment setup help (see the contributor guide in the main README)
- You're debugging a failure (use `@agent-debugging`)

## Built-In Tours

| Tour | Trace |
|------|-------|
| `opportunity-search` | Search page → search hook → `GET /v1/opportunities` → search service → OpenSearch adapter → `Opportunity` model |
| `apply-for-grant`    | Application form → form schema → `POST /v1/applications` → application service → validation → `Application` model + DB write |
| `login`              | Auth callback → session hook → auth service → Login.gov OIDC adapter → session store |
| `agency-profile`     | Agency page → profile loader → `GET /v1/agencies/<id>` → agency service → `Agency` model |

## Invocation

```
/onboarding
@agent-contributor-onboarding <tour name, feature name, or URL>
```

## Examples

### Example 1 — Default tour

```
@agent-contributor-onboarding default
```

Result: runs `opportunity-search`, the canonical end-to-end example.

### Example 2 — Named built-in

```
@agent-contributor-onboarding apply-for-grant
```

Result: 6-layer walkthrough of the application submission path, citing the rule file at each layer.

### Example 3 — Custom feature

```
@agent-contributor-onboarding I want to understand how agency users edit their profile, from the settings page to the database
```

Result: agent greps for the settings page entry point, confirms the file, then traces it layer by layer. If the entry point is ambiguous, it asks before starting.

### Example 4 — From a URL

```
@agent-contributor-onboarding Trace what happens when I POST the form at /apply/123
```

Result: maps the URL to the Next.js route, then walks the stack.

## Output Shape

A markdown document with one section per layer, each citing:
- The file path and line range
- The rule file that governs that layer
- The architectural constraint (FedRAMP, USWDS, accessibility, Grants.gov coexistence) it exists to satisfy

Closes with an example payload traced back up the stack and a "Where to Go Next" list.

## Tips

- Tell the agent your background — it weights the explanations toward the layers least familiar to you
- After the tour, drill into the layer that was least clear; the agent keeps context
- Pair with the `architecture-decision-navigator` onboarding skill to read the ADRs behind each layer's choices

## Pitfalls

- This agent will refuse to write files — if you want a change, switch to a write-capable agent
- For features with no clean single entry point, the tour will stall on ambiguity rather than guess
- It won't cover infrastructure (Terraform, CI/CD); those have their own agents and rules
