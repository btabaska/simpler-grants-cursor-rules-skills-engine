# Dead Code Finder

Identify unreferenced exports, components, and modules across the monorepo.

## What I Need From You

- Scope: `frontend`, `api`, or `all` (default).
- Optional path restriction.
- Optional `include-tests=true`.

## What Happens Next

1. Runs import-graph analysis per scope.
2. Cross-references candidates with feature-flag config.
3. Emits a ranked report (high/medium/low confidence) with evidence.
4. Does not delete anything.

## Tips

- Run `/skill-feature-flag-audit` first.
- Review each candidate in `git log` before deleting.
- Do not bulk-delete low-confidence items.
