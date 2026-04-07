# `architecture-decision-navigator` Agent — Usage Guide

## Purpose

Answer "why did we choose X?" by reading the simpler-grants-gov ADR catalog and surfacing the Context, Decision, Rationale, Alternatives Considered, and Consequences. Read-only.

## When to Use

- A contributor asks why a particular technology, library, or pattern was chosen
- Reviewing a PR that touches a decision boundary
- Onboarding to internalize the team's architectural philosophy
- Evaluating whether an existing constraint still applies

## When NOT to Use

- For *how* to follow a convention (use `@agent-convention-quick-lookup`)
- For implementation walkthroughs (use `@agent-interactive-codebase-tour`)
- For code generation or debugging
- To propose new ADRs

## Invocation

```
/architecture-decision-navigator
@agent-architecture-decision-navigator <question or technology>
```

## Examples

### Example 1 — Direct question
```
@agent-architecture-decision-navigator why Flask instead of FastAPI
```

### Example 2 — Library lookup
```
@agent-architecture-decision-navigator Marshmallow
```

### Example 3 — Architectural concern
```
@agent-architecture-decision-navigator how do we run background jobs
```

## Output Shape

Per ADR: status, file path, governing rule file, Context, Decision, Rationale, Alternatives Considered, Consequences, Related ADRs, and pointers to where the decision shows up in code.

## Tips

- Ask one decision at a time
- If the agent reports no matching ADR, treat that as ground truth — do not push it to invent one
- Pair with `@agent-convention-quick-lookup` to see the rule that operationalizes the decision

## Pitfalls

- Will refuse to propose new ADRs
- Will not contradict a Superseded ADR; cites the superseder instead
- Treats `Proposed` ADRs as non-authoritative
