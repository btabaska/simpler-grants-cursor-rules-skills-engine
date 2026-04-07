# `sprint-summary-generator` Agent — Usage Guide

## Purpose

Produce a concise sprint summary for stakeholders from merged PRs in a sprint window. Buckets work as Feature / Operational / Quality / Docs / Tech Debt and surfaces highlights, risks, and follow-ups.

## When to Use

- End of sprint, before retrospective
- Stakeholder update emails
- Internal status reports

## When NOT to Use

- Release cuts (use `@agent-release-notes-drafter`)
- Personnel evaluation or velocity reporting

## Invocation

```
/sprint-summary-generator
@agent-sprint-summary-generator
```

Provide sprint dates and optional filters.

## Output

`documentation/sprint-summaries/sprint-<n>-<date>.md` with highlights, buckets, quality signals, risks, and contributor list. Every claim cites a PR.

## Tips

- Tag PRs with workstream labels to keep grouping clean
- The agent skips PRs outside the window — set dates carefully
- Use the same labels release notes use so the two views stay aligned

## Pitfalls

- Don't expand into velocity or story-point reporting — out of scope
- Don't omit Risks and Follow-ups; they drive the retro
