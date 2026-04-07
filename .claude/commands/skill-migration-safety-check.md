# Migration Safety Check

Audit an Alembic migration for safety, backward compatibility, and FedRAMP audit requirements.

## What I Need From You

Either:
- Open the migration file under `api/src/db/migrations/versions/`, or
- Specify: "Run migration safety check on `api/src/db/migrations/versions/2026_04_05_1130_add_status_index_a7f3.py`"
- Optional: `mode=advisory` to receive a non-blocking report.

## What Happens Next

1. Parses `upgrade()` and `downgrade()` for risky operations.
2. Flags drops, non-null adds without defaults, type changes, non-concurrent indexes, renames.
3. Verifies revision chain and filename convention.
4. Cross-references audit-log table inventory in `documentation/rules/data-privacy.mdc`.
5. Emits HIGH/MED/LOW findings with concrete fixes. Read-only.

## Tips

- Pair with `/skill-impact-analysis` to find downstream code consumers.
- Two-step migrations (add nullable → backfill → set NOT NULL) are the default safe pattern.
- Concurrent index creation requires `transactional_ddl = False`.
- Always implement `downgrade()` unless explicitly documented as irreversible.
