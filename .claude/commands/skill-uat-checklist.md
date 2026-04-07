# UAT Checklist

Generate a User Acceptance Testing checklist from a feature spec, user story, or PR.

## What I Need From You

- A source: path to a user story, ADR, PR description, or feature spec (or active editor text).
- Optional: `flow=<named-flow>`, `scope=frontend|api|e2e`.

## What Happens Next

1. Extracts acceptance criteria, roles, and edge cases from the source.
2. Identifies affected surfaces from the linked PR diff.
3. Generates eight fixed sections: preconditions, happy path, edge cases, accessibility, data handling, cross-browser, rollback, sign-off.
4. Cross-references `documentation/rules/data-privacy.mdc` for PII and audit rows.
5. Emits a Markdown checklist ready to paste into a sign-off doc.

## Tips

- Run when a PR is labeled `ready-for-uat`.
- Pair with `/skill-accessibility-check` and `/skill-cross-browser-checklist` for the QA pass.
- Edit the generated checklist freely — it is a template, not a contract.
- For API-only deliveries, set `scope=api` to suppress cross-browser rows.
