# `skill-feature-flag-audit` Skill — Usage Guide

## Purpose

Inventory every feature flag, classify it, report state per env, and highlight cleanup candidates.

## When to Use

- Monthly flag hygiene pass.
- Pre-release sweep.
- Before running `flag-cleanup` on a single flag.

## When NOT to Use

- Mid-incident.
- A/B experiments tracked outside the flag system.

## Invocation

```
/skill-feature-flag-audit
@skill-feature-flag-audit scope=frontend
@skill-feature-flag-audit environments=dev,staging
```

## Examples

### Example 1 — Monthly hygiene

5 removal candidates shortlisted; scheduled for cleanup.

### Example 2 — Pre-release

Confirms all release-gates are ON in staging before cutover.

### Example 3 — Scoped

`scope=frontend` lists only frontend-consumed flags.

### Example 4 — Pre-cleanup

Run before `flag-cleanup` to confirm the flag is actually a cleanup candidate.

## Tips

- Treat permission-class flags as non-removable.
- Confirm Terraform state is fresh before trusting per-env values.
- Snapshot results into a quarterly tech-debt ticket.

## Pitfalls

- Stale Terraform state produces stale audits.
- Dynamic flag names (string interpolation) can be missed.
- "Candidate" is advisory — always confirm rollout history before removing.
