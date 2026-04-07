# Visual Regression

Scaffold Storybook stories and visual regression baselines for a frontend component across mobile/tablet/desktop viewports and all meaningful states.

## What I Need From You

1. **Component** — file path or component name
2. **States** (optional) — extra states to cover beyond the default set
3. **Viewports** (optional) — override the default mobile/tablet/desktop matrix

## What Happens Next

The Visual Regression Agent will:
1. Read the component's props and state variations
2. Preserve any existing `.stories.tsx` file
3. Build realistic fixtures (never PII)
4. Emit stories for Default, Loading, Empty, Error, Disabled, Hover, Focus, Selected, and overflow states
5. Configure viewports, themes, and locale variants
6. Set visual regression thresholds per project convention
7. Run convention, accessibility, and TypeScript quality gates

## Tips for Better Results
- Name the component file so the agent does not have to guess
- Call out domain-specific states that aren't part of the default matrix
- Pair with `/test-plan` and `/e2e-scenario` for full coverage
