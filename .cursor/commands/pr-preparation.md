# Prepare PR

Validate a branch for pull request submission: run scoped tests, check convention compliance across every changed file, validate the title, draft the description, and emit a self-review checklist.

## What I Need From You

1. **Nothing required** — the agent reads `git diff main...HEAD`
2. **Proposed title** (optional) — will be validated or generated
3. **Target base** (optional) — defaults to `main`

The working tree must be clean. The agent will ask you to stash or commit otherwise.

## What Happens Next

The PR Preparation Agent will:
1. Inventory the diff by domain (api, frontend, infra, docs, tests)
2. Pick and run the narrowest passing test commands
3. Run convention, language-quality, PII, and recent-PR checks on every changed file
4. Validate the proposed title against `CONTRIBUTING.md`
5. Draft a PR description grouped by domain with test evidence
6. Emit a self-review checklist ready to paste

The agent never pushes, opens the PR, or requests reviewers.

## Tips for Better Results
- Run `/changelog` first if user-visible behavior changed
- Run `/regression-detector` in parallel for deeper risk analysis
- Pair with `/adr-from-pr` if the branch introduces a new architectural decision
