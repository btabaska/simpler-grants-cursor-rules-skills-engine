# frontend-styles

> Note: the `.cursor/rules/frontend-styles.mdc` rule is already present. This companion doc summarizes it.

## Purpose
SCSS patterns for the Simpler Grants frontend: USWDS theme overrides, mixins, breakpoints, and print styles.

## Scope / Globs
`frontend/src/styles/**/*.scss`, `frontend/src/**/*.module.scss`, `frontend/src/**/*.scss`

## Conventions Enforced
- Modern Sass `@forward` / `@use`; no legacy `@import`
- USWDS token overrides via theme map
- `at-media` mixins for responsive breakpoints
- CSS Modules for component-scoped styles
- Print styles isolated in dedicated partials
- Accessibility-first color contrast (WCAG 2.1 AA)

## Examples
Correct: override `$theme-color-primary` via token map, `@include at-media("tablet")`.
Incorrect: hardcoded hex colors or `@import` chains.

## Related Rules
`frontend-components`, `accessibility`, `frontend-app-pages`.
