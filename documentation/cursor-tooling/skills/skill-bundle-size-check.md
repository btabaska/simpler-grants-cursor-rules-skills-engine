# `skill-bundle-size-check` Skill — Usage Guide

## Purpose

Catch Next.js bundle-size regressions locally before they hit CI. Produces a per-route delta report versus a baseline and names the top offending modules.

## When to Use

- After adding or upgrading a frontend dependency.
- Before merging PRs that touch `frontend/src/` imports.
- Pre-release perf sweep.

## When NOT to Use

- Backend-only changes.
- Storybook-only changes.
- While iterating on a branch (too much noise).

## Invocation

```
/skill-bundle-size-check
@skill-bundle-size-check baseline=origin/main budget=200
@skill-bundle-size-check routes=/search,/opportunity/[id]
```

## Examples

### Example 1 — Dependency add

Added `chart.js`. Report shows `/dashboard` +47 KB; recommends dynamic import.

### Example 2 — Over-budget

`/search` at 218 KB vs 200 KB budget. Top offender: full `lodash` import. Fix: `lodash-es` + named imports.

### Example 3 — Route subset

`routes=/opportunity/[id]` to scope a detail-page optimization.

### Example 4 — Pre-release sweep

All routes within budget, no deltas > 5 KB. Ship with confidence.

## Tips

- Always compare against `origin/main`, not a feature branch.
- Regenerate `.next/` when lockfile changes, else results lie.
- First-load JS is what matters for LCP; ignore async chunks in the headline number.

## Pitfalls

- Do not trust a stale `.next/` cache across branch switches.
- Budget breaches are blocking; do not override without a perf waiver.
- Dynamic imports reduce first-load, not total bytes — still watch async chunk growth.
