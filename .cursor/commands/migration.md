# Migration

Generate an Alembic database migration for simpler-grants-gov.

## What I Need From You

Describe the schema change:

1. **What's changing?** — new table, new column, modify column, add index, etc.
2. **Which model?** — the model in `api/src/db/models/` being affected
3. **Is this reversible?** — can `downgrade()` safely undo it?

## What Happens Next

The Migration Agent will:
1. Generate the migration file with proper naming and `schema="api"`
2. Update the model with `Mapped[T]` syntax
3. Handle lookup tables with the four-layer pattern if needed
4. Validate with data safety and convention specialists

## Tips for Better Results
- Specify column types and nullability explicitly
- Mention if this involves foreign keys or relationships
- For lookup tables, list all enum values
