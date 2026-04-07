# Run Relevant Tests

Identify and execute only the test suites affected by your current change set.

## What I Need From You

- Nothing required — defaults to comparing against `origin/main` plus unstaged changes.
- Optional: `base_ref=<git-ref>`, `scope=api|frontend|all`, `mode=fast|deep`.

## What Happens Next

1. Diffs your branch against the base ref and collects unstaged edits.
2. Maps each changed file to its sibling pytest or Jest target.
3. In `deep` mode, also collects reverse-dependency tests.
4. Prints the execution plan and asks for confirmation if > 50 files.
5. Runs API tests via `uv run pytest` and frontend tests via `npm test`.
6. Parses results, attributes failures to likely root-cause files, and suggests follow-up skills.

## Tips

- Run before pushing — catches the obvious breakages CI would catch in 10 minutes.
- Use `mode=deep` after refactoring shared utils.
- Pair with `/skill-impact-analysis` first to preview the test surface.
- Treat as a smoke test, not a CI substitute.
