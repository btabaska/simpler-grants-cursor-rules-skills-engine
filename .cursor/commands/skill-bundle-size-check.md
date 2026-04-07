# Bundle Size Check

Compare Next.js bundle sizes against a baseline and flag oversize imports.

## What I Need From You

- Optional baseline ref (default `origin/main`).
- Optional budget in KB (default 200).
- Optional route subset (e.g. `/search,/opportunity/[id]`).

## What Happens Next

1. Runs the Next.js production build (or reuses `.next/`).
2. Parses build manifests, diffs against the baseline.
3. Identifies top offending modules per over-budget route.
4. Emits a route-by-route delta table with remediation hints.

## Tips

- Run after every dependency add or upgrade.
- Pair with `/skill-dead-code-finder` to remove what the offender replaced.
- Treat any route > 200 KB first-load as a block.
