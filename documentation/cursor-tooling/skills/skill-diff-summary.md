# `skill-diff-summary` Skill — Usage Guide

## Purpose

Turn a raw git diff into a structured PR description with surfaces, risks, and test-coverage notes.

## When to Use

- Opening a PR with a non-trivial diff.
- Backfilling a PR description for a stacked branch.
- Drafting release notes for a batch of merges.

## When NOT to Use

- Single-file trivial changes.
- Merge-only diffs.
- Diffs dominated by generated files.

## Invocation

```
/skill-diff-summary
@skill-diff-summary range=origin/main...HEAD
@skill-diff-summary audience=pm
```

## Examples

### Example 1 — Full-stack feature

Groups API, frontend, and migration under one PR body.

### Example 2 — Infra-only

Concise Terraform summary with FedRAMP boundary reminder.

### Example 3 — PM audience

Removes file paths; focuses on user-visible impact.

### Example 4 — Release notes batch

`range=v1.12.0..HEAD` to summarize a sprint for the changelog.

## Tips

- Always review the "Intent" paragraph; it is inferred, not verbatim.
- Pair with `/skill-impact-analysis` for cross-service risk.
- Use `audience=pm` for customer-visible releases.

## Pitfalls

- Do not trust test-coverage notes blindly; they detect presence, not quality.
- Generated file noise (lockfile, OpenAPI) can drown the signal — exclude via `range` scoping.
- PII flags are pattern-based, not semantic; a false negative is possible.
