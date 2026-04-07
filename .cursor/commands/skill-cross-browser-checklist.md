# Cross-Browser Checklist

Generate a diff-scoped manual cross-browser test checklist.

## What I Need From You

- Optional diff range (default `origin/main...HEAD`).
- Optional browser subset.

## What Happens Next

1. Collects changed frontend files.
2. Traces affected user flows.
3. Emits a per-browser checklist covering the specific flows and known-sensitive constructs.

## Tips

- Attach the output to the PR description.
- Combine with `/skill-accessibility-check` and `/skill-uat-checklist` for full release QA.
- Focus the tester; do not ask them to re-test unrelated flows.
