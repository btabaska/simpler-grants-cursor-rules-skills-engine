# `user-guide-updater` Agent — Usage Guide

## Purpose

Catch every user-facing guide section that references a changed feature and draft paragraph-level updates in the guide's existing voice. Prevents documentation drift without hand-grepping.

## When to Use

- A user-visible workflow changed and you need to sweep the docs
- A noun was renamed ("opportunity" → "funding opportunity") and you need consistency
- A UI flow was reordered and the stepwise guide instructions must match
- You need a reviewable diff of proposed guide edits

## When NOT to Use

- The change is API-only (use `@agent-api-docs-sync`)
- You need screenshots refreshed — this agent flags them but does not touch images
- You need translations updated — flagged as follow-up only
- You need a changelog entry (use `@agent-changelog-generator`)

## Invocation

```
/user-guide-update
@agent-user-guide-updater I changed <feature>. Update affected guides.
```

## Examples

### Example 1 — Search filter rework
```
@agent-user-guide-updater I refactored the opportunity search filters into a new sidebar UI. Update affected guides.
```
Result: 4 guide pages identified, 9 paragraphs rewritten, 2 screenshots flagged for refresh.

### Example 2 — Terminology rename
```
@agent-user-guide-updater We renamed "applications" to "submissions" across the product. Update the user guides.
```
Result: 12 files touched, consistent rename throughout, i18n follow-up flagged.

### Example 3 — Workflow reorder
```
@agent-user-guide-updater The save-draft step now happens before review, not after. Update the application guide.
```
Result: stepwise instructions rewritten in two guides, before/after diff blocks emitted.

### Example 4 — Scoped sweep
```
@agent-user-guide-updater Scope to docs/user-guide/search/. I changed how sort order persists across sessions.
```
Result: narrow sweep, one guide page updated, translation follow-up flagged.

## Tips

- Describe the change in the same nouns the guide uses
- Use before/after summaries to speed classification
- Review the follow-up list — screenshots and translations still need human hands

## Pitfalls

- Don't accept rewrites whose tone drifts from the surrounding paragraphs
- Don't let the agent touch API reference material
- Don't skip the translation follow-up check for i18n-aware features
