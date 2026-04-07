# `refactor` Agent — Usage Guide

## Purpose

Plan and execute multi-file refactors in simpler-grants-gov with full blast-radius analysis, staged execution, import updates, test verification, and specialist review. Handles extracts, splits, moves, renames, consolidations, restructures, and deletions.

## When to Use

- You need to rename a function/class/variable across more than a handful of files
- You want to split a large file into smaller modules
- You're moving logic between architectural layers (route → service, hook → service)
- You're consolidating duplicated patterns into a shared implementation
- You're restructuring a function signature with many callers

## When NOT to Use

- Purely mechanical transformations at scale — use `@agent-codemod` for those
- Database schema changes — use `@agent-migration`
- New features or endpoints — use `@agent-new-endpoint`
- Cross-language refactors (run separately for Python and TypeScript)
- Public API signature changes without an ADR — pair with `/adr-from-pr` first

## Invocation

```
/refactor
@agent-refactor <what to refactor and why>
```

## Examples

### Example 1 — Extract a service
```
@agent-refactor Extract eligibility logic out of opportunity_service into its own eligibility_service
```
Result: blast-radius plan (5 files), create-before-delete phased execution, import updates across callers, new test file, `codebase-conventions-reviewer` + `kieran-python-reviewer` + `code-simplicity-reviewer` gates.

### Example 2 — Split a large component
```
@agent-refactor Split ApplicationForm.tsx (900 lines) into logical sub-components
```
Result: plan for header, fields, actions, review sections, type definitions moved, Jest tests updated, `julik-frontend-races-reviewer` gate run.

### Example 3 — Rename across services layer
```
@agent-refactor Rename get_opportunity_details to fetch_opportunity_details everywhere
```
Result: 14-file blast radius, renames applied, imports fixed, `make test-api` PASS, `pattern-recognition-specialist` confirms no stray references.

### Example 4 — Consolidate duplicated pagination
```
@agent-refactor Consolidate the four pagination helpers in api/src/services into one
```
Result: canonical helper promoted, four call sites migrated, all duplicates removed, coverage maintained.

## Tips

- Describe both the what and the why — the plan is tighter when intent is clear
- Approve the blast-radius plan carefully; the agent waits for confirmation
- If a refactor crosses architectural layers, be ready for the `architecture-strategist` gate to push back
- Pair with `@agent-codemod` when the refactor has a mechanical tail (e.g. rename after extract)

## Pitfalls

- Don't accept a refactor that reduces test coverage — the gate should block this but verify
- Don't skip the plan approval step just because the change feels small
- Don't mix a refactor with a behavior change in one invocation — behavior changes need their own review
- Don't run on a dirty working tree; rollback depends on clean state
