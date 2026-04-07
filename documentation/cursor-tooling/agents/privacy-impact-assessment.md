# `privacy-impact-assessment` Agent — Usage Guide

## Purpose

Detect PII exposure in a simpler-grants-gov PR diff and emit a draft HHS Privacy Impact Assessment covering data elements, purpose, retention, sharing, access controls, risks, and mitigations.

## When to Use

- Any PR touching `api/src/db/models`, `api/src/api`, `api/src/services`, or `frontend/src/services` that reads or writes applicant data
- Adding a new data export, report, or external integration
- Back-filling PIA documentation for a merged change

## When NOT to Use

- Pure infrastructure changes (use `@agent-fedramp-compliance-checker`)
- PRs with no PII surface

## Invocation

```
/privacy-impact-assessment
@agent-privacy-impact-assessment
```

Provide a PR number, JSON view, or unified diff plus PR description.

## Output

`documentation/compliance/pia/PR-<num>-pia.md` containing the standard HHS PIA sections, with `path:line` evidence for every PII field, NIST control mapping for access controls, and an Open Questions block for the Privacy Officer.

## Tips

- State purpose, retention, and sharing in the PR body — the agent extracts; it does not invent.
- Tag fields PII in the model layer so future PIAs catch them automatically.
- Pair with `@agent-authority-to-operate-checklist` for the full compliance picture.

## Pitfalls

- Don't accept "n/a" for retention or purpose — the agent will block.
- Don't approve the PIA in this tool; the Privacy Officer signs off.
- Don't omit external sharing destinations (logs, analytics, email gateways count).
