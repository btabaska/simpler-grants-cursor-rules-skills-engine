# Pass 2: Pattern Codification -- Frontend Tests

**Domain:** `frontend/tests/`
**Source:** Pass 1 discovery document + 18 representative PRs reviewed
**Analysis date:** 2026-03-30

---

## Pattern 1: Jest + React Testing Library as the Unit Test Stack

### Rule Statement
ALWAYS use Jest as the test runner and `@testing-library/react` for component rendering in unit tests. NEVER introduce alternative test frameworks (e.g., Vitest, Enzyme) for frontend unit tests.

### Confidence
High

### Frequency
Near-universal across all unit tests (~200+ PRs)

### Code Examples

**PR #7346** -- New component test for `InviteLegacyUsersButton`:
```tsx
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

**PR #5637** -- New component test for `ScriptInjector`:
```tsx
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

### Rationale
Consistency across the codebase. React Testing Library encourages testing from the user's perspective (via roles, text, and accessibility queries) rather than testing implementation details.

### Open Questions
- Some tests import `render` from `tests/react-utils` instead of `@testing-library/react`. It is unclear when each import source should be used. Tech lead should clarify when the wrapper is required vs. optional.

---

## Pattern 2: Accessibility Test Per Component (jest-axe)

### Rule Statement
ALWAYS include a `jest-axe` accessibility scan as the first or second test in every component test suite. The test MUST use the standard pattern of rendering into a container and asserting `toHaveNoViolations()`.

### Confidence
High

### Frequency
High (~30+ PRs). Present in nearly every new component test suite.

### Code Examples

**PR #7346** -- `InviteLegacyUsersButton`:
```tsx
import { axe } from "jest-axe";

it("should not have accessibility violations", async () => {
  const { container } = render(
    <InviteLegacyUsersButton organizationId="org-123" />,
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

**PR #5008** -- `AgencyFilterAccordion`:
```tsx
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

**PR #4981** (deleted test, showing the established pattern in `SearchFilterToggleAll.test.tsx`):
```tsx
it("should not have basic accessibility issues", async () => {
  const { container } = render(
    <SearchFilterToggleAll
      onSelectAll={mockOnSelectAll}
      onClearAll={mockOnClearAll}
      isAllSelected={false}
      isNoneSelected={false}
    />,
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Rationale
Ensures baseline WCAG compliance. The project serves government users and must meet Section 508 accessibility standards.

### Open Questions
None. This pattern is very well established.

---

## Pattern 3: Mock next-intl via Shared intlMocks Utility

### Rule Statement
ALWAYS mock `next-intl` and `next-intl/server` translation functions using the shared utilities from `src/utils/testing/intlMocks.ts`. NEVER define custom inline translation mocks when the shared utilities exist.

### Confidence
High

### Frequency
Very High (~40+ PRs). Reviewer explicitly enforces this (PR #7346).

### Code Examples

**PR #7346** -- Using shared mock for server component:
```tsx
import { mockUseTranslations } from "src/utils/testing/intlMocks";

jest.mock("next-intl/server", () => ({
  getTranslations: () => mockUseTranslations,
}));
```

Reviewer comment from `doug-s-nava` in the same PR:
> "is there a reason [mockUseTranslations] doesn't work here?"

**PR #7346** -- ManageUsersPageContent test was updated to replace a custom translation mock with the shared one:
```tsx
// BEFORE (custom mock, replaced):
type TranslationFn = (key: string) => string;
const getTranslationsMock = jest.fn<Promise<TranslationFn>, [string]>(
  (_namespace: string) => Promise.resolve((key: string) => key),
);

// AFTER (shared mock):
import { mockUseTranslations } from "src/utils/testing/intlMocks";
jest.mock("next-intl/server", () => ({
  getTranslations: () => mockUseTranslations,
}));
```

**PR #5637** -- Client component mocking:
```tsx
import { useTranslationsMock } from "src/utils/testing/intlMocks";

jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

### Rationale
Centralizes translation mock behavior so changes only need to be made in one place. The mock returns the translation key as the rendered string, making assertions simple and predictable.

### Open Questions
None. Reviewer actively enforces this.

---

## Pattern 4: Mock next/navigation Hooks with requireActual Spread

### Rule Statement
ALWAYS mock `next/navigation` hooks (useRouter, usePathname, useSearchParams) when testing components that depend on them. ALWAYS use `jest.requireActual` spread to preserve unmocked exports.

### Confidence
High

### Frequency
High (~20+ PRs)

### Code Examples

**PR #5637** -- `ScriptInjector.test.tsx`:
```tsx
const usePathnameMock = jest.fn();

jest.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock() as string,
}));
```

**PR #4304** -- Standard pattern with `requireActual`:
```tsx
jest.mock("next/navigation", () => ({
  ...jest.requireActual<typeof import("next/navigation")>("next/navigation"),
  useRouter: () => ({ push: () => {} }),
  usePathname: () => usePathnameMock() as string,
  useSearchParams: () => new URLSearchParams(),
}));
```

### Rationale
Next.js navigation hooks require browser-like context that is unavailable in the Jest JSDOM environment. The `requireActual` spread ensures other exports (e.g., `ReadonlyURLSearchParams`) remain available.

### Open Questions
None.

---

## Pattern 5: Direct Invocation for Async Server Components

### Rule Statement
ALWAYS test async server components by calling the component function directly and passing the return value to `render()`. NEVER use JSX syntax (`<Component />`) for async server components in tests, as React Testing Library cannot render them directly.

### Confidence
High

### Frequency
High (~15+ PRs). Growing as more server components are added.

### Code Examples

**PR #7346** -- `InviteLegacyUsersButton` (async server component):
```tsx
it("confirm the URL is correct", async () => {
  const organizationId = "org-123";
  const component = await InviteLegacyUsersButton({ organizationId });
  render(component);
  const legacyInviteButton = await screen.findByRole("link");
  expect(legacyInviteButton).toBeVisible();
});
```

**PR #5008** -- `AgencyFilterAccordion` (async server component):
```tsx
it("renders async component (asserting on mock suspended state)", async () => {
  const component = await AgencyFilterAccordion({
    agencyOptionsPromise: Promise.resolve([fakeOptions, fakeSearchAPIResponse]),
    query: new Set(),
  });
  render(component);
  // assertions...
});
```

**PR #5641** -- `SearchResultsTable`:
```tsx
it("displays a proper message when there are no results", async () => {
  const component = await SearchResultsTable({
    searchResults: [],
  });
  render(component);
  expect(screen.queryAllByRole("row")).toHaveLength(0);
});
```

### Rationale
Next.js async server components return Promises. React Testing Library's `render()` does not support async component functions in JSX. Calling the function directly and awaiting the result is the established workaround.

### Open Questions
None. Well-established pattern.

---

## Pattern 6: Shared Test Fixtures in fixtures.ts

### Rule Statement
ALWAYS define reusable mock data objects in `src/utils/testing/fixtures.ts` rather than inline in individual test files. When a new entity type is added, ALWAYS add its mock fixture to this central file.

### Confidence
High

### Frequency
High (~25+ PRs). Fixtures file expanded repeatedly over the project history.

### Code Examples

**PR #7279** -- Using `fakeOrganizationInvitation` from shared fixtures:
```tsx
import { fakeOrganizationInvitation } from "src/utils/testing/fixtures";

beforeEach(() => {
  mockUpdateOrganizationInvitation.mockResolvedValue({
    json: () => Promise.resolve({ data: fakeOrganizationInvitation }),
  });
});
```

**PR #5008** -- Using `fakeSearchAPIResponse`:
```tsx
import { fakeSearchAPIResponse } from "src/utils/testing/fixtures";

const component = await AgencyFilterAccordion({
  agencyOptionsPromise: Promise.resolve([fakeOptions, fakeSearchAPIResponse]),
  query: new Set(),
});
```

**PR #4997** -- Using `fakeSavedSearch`:
```tsx
import { fakeSavedSearch } from "src/utils/testing/fixtures";
```

### Rationale
Centralizing fixtures reduces duplication and ensures consistency. When API shapes change, only the fixture file needs updating.

### Open Questions
None.

---

## Pattern 7: Type Hacks Accepted in Test Mocks

### Rule Statement
ALWAYS feel free to use `as unknown` casts, loose typing (`...args: unknown[]`), and other typing shortcuts in `jest.mock` factory functions within test files. NEVER spend excessive time solving complex type issues in test mocks.

### Confidence
High

### Frequency
Documented norm (PR #4414). Applied across many PRs.

### Code Examples

**PR #7279** -- `as unknown` cast in mock factory:
```tsx
jest.mock("src/services/fetch/fetchers/fetchers", () => ({
  fetchUserWithMethod: () => (opts: unknown) =>
    mockUpdateOrganizationInvitation(opts) as unknown,
}));
```

**PR #5637** -- `as unknown` and `as string` casts:
```tsx
jest.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock() as string,
}));

jest.mock("src/utils/injectableScripts", () => ({
  injectableScriptConfig: {
    test: {
      tag: <a href="wherever">a link</a>,
      gate: () => mockGate() as unknown,
    },
  },
}));
```

**PR #4414** -- Official code style documentation:
> "Do not feel bad about hacking around or otherwise not following best typing practices in order to solve problems with typing in unit or e2e test files."

### Rationale
Test mock factories operate outside TypeScript's module system and frequently hit type inference limitations. The team decided the cost of perfect typing in mocks outweighs the benefit.

### Open Questions
None. Explicitly codified in project documentation.

---

## Pattern 8: Mock Auth Session with getSession Pattern

### Rule Statement
ALWAYS mock `src/services/auth/session` using a `jest.fn()` reference when testing components or handlers that depend on user authentication. NEVER import real session logic in unit tests.

### Confidence
High

### Frequency
High (~15+ PRs)

### Code Examples

**PR #7279** -- API route handler test:
```tsx
const getSessionMock = jest.fn();

jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));

// In test setup:
getSessionMock.mockReturnValue({ token: "a token", user_id: "1" });
```

**PR #6292** -- `ApplyForm.test.tsx` (note: this PR had a duplicate mock block caught by reviewer):
```tsx
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));
```

### Rationale
Authentication involves external services (login.gov, JWT verification) that cannot run in a unit test environment.

### Open Questions
None.

---

## Pattern 9: Use waitFor for Async State Assertions

### Rule Statement
ALWAYS use `waitFor` from `@testing-library/react` when asserting on state that updates asynchronously after render. NEVER rely on synchronous assertions for values that depend on React state updates or async operations.

### Confidence
High

### Frequency
Moderate (~10+ PRs). Became more important after React version upgrades.

### Code Examples

**PR #4997** -- Fixed flaky tests by adding `waitFor`:
```tsx
import { waitFor } from "@testing-library/react";

// BEFORE (flaky):
expect((options[1] as HTMLOptionElement).selected).toEqual(true);

// AFTER (stable):
await waitFor(() =>
  expect((options[1] as HTMLOptionElement).selected).toEqual(true),
);
```

**PR #4997** -- Another fix in the same file:
```tsx
await waitFor(() => {
  const selectedOption = screen.getByRole("option", { selected: true });
  return expect(selectedOption).toHaveTextContent(fakeSavedSearchRecord.name);
});
```

### Rationale
React 19 changed some internal batching behavior, causing previously synchronous state updates to become asynchronous. Using `waitFor` makes tests resilient to timing changes.

### Open Questions
None.

---

## Pattern 10: Components and Their Tests Are Deleted Together

### Rule Statement
ALWAYS delete a component's test file in the same PR that deletes the component. NEVER leave orphaned test files for removed components.

### Confidence
High

### Frequency
Moderate (~10 PRs). Consistently applied.

### Code Examples

**PR #4981** -- Removed `SearchFilterToggleAll.tsx` and its test in the same PR:
- Deleted: `frontend/src/components/search/SearchFilterAccordion/SearchFilterToggleAll.tsx`
- Deleted: `frontend/tests/components/search/SearchFilterAccordion/SearchFilterToggleAll.test.tsx`
- Also removed related test assertions from `SearchFilterAccordion.test.tsx`

### Rationale
Keeps the test suite in sync with the codebase. Orphaned tests cause confusion and false confidence in coverage metrics.

### Open Questions
None.

---

## Pattern 11: Prefer Role-Based Queries in Assertions

### Rule Statement
ALWAYS prefer `screen.getByRole()` / `screen.findByRole()` for element queries in tests. Use `screen.getByText()` only for simpler assertions where role-based queries are impractical. Use `screen.queryByRole()` for negative assertions (`not.toBeInTheDocument()`).

### Confidence
High

### Frequency
High. Increasingly preferred over `getByText`.

### Code Examples

**PR #7346**:
```tsx
const legacyInviteButton = await screen.findByRole("link");
expect(legacyInviteButton).toBeVisible();
```

**PR #5641**:
```tsx
expect(
  screen.getByRole("heading", { name: "title" }),
).toBeInTheDocument();
```

**PR #5637**:
```tsx
expect(screen.getByRole("link", { name: "a link" })).toBeInTheDocument();
expect(
  screen.queryByRole("link", { name: "a link" }),
).not.toBeInTheDocument();
```

### Rationale
Role-based queries align with Testing Library's guiding principle of testing the way users interact with the UI. They are also more resilient to text changes.

### Open Questions
None.

---

## Pattern 12: Mock Third-Party Libraries When Added

### Rule Statement
ALWAYS add `jest.mock()` for new third-party library hooks/functions in all existing test files that render components affected by the new dependency. NEVER leave test files broken by new library imports.

### Confidence
High

### Frequency
Moderate (~10+ PRs)

### Code Examples

**PR #6292** -- Added `next-navigation-guard` mock to `ApplyForm.test.tsx`:
```tsx
jest.mock("next-navigation-guard", () => ({
  useNavigationGuard: () => jest.fn(),
}));
```

Reviewer `doug-s-nava` also caught a duplicate mock block in the same file and commented:
> "can delete this"

### Rationale
New library imports in production components break existing tests that mock the component's dependency tree. Adding mocks proactively prevents CI failures.

### Open Questions
None.

---

## Pattern 13: Playwright for All E2E Tests with Multi-Browser Support

### Rule Statement
ALWAYS use Playwright for end-to-end tests. ALWAYS configure tests to run across Chromium, Firefox, WebKit, and Mobile Chrome. NEVER use Cypress or other E2E frameworks.

### Confidence
High

### Frequency
Universal for E2E tests (~30+ PRs)

### Code Examples

**PR #8710** -- Standard E2E test structure:
```ts
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

**PR #8867** -- E2E test for form filling with authentication:
```ts
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

### Rationale
Playwright provides built-in multi-browser support, auto-waiting, and reliable cross-browser testing, which is critical for a government application that must work across all major browsers.

### Open Questions
None.

---

## Pattern 14: E2E Shared Utility Functions

### Rule Statement
ALWAYS extract reusable E2E interactions (search submission, filter toggling, wait helpers, URL assertions) into shared utility files (`searchSpecUtil.ts`, `playwrightUtils.ts`). NEVER duplicate interaction logic across spec files.

### Confidence
High

### Frequency
High (~20+ PRs). Utilities expanded over time.

### Code Examples

**PR #8710** -- Shared utilities for filter drawer and checkbox interactions:
```ts
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

### Rationale
E2E tests are inherently verbose. Shared utilities reduce duplication and make it easier to apply cross-browser fixes in one place.

### Open Questions
- Reviewer `doug-s-nava` noted concerns about reuse in PR #8710: "is there a way to reuse this at all rather than writing from scratch?" -- suggesting some utility functions are being duplicated rather than extended.

---

## Pattern 15: Use data-testid Over CSS Selectors in E2E Tests

### Rule Statement
ALWAYS prefer `data-testid` attributes for locating elements in E2E tests. NEVER use CSS class selectors (e.g., `.margin-left-4`) for E2E element selection when a `data-testid` can be added instead.

### Confidence
High

### Frequency
Moderate (~3-5 instances of reviewer enforcement). Emerging norm.

### Code Examples

**PR #8710** -- Reviewer comment from `doug-s-nava`:
> "would be great to be able to locate this without a margin styling class. Feel free to add a test id into the dom to make this easier"

This led to the code being updated from:
```ts
// BEFORE: using CSS class selector
const subAgencyItems = page.locator(
  "#opportunity-filter-agency ul.margin-left-4 > li",
);
```
to using `data-testid`:
```ts
// AFTER: using data-testid
const subAgencyItems = page.locator('[data-testid="sub-agency-item"]');
```

### Rationale
CSS classes can change for styling reasons, breaking E2E tests. `data-testid` attributes are semantically tied to testing and are stable across refactors.

### Open Questions
None.

---

## Pattern 16: Browser-Specific Workarounds in E2E Tests

### Rule Statement
ALWAYS account for WebKit and Firefox behavioral differences in E2E tests. Use `pressSequentially` instead of `fill` for WebKit. Add `scrollIntoViewIfNeeded()` before interactions with elements in nested scrollable containers. Use retry patterns for interactions that are unreliable in specific browsers.

### Confidence
High

### Frequency
High (~10+ PRs). Persistent challenge.

### Code Examples

**PR #8710** -- Multi-strategy click with retry for nested scrollable elements:
```ts
// Step 6: Click the sub-agency checkbox with robust cross-browser approach
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

**PR #8710** -- `pressSequentially` for WebKit compatibility:
```ts
// this needs to be `pressSequentially` rather than `fill` because `fill` was not
// reliably triggering onChange handlers in webkit
await searchInput.pressSequentially(term);
```

### Rationale
WebKit and Firefox have known differences in event dispatch, scroll behavior, and focus management. These workarounds ensure tests pass across all configured browsers.

### Open Questions
- Reviewer `doug-s-nava` in PR #8710 raised concerns about accumulated timeouts affecting test duration: "If I have a concern it's how long all of this might take now with the timeouts adjusted." Tech lead should evaluate whether timeout budgets need formal limits.

---

## Pattern 17: E2E Test Flakiness Management via Skip/Un-skip

### Rule Statement
NEVER leave flaky E2E tests running and failing intermittently. ALWAYS use `test.skip()` to temporarily disable known-flaky tests, with a comment explaining why. ALWAYS un-skip tests in a follow-up PR once the root cause is fixed (e.g., better seed data, better selectors).

### Confidence
High

### Frequency
High (~10+ PRs). Visible skip/un-skip cycle across project history.

### Code Examples

**PR #4376** -- Un-skipping previously-flaky tests after adding agency seed data:
```ts
// BEFORE (PR #4359):
test.skip("should refresh and retain filters in a new tab", async ({ page }, ...

// AFTER (PR #4376):
test("should refresh and retain filters in a new tab", async ({ page }, ...
```

**PR #8710** -- Skipping an older test suite in favor of better replacements:
```ts
test.describe.skip("Search page tests", () => {
  // ...
});
```

### Rationale
Flaky tests undermine CI reliability. Skipping with documentation preserves intent while preventing false failures. Fixing the root cause (seed data, better selectors) is always the goal.

### Open Questions
- There is no formal tracking mechanism for skipped tests. Tech lead should consider whether a lint rule or periodic audit is needed to prevent tests from staying skipped indefinitely.

---

## Pattern 18: Page Object Model for E2E Form Tests (Emerging)

### Rule Statement
For E2E tests involving complex form interactions, ALWAYS use the Page Object Model (POM) pattern: separate test data into fixture files, form metadata/field mappings into page object files, and generic form-filling logic into shared utility files.

### Confidence
Medium

### Frequency
Low (~2 PRs). Newly introduced pattern (2026).

### Code Examples

**PR #8867** -- Page object for SF-LLL form:
```ts
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

**PR #8867** -- Generic form-filling utility:
```ts
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

**PR #8867** -- Test data fixture:
```ts
// fixtures/test-data-for-sflll-forms.fixture.ts
export const FORMS_TEST_DATA = {
  sflll: {
    form: { name: "Disclosure of Lobbying Activities (SF-LLL)" },
    federalAction: { type: "Grant", status: "BidOffer", reportType: "MaterialChange" },
    // ... structured test data
  },
} as const;
```

### Rationale
As the application adds more complex government forms, separating test data, page objects, and interaction logic prevents spec files from becoming unmanageably long and makes it easy to add tests for new form types.

### Open Questions
- This pattern is new and has only been applied to one form type. Tech lead should confirm whether this should be the standard for all future form E2E tests or only for complex multi-section forms.

---

## Pattern 19: Snapshot Tests Used Selectively for Complex UI

### Rule Statement
ALWAYS consider snapshot tests for complex UI components (tables, modals, multi-element layouts). NEVER use snapshot tests as the only test for a component -- pair them with behavioral tests. Use `it.skip` for snapshot tests during active development, and enable them once the component stabilizes.

### Confidence
High

### Frequency
Moderate (~15-20 PRs)

### Code Examples

**PR #5641** -- Un-skipping snapshot tests once component was stable:
```tsx
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

### Rationale
Snapshots catch unintended visual regressions in complex UI. Skipping during active development prevents noisy snapshot update churn. PR #4414 documentation states: "feel free to rely on snapshot based tests rather than functional tests for [page level] components."

### Open Questions
- PR #5021 contained a bug where `rerender` (a function) was passed to `toMatchSnapshot()` instead of `container`, producing a snapshot of `[Function]`. There is no guard against this. Tech lead should consider whether a lint rule could catch this.

---

## Pattern 20: Jest Environment Directive for Node-Specific Tests

### Rule Statement
ALWAYS add the `@jest-environment node` directive at the top of test files that exercise API route handlers or server-only code incompatible with JSDOM.

### Confidence
High

### Frequency
Moderate (~5-10 PRs)

### Code Examples

**PR #7279** -- API route handler test:
```ts
/**
 * @jest-environment node
 */

import { updateOrganizationInvitation } from "src/app/api/user/organization-invitations/[organizationInvitationId]/handler";

describe("user/organization-invitations POST requests", () => {
  // ... tests for request/response handling
});
```

### Rationale
The default Jest environment is JSDOM, which lacks certain Node APIs (e.g., `Request`, `Response`, `URLSearchParams.size`). Route handler tests and server utility tests need the Node environment.

### Open Questions
None.

---

## Pattern 21: Avoid Duplicate jest.mock Blocks

### Rule Statement
NEVER include duplicate `jest.mock()` calls for the same module in a single test file. ALWAYS check for existing mocks before adding new ones when modifying test files.

### Confidence
Medium

### Frequency
Low (1 observed instance, but explicitly flagged by reviewer)

### Code Examples

**PR #6292** -- Duplicate mock caught by reviewer:
```tsx
// First mock block (line ~46):
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));

// Duplicate mock block (line ~50) -- reviewer said "can delete this":
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));
```

### Rationale
Duplicate mocks are confusing and can lead to subtle bugs if they diverge. Only the last `jest.mock()` call for a given module takes effect.

### Open Questions
None.

---

## Pattern 22: Use Ternary Operator Over && for Conditional Rendering

### Rule Statement
ALWAYS use ternary operators (`condition ? <Component /> : <></>`) rather than `&&` for conditional rendering when the condition evaluates to a number (e.g., `.length`). The `&&` pattern can render `0` to the screen when the condition is falsy.

### Confidence
Medium

### Frequency
Low (1 explicit discussion in PR #7279), but team consensus to standardize.

### Code Examples

**PR #7279** -- Bug fix: `&&` rendered `0` when array was empty:
```tsx
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

Reviewer `ErinPattisonNava` commented:
> "In a past team we normed on always using the ternary operator because the && can produce unexpected results. I'd love it if that could be the standard here too."

### Rationale
JavaScript's `&&` short-circuit returns the left operand when falsy. For numeric values like `0` (from `.length`), this means `0` renders visibly in React.

### Open Questions
- This was discussed but not formally codified in the code style document (PR #4414). Tech lead should confirm if this should be added as an official norm and possibly enforced via lint rule.

---

## Summary Table

| # | Pattern Name | Rule | Confidence | Frequency |
|---|---|---|---|---|
| 1 | Jest + RTL Stack | ALWAYS use Jest + React Testing Library | High | Universal |
| 2 | Accessibility Test Per Component | ALWAYS include jest-axe scan | High | High |
| 3 | Shared intlMocks for Translations | ALWAYS use shared intlMocks.ts | High | Very High |
| 4 | Mock next/navigation with requireActual | ALWAYS mock navigation hooks | High | High |
| 5 | Direct Invocation for Async Components | ALWAYS call async components directly | High | High |
| 6 | Shared Fixtures in fixtures.ts | ALWAYS centralize mock data | High | High |
| 7 | Type Hacks in Test Mocks | ALWAYS accept typing shortcuts in mocks | High | Documented |
| 8 | Mock Auth Session | ALWAYS mock session with jest.fn() | High | High |
| 9 | waitFor for Async Assertions | ALWAYS use waitFor for async state | High | Moderate |
| 10 | Co-delete Components and Tests | ALWAYS delete tests with components | High | Moderate |
| 11 | Role-Based Queries | ALWAYS prefer getByRole/findByRole | High | High |
| 12 | Mock New Third-Party Libraries | ALWAYS add mocks for new dependencies | High | Moderate |
| 13 | Playwright Multi-Browser E2E | ALWAYS use Playwright across browsers | High | Universal |
| 14 | Shared E2E Utilities | ALWAYS extract reusable E2E logic | High | High |
| 15 | data-testid Over CSS Selectors | ALWAYS prefer data-testid in E2E | High | Moderate |
| 16 | Browser-Specific Workarounds | ALWAYS handle WebKit/Firefox quirks | High | High |
| 17 | Flakiness via Skip/Un-skip | ALWAYS skip flaky tests with comments | High | High |
| 18 | Page Object Model for Forms | Use POM for complex form E2E tests | Medium | Low |
| 19 | Selective Snapshot Tests | Use snapshots for complex UI, skip during dev | High | Moderate |
| 20 | Jest Node Environment Directive | ALWAYS add @jest-environment node for server tests | High | Moderate |
| 21 | No Duplicate jest.mock Blocks | NEVER duplicate jest.mock for same module | Medium | Low |
| 22 | Ternary Over && for Conditionals | ALWAYS use ternary when condition is numeric | Medium | Low |
