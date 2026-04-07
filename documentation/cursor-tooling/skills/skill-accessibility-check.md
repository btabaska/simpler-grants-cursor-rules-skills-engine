# `skill-accessibility-check` Skill — Usage Guide

## Purpose

Fast, local WCAG 2.1 AA feedback on React/Next.js components in the `frontend/` tree. Catches the top recurring a11y defects (missing labels, clickable divs, icon-only buttons, non-tokenized colors) before CI or manual QA.

## When to Use

- Editing a component under `frontend/src/components/` or `frontend/src/app/`.
- Pre-push sweep on a PR that touches JSX/TSX.
- Reviewer wants a structured a11y report.

## When NOT to Use

- Non-frontend files.
- As a substitute for axe-core / Pa11y CI certification.
- Generated files (`.next/`, snapshots, `node_modules/`).

## Invocation

```
/skill-accessibility-check
@skill-accessibility-check frontend/src/components/search/SearchBar.tsx
@skill-accessibility-check scope=changed
```

## Examples

### Example 1 — Active file

Open `OpportunityCard.tsx`, run `/skill-accessibility-check`. Returns: missing `alt` on agency logo, `<div onClick>` without keyboard handler, suggested refactor to `<article>` with inner `<button>`.

### Example 2 — Diff-only scope

`@skill-accessibility-check scope=changed` before pushing a hot-fix. Reports only on added lines from `git diff`.

### Example 3 — Cross-referenced with conventions

Finding cites `documentation/rules/frontend-components.md` when it matches a MUST directive (e.g. USWDS color tokens).

### Example 4 — Pre-release sweep

Run over a feature directory before accessibility sign-off. Combine with `/skill-cross-browser-checklist` for launch readiness.

## Tips

- Treat `ERROR` findings as block-merge. `WARN` should be resolved before requesting review.
- Use USWDS theme tokens instead of color literals — the skill flags raw hex.
- Pair with `/check-conventions` for non-a11y rules.

## Pitfalls

- This is lint-grade, not a full audit. It cannot compute runtime contrast or detect dynamic focus traps.
- It does not exercise the component. Runtime a11y regressions still need Playwright + axe.
- Suppressing findings without a fix silently hides real issues; prefer refactoring to the suggested pattern.
