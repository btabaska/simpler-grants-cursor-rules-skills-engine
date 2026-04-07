# frontend-utils

> Note: the `.cursor/rules/frontend-utils.mdc` rule is already present. This companion doc summarizes it.

## Purpose
Utility module conventions for `frontend/src/utils/`: pure functions, tree-shakeable exports, and typed helpers.

## Scope / Globs
`frontend/src/utils/**/*.ts`

## Conventions Enforced
- Pure, side-effect-free functions
- Named exports; no default exports
- Strict typing; no `any`
- Co-located unit tests
- No direct React/DOM dependencies in utility modules

## Examples
Correct: `export function formatCurrency(value: number, locale: string): string { ... }`.
Incorrect: mixing a fetch call into a formatting util.

## Related Rules
`frontend-types`, `frontend-components`, `frontend-tests`.
