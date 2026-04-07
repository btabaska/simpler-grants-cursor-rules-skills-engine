# frontend-app-pages

> Note: the `.cursor/rules/frontend-app-pages.mdc` rule is already present in the repo. This companion doc summarizes it.

## Purpose
Next.js App Router page and layout conventions: server components, metadata, ISR vs dynamic, locale routing, error/loading boundaries, and API route handlers.

## Scope / Globs
`frontend/src/app/**/*.tsx`, `frontend/src/app/**/*.ts`

## Conventions Enforced
- Server components by default; no unnecessary `"use client"`
- Async `generateMetadata` integrated with `next-intl`
- Promise-typed async params
- Explicit `revalidate` or `force-dynamic` for data-fetching pages
- `[locale]/(base)` / `[locale]/(print)` route groups
- `respondWithTraceAndLogs` for `frontend/src/app/api/` handlers
- Thin pages delegating to components and services
- Catch-all `[...not-found]` 404s

## Examples
Correct: `export const revalidate = 600` for ISR data page.
Incorrect: `"use client"` on a page that only needs interactive children.

## Related Rules
`frontend-components`, `frontend-services`, `frontend-i18n`, `frontend-hooks`, `accessibility`, `cross-domain`.
