# `section-508-report-generator` Agent — Usage Guide

## Purpose

Convert jest-axe and pa11y JSON output into a Section 508 / VPAT 2.4 Rev 508 conformance report mapped to WCAG 2.1 A/AA, with conformance claims, prose, and a prioritized remediation backlog.

## When to Use

- Before a release that requires updated Section 508 documentation
- After a significant frontend change that may affect accessibility
- When compliance asks for current VPAT excerpts

## When NOT to Use

- Manual screen-reader or keyboard audits (the agent only ingests automated output)
- Fixing accessibility violations (use `@agent-refactor`)

## Invocation

```
/section-508-report-generator
@agent-section-508-report-generator
```

Provide jest-axe and/or pa11y JSON paths and the routes scanned.

## Output

`documentation/compliance/section-508/<date>-vpat.md` containing the VPAT 2.4 Rev 508 chapter structure, per-criterion conformance prose, and a remediation backlog ordered by impact. Every claim cites the test artifact, rule ID, selector, and `path:line`.

## Tips

- Run pa11y across representative routes, not just the home page
- Keep test artifacts at stable paths so citations resolve later
- Pair with `frontend-app-pages.mdc` and `frontend-components.mdc` rules to ground remediation suggestions

## Pitfalls

- Don't claim Supports manually — let the agent's evidence rule decide
- Don't drop AAA findings without noting them in Open Questions
- Don't omit the artifact paths from the input; provenance is mandatory
