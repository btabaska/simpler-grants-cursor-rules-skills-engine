# `release-notes-drafter` Agent — Usage Guide

## Purpose

Produce deterministic, user-facing release notes for simpler-grants-gov by querying merged PRs in a date range, categorizing them in Keep a Changelog format, and surfacing breaking changes and deprecations.

## When to Use

- Cutting a release
- Drafting an interim changelog for stakeholders
- Back-filling release notes for a missed cut

## When NOT to Use

- Sprint retrospectives (use `@agent-sprint-summary-generator`)
- Marketing announcements

## Invocation

```
/release-notes-drafter
@agent-release-notes-drafter
```

Provide the start/end dates or tags and an optional version.

## Output

`documentation/release-notes/<version>.md` plus an updated index. Categories follow Keep a Changelog. Every entry cites a PR number and author.

## Tips

- Use `breaking-change` and workstream labels to make grouping deterministic
- Include `BREAKING CHANGE:` blocks in PR bodies to guarantee surfacing
- Cross-link ADRs touched in the range so users can dig into rationale

## Pitfalls

- Don't let the agent invent entries — it will only output PRs in the queried range
- Don't skip the breaking-changes block; merge will surface them anyway
- Don't run before the prior release tag is recorded; the start anchor must exist
