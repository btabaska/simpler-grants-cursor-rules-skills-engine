# Impact Analysis

Map the downstream blast radius of a change before merging.

## What I Need From You

Either:
- A staged/unstaged diff (default), or
- A target file: "Run impact analysis on `api/src/db/models/opportunity_models.py`", or
- A symbol: "Who depends on `OpportunityService.get_summary`?"
- Optional: `scope=api|frontend|infra|all`, `depth=1..3`.

## What Happens Next

1. Resolves changed files or target symbol.
2. Classifies each as model/route/schema/openapi/component/etc.
3. Walks importers and callers up to the requested depth.
4. Tags each downstream node HIGH / MED / LOW risk.
5. Cross-references convention rules and identifies cross-service contracts.
6. Emits a structured report with suggested reviewers and follow-up skills.

## Tips

- Run before opening a PR that touches `api/src/db/models/`, OpenAPI, or shared utils.
- Pair with `/skill-run-relevant-tests` to actually execute the implicated suites.
- For DB changes, chain into `/skill-migration-safety-check`.
- Use `depth=1` for quick triage, `depth=3` for deep refactors.
