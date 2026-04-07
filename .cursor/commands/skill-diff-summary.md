# Diff Summary

Summarize a git diff into a PR description.

## What I Need From You

- Optional git range (default `origin/main...HEAD`).
- Optional audience: `engineer` (default) or `pm`.

## What Happens Next

1. Classifies changed files by surface.
2. Extracts added/removed top-level symbols.
3. Flags risks (migrations, flags, auth, PII, dep upgrades).
4. Notes whether corresponding tests are included.
5. Emits Markdown to paste into the PR.

## Tips

- Re-run after each push to keep the PR body fresh.
- Use `audience=pm` when the PR is customer-visible.
- Always sanity-check the "Intent" paragraph before posting.
