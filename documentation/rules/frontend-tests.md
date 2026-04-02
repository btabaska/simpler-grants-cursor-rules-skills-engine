# Frontend Tests -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a pending
> marker are awaiting team confirmation. All other patterns reflect
> high-confidence conventions observed consistently across the codebase.

## Overview

The simpler-grants-gov frontend uses a two-tier testing strategy: Jest with React Testing Library for unit/component tests, and Playwright for end-to-end tests. Every new component is expected to include an accessibility scan using `jest-axe`, and snapshot tests are used selectively for complex UI. The testing approach emphasizes testing from the user's perspective via role-based queries and asserting on translation keys rather than actual text content.

The unit test infrastructure relies heavily on shared utilities: `intlMocks.ts` for translation mocking, `fixtures.ts` for centralized test data, and consistent patterns for mocking Next.js navigation hooks, auth sessions, and third-party libraries. Async server components are tested by calling the component function directly rather than using JSX syntax. Type hacks in test mocks are explicitly permitted by the code style guide.

End-to-end tests run across Chromium, Firefox, WebKit, and Mobile Chrome using Playwright. Reusable interaction logic is extracted into shared utility files, and elements are located using `data-testid` attributes rather than CSS class selectors. Browser-specific workarounds (especially for WebKit) are documented inline, and flaky tests are managed through a disciplined skip/un-skip cycle.

## Rules

### Unit Test Framework

#### Rule: Jest + React Testing Library as the Unit Test Stack

**Confidence:** High
**Observed in:** Near-universal across all unit tests (~200+ PRs) | PR refs: #7346, #5637

ALWAYS use Jest as the test runner and `@testing-library/react` for component rendering in unit tests. NEVER introduce alternative test frameworks (e.g., Vitest, Enzyme) for frontend unit tests.

**DO:**
```tsx
// From PR #7346 -- new component test for InviteLegacyUsersButton
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

**DON'T:**
```tsx
// Anti-pattern -- using Enzyme or other frameworks
import { shallow } from "enzyme";
const wrapper = shallow(<InviteLegacyUsersButton />);
```

> **Rationale:** Consistency across the codebase. React Testing Library encourages testing from the user's perspective (via roles, text, and accessibility queries) rather than testing implementation details.

---

#### Rule: Accessibility Test Per Component (jest-axe)

**Confidence:** High
**Observed in:** ~30+ PRs; present in nearly every new component test suite | PR refs: #7346, #5008, #4981

ALWAYS include a `jest-axe` accessibility scan as the first or second test in every component test suite. The test MUST use the standard pattern of rendering into a container and asserting `toHaveNoViolations()`.

**DO:**
```tsx
// From PR #7346 -- InviteLegacyUsersButton
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
// From PR #5008 -- async server component accessibility test
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

**DON'T:**
```tsx
// Anti-pattern -- no accessibility test in component test suite
describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent />);
    // no axe check -- missing WCAG validation
  });
});
```

> **Rationale:** Ensures baseline WCAG compliance. The project serves government users and must meet Section 508 accessibility standards.

---

#### Rule: Selective Snapshot Tests for Complex UI

**Confidence:** High
**Observed in:** ~15-20 PRs | PR refs: #5641, #4414

ALWAYS consider snapshot tests for complex UI components (tables, modals, multi-element layouts). NEVER use snapshot tests as the only test for a component -- pair them with behavioral tests. Use `it.skip` for snapshot tests during active development, and enable them once the component stabilizes.

**DO:**
```tsx
// From PR #5641 -- un-skipping snapshot tests once component was stable
it("matches snapshot", async () => {
  const component = await SearchResultsTable({
    searchResults: [mockOpportunity],
  });
  const { container } = render(component);
  expect(container).toMatchSnapshot();
});
```

**DON'T:**
```tsx
// Anti-pattern -- snapshot as the only test (no behavioral assertions)
describe("ComplexTable", () => {
  it("matches snapshot", () => {
    const { container } = render(<ComplexTable data={mockData} />);
    expect(container).toMatchSnapshot();
    // no accessibility test, no behavioral tests
  });
});
```

> **Rationale:** Snapshots catch unintended visual regressions in complex UI. Skipping during active development prevents noisy snapshot update churn. PR #4414 documentation states: "feel free to rely on snapshot based tests rather than functional tests for [page level] components."

---

### Mocking Patterns

#### Rule: Mock next-intl via Shared intlMocks Utility

**Confidence:** High
**Observed in:** ~40+ PRs; reviewer explicitly enforces this | PR refs: #7346, #5637

ALWAYS mock `next-intl` and `next-intl/server` translation functions using the shared utilities from `src/utils/testing/intlMocks.ts`. NEVER define custom inline translation mocks when the shared utilities exist. See `frontend-i18n.md` for the full i18n testing convention.

**DO:**
```tsx
// From PR #5637 -- client component mocking
import { useTranslationsMock } from "src/utils/testing/intlMocks";

jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

```tsx
// From PR #7346 -- server component mocking
import { mockUseTranslations } from "src/utils/testing/intlMocks";

jest.mock("next-intl/server", () => ({
  getTranslations: () => mockUseTranslations,
}));
```

**DON'T:**
```tsx
// Anti-pattern -- custom translation mock (replaced in PR #7346)
type TranslationFn = (key: string) => string;
const getTranslationsMock = jest.fn<Promise<TranslationFn>, [string]>(
  (_namespace: string) => Promise.resolve((key: string) => key),
);
```

> **Rationale:** Centralizes translation mock behavior so changes only need to be made in one place. The mock returns the translation key as the rendered string, making assertions simple and predictable. Reviewer (doug-s-nava, PR #7346): "is there a reason [mockUseTranslations] doesn't work here?"

---

#### Rule: Mock next/navigation Hooks with `requireActual` Spread

**Confidence:** High
**Observed in:** ~20+ PRs | PR refs: #4304, #5637

ALWAYS mock `next/navigation` hooks (useRouter, usePathname, useSearchParams) when testing components that depend on them. ALWAYS use `jest.requireActual` spread to preserve unmocked exports.

**DO:**
```tsx
// From PR #4304 -- standard pattern with requireActual
jest.mock("next/navigation", () => ({
  ...jest.requireActual<typeof import("next/navigation")>("next/navigation"),
  useRouter: () => ({ push: () => {} }),
  usePathname: () => usePathnameMock() as string,
  useSearchParams: () => new URLSearchParams(),
}));
```

**DON'T:**
```tsx
// Anti-pattern -- mocking without requireActual (loses other exports)
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  // missing usePathname, useSearchParams, ReadonlyURLSearchParams, etc.
}));
```

> **Rationale:** Next.js navigation hooks require browser-like context unavailable in the Jest JSDOM environment. The `requireActual` spread ensures other exports (e.g., `ReadonlyURLSearchParams`) remain available.

---

#### Rule: Mock Auth Session with `getSession` Pattern

**Confidence:** High
**Observed in:** ~15+ PRs | PR refs: #7279, #6292

ALWAYS mock `src/services/auth/session` using a `jest.fn()` reference when testing components or handlers that depend on user authentication. NEVER import real session logic in unit tests.

**DO:**
```tsx
// From PR #7279 -- API route handler test
const getSessionMock = jest.fn();

jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));

// In test setup:
getSessionMock.mockReturnValue({ token: "a token", user_id: "1" });
```

**DON'T:**
```tsx
// Anti-pattern -- importing real session logic in tests
import { getSession } from "src/services/auth/session";
// will try to access cookies, JWT verification, etc.
```

> **Rationale:** Authentication involves external services (login.gov, JWT verification) that cannot run in a unit test environment.

---

#### Rule: Type Hacks Accepted in Test Mocks

**Confidence:** High
**Observed in:** Documented norm (PR #4414); applied across many PRs | PR refs: #7279, #5637, #4414

ALWAYS feel free to use `as unknown` casts, loose typing (`...args: unknown[]`), and other typing shortcuts in `jest.mock` factory functions within test files. NEVER spend excessive time solving complex type issues in test mocks.

**DO:**
```tsx
// From PR #7279 -- as unknown cast in mock factory
jest.mock("src/services/fetch/fetchers/fetchers", () => ({
  fetchUserWithMethod: () => (opts: unknown) =>
    mockUpdateOrganizationInvitation(opts) as unknown,
}));
```

```tsx
// From PR #5637 -- as string cast
jest.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock() as string,
}));
```

**DON'T:**
```tsx
// Anti-pattern -- spending excessive time on perfect mock typing
// PR #4414 documentation: "Do not feel bad about hacking around or otherwise
// not following best typing practices in order to solve problems with typing
// in unit or e2e test files."
```

> **Rationale:** Test mock factories operate outside TypeScript's module system and frequently hit type inference limitations. The team decided the cost of perfect typing in mocks outweighs the benefit.

---

#### Rule: Mock New Third-Party Libraries When Added

**Confidence:** High
**Observed in:** ~10+ PRs | PR refs: #6292

ALWAYS add `jest.mock()` for new third-party library hooks/functions in all existing test files that render components affected by the new dependency. NEVER leave test files broken by new library imports.

**DO:**
```tsx
// From PR #6292 -- added next-navigation-guard mock to ApplyForm.test.tsx
jest.mock("next-navigation-guard", () => ({
  useNavigationGuard: () => jest.fn(),
}));
```

**DON'T:**
```
# Anti-pattern -- adding a new library import to a component without
# updating the mock in its test file, causing CI failures
```

> **Rationale:** New library imports in production components break existing tests that mock the component's dependency tree. Adding mocks proactively prevents CI failures.

---

#### Rule: No Duplicate `jest.mock` Blocks

**Confidence:** Medium (Pending)
**Observed in:** 1 observed instance, explicitly flagged by reviewer | PR refs: #6292

NEVER include duplicate `jest.mock()` calls for the same module in a single test file. ALWAYS check for existing mocks before adding new ones when modifying test files.

**DO:**
```tsx
// Single mock block per module
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));
```

**DON'T:**
```tsx
// From PR #6292 -- duplicate mock caught by reviewer
// First mock block (line ~46):
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));

// Duplicate mock block (line ~50) -- reviewer said "can delete this":
jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));
```

> **Rationale:** Duplicate mocks are confusing and can lead to subtle bugs if they diverge. Only the last `jest.mock()` call for a given module takes effect.

---

### Async Component Testing

#### Rule: Direct Invocation for Async Server Components

**Confidence:** High
**Observed in:** ~15+ PRs; growing as more server components are added | PR refs: #7346, #5008, #5641

ALWAYS test async server components by calling the component function directly and passing the return value to `render()`. NEVER use JSX syntax (`<Component />`) for async server components in tests, as React Testing Library cannot render them directly.

**DO:**
```tsx
// From PR #7346 -- InviteLegacyUsersButton (async server component)
it("confirm the URL is correct", async () => {
  const organizationId = "org-123";
  const component = await InviteLegacyUsersButton({ organizationId });
  render(component);
  const legacyInviteButton = await screen.findByRole("link");
  expect(legacyInviteButton).toBeVisible();
});
```

```tsx
// From PR #5641 -- SearchResultsTable
it("displays a proper message when there are no results", async () => {
  const component = await SearchResultsTable({
    searchResults: [],
  });
  render(component);
  expect(screen.queryAllByRole("row")).toHaveLength(0);
});
```

**DON'T:**
```tsx
// Anti-pattern -- JSX syntax with async server components
it("renders", async () => {
  render(<SearchResultsTable searchResults={[]} />);
  // TypeError: Objects are not valid as a React child (Promise)
});
```

> **Rationale:** Next.js async server components return Promises. React Testing Library's `render()` does not support async component functions in JSX. Calling the function directly and awaiting the result is the established workaround.

---

### Test Data and Assertions

#### Rule: Shared Test Fixtures in `fixtures.ts`

**Confidence:** High
**Observed in:** ~25+ PRs; fixtures file expanded repeatedly | PR refs: #7279, #5008, #4997

ALWAYS define reusable mock data objects in `src/utils/testing/fixtures.ts` rather than inline in individual test files. When a new entity type is added, ALWAYS add its mock fixture to this central file.

**DO:**
```tsx
// From PR #7279 -- using shared fixture
import { fakeOrganizationInvitation } from "src/utils/testing/fixtures";

beforeEach(() => {
  mockUpdateOrganizationInvitation.mockResolvedValue({
    json: () => Promise.resolve({ data: fakeOrganizationInvitation }),
  });
});
```

```tsx
// From PR #5008 -- using fakeSearchAPIResponse
import { fakeSearchAPIResponse } from "src/utils/testing/fixtures";

const component = await AgencyFilterAccordion({
  agencyOptionsPromise: Promise.resolve([fakeOptions, fakeSearchAPIResponse]),
  query: new Set(),
});
```

**DON'T:**
```tsx
// Anti-pattern -- large inline mock objects duplicated across test files
const fakeInvitation = {
  organization_invitation_id: "uuid",
  organization: { organization_id: "uuid", organization_name: "Example" },
  status: "pending",
  // ... 10 more fields, duplicated in every test
};
```

> **Rationale:** Centralizing fixtures reduces duplication and ensures consistency. When API shapes change, only the fixture file needs updating.

---

#### Rule: Prefer Role-Based Queries in Assertions

**Confidence:** High
**Observed in:** Increasingly preferred over `getByText` | PR refs: #7346, #5641, #5637

ALWAYS prefer `screen.getByRole()` / `screen.findByRole()` for element queries in tests. Use `screen.getByText()` only for simpler assertions where role-based queries are impractical. Use `screen.queryByRole()` for negative assertions (`not.toBeInTheDocument()`).

**DO:**
```tsx
// From PR #7346
const legacyInviteButton = await screen.findByRole("link");
expect(legacyInviteButton).toBeVisible();
```

```tsx
// From PR #5641
expect(
  screen.getByRole("heading", { name: "title" }),
).toBeInTheDocument();
```

```tsx
// From PR #5637 -- negative assertion with queryByRole
expect(
  screen.queryByRole("link", { name: "a link" }),
).not.toBeInTheDocument();
```

**DON'T:**
```tsx
// Anti-pattern -- using CSS selectors or container queries
const heading = container.querySelector("h2.title");
expect(heading).toBeTruthy();
```

> **Rationale:** Role-based queries align with Testing Library's guiding principle of testing the way users interact with the UI. They are also more resilient to text changes.

---

#### Rule: Use `waitFor` for Async State Assertions

**Confidence:** High
**Observed in:** ~10+ PRs; became more important after React version upgrades | PR refs: #4997

ALWAYS use `waitFor` from `@testing-library/react` when asserting on state that updates asynchronously after render. NEVER rely on synchronous assertions for values that depend on React state updates or async operations.

**DO:**
```tsx
// From PR #4997 -- fixed flaky tests by adding waitFor
import { waitFor } from "@testing-library/react";

await waitFor(() =>
  expect((options[1] as HTMLOptionElement).selected).toEqual(true),
);

await waitFor(() => {
  const selectedOption = screen.getByRole("option", { selected: true });
  return expect(selectedOption).toHaveTextContent(fakeSavedSearchRecord.name);
});
```

**DON'T:**
```tsx
// Anti-pattern -- synchronous assertion on async state (flaky)
expect((options[1] as HTMLOptionElement).selected).toEqual(true);
```

> **Rationale:** React 19 changed some internal batching behavior, causing previously synchronous state updates to become asynchronous. Using `waitFor` makes tests resilient to timing changes.

---

#### Rule: Use Ternary Operator Over `&&` for Conditional Rendering

**Confidence:** Medium (Pending)
**Observed in:** 1 explicit discussion with team consensus | PR refs: #7279

ALWAYS use ternary operators (`condition ? <Component /> : <></>`) rather than `&&` for conditional rendering when the condition evaluates to a number (e.g., `.length`). The `&&` pattern can render `0` to the screen when the condition is falsy.

**DO:**
```tsx
// From PR #7279 -- correct ternary pattern
{userInvitations?.length ? (
  <OrganizationInvitationReplies userInvitations={userInvitations} />
) : (
  <></>
)}
```

**DON'T:**
```tsx
// From PR #7279 -- bug: renders "0" when userInvitations is empty
{userInvitations?.length && (
  <OrganizationInvitationReplies userInvitations={userInvitations} />
)}
```

> **Rationale:** JavaScript's `&&` short-circuit returns the left operand when falsy. For numeric values like `0` (from `.length`), this means `0` renders visibly in React. Reviewer (ErinPattisonNava): "I'd love it if [ternary] could be the standard here too."

---

### Test Lifecycle

#### Rule: Components and Their Tests Are Deleted Together

**Confidence:** High
**Observed in:** ~10 PRs, consistently applied | PR refs: #4981

ALWAYS delete a component's test file in the same PR that deletes the component. NEVER leave orphaned test files for removed components.

**DO:**
```
# From PR #4981 -- component and test deleted together
- Deleted: frontend/src/components/search/SearchFilterAccordion/SearchFilterToggleAll.tsx
- Deleted: frontend/tests/components/search/SearchFilterAccordion/SearchFilterToggleAll.test.tsx
```

**DON'T:**
```
# Anti-pattern -- deleting component but leaving orphaned test
- Deleted: src/components/OldComponent.tsx
# tests/components/OldComponent.test.tsx still exists and will fail
```

> **Rationale:** Keeps the test suite in sync with the codebase. Orphaned tests cause confusion and false confidence in coverage metrics.

---

### Test Environment

#### Rule: Jest Environment Directive for Node-Specific Tests

**Confidence:** High
**Observed in:** ~5-10 PRs | PR refs: #7279

ALWAYS add the `@jest-environment node` directive at the top of test files that exercise API route handlers or server-only code incompatible with JSDOM.

**DO:**
```ts
// From PR #7279 -- API route handler test
/**
 * @jest-environment node
 */

import { updateOrganizationInvitation } from "src/app/api/user/organization-invitations/[organizationInvitationId]/handler";

describe("user/organization-invitations POST requests", () => {
  // ... tests for request/response handling
});
```

**DON'T:**
```ts
// Anti-pattern -- running server code in JSDOM environment
// Will fail with: ReferenceError: Request is not defined
import { updateOrganizationInvitation } from "src/app/api/.../handler";
```

> **Rationale:** The default Jest environment is JSDOM, which lacks certain Node APIs (e.g., `Request`, `Response`, `URLSearchParams.size`). Route handler tests and server utility tests need the Node environment.

---

### E2E Testing with Playwright

#### Rule: Playwright for All E2E Tests with Multi-Browser Support

**Confidence:** High
**Observed in:** Universal for E2E tests (~30+ PRs) | PR refs: #8710, #8867

ALWAYS use Playwright for end-to-end tests. ALWAYS configure tests to run across Chromium, Firefox, WebKit, and Mobile Chrome. NEVER use Cypress or other E2E frameworks.

**DO:**
```ts
// From PR #8710 -- standard E2E test structure
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
// From PR #8867 -- E2E test with authentication
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

**DON'T:**
```ts
// Anti-pattern -- using Cypress
describe("Search page", () => {
  it("retains filters", () => {
    cy.visit("/search");
  });
});
```

> **Rationale:** Playwright provides built-in multi-browser support, auto-waiting, and reliable cross-browser testing, which is critical for a government application that must work across all major browsers.

---

#### Rule: E2E Shared Utility Functions

**Confidence:** High
**Observed in:** ~20+ PRs; utilities expanded over time | PR refs: #8710

ALWAYS extract reusable E2E interactions (search submission, filter toggling, wait helpers, URL assertions) into shared utility files (`searchSpecUtil.ts`, `playwrightUtils.ts`). NEVER duplicate interaction logic across spec files.

**DO:**
```ts
// From PR #8710 -- shared utilities for filter interactions
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

**DON'T:**
```ts
// Anti-pattern -- duplicating interaction logic in each spec file
// Reviewer (doug-s-nava, PR #8710): "is there a way to reuse this at all
// rather than writing from scratch?"
```

> **Rationale:** E2E tests are inherently verbose. Shared utilities reduce duplication and make it easier to apply cross-browser fixes in one place.

---

#### Rule: Use `data-testid` Over CSS Selectors in E2E Tests

**Confidence:** High
**Observed in:** ~3-5 instances of reviewer enforcement | PR refs: #8710

ALWAYS prefer `data-testid` attributes for locating elements in E2E tests. NEVER use CSS class selectors (e.g., `.margin-left-4`) for E2E element selection when a `data-testid` can be added instead.

**DO:**
```ts
// From PR #8710 -- using data-testid (after reviewer feedback)
const subAgencyItems = page.locator('[data-testid="sub-agency-item"]');
```

**DON'T:**
```ts
// From PR #8710 -- using CSS class selector (before reviewer feedback)
// Reviewer: "would be great to be able to locate this without a margin styling class"
const subAgencyItems = page.locator(
  "#opportunity-filter-agency ul.margin-left-4 > li",
);
```

> **Rationale:** CSS classes can change for styling reasons, breaking E2E tests. `data-testid` attributes are semantically tied to testing and are stable across refactors.

---

#### Rule: Browser-Specific Workarounds in E2E Tests

**Confidence:** High
**Observed in:** ~10+ PRs; persistent challenge | PR refs: #8710

ALWAYS account for WebKit and Firefox behavioral differences in E2E tests. Use `pressSequentially` instead of `fill` for WebKit. Add `scrollIntoViewIfNeeded()` before interactions with elements in nested scrollable containers. Use retry patterns for interactions that are unreliable in specific browsers.

**DO:**
```ts
// From PR #8710 -- pressSequentially for WebKit compatibility
// this needs to be `pressSequentially` rather than `fill` because `fill` was not
// reliably triggering onChange handlers in webkit
await searchInput.pressSequentially(term);
```

```ts
// From PR #8710 -- multi-strategy click with retry for cross-browser reliability
let selectedAndUpdated = false;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  if (await checkbox.isChecked()) {
    await page.evaluate((id) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.click();
    }, subAgency.id);
    await page.waitForTimeout(500);
  }
  try {
    await waitForURLContainsQueryParamValues(page, "agency", [subAgency.value], 60000);
    selectedAndUpdated = true;
    break;
  } catch (_e) {
    if (attempt === 3) throw _e;
  }
}
```

**DON'T:**
```ts
// Anti-pattern -- assuming fill() works across all browsers
await searchInput.fill(term); // fails silently in WebKit
```

> **Rationale:** WebKit and Firefox have known differences in event dispatch, scroll behavior, and focus management. These workarounds ensure tests pass across all configured browsers.

---

#### Rule: E2E Test Flakiness Management via Skip/Un-skip

**Confidence:** High
**Observed in:** ~10+ PRs; visible skip/un-skip cycle | PR refs: #4376, #8710

NEVER leave flaky E2E tests running and failing intermittently. ALWAYS use `test.skip()` to temporarily disable known-flaky tests, with a comment explaining why. ALWAYS un-skip tests in a follow-up PR once the root cause is fixed.

**DO:**
```ts
// From PR #4376 -- un-skipping after fix (added agency seed data)
// Previously skipped in PR #4359:
// test.skip("should refresh and retain filters in a new tab", async ({ page }, ...

// Now fixed and un-skipped:
test("should refresh and retain filters in a new tab", async ({ page }, ...
```

**DON'T:**
```ts
// Anti-pattern -- leaving flaky tests running in CI
test("sometimes fails due to timing", async ({ page }) => {
  // fails 20% of the time, blocks CI for everyone
});
```

> **Rationale:** Flaky tests undermine CI reliability. Skipping with documentation preserves intent while preventing false failures. Fixing the root cause (seed data, better selectors) is always the goal.

---

#### Rule: Page Object Model for E2E Form Tests (Emerging)

**Confidence:** Medium (Pending)
**Observed in:** ~2 PRs; newly introduced pattern | PR refs: #8867

For E2E tests involving complex form interactions, ALWAYS use the Page Object Model (POM) pattern: separate test data into fixture files, form metadata/field mappings into page object files, and generic form-filling logic into shared utility files.

**DO:**
```ts
// From PR #8867 -- page object for SF-LLL form
// page-objects/sflll-form.page.ts
export const SFLLL_FORM_CONFIG = {
  formName: "Disclosure of Lobbying Activities (SF-LLL)",
  ...FORM_DEFAULTS,
} as const;

export function getSflllFillFields(data: SflllEntityData): FillFieldDefinition[] {
  return [
    { selector: "#federal_action_type", value: data.federalAction.type, type: "dropdown", section: "Section 1", field: "Type of Federal Action" },
    { testId: "material_change_year", value: data.materialChange.year, type: "text", section: "Section 3", field: "Material Change Year" },
  ];
}
```

```ts
// From PR #8867 -- generic form-filling utility
export async function fillForm(testInfo: TestInfo, page: Page, config: FillFormConfig): Promise<void> {
  const { formName, fields, saveButtonTestId } = config;
  await page.getByRole("link", { name: formName }).click();
  for (const field of fields) {
    await fillField(testInfo, page, field);
  }
  await page.getByTestId(saveButtonTestId).click();
}
```

```ts
// From PR #8867 -- test data fixture
export const FORMS_TEST_DATA = {
  sflll: {
    form: { name: "Disclosure of Lobbying Activities (SF-LLL)" },
    federalAction: { type: "Grant", status: "BidOffer", reportType: "MaterialChange" },
  },
} as const;
```

**DON'T:**
```ts
// Anti-pattern -- all form interaction logic inline in a single spec file
test("fills form", async ({ page }) => {
  await page.click("#federal_action_type");
  await page.selectOption("#federal_action_type", "Grant");
  await page.fill("#material_change_year", "2025");
  // ... hundreds of lines of inline selectors and data
});
```

> **Rationale:** As the application adds more complex government forms, separating test data, page objects, and interaction logic prevents spec files from becoming unmanageably long and makes it easy to add tests for new form types.

---

## Anti-Patterns

### Anti-Pattern: Snapshot of Function Instead of Container

PR #5021 contained a bug where `rerender` (a function) was passed to `toMatchSnapshot()` instead of `container`, producing a snapshot of `[Function]`. There is no guard against this -- always ensure you snapshot `container`, not other `render()` return values.

### Anti-Pattern: Synchronous Assertions on Async State

Asserting synchronously on values that depend on React state updates. After React 19's batching changes, these assertions became flaky. Always use `waitFor` (PR #4997).

### Anti-Pattern: CSS Class Selectors in E2E Tests

Using styling-related CSS classes (e.g., `.margin-left-4`) to locate elements in E2E tests. These break when styling changes. Use `data-testid` instead (PR #8710).

## Known Inconsistencies

### Test File Location

Frontend tests are split between two locations: `frontend/tests/components/<path>/` (traditional) and `frontend/src/components/<path>/` (co-located). Both patterns coexist with no formal decision documented. See cross-domain inconsistency INC-6.

### `render` Import Source

Some tests import `render` from `tests/react-utils` instead of `@testing-library/react`. It is unclear when each import source should be used.

### Skipped Test Tracking

There is no formal tracking mechanism for skipped E2E tests. Tests can remain skipped indefinitely without a periodic audit or lint rule to flag them.

## Related Documents
- **Cursor Rules:** `.cursor/rules/frontend-tests.md`
- **Related Domains:** `frontend-components.md` (component test structure), `frontend-i18n.md` (i18n mock patterns), `frontend-hooks.md` (hook testing patterns), `frontend-services.md` (service mock patterns, fixtures)
