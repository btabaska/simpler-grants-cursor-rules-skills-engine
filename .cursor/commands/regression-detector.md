# Regression Detector

Analyze a PR diff for hidden dependencies, untested code paths, contract changes, and performance risks. Delegates deep analysis to `pattern-recognition-specialist` and `performance-oracle`, and emits a prioritized risk report.

## What I Need From You

1. **Nothing required** — defaults to `git diff main...HEAD`
2. **Diff source** (optional) — different base, PR number, or pasted patch
3. **Focus** (optional) — `tests`, `performance`, `contracts`, or `all`

## What Happens Next

The Regression Detector Agent will:
1. Enumerate changed functions, imports, schemas, and flags
2. Map the call graph two levels deep
3. Diff contracts (OpenAPI, error codes, request/response shapes)
4. Identify changed lines that have no test coverage
5. Invoke `pattern-recognition-specialist`, `performance-oracle`, and `api-contract-checker` in parallel
6. Predict which tests are likely to fail and list manual regression scenarios
7. Emit a report grouped by risk level

The agent does not run tests or gate merges — it predicts risks.

## Tips for Better Results
- Run before `/prepare-pr` so predicted risks feed the self-review checklist
- Name a focus if you already suspect a category of risk
- Pair with `/performance-audit` for deep dives into performance hits
