# Feature Flag Audit

Inventory all feature flags and shortlist removal candidates.

## What I Need From You

- Optional scope (`api`, `frontend`, `infra`, `all`).
- Optional environments list (default `dev,staging,prod`).

## What Happens Next

1. Collects flag names from code and SSM.
2. Classifies each flag by purpose.
3. Computes age and state per environment.
4. Emits a table plus a shortlist of removal candidates.

## Tips

- Run monthly.
- Pair with `/skill-flag-cleanup` (or the `flag-cleanup` skill) to execute removals.
- Never include prod values in public PR bodies without a reason.
