# `skill-generate-story` Skill — Usage Guide

## Purpose

Ensure every component has Storybook coverage with baseline and edge states, without re-deriving the skeleton each time.

## When to Use

- New component added.
- Reviewer asks for visual coverage.
- Before a11y or visual-regression sweeps.

## When NOT to Use

- Pure utility modules.
- Page-level components with only e2e coverage.
- Components requiring server-only data.

## Invocation

```
/skill-generate-story
@skill-generate-story component=frontend/src/components/search/SearchBar.tsx
@skill-generate-story component=.../OpportunityCard.tsx states=default,error,empty
```

## Examples

### Example 1 — New component

`OpportunityCard` → default, loading, empty, long-title, with-badge.

### Example 2 — Augment existing

Add `error` state to an existing `SearchBar.stories.tsx`.

### Example 3 — RTL coverage

Generate RTL decorator story for an i18n-sensitive component.

### Example 4 — Pre visual-regression

Run before the visual-regression agent captures baselines.

## Tips

- Commit factories alongside stories so Chromatic-style tools stay deterministic.
- Use CSF3 `args` and `argTypes` — match the repo style.
- Keep one component per story file.

## Pitfalls

- Do not overwrite tuned existing stories; augment.
- Synthetic props may miss realistic corner cases.
- Avoid stories that depend on live network; use MSW decorators instead.
