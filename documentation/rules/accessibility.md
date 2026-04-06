# Accessibility Rules (WCAG 2.1 AA / Section 508)

> **This is a federal government project.** Section 508 compliance and WCAG 2.1 AA conformance are legal requirements.

## Jest-axe Testing (Required)

EVERY component test suite MUST include a `jest-axe` accessibility scan with `toHaveNoViolations()`.

Example from codebase:
```tsx
import { axe } from "jest-axe";

it("should not have accessibility violations", async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## ARIA Labels and Roles

EVERY interactive element MUST have a proper ARIA label or accessible name. Icon-only buttons MUST have `aria-label`.

## Keyboard Navigation

ALWAYS maintain logical tab order. NEVER use `tabIndex` values greater than 0. ALWAYS ensure all interactive elements are keyboard-reachable.

## Focus Management

ALWAYS use `focus-trap-react` for modals, dialogs, and drawers. ALWAYS return focus to the trigger element on close.

## Heading Hierarchy

ALWAYS maintain logical heading hierarchy (h1 > h2 > h3). NEVER skip levels. EVERY page MUST have exactly one `<h1>`.

## Form Accessibility

EVERY form input MUST have an associated `<label>`. ALWAYS use `aria-describedby` for help text and errors. ALWAYS use `aria-invalid="true"` for invalid fields.

## Dynamic Content

ALWAYS use `aria-live` regions for dynamic updates. Use `role="alert"` for urgent messages, `role="status"` for non-urgent.

## Color and Contrast

NEVER convey information solely through color. ALWAYS ensure sufficient contrast (4.5:1 normal text, 3:1 large text). Use USWDS design tokens.

## Images and Icons

ALWAYS provide meaningful `alt` text for informational images. Use `aria-hidden="true"` for decorative images.

## USWDS Components

ALWAYS prefer USWDS components from `@trussworks/react-uswds` — they include built-in accessibility.

## Pa11y-CI

Pa11y-ci runs desktop + mobile configurations in CI. ALWAYS ensure pages render `#main-content` as a landmark.

## Tables

ALWAYS use semantic table elements. ALWAYS use `scope` on `<th>`. NEVER use tables for layout. ALWAYS provide `<caption>` or `aria-label`.
