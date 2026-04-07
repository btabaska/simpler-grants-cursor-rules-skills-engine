# frontend-storybook

> Note: the `.cursor/rules/frontend-storybook.mdc` rule is already present. This companion doc summarizes it.

## Purpose
CSF3 Storybook patterns: args/controls, a11y stories, visual regression, decorators, MSW mocking, and play/interaction tests.

## Scope / Globs
`frontend/**/*.stories.{ts,tsx,jsx}`, `frontend/.storybook/**/*`

## Conventions Enforced
- CSF3 with `Meta` / `StoryObj`
- Co-located `.stories.tsx`; title mirrors folder structure
- `argTypes` with explicit control kinds and descriptions
- a11y addon passes on `Default`; rule disables documented
- Deterministic visual regression stories (no randomness, no live data)
- Global providers via `.storybook/preview.tsx`
- MSW for network; `@storybook/nextjs` for router/navigation
- `@storybook/test` play functions assert observable behavior

## Examples
Correct: `export const WithError: StoryObj<typeof Alert> = { args: { ... } }`.
Incorrect: CSF2 function stories or real fetch calls.

## Related Rules
`frontend-components`, `frontend-tests`, `frontend-i18n`, `accessibility`.
