# `feature-flag` Agent — Usage Guide

## Purpose

Scaffold a boolean feature flag end-to-end: Terraform SSM parameter, API config loader entry, API branching code, frontend `useFeatureFlag` hook call, `.env.development` toggle, and a cleanup tracker entry. Flags are boolean only.

## When to Use

- You're about to merge a feature that needs a kill switch
- You want to gate a risky refactor behind a toggle for staged rollout
- You're introducing a parallel v2 path that should be off by default

## When NOT to Use

- You need A/B testing, percentage rollouts, or multivariate flags (out of scope)
- You want analytics or event instrumentation (use your existing telemetry tooling)
- You want to REMOVE a flag (use the `flag-cleanup` skill)
- You're auditing existing flags (use the `feature-flag-audit` skill)

## Invocation

```
/feature-flag
@agent-feature-flag <flag name + affected files + owner + cleanup date>
```

## Examples

### Example 1 — Full-stack flag

```
@agent-feature-flag opportunity_search_v2; backend: api/src/services/search.py;
frontend: frontend/src/components/search/SearchPage.tsx; owner: @jdoe; cleanup: 2026-06-01
```

Result: SSM `/simpler-grants-gov/<env>/feature_flags/opportunity_search_v2`, API env var `FEATURE_OPPORTUNITY_SEARCH_V2`, frontend env var `NEXT_PUBLIC_FEATURE_OPPORTUNITY_SEARCH_V2`, hook call `useFeatureFlag('featureOpportunitySearchV2')`, `.env.development` set to `true` locally, cleanup tracker entry created.

### Example 2 — API-only flag

```
@agent-feature-flag async_notification_delivery; backend: api/src/services/notifications.py;
owner: @kteam; cleanup: 2026-05-15
```

Result: Terraform + API wiring only, no frontend changes, cleanup tracker entry notes the single-layer scope.

### Example 3 — Frontend-only flag

```
@agent-feature-flag new_nav_ia; frontend: frontend/src/components/layout/GlobalHeader.tsx;
owner: @designsys; cleanup: 2026-04-30
```

Result: Terraform + `.env.development` + frontend hook wiring, API side skipped.

### Example 4 — Risky refactor kill switch

```
@agent-feature-flag use_sqlalchemy_2_query_api; backend: api/src/db/queries/; owner: @infra;
cleanup: 2026-05-01
```

Result: branches each query module behind a config-level toggle, with a helper if the off/on paths diverge beyond 10 lines.

## Lifecycle

1. **Create** — this agent scaffolds it
2. **Iterate** — ship the on-path behind the flag; keep the off-path untouched
3. **Roll out** — flip SSM in each environment in order
4. **Remove** — invoke `/flag-cleanup <flag-name>` to delete the wiring and simplify the on-path

## Tips

- Always set a cleanup date — flags without one are refused
- Default to `false` in non-dev environments
- Keep branching to ~3 sites per layer; extract a helper otherwise
- Cross-link the flag from the feature's ADR if one exists

## Pitfalls

- Production defaults of `true` are refused
- The agent will not remove or modify existing flags in the same run
- If any of the four wiring points (Terraform, API config, frontend hook, `.env.development`) can't be located, the agent stops and asks — it will not invent infra
