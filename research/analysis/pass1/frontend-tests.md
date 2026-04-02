# Pattern Discovery: Frontend Testing

**Domain:** `frontend/tests/`
**Source:** 279 merged PRs analyzed across 6 batch files
**Analysis date:** 2026-03-27

---

## 1. Test Framework Patterns

### 1.1 Jest + React Testing Library as Unit Test Stack
**Frequency:** Near-universal across all unit tests (~200+ PRs)
**Confidence:** Very High
**Trend:** Stable throughout the entire PR history

The project uses Jest as the test runner with `@testing-library/react` for component rendering. Imports consistently follow the pattern:

```tsx
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
```

Some tests import from a local `tests/react-utils` wrapper instead of directly from `@testing-library/react`, suggesting a project-level render wrapper exists for providing common context (e.g., i18n providers).

**Exemplar PRs:** #4304, #4318, #4367, #4980, #5637, #7346

### 1.2 Test File Organization Mirrors Source Structure
**Frequency:** Universal
**Confidence:** Very High
**Trend:** Stable

Test files live under `frontend/tests/` and mirror the `src/` directory structure:
- `tests/components/search/` mirrors `src/components/search/`
- `tests/services/fetch/fetchers/` mirrors `src/services/fetch/fetchers/`
- `tests/pages/` mirrors `src/app/[locale]/`
- `tests/utils/` mirrors `src/utils/`
- `tests/hooks/` mirrors `src/hooks/`
- `tests/e2e/` contains Playwright end-to-end tests organized by feature area

Test files are named `ComponentName.test.tsx` or `utilName.test.ts`.

**Exemplar PRs:** #4414 (explicitly documents frontend code organization norms)

### 1.3 jest-axe Accessibility Testing in Unit Tests
**Frequency:** High (~30+ PRs)
**Confidence:** High
**Trend:** Stable, consistently applied to new components

Most component tests include an accessibility scan using `jest-axe`:

```tsx
import { axe } from "jest-axe";

it("should not have basic accessibility issues", async () => {
  const { container } = render(<Component />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

This pattern appears as the first or second test in almost every component test suite.

**Exemplar PRs:** #4304, #4980, #4981, #7346

### 1.4 Jest Environment Directive for Node-Specific Tests
**Frequency:** Moderate (~5-10 PRs)
**Confidence:** High
**Trend:** Stable

Tests that exercise server-only code or encounter JSDOM incompatibilities use the `@jest-environment node` directive:

```ts
/**
 * @jest-environment node
 */
```

This is used for API route handler tests and utility tests that reference Node-specific APIs or have issues with `URLSearchParams.size` in JSDOM.

**Exemplar PRs:** #4980 (searchUtils.test.ts), #7279 (route.test.ts)

---

## 2. Component Test Patterns

### 2.1 Describe-It Block Structure
**Frequency:** Universal
**Confidence:** Very High
**Trend:** Stable

All test files use Jest's `describe`/`it` blocks. The `describe` block names the component, and `it` blocks describe behavior:

```tsx
describe("SearchFilterAccordion", () => {
  it("should not have basic accessibility issues", async () => { ... });
  it("displays the correct options", () => { ... });
  it("has hidden attribute when collapsed", () => { ... });
});
```

**Exemplar PRs:** #4304, #4980

### 2.2 Direct Invocation of Async Server Components
**Frequency:** High (~15+ PRs)
**Confidence:** High
**Trend:** Growing pattern as more server components are added

For Next.js async server components, tests call the component function directly and render the result, rather than using JSX:

```tsx
it("Renders without errors", async () => {
  const component = await SearchFilters({
    fundingInstrument: new Set(),
    eligibility: new Set(),
    // ... other props
  });
  render(component);
  const title = await screen.findByText("accordion.titles.funding");
  expect(title).toBeInTheDocument();
});
```

This is necessary because async components cannot be rendered directly by React Testing Library.

**Exemplar PRs:** #4304 (SearchFilters), #5008 (AgencyFilterAccordion), #7346 (InviteLegacyUsersButton)

### 2.3 screen.getByRole / screen.findByRole Preferred for Queries
**Frequency:** High
**Confidence:** High
**Trend:** Increasingly preferred over getByText

Tests prefer role-based queries for assertions, aligning with Testing Library best practices:

```tsx
const checkbox = await screen.findByRole("checkbox", {
  name: `${option.label} [1]`,
});
const link = screen.getByRole("link");
const heading = screen.getByRole("heading", { name: "title" });
```

`getByText` is also common for simpler assertions. `queryByRole` is used for negative assertions (`not.toBeInTheDocument()`).

**Exemplar PRs:** #4304, #5641, #5650

### 2.4 waitFor for Async State Assertions
**Frequency:** Moderate (~10+ PRs)
**Confidence:** High
**Trend:** Growing, especially after React version upgrades

When tests need to wait for async state updates, `waitFor` is used:

```tsx
import { waitFor } from "@testing-library/react";

await waitFor(() =>
  expect((options[1] as HTMLOptionElement).selected).toEqual(true),
);
```

PR #4997 specifically fixed flaky tests by adding `waitFor` to handle timing issues introduced by a React version upgrade.

**Exemplar PRs:** #4997, #5021

---

## 3. Mock Patterns

### 3.1 jest.mock for next-intl Translation Functions
**Frequency:** Very High (~40+ PRs)
**Confidence:** Very High
**Trend:** Stable

Nearly every component test mocks the `next-intl` translation system using a shared mock utility:

```tsx
import { useTranslationsMock } from "src/utils/testing/intlMocks";

jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

For server components using `getTranslations`:

```tsx
import { mockUseTranslations } from "src/utils/testing/intlMocks";

jest.mock("next-intl/server", () => ({
  getTranslations: () => mockUseTranslations,
  setRequestLocale: identity,
}));
```

The project maintains shared mock utilities in `src/utils/testing/intlMocks.ts`.

**Exemplar PRs:** #4304, #4980, #5637, #7346

### 3.2 jest.mock for Next.js Navigation Hooks
**Frequency:** High (~20+ PRs)
**Confidence:** Very High
**Trend:** Stable

`next/navigation` hooks are routinely mocked:

```tsx
jest.mock("next/navigation", () => ({
  ...jest.requireActual<typeof import("next/navigation")>("next/navigation"),
  useRouter: () => ({ push: () => {} }),
  usePathname: () => usePathnameMock() as string,
  useSearchParams: () => new URLSearchParams(),
}));
```

The `jest.requireActual` spread pattern is standard for preserving unmocked exports.

**Exemplar PRs:** #4304, #5637

### 3.3 jest.mock for Custom Hooks (useSearchParamUpdater)
**Frequency:** High (~15+ PRs)
**Confidence:** Very High
**Trend:** Stable

The `useSearchParamUpdater` hook is one of the most frequently mocked dependencies:

```tsx
const mockUpdateQueryParams = jest.fn();

jest.mock("src/hooks/useSearchParamUpdater", () => ({
  useSearchParamUpdater: () => ({
    updateQueryParams: mockUpdateQueryParams,
    searchParams: new URLSearchParams(),
    setQueryParam: jest.fn(),
  }),
}));
```

**Exemplar PRs:** #4304, #4980, #4981

### 3.4 jest.mock for Auth Session
**Frequency:** High (~15+ PRs)
**Confidence:** Very High
**Trend:** Stable

Authentication session is mocked in tests requiring user context:

```tsx
const getSessionMock = jest.fn();

jest.mock("src/services/auth/session", () => ({
  getSession: (): unknown => getSessionMock(),
}));
```

The `as unknown` cast pattern is explicitly documented as acceptable in test files (PR #4414 code style doc).

**Exemplar PRs:** #6292, #7279

### 3.5 Shared Test Fixtures in src/utils/testing/fixtures.ts
**Frequency:** High (~25+ PRs)
**Confidence:** Very High
**Trend:** Growing, fixtures file expanded repeatedly

The project centralizes mock data in `src/utils/testing/fixtures.ts`:

- `mockOpportunity` - base opportunity object
- `fakeSearchAPIResponse` - search response with facet counts
- `fakeFacetCounts` - filter facet count data
- `fakeOpportunityDocument` - document attachment fixture
- `initialFilterOptions` - standard filter option array
- `fakeOrganizationInvitation` - org invitation data

Tests import these rather than declaring inline fixtures, reducing duplication.

**Exemplar PRs:** #4304, #4367, #4980, #7279

### 3.6 Mocking React Suspense for Testing
**Frequency:** Low (~3-5 PRs)
**Confidence:** Moderate
**Trend:** Occasional workaround

To test components wrapped in Suspense, tests mock React's Suspense to render the fallback:

```tsx
jest.mock("react", () => ({
  ...jest.requireActual<typeof import("react")>("react"),
  Suspense: ({ fallback }: { fallback: React.Component }) => fallback,
}));
```

**Exemplar PRs:** #4304

### 3.7 Mocking Third-Party Libraries in Tests
**Frequency:** Moderate (~10+ PRs)
**Confidence:** High
**Trend:** Stable, applied as needed when new libraries are integrated

When new libraries are added (e.g., `next-navigation-guard`), their hooks are mocked in existing tests:

```tsx
jest.mock("next-navigation-guard", () => ({
  useNavigationGuard: () => jest.fn(),
}));
```

Reviewer comment in PR #6292 noted a duplicate mock block and requested cleanup.

**Exemplar PRs:** #6292

### 3.8 Typing Hacks Accepted in Test Mocks
**Frequency:** Documented norm
**Confidence:** Very High
**Trend:** Explicitly codified in PR #4414

The code style document (PR #4414) explicitly states that typing shortcuts are acceptable in test files:

```tsx
jest.mock("some/mocked/file", () => ({
  originalFunction: (...args: unknown[]) => mockOriginalFunction(args) as unknown,
}));
```

The `as unknown` cast and loose typing are standard patterns in test mocks throughout the codebase.

**Exemplar PRs:** #4414 (documentation), #7279

---

## 4. Snapshot Patterns

### 4.1 Snapshot Tests for UI-Heavy Components
**Frequency:** Moderate (~15-20 PRs)
**Confidence:** High
**Trend:** Stable, used selectively

Snapshot tests are used for components with complex rendered output (tables, modals, page layouts):

```tsx
it("matches snapshot", () => {
  const component = TableWithResponsiveHeader({ ... });
  const { container } = render(component);
  expect(container).toMatchSnapshot();
});
```

Snapshot files are stored in `__snapshots__/` directories adjacent to test files.

**Exemplar PRs:** #5641, #5021, #5069, #6269

### 4.2 Previously-Skipped Snapshots Enabled
**Frequency:** Low (~3 PRs)
**Confidence:** Moderate
**Trend:** Snapshots were initially skipped during component development, then enabled

PR #5641 un-skipped snapshot tests (`it.skip` to `it`) once components were stable:

```tsx
// Before:
it.skip("matches snapshot", () => { ... });

// After:
it("matches snapshot", () => { ... });
```

This suggests snapshots are considered valuable for regression testing but not during active development.

**Exemplar PRs:** #5641

### 4.3 Snapshot Anti-Pattern: Passing Wrong Object
**Frequency:** Low (1 observed instance)
**Confidence:** Moderate
**Trend:** One-off mistake

In PR #5021, a snapshot test passed `rerender` (a function) instead of `container` to `toMatchSnapshot()`, resulting in a snapshot of `[Function]`:

```tsx
expect(rerender).toMatchSnapshot(); // Bug: should be container
```

This was not caught in review and persisted in the snapshot file.

**Exemplar PRs:** #5021

---

## 5. E2E Test Patterns (Playwright)

### 5.1 Playwright as E2E Framework
**Frequency:** Universal for E2E tests (~30+ PRs)
**Confidence:** Very High
**Trend:** Stable, growing sophistication over time

All E2E tests use Playwright with multi-browser testing (Chromium, Firefox, WebKit, Mobile Chrome). Configuration is in `frontend/tests/playwright.config.ts`.

```ts
import { expect, test } from "@playwright/test";

test.describe("Search page tests", () => {
  test("should refresh and retain filters", async ({ page }, { project }) => {
    // ...
  });
});
```

**Exemplar PRs:** #4304, #4359, #4376, #8700, #8710

### 5.2 E2E Shared Utility Functions
**Frequency:** High (~20+ PRs)
**Confidence:** Very High
**Trend:** Growing, utility files expanded over time

E2E tests rely on shared utilities in `tests/e2e/search/searchSpecUtil.ts` and `tests/e2e/playwrightUtils.ts`:

- `fillSearchInputAndSubmit()` - type and submit search queries
- `waitForSearchResultsInitialLoad()` - wait for results to render
- `toggleCheckboxes()` / `toggleCheckbox()` - interact with filter checkboxes
- `selectSortBy()` / `expectSortBy()` - sort interactions
- `clickAccordionWithTitle()` - expand filter accordions
- `refreshPageWithCurrentURL()` - page refresh helper
- `expectURLQueryParamValue()` / `expectURLQueryParamValues()` - URL state assertions

These utilities are refactored and expanded across PRs to handle cross-browser quirks.

**Exemplar PRs:** #4304, #4980, #8700, #8710

### 5.3 Browser-Specific Workarounds
**Frequency:** High (~10+ PRs)
**Confidence:** Very High
**Trend:** Persistent challenge, growing number of workarounds

WebKit and Firefox require special handling in E2E tests. Common workarounds include:

- `pressSequentially` instead of `fill` for WebKit (onChange not reliably triggered)
- Extra `waitForTimeout` calls for WebKit rendering delays
- Browser detection via project name for conditional logic
- Retry patterns for flaky interactions (especially nested scrolling)

```ts
const browserType = getBrowserType(page, projectName);
if (browserType === "firefox" || browserType === "webkit") {
  await searchInput.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
}
```

**Exemplar PRs:** #4304, #8700, #8710

### 5.4 E2E Test Flakiness Management
**Frequency:** High (~10+ PRs)
**Confidence:** Very High
**Trend:** Recurring theme throughout project history

Flaky E2E tests are a persistent challenge. The project uses several strategies:
- `test.skip()` to temporarily disable flaky tests
- Retry wrappers (try/catch with second attempt)
- Increased timeouts for specific operations
- Comments documenting why tests are flaky
- Better seed data to reduce dependency on external state (PR #4376 - seeding agencies)

The pattern of skipping and un-skipping tests is visible across multiple PRs: #4359 (skipped), #4376 (un-skipped), #8824 (skipped again).

**Exemplar PRs:** #4359, #4376, #4997, #5009, #8824

### 5.5 E2E Environment Configuration
**Frequency:** Moderate (~5+ PRs)
**Confidence:** High
**Trend:** Growing sophistication

E2E tests use environment-aware configuration via `tests/e2e/playwright-env.ts`:

```ts
const BASE_URLS: Record<string, string> = {
  local: "http://localhost:3000",
  staging: process.env.STAGING_BASE_URL || "https://staging.simpler.grants.gov",
};
```

Tests can target different environments via `PLAYWRIGHT_TARGET_ENV`. Timeout values are also environment-dependent.

**Exemplar PRs:** #8700, #8710

### 5.6 E2E Spoofed Authentication
**Frequency:** Low (~2-3 PRs)
**Confidence:** High
**Trend:** Introduced in PR #6318 and maintained

E2E tests requiring login use a spoofed authentication mechanism rather than scripting through the login flow:

- API seed script creates a test user and JWT token
- Token is written to a temp file and injected into the frontend environment
- `authenticateE2eUser()` utility sets up the auth cookie in the browser context

This avoids dependency on login.gov and the full OAuth flow in CI.

**Exemplar PRs:** #6318, #8867

### 5.7 Page Object Pattern in E2E Tests (Emerging)
**Frequency:** Low (~2 PRs)
**Confidence:** Moderate
**Trend:** Newly introduced in late PRs (2026)

The most recent E2E tests introduce a page object pattern for form filling:

```ts
// page-objects/sflll-form.page.ts
export const SFLLL_FORM_CONFIG = { ... };
export function getSflllFillFields(data: SflllEntityData): FillFieldDefinition[] { ... }

// fixtures/test-data-for-sflll-forms.fixture.ts
export const FORMS_TEST_DATA = { sflll: { ... } };
```

With generic form-filling utilities:
```ts
import { fillForm } from "tests/e2e/utils/forms/general-forms-filling";
```

**Exemplar PRs:** #8867

### 5.8 Feature Files for E2E Documentation
**Frequency:** Low (~3-5 files)
**Confidence:** Moderate
**Trend:** Recently introduced (2026)

Gherkin-style `.feature` files have been added alongside E2E specs for documentation:

```
frontend/tests/e2e/search/features/filter-drawer/filter-drawer-clear-filters.feature
frontend/tests/e2e/search/features/filter-drawer/filter-drawer-contents.feature
```

PR #8804 reorganized these files for consistency.

**Exemplar PRs:** #8804

---

## 6. Corrective Patterns (Reviewer Enforcement)

### 6.1 Reviewer Requests for data-testid Over CSS Selectors
**Frequency:** Moderate (~3-5 instances)
**Confidence:** High
**Trend:** Active enforcement

Reviewers push back on E2E tests that locate elements by CSS class names or complex selectors:

> "would be great to be able to locate this without a margin styling class. Feel free to add a test id into the dom to make this easier" (PR #8710, doug-s-nava)

This led to adding `data-testid="sub-agency-item"` to production code for test stability.

**Exemplar PRs:** #8710

### 6.2 Reviewer Catches Duplicate Mock Blocks
**Frequency:** Low (1 observed instance)
**Confidence:** Moderate
**Trend:** Occasional

In PR #6292, a reviewer noted a duplicate `jest.mock` block:

> "can delete this" (doug-s-nava, pointing to duplicate session mock)

**Exemplar PRs:** #6292

### 6.3 Code Style Doc Enforcement on Interface vs Type
**Frequency:** Moderate (~3-5 instances)
**Confidence:** High
**Trend:** Active enforcement after PR #4414 established norms

Reviewers reference the documented code style when seeing interfaces used for props:

> "we documented a style decision on interfaces vs types a while back... props can either be a declared type, or just generically defined in the function definition" (PR #7346, doug-s-nava)

**Exemplar PRs:** #7346

### 6.4 Shared Mock Utility Enforcement
**Frequency:** Moderate (~3 instances)
**Confidence:** High
**Trend:** Active enforcement

Reviewers ask test authors to use shared mock utilities rather than defining custom ones:

> "is there a reason [mockUseTranslations] doesn't work here?" (PR #7346, doug-s-nava)

This drives adoption of `src/utils/testing/intlMocks.ts` and `src/utils/testing/fixtures.ts`.

**Exemplar PRs:** #7346

### 6.5 Reviewer Concern About E2E Test Duration
**Frequency:** Low (~2 instances)
**Confidence:** Moderate
**Trend:** Emerging concern with growing E2E suite

> "If I have a concern it's how long all of this might take now with the timeouts adjusted. Are any of these tests taking too long to be practically worthwhile?" (PR #8710, doug-s-nava)

**Exemplar PRs:** #8710

---

## 7. Anti-Patterns and Things Flagged as Wrong

### 7.1 Deleting Page-Level Unit Tests in Favor of Component Tests
**Frequency:** Low (~2-3 PRs)
**Confidence:** Moderate
**Trend:** Established decision

PR #4304 explicitly deleted the search page unit test (`tests/pages/search/page.test.tsx`) with the rationale that:
- "The page component doesn't do very much on its own, largely an entry point into other component behavior"
- "Underlying behavior changes in this PR already have test coverage"

This suggests a preference for testing individual components rather than full page compositions.

**Exemplar PRs:** #4304

### 7.2 Commented-Out Debug Code in Tests
**Frequency:** Low (~3 instances)
**Confidence:** Moderate
**Trend:** Occasionally appears, not always caught in review

Commented-out debug statements sometimes persist in merged code:

```ts
// const count = await searchInput.count();
// const buttonCount = await searchInput.count();
// console.log("!!! searchinput", count, buttonCount);
// await new Promise((resolve) => setTimeout(resolve, 1000));
```

**Exemplar PRs:** #4304 (searchSpecUtil.ts)

### 7.3 Excessive waitForTimeout in E2E Tests
**Frequency:** Moderate (~5+ PRs)
**Confidence:** Moderate
**Trend:** Recurring, sometimes flagged by reviewers

E2E tests accumulate `waitForTimeout` calls to handle browser rendering delays. While sometimes necessary, this pattern is fragile:

```ts
await page.waitForTimeout(200);
await page.waitForTimeout(800);
await page.waitForTimeout(500);
```

Reviewers have expressed concern about accumulated timeouts affecting test duration.

**Exemplar PRs:** #8710, #8700

### 7.4 Using && for Conditional Rendering (Flagged in Review)
**Frequency:** Low (1 explicit discussion)
**Confidence:** Moderate
**Trend:** Ternary operator recommended as standard

In PR #7279, reviewers discussed the `&&` vs ternary pattern for conditional rendering. The `&&` pattern was found to produce `0` on screen when the array was empty. A reviewer recommended:

> "In a past team we normed on always using the ternary operator because the && can produce unexpected results. I'd love it if that could be the standard here too." (ErinPattisonNava)

While this is a component pattern rather than a test pattern, it reflects coding standards enforced through test-driven review.

**Exemplar PRs:** #7279

---

## 8. Test Deletion and Cleanup Patterns

### 8.1 Tests Removed When Components Are Deleted
**Frequency:** Moderate (~10 PRs)
**Confidence:** Very High
**Trend:** Consistent practice

When components are removed, their tests are removed in the same PR:
- PR #4981: Removed `SearchFilterToggleAll.test.tsx` alongside `SearchFilterToggleAll.tsx`
- PR #7275: Removed `BookmarkBanner.tsx` test alongside the component
- PR #4414: Removed `isSummary.test.ts` alongside `isSummary.ts`

**Exemplar PRs:** #4981, #7275, #4414

### 8.2 Test Fixtures Centralized from Inline to Shared File
**Frequency:** Moderate (~5 PRs)
**Confidence:** High
**Trend:** Progressive centralization

Filter options that were previously defined inline in test files were moved to `src/utils/testing/fixtures.ts`:

PR #4980 moved `initialFilterOptions` from `SearchFilterAccordion.test.tsx` to the shared fixtures file, and tests began importing from there.

**Exemplar PRs:** #4980

---

## Summary of Key Conventions

| Convention | Status | Confidence |
|---|---|---|
| Jest + React Testing Library for unit tests | Established | Very High |
| jest-axe accessibility test per component | Established | High |
| Shared i18n mocks via intlMocks.ts | Established | Very High |
| Shared fixtures via fixtures.ts | Established, growing | Very High |
| Direct invocation for async server components | Established | High |
| Snapshot tests for complex UI, selectively | Established | High |
| Playwright for multi-browser E2E | Established | Very High |
| Shared E2E utility functions | Established, expanding | Very High |
| data-testid preferred for E2E selectors | Emerging norm | High |
| Page Object pattern for E2E | Newly emerging | Moderate |
| Type hacks acceptable in test files | Documented norm | Very High |
| Components and tests deleted together | Established | Very High |
