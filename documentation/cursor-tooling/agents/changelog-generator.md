# `changelog-generator` Agent — Usage Guide

## Purpose

Draft a categorized, human-readable release section for `CHANGELOG.md` from the merged PRs since a given cutoff. The agent never invents version numbers or release dates — you supply them.

## When to Use

- Cutting a release and you want a first-pass changelog draft
- Auditing what shipped in a date range
- Preparing release notes for a stakeholder summary

## When NOT to Use

- Backfilling past release sections (the agent only appends to the top)
- Tagging or publishing a release (out of scope)
- Generating internal sprint summaries (use `sprint-summary-generator` instead)

## Invocation

```
/changelog
@agent-changelog-generator <cutoff + version + date>
```

## Examples

### Example 1 — Since a date

```
@agent-changelog-generator Generate v1.2.0 dated 2026-04-15 from PRs merged since 2026-03-01
```

Result: queries `gh pr list --search 'merged:>2026-03-01'`, categorizes ~40 PRs, presents the draft with per-category counts, then writes after confirmation.

### Example 2 — Since previous version tag

```
@agent-changelog-generator Generate v1.2.0 dated today since v1.1.0
```

Result: resolves `v1.1.0` tag date via `gh release view v1.1.0`, then proceeds as in Example 1.

### Example 3 — Scoped by label

```
@agent-changelog-generator Generate v1.2.0-frontend dated 2026-04-15 since 2026-03-01, only label:frontend
```

Result: appends `--label frontend` to the search; output omits backend categories.

### Example 4 — Audit only

```
@agent-changelog-generator Show me all merged PRs since 2026-03-01 grouped by category, do not write
```

Result: prints the categorized draft without modifying `CHANGELOG.md`.

## Categorization Rules

Priority order (highest first): Security → Breaking Changes → Features → Bug Fixes → Performance → Accessibility → Documentation → Infrastructure → Other. A PR maps to exactly one category. Multiple labels: highest-priority wins.

## Tips

- Run after the release branch is cut and frozen, so the PR set is stable
- If a PR title is opaque, the agent reads the body; if still unclear, it parks the PR under `## Needs Triage`
- For security entries, manually re-read for embargoed CVE detail before publishing

## Pitfalls

- The agent never silently drops a PR — if the count doesn't match `gh pr list`, that is a defect, not a feature
- External contributors get `@login` credit; internal authors do not
- Empty categories are omitted from the output
