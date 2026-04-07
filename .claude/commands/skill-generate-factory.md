# Generate Factory

Generate a test-data factory for a model or type.

## What I Need From You

- Target: symbol or file + class name.
- Side: `api` or `frontend`.

## What Happens Next

1. Reads the target fields.
2. Matches existing sibling factory style.
3. Writes the factory with synthetic defaults.
4. Runs the related test module once to confirm construction.

## Tips

- Do not use for PII-sensitive models without manual review.
- Pair with `/skill-generate-test-data` when you need JSON fixtures too.
- Keep factories additive — do not regenerate from scratch over hand-tuned versions.
