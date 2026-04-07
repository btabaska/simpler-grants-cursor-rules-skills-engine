# Release Notes Drafter

Generate user-facing release notes for simpler-grants-gov from merged PRs in a date range.

## What I Need From You

1. A start date / tag and end date / tag (or "since last release")
2. Optional version string
3. Optional filters (workstream, contributor, feature area)

## What Happens Next

The Release Notes Drafter Agent will:
1. Pull merged PRs in the range and categorize each as Added / Changed / Deprecated / Removed / Fixed / Security
2. Group entries by feature area (Opportunities, Applications, Auth, Forms, Workspace, Infra, Docs)
3. Surface breaking changes and deprecations at the top
4. Cite PR numbers, authors, and any ADRs / migrations / runbooks touched
5. Write `documentation/release-notes/<version>.md` in Keep a Changelog format

## Tips

- Tag PRs with `breaking-change` or include a `BREAKING CHANGE:` block so the agent surfaces them
- Workstream labels make categorization deterministic
- Pair with the Sprint Summary Generator for retros
