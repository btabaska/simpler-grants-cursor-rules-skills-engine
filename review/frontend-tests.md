# Frontend Tests — Pattern Review

**Reviewer(s):** doug-s-nava
**PRs analyzed:** 279
**Rules proposed:** 22
**Open questions:** 6

---

> **IMPORTANT: A note on inconsistencies**
>
> This extraction will surface patterns that are inconsistent — where the codebase
> does things two or three different ways. Some of these inconsistencies may be
> intentional (different contexts warranting different approaches) or evolutionary
> (the team moved from approach A to approach B but hasn't migrated everything).
>
> A big part of this review is resolving that ambiguity — deciding which patterns
> are canonical, which are legacy, and which represent intentional variation.
> Please don't assume that the most common pattern is automatically the right one.

---

## How to Review

For each pattern below, check one box and optionally add notes:
- **CONFIRMED** — This is the canonical pattern. Enforce it.
- **DEPRECATED** — This pattern is legacy. The correct approach is noted in your comments.
- **NEEDS NUANCE** — The rule is directionally correct but needs caveats or exceptions.
- **SPLIT** — This is actually two or more valid patterns for different contexts.

---

## Patterns

### 1. Jest + React Testing Library as the Unit Test Stack

**Confidence:** High
**Frequency:** Near-universal across all unit tests (~200+ PRs)
**Source PRs:** #7346, #5637

**Proposed Rule:**
> ALWAYS use Jest as the test runner and `@testing-library/react` for component rendering in unit tests. NEVER introduce alternative test frameworks (e.g., Vitest, Enzyme) for frontend unit tests.

**Rationale:**
Consistency across the codebase. React Testing Library encourages testing from the user's perspective (via roles, text, and accessibility queries) rather than testing implementation details.

**Code Examples:**
```tsx
# From PR #7346 — New component test for InviteLegacyUsersButton
import { render, screen } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom";
import { axe } from "jest-axe";

import { InviteLegacyUsersButton } from "src/components/manageUsers/InviteLegacyUsersButton";

describe("InviteLegacyUserButton", () => {
  it("confirm the URL is correct", async () => {
    const organizationId = "org-123";
    const component = await InviteLegacyUsersButton({ organizationId });
    render(component);
    const legacyInviteButton = await screen.findByRole("link");
    expect(legacyInviteButton).toBeVisible();
    expect(legacyInviteButton).toHaveAttribute(
      "href",
      `/organization/${organizationId}/manage-users/legacy`,
    );
  });
});
```

```tsx
# From PR #5637 — New component test for ScriptInjector
import { render, screen } from "@testing-library/react";
import { ClientScriptInjector } from "src/components/ScriptInjector";

describe("ScriptInjector", () => {
  it("inserts tag in config if gate function returns true", () => {
    mockGate.mockReturnValue(true);
    render(<ClientScriptInjector />);
    expect(screen.getByRole("link", { name: "a link" })).toBeInTheDocument();
  });
});
```

**Conflicting Examples:**
Some tests import `render` from `tests/react-utils` instead of `@testing-library/react`. It is unclear when each import source should be used.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** When should tests import from `tests/react-utils` vs. directly from `@testing-library/react`?

---

### 2. Accessibility Test Per Component (jest-axe)

**Confidence:** High
**Frequency:** High (~30+ PRs). Present in nearly every new component test suite.
**Source PRs:** #7346, #5008, #4981

**Proposed Rule:**
> ALWAYS include a `jest-axe` accessibility scan as the first or second test in every component test suite. The test MUST use the standard pattern of rendering into a container and asserting `toHaveNoViolations()`.

**Rationale:**
Ensures baseline WCAG compliance. The project serves government users and must meet Section 508 accessibility standards.

**Code Examples:**
```tsx
# From PR #7346 — InviteLegacyUsersButton
import { axe } from "jest-axe";

it("should not have accessibility violations", async () => {
  const { container } = render(
    <InviteLegacyUsersButton organizationId="org-123" />,
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

```tsx
# From PR #5008 — AgencyFilterAccordion
it("is accessible", async () => {
  const component = await AgencyFilterAccordion({
    agencyOptionsPromise: Promise.resolve([fakeOptions, fakeSearchAPIResponse]),
    query: new Set(),
  });
  const { container } = render(component);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 3. Mock `next-intl` via Shared intlMocks Utility

**Confidence:** High
**Frequency:** Very High (~40+ PRs). Reviewer explicitly enforces this (PR #7346).
**Source PRs:** #7346, #5637

**Proposed Rule:**
> ALWAYS mock `next-intl` and `next-intl/server` translation functions using the shared utilities from `src/utils/testing/intlMocks.ts`. NEVER define custom inline translation mocks when the shared utilities exist.

**Rationale:**
Centralizes translation mock behavior so changes only need to be made in one place. The mock returns the translation key as the rendered string, making assertions simple and predictable.

**Code Examples:**
```tsx
# From PR #7346 — Using shared mock for server component
import { mockUseTranslations } from "src/utils/testing/intlMocks";

jest.mock("next-intl/server", () => ({
  getTranslations: () => mockUseTranslations,
}));
```

```tsx
# From PR #5637 — Client component mocking
import { useTranslationsMock } from "src/utils/testing/intlMocks";

jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

```tsx
# From PR #7346 — Reviewer enforcement (doug-s-nava)
> "is there a reason [mockUseTranslations] doesn't work here?"
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 4. Mock `next/navigation` Hooks with `requireActual` Spread

**Confidence:** High
**Frequency:** High (~20+ PRs)
**Source PRs:** #5637, #4304

**Proposed Rule:**
> ALWAYS mock `next/navigation` hooks (useRouter, usePathname, useSearchParams) when testing components that depend on them. ALWAYS use `jest.requireActual` spread to preserve unmocked exports.

**Rationale:**
Next.js navigation hooks require browser-like context that is unavailable in the Jest JSDOM environment. The `requireActual` spread ensures other exports (e.g., `ReadonlyURLSearchParams`) remain available.

**Code Examples:**
```tsx
# From PR #5637 — ScriptInjector.test.tsx
const usePathnameMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock() as string,
}));
```

```tsx
# From PR #4304 — Standard pattern with requireActual
jest.mock("next/navigation", () => ({
  ...jest.requireActual<typeof import("next/navigation")>("next/navigation"),
  useRouter: () => ({ push: () => {} }),
  usePathname: () => usePathnameMock() as string,
  useSearchParams: () => new URLSearchParams(),
}));
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 5. Direct Invocation for Async Server Components

**Confidence:** High
**Frequency:** High (~15+ PRs). Growing as more server components are added.
**Source PRs:** #7346, #5008, #5641

**Proposed Rule:**
> ALWAYS test async server components by calling the component function directly and passing the return value to `render()`. NEVER use JSX syntax (`<Component />`) for async server components in tests, as React Testing Library cannot render them directly.

**Rationale:**
Next.js async server components return Promises. React Testing Library's `render()` does not support async component functions in JSX. Calling the function directly and awaiting the result is the established workaround.

**Code Examples:**
```tsx
# From PR #7346 — InviteLegacyUsersButton (async server component)
it("confirm the URL is correct", async () => {
  const organizationId = "org-123";
  const component = await InviteLegacyUsersButton({ organizationId });
  render(component);
  const legacyInviteButton = await screen.findByRole("link");
  expect(legacyInviteButton).toBeVisible();
});
```

```tsx
# From PR #5641 — SearchResultsTable
it("displays a proper message when there are no results", async () => {
  const component = await SearchResultsTable({
    searchResults: [],
  });
  render(component);
  expect(screen.queryAllByRole("row")).toHaveLength(0);
});
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 6. Shared Test Fixtures in `fixtures.ts`

**Confidence:** High
**Frequency:** High (~25+ PRs). Fixtures file expanded repeatedly over the project history.
**Source PRs:** #7279, #5008, #4997

**Proposed Rule:**
> ALWAYS define reusable mock data objects in `src/utils/testing/fixtures.ts` rather than inline in individual test files. When a new entity type is added, ALWAYS add its mock fixture to this central file.

**Rationale:**
Centralizing fixtures reduces duplication and ensures consistency. When API shapes change, only the fixture file needs updating.

**Code Examples:**
```tsx
# From PR #7279 — Using fakeOrganizationInvitation from shared fixtures
import { fakeOrganizationInvitation } from "src/utils/testing/fixtures";

beforeEach(() => {
  mockUpdateOrganizationInvitation.mockResolvedValue({
    json: () => Promise.resolve({ data: fakeOrganizationInvitation }),
  });
});
```

```tsx
# From PR #5008 — Using fakeSearchAPIResponse
import { fakeSearchAPIResponse } from "src/utils/testing/fixtures";

const component = await AgencyFilterAccordion({
  agencyOptionsPromise: Promise.resolve([fakeOptions, fakeSearchAPIResponse]),
  query: new Set(),
});
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 7. Type Hacks Accepted in Test Mocks

**Confidence:** High
**Frequency:** Documented norm (PR #4414). Applied across many PRs.
**Source PRs:** #7279, #5637, #4414

**Proposed Rule:**
> ALWAYS feel free to use `as unknown` casts, loose typing (`...args: unknown[]`), and other typing shortcuts in `jest.mock` factory functions within test files. NEVER spend excessive time solving complex type issues in test mocks.

**Rationale:**
Test mock factories operate outside TypeScript's module system and frequently hit type inference limitations. The team decided the cost of perfect typing in mocks outweighs the benefit.

**Code Examples:**
```tsx
# From PR #7279 — as unknown cast in mock factory
jest.mock("src/services/fetch/fetchers/fetchers", () => ({
  fetchUserWithMethod: () => (opts: unknown) =>
    mockUpdateOrganizationInvitation(opts) as unknown,
}));
```

```
# From PR #4414 — Official code style documentation
> "Do not feel bad about hacking around or otherwise not following best typing
> practices in order to solve problems with typing in unit or e2e test files."
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 8. Mock Auth Session with `getSession` Pattern

**Confidence:** High
**Frequency:** High (~15+ PRs)
**Source PRs:** #7279, #6292

**Proposed Rule:**
> ALWAYS mock `src/services/auth/session` using a `jest.fn()` reference when testing components or handlers that depend on user authentication. NEVER import real session logic in unit tests.

**Rationale:**
Authentication involves external services (login.gov, JWT verification) that cannot run in a unit test environment.

**Code Examples:**
```tsx
# From PR #7279 — API route handler test
const getSessionMock = jest.fn();

jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));

// In test setup:
getSessionMock.mockReturnValue({ token: "a token", user_id: "1" });
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 9. Use `waitFor` for Async State Assertions

**Confidence:** High
**Frequency:** Moderate (~10+ PRs). Became more important after React version upgrades.
**Source PRs:** #4997

**Proposed Rule:**
> ALWAYS use `waitFor` from `@testing-library/react` when asserting on state that updates asynchronously after render. NEVER rely on synchronous assertions for values that depend on React state updates or async operations.

**Rationale:**
React 19 changed some internal batching behavior, causing previously synchronous state updates to become asynchronous. Using `waitFor` makes tests resilient to timing changes.

**Code Examples:**
```tsx
# From PR #4997 — Fixed flaky tests by adding waitFor
import { waitFor } from "@testing-library/react";

// BEFORE (flaky):
expect((options[1] as HTMLOptionElement).selected).toEqual(true);

// AFTER (stable):
await waitFor(() =>
  expect((options[1] as HTMLOptionElement).selected).toEqual(true),
);
```

```tsx
# From PR #4997 — Another fix in the same file
await waitFor(() => {
  const selectedOption = screen.getByRole("option", { selected: true });
  return expect(selectedOption).toHaveTextContent(fakeSavedSearchRecord.name);
});
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 10. Components and Their Tests Are Deleted Together

**Confidence:** High
**Frequency:** Moderate (~10 PRs). Consistently applied.
**Source PRs:** #4981

**Proposed Rule:**
> ALWAYS delete a component's test file in the same PR that deletes the component. NEVER leave orphaned test files for removed components.

**Rationale:**
Keeps the test suite in sync with the codebase. Orphaned tests cause confusion and false confidence in coverage metrics.

**Code Examples:**
```
# From PR #4981 — Removed SearchFilterToggleAll.tsx and its test in the same PR
- Deleted: frontend/src/components/search/SearchFilterAccordion/SearchFilterToggleAll.tsx
- Deleted: frontend/tests/components/search/SearchFilterAccordion/SearchFilterToggleAll.test.tsx
- Also removed related test assertions from SearchFilterAccordion.test.tsx
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 11. Prefer Role-Based Queries in Assertions

**Confidence:** High
**Frequency:** High. Increasingly preferred over `getByText`.
**Source PRs:** #7346, #5641, #5637

**Proposed Rule:**
> ALWAYS prefer `screen.getByRole()` / `screen.findByRole()` for element queries in tests. Use `screen.getByText()` only for simpler assertions where role-based queries are impractical. Use `screen.queryByRole()` for negative assertions (`not.toBeInTheDocument()`).

**Rationale:**
Role-based queries align with Testing Library's guiding principle of testing the way users interact with the UI. They are also more resilient to text changes.

**Code Examples:**
```tsx
# From PR #7346
const legacyInviteButton = await screen.findByRole("link");
expect(legacyInviteButton).toBeVisible();
```

```tsx
# From PR #5641
expect(
  screen.getByRole("heading", { name: "title" }),
).toBeInTheDocument();
```

```tsx
# From PR #5637
expect(screen.getByRole("link", { name: "a link" })).toBeInTheDocument();
expect(
  screen.queryByRole("link", { name: "a link" }),
).not.toBeInTheDocument();
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 12. Mock Third-Party Libraries When Added

**Confidence:** High
**Frequency:** Moderate (~10+ PRs)
**Source PRs:** #6292

**Proposed Rule:**
> ALWAYS add `jest.mock()` for new third-party library hooks/functions in all existing test files that render components affected by the new dependency. NEVER leave test files broken by new library imports.

**Rationale:**
New library imports in production components break existing tests that mock the component's dependency tree. Adding mocks proactively prevents CI failures.

**Code Examples:**
```tsx
# From PR #6292 — Added next-navigation-guard mock to ApplyForm.test.tsx
jest.mock("next-navigation-guard", () => ({
  useNavigationGuard: () => jest.fn(),
}));
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 13. Playwright for All E2E Tests with Multi-Browser Support

**Confidence:** High
**Frequency:** Universal for E2E tests (~30+ PRs)
**Source PRs:** #8710, #8867

**Proposed Rule:**
> ALWAYS use Playwright for end-to-end tests. ALWAYS configure tests to run across Chromium, Firefox, WebKit, and Mobile Chrome. NEVER use Cypress or other E2E frameworks.

**Rationale:**
Playwright provides built-in multi-browser support, auto-waiting, and reliable cross-browser testing, which is critical for a government application that must work across all major browsers.

**Code Examples:**
```ts
# From PR #8710 — Standard E2E test structure
import { expect, test } from "@playwright/test";

test.describe("Search page - state persistence after refresh", () => {
  test("should retain status filter after refresh", async ({ page }) => {
    test.setTimeout(240_000);
    await goToSearch(page);
    await waitForSearchResultsInitialLoad(page);
    await ensureFilterDrawerOpen(page);
    // ... interactions and assertions
  });
});
```

```ts
# From PR #8867 — E2E test for form filling with authentication
import { expect, test } from "@playwright/test";

test.describe("fill SF-LLL Form", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    const isMobile = testInfo.project.name.match(/[Mm]obile/);
    await authenticateE2eUser(page, context, !!isMobile);
  });
  test.setTimeout(120000);

  test("should fill SFLLL form", async ({ page, context }, testInfo) => {
    // ...
  });
});
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 14. E2E Shared Utility Functions

**Confidence:** High
**Frequency:** High (~20+ PRs). Utilities expanded over time.
**Source PRs:** #8710

**Proposed Rule:**
> ALWAYS extract reusable E2E interactions (search submission, filter toggling, wait helpers, URL assertions) into shared utility files (`searchSpecUtil.ts`, `playwrightUtils.ts`). NEVER duplicate interaction logic across spec files.

**Rationale:**
E2E tests are inherently verbose. Shared utilities reduce duplication and make it easier to apply cross-browser fixes in one place.

**Code Examples:**
```ts
# From PR #8710 — Shared utilities for filter drawer and checkbox interactions
export async function ensureFilterDrawerOpen(page: Page) {
  const visibleStatusAccordion = page
    .locator('button[aria-controls="opportunity-filter-status"]:visible')
    .first();
  if (await visibleStatusAccordion.isVisible().catch(() => false)) {
    await page.waitForTimeout(200);
    return;
  }
  await toggleFilterDrawer(page);
  await page.waitForTimeout(800);
  // fallback logic...
}

export async function toggleCheckboxGroup(
  page: Page,
  checkboxObject: Record<string, string>,
) {
  for (const checkboxID of Object.keys(checkboxObject)) {
    await toggleCheckbox(page, checkboxID);
    await page.waitForTimeout(500);
  }
}
```

**Conflicting Examples:**
Reviewer doug-s-nava noted concerns about reuse in PR #8710: "is there a way to reuse this at all rather than writing from scratch?" -- suggesting some utility functions are being duplicated rather than extended.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 15. Use `data-testid` Over CSS Selectors in E2E Tests

**Confidence:** High
**Frequency:** Moderate (~3-5 instances of reviewer enforcement). Emerging norm.
**Source PRs:** #8710

**Proposed Rule:**
> ALWAYS prefer `data-testid` attributes for locating elements in E2E tests. NEVER use CSS class selectors (e.g., `.margin-left-4`) for E2E element selection when a `data-testid` can be added instead.

**Rationale:**
CSS classes can change for styling reasons, breaking E2E tests. `data-testid` attributes are semantically tied to testing and are stable across refactors.

**Code Examples:**
```ts
# From PR #8710 — Reviewer comment from doug-s-nava
> "would be great to be able to locate this without a margin styling class.
> Feel free to add a test id into the dom to make this easier"

# Updated from CSS class selector to data-testid:
// BEFORE: using CSS class selector
const subAgencyItems = page.locator(
  "#opportunity-filter-agency ul.margin-left-4 > li",
);

// AFTER: using data-testid
const subAgencyItems = page.locator('[data-testid="sub-agency-item"]');
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 16. Browser-Specific Workarounds in E2E Tests

**Confidence:** High
**Frequency:** High (~10+ PRs). Persistent challenge.
**Source PRs:** #8710

**Proposed Rule:**
> ALWAYS account for WebKit and Firefox behavioral differences in E2E tests. Use `pressSequentially` instead of `fill` for WebKit. Add `scrollIntoViewIfNeeded()` before interactions with elements in nested scrollable containers. Use retry patterns for interactions that are unreliable in specific browsers.

**Rationale:**
WebKit and Firefox have known differences in event dispatch, scroll behavior, and focus management. These workarounds ensure tests pass across all configured browsers.

**Code Examples:**
```ts
# From PR #8710 — Multi-strategy click with retry for nested scrollable elements
let selectedAndUpdated = false;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  if (await checkbox.isChecked()) {
    await page.evaluate((id) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.click();
    }, subAgency.id);
    await page.waitForTimeout(500);
  }
  // ... multiple click strategies
  try {
    await waitForURLContainsQueryParamValues(page, "agency", [subAgency.value], 60000);
    selectedAndUpdated = true;
    break;
  } catch (_e) {
    if (attempt === 3) throw _e;
  }
}
```

```ts
# From PR #8710 — pressSequentially for WebKit compatibility
// this needs to be `pressSequentially` rather than `fill` because `fill` was not
// reliably triggering onChange handlers in webkit
await searchInput.pressSequentially(term);
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** Reviewer doug-s-nava in PR #8710 raised concerns about accumulated timeouts affecting test duration: "If I have a concern it's how long all of this might take now with the timeouts adjusted." Should timeout budgets have formal limits?

---

### 17. E2E Test Flakiness Management via Skip/Un-skip

**Confidence:** High
**Frequency:** High (~10+ PRs). Visible skip/un-skip cycle across project history.
**Source PRs:** #4376, #4359, #8710

**Proposed Rule:**
> NEVER leave flaky E2E tests running and failing intermittently. ALWAYS use `test.skip()` to temporarily disable known-flaky tests, with a comment explaining why. ALWAYS un-skip tests in a follow-up PR once the root cause is fixed (e.g., better seed data, better selectors).

**Rationale:**
Flaky tests undermine CI reliability. Skipping with documentation preserves intent while preventing false failures. Fixing the root cause (seed data, better selectors) is always the goal.

**Code Examples:**
```ts
# From PR #4376 — Un-skipping previously-flaky tests after adding agency seed data
// BEFORE (PR #4359):
test.skip("should refresh and retain filters in a new tab", async ({ page }, ...

// AFTER (PR #4376):
test("should refresh and retain filters in a new tab", async ({ page }, ...
```

```ts
# From PR #8710 — Skipping an older test suite in favor of better replacements
test.describe.skip("Search page tests", () => {
  // ...
});
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** There is no formal tracking mechanism for skipped tests. Should a lint rule or periodic audit prevent tests from staying skipped indefinitely?

---

### 18. Page Object Model for E2E Form Tests (Emerging)

**Confidence:** Medium
**Frequency:** Low (~2 PRs). Newly introduced pattern (2026).
**Source PRs:** #8867

**Proposed Rule:**
> For E2E tests involving complex form interactions, ALWAYS use the Page Object Model (POM) pattern: separate test data into fixture files, form metadata/field mappings into page object files, and generic form-filling logic into shared utility files.

**Rationale:**
As the application adds more complex government forms, separating test data, page objects, and interaction logic prevents spec files from becoming unmanageably long and makes it easy to add tests for new form types.

**Code Examples:**
```ts
# From PR #8867 — Page object for SF-LLL form
// page-objects/sflll-form.page.ts
export const SFLLL_FORM_CONFIG = {
  formName: "Disclosure of Lobbying Activities (SF-LLL)",
  ...FORM_DEFAULTS,
} as const;

export function getSflllFillFields(data: SflllEntityData): FillFieldDefinition[] {
  return [
    { selector: "#federal_action_type", value: data.federalAction.type, type: "dropdown", section: "Section 1", field: "Type of Federal Action" },
    { testId: "material_change_year", value: data.materialChange.year, type: "text", section: "Section 3", field: "Material Change Year" },
    // ... many more fields
  ];
}
```

```ts
# From PR #8867 — Generic form-filling utility
// utils/forms/general-forms-filling.ts
export async function fillForm(testInfo: TestInfo, page: Page, config: FillFormConfig): Promise<void> {
  const { formName, fields, saveButtonTestId } = config;
  await page.getByRole("link", { name: formName }).click();
  for (const field of fields) {
    await fillField(testInfo, page, field);
  }
  await page.getByTestId(saveButtonTestId).click();
}
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** This pattern is new and has only been applied to one form type. Should this be the standard for all future form E2E tests or only for complex multi-section forms?

---

### 19. Snapshot Tests Used Selectively for Complex UI

**Confidence:** High
**Frequency:** Moderate (~15-20 PRs)
**Source PRs:** #5641, #4414

**Proposed Rule:**
> ALWAYS consider snapshot tests for complex UI components (tables, modals, multi-element layouts). NEVER use snapshot tests as the only test for a component -- pair them with behavioral tests. Use `it.skip` for snapshot tests during active development, and enable them once the component stabilizes.

**Rationale:**
Snapshots catch unintended visual regressions in complex UI. Skipping during active development prevents noisy snapshot update churn. PR #4414 documentation states: "feel free to rely on snapshot based tests rather than functional tests for [page level] components."

**Code Examples:**
```tsx
# From PR #5641 — Un-skipping snapshot tests once component was stable
// BEFORE:
it.skip("matches snapshot", () => { ... });

// AFTER:
it("matches snapshot", async () => {
  const component = await SearchResultsTable({
    searchResults: [mockOpportunity],
  });
  const { container } = render(component);
  expect(container).toMatchSnapshot();
});
```

**Conflicting Examples:**
PR #5021 contained a bug where `rerender` (a function) was passed to `toMatchSnapshot()` instead of `container`, producing a snapshot of `[Function]`. There is no guard against this.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** Could a lint rule catch the `rerender`-instead-of-`container` snapshot bug (PR #5021)?

---

### 20. Jest Environment Directive for Node-Specific Tests

**Confidence:** High
**Frequency:** Moderate (~5-10 PRs)
**Source PRs:** #7279

**Proposed Rule:**
> ALWAYS add the `@jest-environment node` directive at the top of test files that exercise API route handlers or server-only code incompatible with JSDOM.

**Rationale:**
The default Jest environment is JSDOM, which lacks certain Node APIs (e.g., `Request`, `Response`, `URLSearchParams.size`). Route handler tests and server utility tests need the Node environment.

**Code Examples:**
```ts
# From PR #7279 — API route handler test
/**
 * @jest-environment node
 */

import { updateOrganizationInvitation } from "src/app/api/user/organization-invitations/[organizationInvitationId]/handler";

describe("user/organization-invitations POST requests", () => {
  // ... tests for request/response handling
});
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 21. Avoid Duplicate `jest.mock` Blocks

**Confidence:** Medium
**Frequency:** Low (1 observed instance, but explicitly flagged by reviewer)
**Source PRs:** #6292

**Proposed Rule:**
> NEVER include duplicate `jest.mock()` calls for the same module in a single test file. ALWAYS check for existing mocks before adding new ones when modifying test files.

**Rationale:**
Duplicate mocks are confusing and can lead to subtle bugs if they diverge. Only the last `jest.mock()` call for a given module takes effect.

**Code Examples:**
```tsx
# From PR #6292 — Duplicate mock caught by reviewer
// First mock block (line ~46):
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));

// Duplicate mock block (line ~50) — reviewer said "can delete this":
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 22. Use Ternary Operator Over `&&` for Conditional Rendering

**Confidence:** Medium
**Frequency:** Low (1 explicit discussion in PR #7279), but team consensus to standardize.
**Source PRs:** #7279

**Proposed Rule:**
> ALWAYS use ternary operators (`condition ? <Component /> : <></>`) rather than `&&` for conditional rendering when the condition evaluates to a number (e.g., `.length`). The `&&` pattern can render `0` to the screen when the condition is falsy.

**Rationale:**
JavaScript's `&&` short-circuit returns the left operand when falsy. For numeric values like `0` (from `.length`), this means `0` renders visibly in React.

**Code Examples:**
```tsx
# From PR #7279 — Bug fix: && rendered "0" when array was empty
// BEFORE (bug: renders "0" when userInvitations is empty):
{userInvitations?.length && (
  <OrganizationInvitationReplies userInvitations={userInvitations} />
)}

// AFTER (correct):
{userInvitations?.length ? (
  <OrganizationInvitationReplies userInvitations={userInvitations} />
) : (
  <></>
)}
```

```
# Reviewer ErinPattisonNava commented:
> "In a past team we normed on always using the ternary operator because the
> && can produce unexpected results. I'd love it if that could be the standard here too."
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** This was discussed but not formally codified in the code style document (PR #4414). Should it be added as an official norm and possibly enforced via lint rule?

---

## Coverage Gaps

1. **No formal tracking of skipped E2E tests** — Tests are skipped with comments, but there is no registry, lint rule, or periodic audit to ensure they are re-enabled. Tests can stay skipped indefinitely.
2. **No E2E timeout budget policy** — Reviewer raised concerns about accumulated `waitForTimeout` calls. There is no formal limit on per-test or per-suite timeout budgets.
3. **No guard against snapshot anti-patterns** — The `rerender`-instead-of-`container` bug (PR #5021) produced a snapshot of `[Function]` that persisted undetected. No lint rule prevents this.
4. **`render` import source ambiguity** — Some tests import from `tests/react-utils`, others from `@testing-library/react`. No documentation clarifies when each should be used.

## Inconsistencies Requiring Resolution

### Test File Location (INC-6)

Frontend tests are in flux between two patterns:
- **Traditional:** `frontend/tests/components/<path>/<Component>.test.tsx`
- **Co-located:** `frontend/src/components/<path>/<Component>.test.tsx`

Both patterns coexist. No formal decision has been documented. Newer tests tend toward co-location.

**Question:** Should new tests be co-located with their components, or continue to live in the `tests/` directory? Is there a migration plan?

### Cross-Domain: Factory Pattern for Test Data (CCP-3)

The centralized `fixtures.ts` pattern on the frontend mirrors the `.build()` / `.create()` factory pattern on the API side. Both domains use centralized typed fixtures for test data. This consistency should be maintained.

### Cross-Domain: Accessibility Testing (CCP-7)

Accessibility testing via `jest-axe` is mandatory for all frontend components. E2E tests run across Chromium, Firefox, WebKit, and Mobile Chrome. This is a cross-cutting requirement that spans frontend-components, frontend-services, and frontend-tests domains.

### Ternary vs. `&&` for Conditional Rendering

This was raised in PR #7279 with team consensus to prefer ternary, but it has not been added to the code style document or enforced via lint rule. This is a component-level pattern that overlaps with the testing domain because the bug was caught during test-driven review.

**Question:** Should the ternary-over-`&&` rule be codified in the code style document and enforced via ESLint?
