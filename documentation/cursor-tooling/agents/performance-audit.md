# `performance-audit` Agent — Usage Guide

## Purpose

Audit a specific endpoint or page in simpler-grants-gov for N+1 queries, missing indexes, wasteful re-renders, bundle bloat, and unoptimized images. Produces a prioritized remediation report backed by `performance-oracle` and `pattern-recognition-specialist`.

## When to Use

- A latency complaint lands and you need to narrow the suspect surface
- Before shipping a new endpoint, you want a proactive review
- You see rising p95 on a specific page and want static analysis plus specialist opinions
- You suspect an N+1 after a model change and want confirmation

## When NOT to Use

- You want the fix applied (use `@agent-refactor` after this agent reports)
- You want end-to-end measurement (generate a load test with `/load-test`)
- You need infra or capacity planning
- You are auditing the entire repo — narrow to one target

## Invocation

```
/performance-audit
@agent-performance-audit Audit <target> for <concern>
```

## Examples

### Example 1 — N+1 audit
```
@agent-performance-audit Audit GET /v1/opportunities?search=<q> for n+1 queries
```
Result: trace to `opportunity_service.search`, finding on iteration over `opportunity.agency` without `selectinload`, fix pattern from `api-database.mdc`, specialist confirmation.

### Example 2 — Frontend re-render audit
```
@agent-performance-audit Audit frontend/src/app/opportunities/page.tsx for re-renders
```
Result: context provider churn, missing `useCallback` on event handlers, recommendation to split server/client boundary.

### Example 3 — Bundle bloat
```
@agent-performance-audit Audit frontend/src/app/search/page.tsx for bundle size
```
Result: top client imports, recommendation to `dynamic()` the chart library, rule reference to `frontend-components.mdc`.

### Example 4 — Full sweep
```
@agent-performance-audit Audit the application submission flow end-to-end
```
Result: findings across route → service → form component → hooks, prioritized by impact.

## Tips

- Name a single target — this agent is a scalpel, not a sweeper
- Provide profiler output if you have it — it sharpens the specialist prompts
- Read the rule references cited in the report; they are the canonical source

## Pitfalls

- Don't treat static findings as latency measurements — run a load test to confirm
- Don't apply index changes without a migration plan
- Don't cache without an invalidation strategy
