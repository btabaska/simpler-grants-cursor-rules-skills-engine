# `technical-rfc-template` Agent — Usage Guide

## Purpose

Generate a structured Technical RFC for proposed changes that have not yet been decided. Pre-populates project constraints and starting alternatives so the author can focus on the proposal.

## When to Use

- A non-trivial change that needs team discussion before implementation
- Cross-domain changes (api + frontend, or infra + api)
- Anything affecting the FedRAMP boundary, auth, data model, or accessibility posture

## When NOT to Use

- A decision already made — use `@agent-adr-from-pr` or `@agent-adr`
- A small refactor handled in code review

## Invocation

```
/technical-rfc-template
@agent-technical-rfc-template
```

Provide the problem statement, author, and scope.

## Output

`documentation/rfcs/RFC-<NNNN>-<title>.md` with Status: Draft, the next sequential number, all sections populated, and at least two starting alternatives traced to existing patterns.

## Tips

- The agent infers scope from keywords if not given
- Constraints are seeded from `get_conventions_summary()` so you don't forget FedRAMP / 508 / USWDS
- Pair with `@agent-architecture-decision-navigator` to find related ADRs

## Pitfalls

- Don't accept the seeded alternatives as final — they are starting drafts
- Don't change Status from Draft inside the agent; consensus happens in PR review
- Don't reuse RFC numbers; the agent enforces monotonic numbering
