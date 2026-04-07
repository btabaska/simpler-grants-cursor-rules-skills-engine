# `skill-migration-safety-check` Skill — Usage Guide

## Purpose

Lint Alembic migrations for production-deployment safety, zero-downtime patterns, and FedRAMP audit-log compliance. Catches drops, non-null adds, non-concurrent indexes, type changes, and renames before they reach a deploy.

## When to Use

- A new file is added under `api/src/db/migrations/versions/`.
- An existing migration is edited.
- Pre-tag review for any release that includes a schema change.

## When NOT to Use

- Seed scripts and data fixtures not under `versions/`.
- Model changes that have no migration yet — run `alembic revision --autogenerate` first.
- As a substitute for staging validation.

## Invocation

```
/skill-migration-safety-check
@skill-migration-safety-check api/src/db/migrations/versions/2026_04_05_1130_add_status_index_a7f3.py
@skill-migration-safety-check mode=advisory
```

## Examples

### Example 1 — Concurrent index miss

Author adds a btree index. Skill flags missing `postgresql_concurrently=True`, recommends `transactional_ddl = False`.

### Example 2 — NOT NULL without default

`op.add_column('opportunity', sa.Column('status', sa.String(), nullable=False))` flagged HIGH; recommends two-step backfill.

### Example 3 — Drop column same revision

Dropping `legacy_status` in the same migration that adds `status`. Flagged HIGH; recommends splitting across releases.

### Example 4 — Audit-logged table

Migration touches `application` table; skill cross-references `documentation/rules/data-privacy.mdc` and reminds reviewer to update the audit projection.

## Tips

- Pair with `/skill-impact-analysis` for downstream consumers.
- Run before opening the PR — fixes are cheaper before review.
- Document irreversible migrations explicitly in the docstring.

## Pitfalls

- Heuristic-based — does not query live row counts; assume concurrent index for any non-trivial table.
- Cannot detect logical race conditions in raw SQL.
- Does not validate that backfills are idempotent.
