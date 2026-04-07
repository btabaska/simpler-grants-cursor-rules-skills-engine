# Generate Test Data

Generate synthetic fixture files.

## What I Need From You

- Target: symbol, file, or OpenAPI operation id.
- Count (default 10).
- Format: `json`, `ndjson`, or `sql`.
- Optional seed.

## What Happens Next

1. Resolves the target shape.
2. Seeds the generator for reproducibility.
3. Writes the fixture to the conventional directory with a header comment.

## Tips

- Pin the seed in CI runs.
- Use `sql` format for local dev DB seeding.
- Pair with `/skill-generate-factory` when the same data is also needed in code.
