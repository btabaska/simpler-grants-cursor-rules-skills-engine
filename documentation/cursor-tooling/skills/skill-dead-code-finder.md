# `skill-dead-code-finder` Skill — Usage Guide

## Purpose

Surface likely-dead code with an evidence trail so a human can delete safely.

## When to Use

- Tech-debt sweeps.
- After a major feature removal.
- Before a release targeting surface reduction.

## When NOT to Use

- On hot branches with in-flight refactors.
- On flag-gated code without running `/skill-feature-flag-audit` first.
- On public API handlers.

## Invocation

```
/skill-dead-code-finder
@skill-dead-code-finder scope=frontend
@skill-dead-code-finder scope=api path=api/src/services
```

## Examples

### Example 1 — Post-v0 removal

7 high-confidence orphans incl. legacy v0 opportunity service.

### Example 2 — Frontend sweep

12 orphan components; 4 referenced only by Storybook.

### Example 3 — Flag-gated skip

Module gated by `feature_new_search` skipped because flag is OFF in prod.

### Example 4 — Targeted path

`scope=api path=api/src/services` to focus on the service layer.

## Tips

- Confidence buckets exist for a reason; review medium/low manually.
- Always open a scoped PR per deletion batch for easy revert.
- Re-run `/skill-bundle-size-check` after frontend deletions to confirm impact.

## Pitfalls

- String-referenced exports (dynamic imports, route registries) can appear dead.
- Audit-log and security middleware can look orphaned; verify before touching.
- A candidate with git activity < 90 days is rarely safe to delete.
