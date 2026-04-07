# github-issues

## Purpose
Conventions for GitHub issue templates, the PR template, labels, commit message style, and issue/PR automation workflows.

## Scope / Globs
`.github/ISSUE_TEMPLATE/**/*`, `.github/PULL_REQUEST_TEMPLATE*`, `.github/workflows/**/*.yml`

## Conventions Enforced
- YAML form issue templates with required fields
- PR template with linked issue, tests, screenshots, a11y + privacy notes
- Canonical label set; conventional commit-style titles
- Private advisory process for security issues
- CC0-compatible license review for imported content
- Workflows pinned by SHA, least-privilege `permissions:`

## Examples
Correct: `Closes #123` in PR body; `feat: add saved search endpoint` title.
Incorrect: freeform bug report with no reproduction fields.

## Related Rules
`ci-cd`, `security`, `data-privacy`, `fedramp`, `accessibility`.
