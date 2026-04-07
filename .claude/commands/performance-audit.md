# Performance Audit

Audit a specific endpoint or page for common performance issues: N+1 queries, missing indexes, wasteful re-renders, bundle bloat, and unoptimized images. Delegates deep analysis to `performance-oracle` and `pattern-recognition-specialist`.

## What I Need From You

1. **Target** — endpoint path or page file
2. **Concern** (optional) — `n+1`, `re-renders`, `bundle`, `images`, or leave blank for a full sweep
3. **Context** (optional) — recent complaint, observed latency, profiler output

## What Happens Next

The Performance Audit Agent will:
1. Load architecture + rules for the target's domain
2. Trace route → service → data access (or page → components → hooks)
3. Walk the audit catalog and record every hit with file:line
4. Invoke `performance-oracle` for deep analysis
5. Invoke `pattern-recognition-specialist` for canonical fix patterns
6. Produce a prioritized report grouped by impact and effort

The agent never applies fixes — it only recommends.

## Tips for Better Results
- Name the concern so the agent focuses the scan
- Paste profiler output or observed latency if you have it
- Pair with `/load-test` to validate the fix and `@agent-refactor` to execute it
