# Debug

Investigate and fix a bug in the simpler-grants-gov codebase.

## What I Need From You

Provide ONE of the following:
1. **Error message or stack trace** — paste the full error output
2. **Test failure** — which test is failing and the failure output
3. **Unexpected behavior** — what you expected vs what happened, and where in the code

## What Happens Next

The Debugging Agent will:
1. Classify the error (Python runtime, TypeScript compile, test failure, API error, infrastructure)
2. Load relevant project context via MCP
3. Investigate using the appropriate strategy for the error type
4. Check git history for regression causes
5. Perform root cause analysis
6. Suggest a fix with full code changes
7. Run the quality gate pipeline to validate the fix

## Tips for Better Results
- Include the FULL error trace, not just the last line
- Mention what you were doing when the error occurred
- If it's intermittent, note when it happens and when it doesn't
- If you suspect a recent change caused it, mention the PR number or commit
