# `visual-regression` Agent — Usage Guide

## Purpose

Scaffold Storybook stories and visual regression baselines for a frontend component. Covers meaningful states, multiple viewports, themes, and locales with threshold configuration matched to the project's existing harness.

## When to Use

- A new component needs visual coverage before it ships
- An existing component's story file is incomplete (missing states, viewports, or a11y variants)
- You're introducing visual regression testing to a previously untested area
- You want realistic fixtures composed without hand-writing them

## When NOT to Use

- You need to run visual regression or approve baselines (use the harness directly)
- You want unit or interaction tests (use `@agent-test-generation`)
- You want functional E2E coverage (use `@agent-e2e-scenario-builder`)
- The component does not render anything (pure logic hooks, providers)

## Invocation

```
/visual-regression
@agent-visual-regression Set up visual tests for <component>
```

## Examples

### Example 1 — Card component
```
@agent-visual-regression Set up visual tests for OpportunityCard
```
Result: `OpportunityCard.stories.tsx` with Default, Loading, Error, Long-title, Hover, Focus stories at mobile/tablet/desktop, threshold 0.1%.

### Example 2 — Interactive form control
```
@agent-visual-regression Scaffold stories for the ApplicationFormField component including all validation states
```
Result: stories covering valid, invalid, warning, disabled, focused, and filled states; accessibility gate confirms focus-ring coverage.

### Example 3 — Augment existing stories
```
@agent-visual-regression The SearchBar component has stories but no error state. Add it.
```
Result: existing file preserved, new Error and Disabled stories appended, threshold unchanged.

### Example 4 — RTL coverage
```
@agent-visual-regression Add an Arabic-locale story to NavigationMenu
```
Result: new `RTL` story added with the `ar` locale decorator, aligned to project i18n convention.

## Tips

- Let the agent read the props interface — don't describe states by hand unless they are non-obvious
- Review masked regions to avoid flakey baselines (timestamps, IDs)
- Keep thresholds conservative; lower is safer

## Pitfalls

- Don't let the agent overwrite existing stories — it should augment
- Don't accept baselines that capture non-deterministic content unmasked
- Don't skip the accessibility gate for interactive components
