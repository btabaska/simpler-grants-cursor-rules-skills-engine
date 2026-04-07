# Good First Issue Assistant

Get a guided walkthrough of a `good-first-issue` from the simpler-grants-gov repo, including code mapping, scaffolded changes, test strategy, and PR submission steps.

## What I Need From You

One of:

1. **A GitHub issue URL** — `https://github.com/HHS/simpler-grants-gov/issues/<n>`
2. **An issue number**
3. **A search** — "find a good-first-issue in frontend i18n"

## What Happens Next

The agent will:
1. Fetch the issue via `gh issue view`
2. Verify the `good-first-issue` label
3. Summarize goal, affected files, and governing rules
4. Produce a scaffold as a diff (NOT applied)
5. Draft a sample test
6. Walk through branch, commit, and `gh pr create`
7. Provide a final pre-submission checklist

This agent is READ-ONLY. It will not edit files or open PRs on your behalf.

## Tips for Better Results
- Pick issues actually labeled `good-first-issue`
- For multi-file refactors use a different agent
- The agent will refuse to scaffold issues that touch more than one module
