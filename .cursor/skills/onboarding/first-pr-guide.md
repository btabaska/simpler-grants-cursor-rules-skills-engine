# First PR Guide

How to make your first contribution to simpler-grants-gov.

## Step 1: Pick an Issue

Look for issues labeled `good first issue` or `starter task` in the GitHub repo. Good first PRs include:
- Adding a missing test case
- Fixing a typo in documentation
- Adding a translation key
- Small bug fixes with clear reproduction steps

## Step 2: Create a Branch

```bash
git checkout -b <your-name>/<issue-number>-<short-description>
```

Example: `git checkout -b jane/1234-fix-search-filter`

## Step 3: Use the Toolkit

Depending on your task, use the appropriate command:
- Bug fix → `/debug` to investigate, then fix
- New test → `/test` to generate test scaffolding
- New translation → `/i18n` to add text properly
- Code changes → `/generate` or edit manually with rules auto-activating

## Step 4: Validate Your Changes

Before submitting, run the quality checks:
- `/check-conventions` on each changed file
- Run tests: `cd api && make test` or `cd frontend && npm test`
- Run linting: `cd api && make lint` or `cd frontend && npm run lint`

## Step 5: Submit the PR

PR title format: `[Issue N] Description`

Example: `[Issue 1234] Fix search filter not clearing on page navigation`

Include in the PR description:
- What the change does
- How to test it
- Any relevant screenshots (for UI changes)

## Step 6: Address Review Feedback

Your PR will be reviewed using the project's review standards (the PR Review skill). Common feedback areas:
- Convention compliance (naming, patterns, file placement)
- Test coverage
- Accessibility (for frontend changes)
- Error handling patterns

Don't worry about getting everything perfect on the first try — the review process is collaborative.
