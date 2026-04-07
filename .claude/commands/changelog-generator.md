# Changelog Generator

Draft a categorized release section for `CHANGELOG.md` from the set of pull requests merged into `main` since a given cutoff.

## What I Need From You

1. **Cutoff** — a date (`since 2026-03-01`), a previous version tag (`since v1.1.0`), or a PR count (`last 50 merged PRs`)
2. **Target version** — e.g. `v1.2.0`
3. **Release date** — defaults to today; confirm before write
4. **Optional scope filter** — label, path glob, or team

## What Happens Next

The Changelog Generator Agent will:
1. Query `gh pr list --state merged --base main --search 'merged:>...' --json ...`
2. Categorize each PR (Security, Breaking Changes, Features, Bug Fixes, Performance, Accessibility, Documentation, Infrastructure)
3. Rewrite each title into the project's voice with PR link and external-contributor credit
4. Present the draft and a per-category PR count before writing
5. Append the new section to the top of `CHANGELOG.md`
6. Run convention, coverage, and security-disclosure quality gates

## Tips for Better Results
- Always supply the version and release date — the agent will not invent them
- For security PRs, double-check the rewritten entry does not leak embargoed CVE detail
- If a PR title is opaque (`"address feedback"`), the agent reads the body; if still unclear, it puts the PR under `## Needs Triage` for you to fix
