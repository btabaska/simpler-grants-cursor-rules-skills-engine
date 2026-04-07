# responsive-design-checker

## Purpose

Specialist reviewer subagent that validates frontend components across USWDS breakpoints, honors mobile-first layout rules, and avoids horizontal scroll or clipped interactive targets at the minimum supported viewport (320px).

## Who calls it

- `visual-regression` (Gate 2)
- Optional gate for `codebase-conventions-reviewer`, `new-endpoint`

## What it checks

- Hardcoded pixel widths without max-width fallback
- Touch targets under 44x44 CSS pixels (WCAG 2.5.5)
- Table-like layouts without mobile strategy
- Missing breakpoint coverage in stories (mobile/tablet/desktop)
- USWDS tokens used instead of ad-hoc values
- Responsive image `sizes` / `srcSet` attributes

## Output format

JSON with severity summary and per-element findings. See `.cursor/agents/responsive-design-checker.md`.

## Example

```
Invoke responsive-design-checker with:
  files: ["frontend/src/components/application/summary.tsx"]
  stories: ["frontend/src/stories/application/summary.stories.tsx"]
  calling_agent: "visual-regression"
```

## Policy

Horizontal scroll at 320px or touch targets under 44x44 always block.
