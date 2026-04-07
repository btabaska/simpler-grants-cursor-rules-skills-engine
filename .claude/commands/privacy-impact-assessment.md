# Privacy Impact Assessment

Draft an HHS Privacy Impact Assessment from a simpler-grants-gov PR diff that touches PII.

## What I Need From You

1. `gh pr view <num> --json` plus `gh pr diff <num>` (preferred)
2. A unified diff plus PR description
3. A description of the data flow you're adding or changing

If purpose, retention, or sharing is not stated, the agent will ask before drafting.

## What Happens Next

The Privacy Impact Assessment Agent will:
1. Scan the diff for PII fields (name, SSN, ITIN, banking, login.gov IDs, etc.)
2. Cross-reference RBAC enforcement points (AC-2, AC-3, AC-5)
3. Extract purpose, retention, and sharing from the PR body
4. Identify privacy risks and propose mitigations grounded in repo patterns
5. Write a Draft PIA to `documentation/compliance/pia/PR-<num>-pia.md`

## Tips

- Name retention windows explicitly in the PR body
- Flag any data leaving the FedRAMP boundary; the agent will surface it under sharing
- Drafts are never auto-approved; the Privacy Officer signs off
