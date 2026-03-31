# Pattern Discovery: Frontend Components (`frontend/src/components/`)

Analysis of 293 merged PRs from the HHS/simpler-grants-gov monorepo, spanning approximately April 2025 through March 2026.

---

## 1. Structural Patterns

### 1.1 Component File Organization: Domain-Based Subdirectories
**Frequency:** Very high (~90% of new component additions)
**Confidence:** High
**Trend:** Consistent throughout the entire period

Components are organized into subdirectories by feature/domain area, not by type. General-purpose components live at the root of `src/components/`, while feature-specific components live in subdirectories.

Observed directory structure:
- `src/components/` -- general-purpose (e.g., `SimplerModal.tsx`, `SaveIcon.tsx`, `Spinner.tsx`, `USWDSIcon.tsx`, `TableHeader.tsx`, `PopoverMenu.tsx`)
- `src/components/search/` -- search page components
- `src/components/opportunity/` -- opportunity detail page components
- `src/components/application/` -- application page components
- `src/components/application/attachments/` -- sub-feature nesting
- `src/components/workspace/` -- workspace/saved-search components
- `src/components/user/` -- user auth/save controls
- `src/components/drawer/` -- drawer UI components
- `src/components/organization/` -- organization management
- `src/components/applyForm/` -- application form system
- `src/components/applyForm/widgets/` -- form field widgets
- `src/components/applyForm/widgets/budget/` -- budget-specific widgets
- `src/components/research/` -- static research page content
- `src/components/research-participant-guide/` -- research participant guide
- `src/components/manageUsers/` -- user management

This was explicitly codified in PR #4414 which created `frontend/src/components/README.md`:
> "All non-page level components should go in this directory. If a component is for general use throughout the application, it should be placed in this root directory. If it is specific to a page or a set of pages, it should be placed in a subdirectory based on where it will be used."

**Exemplary PRs:** #4414 (codified the pattern), #5756 (attachments subdirectory), #5174 (SimplerModal at root)

### 1.2 Co-Located Tests in Parallel Directory
**Frequency:** Very high (~95% of component changes include test changes)
**Confidence:** High
**Trend:** Consistent

Tests mirror the component directory structure under `frontend/tests/components/`. Some newer tests appear co-located directly alongside components (e.g., `src/components/applyForm/utils.test.ts`, `src/components/research-participant-guide/ResearchParticipantGuide.test.tsx`, `src/components/workspace/OrganizationInvitationReplies.test.tsx`).

The primary test location remains `frontend/tests/components/` with a mirrored path structure, but there is a visible shift toward co-location in later PRs.

**Exemplary PRs:** #5174 (`tests/components/SimplerModal.test.tsx`), #8364 (co-located `ResearchParticipantGuide.test.tsx`)

### 1.3 Snapshot Tests + Accessibility Tests as Standard
**Frequency:** High (~70% of new components)
**Confidence:** High
**Trend:** Consistent

Most component test files include:
1. A snapshot test (`expect(container).toMatchSnapshot()`)
2. An accessibility test using `jest-axe` (`expect(results).toHaveNoViolations()`)

Snapshot files live in `__snapshots__/` subdirectories adjacent to the test files.

**Exemplary PRs:** #5174 (SimplerModal), #6863 (OrganizationInvitationReply), #5762 (SaveIcon)

### 1.4 Types Live in `/types` Directory (Not Alongside Components)
**Frequency:** High
**Confidence:** High
**Trend:** Consistent

Types/interfaces that are shared across components are placed in `src/types/` with domain-specific files (e.g., `src/types/attachmentTypes.ts`, `src/types/applicationResponseTypes.ts`, `src/types/search/searchFilterTypes.ts`). Locally-scoped interfaces are defined inline within the component file itself.

This was codified in PR #4414:
> "Typings should be placed within the /types directory unless they will only be ever referenced locally within the file where they are defined."

A reviewer explicitly called this out in PR #5756 when types were initially placed in a component utility file:
> "can these be moved to a types file?" -- doug-s-nava

**Exemplary PRs:** #4414 (codified), #5756 (reviewer enforcement), #5204 (type extraction)

---

## 2. Code Patterns

### 2.1 Destructured Props with Inline Type Annotations
**Frequency:** Very high (~95% of components)
**Confidence:** High
**Trend:** Consistent, with explicit reviewer enforcement

The codebase consistently uses destructured props with inline type annotations rather than passing a `props` object. This was explicitly called out by a reviewer:

> "[nit] I haven't consciously thought about this but I believe all of the signatures for our components destructure the props in the signature along the lines of `const Component = ({ propOne, propTwo }) =>` rather than `const Component = (props) =>`" -- doug-s-nava (PR #5204)

The reviewer also suggested adding an ESLint rule to enforce this.

There is also a progressive shift from `React.FC<Props>` syntax to plain function signatures with type annotations:
```typescript
// Old style (being replaced)
const SearchFilterSection: React.FC<SearchFilterSectionProps> = ({ ... }) => {

// New style (preferred)
const SearchFilterSection = ({ ... }: SearchFilterSectionProps) => {
```

**Exemplary PRs:** #4304 (transition visible), #5204 (reviewer enforcement), #6863

### 2.2 Server Components as Default, `"use client"` When Needed
**Frequency:** High
**Confidence:** High
**Trend:** Consistent

Components are server components by default. The `"use client"` directive is added only when the component needs client-side interactivity (event handlers, hooks like `useState`, `useRef`, etc.). Some components use `"use server"` for server actions (e.g., `actions.ts` files).

Server components use `async` functions and can `await` data fetches directly. The pattern of passing Promises as props from server pages to components is also evident.

Notable: When a feature flag is removed and a component no longer needs client-side hooks, the `"use client"` directive is also removed. A reviewer explicitly flagged this in PR #8363:
> "See comment above this line around the 'use client' decorator -- should it be removed?"

**Exemplary PRs:** #4304 (SearchFilters as async server component), #5756 (actions.ts with "use server"), #8363 (removing unnecessary "use client")

### 2.3 Passing Promises as Props for Data Fetching
**Frequency:** Medium (search-related components)
**Confidence:** High
**Trend:** Increasing in search components

A distinctive pattern: server page components create unresolved promises and pass them as props to child components, which await them. This avoids Suspense boundaries blocking entire sections.

```typescript
// In page.tsx
const searchResultsPromise = searchForOpportunities(convertedSearchParams);
return <SearchFilters searchResultsPromise={searchResultsPromise} />;

// In component
export default async function SearchFilters({ searchResultsPromise }) {
  let searchResults;
  try {
    searchResults = await searchResultsPromise;
  } catch (e) {
    console.error("Search error, cannot set filter facets", e);
  }
}
```

A reviewer explained the rationale:
> "the tricky piece here is that we have an async call in this component, but the component is not suspended. I did it this way because all we care about from the search response is the facet count, which is not vitally important to the functionality of the page. If we suspended on this, it would make the entire filter section unusable until the search results load" -- doug-s-nava (PR #4304)

**Exemplary PRs:** #4304, #5178

### 2.4 Promise Naming Convention
**Frequency:** Medium
**Confidence:** High
**Trend:** Codified in documentation

Unresolved promises should be named `varNamePromise(s)` and resolved values should be named `resolvedVarName(s)`. This was codified in PR #4414 in `documentation/frontend/code-style.md`.

**Exemplary PRs:** #4414 (codified), #4304 (`searchResultsPromise`, `agenciesPromise`)

### 2.5 Helper Functions Defined Outside Components
**Frequency:** Medium
**Confidence:** Medium
**Trend:** Enforced by reviewers

Reviewers consistently push for helper/utility functions that don't depend on component state to be defined outside the component body.

> "since each of these helper functions take in their dependencies as arguments, they can function independent of the component. As such it would be a minor improvement to define them outside of the component" -- doug-s-nava (PR #5204)

> "these seem like constants, can we define them outside the component?" -- doug-s-nava (PR #5756)

**Exemplary PRs:** #5204, #5756

### 2.6 Testing Async Server Components
**Frequency:** Medium
**Confidence:** High
**Trend:** Consistent for server components

Async server components are tested by calling them as functions and rendering the result:

```typescript
it("Renders without errors", async () => {
  const component = await SearchFilters({
    fundingInstrument: new Set(),
    eligibility: new Set(),
    ...
  });
  render(component);
  const title = await screen.findByText("accordion.titles.funding");
  expect(title).toBeInTheDocument();
});
```

**Exemplary PRs:** #4304, #5178

### 2.7 Context Providers for Shared State
**Frequency:** Medium
**Confidence:** High
**Trend:** Increasing

The codebase uses React Context for cross-component shared state. Examples:
- `LoginModalProvider` (PR #6160) -- shared login modal across the app
- `QueryProvider` -- search query state
- `UserProvider` -- user authentication state
- `AttachmentsProvider` -- attachment state for forms
- `FeatureFlags` context

The pattern includes a custom hook that throws if used outside the provider:
```typescript
export const useLoginModal = () => {
  const ctx = useContext(LoginModalContext);
  if (ctx === null) {
    throw new Error("useLoginModal must be used within <LoginModalProvider>");
  }
  return ctx;
};
```

**Exemplary PRs:** #6160 (LoginModalProvider), #5222 (ApplicationContainer state)

### 2.8 `useClientFetch` Hook for Client-Side API Calls
**Frequency:** High
**Confidence:** High
**Trend:** Consistent

Client-side API calls use the `useClientFetch` custom hook rather than raw `fetch`:

```typescript
const { clientFetch } = useClientFetch<Response>(
  "Error deleting saved search",
  { jsonResponse: false, authGatedRequest: true },
);
```

**Exemplary PRs:** #5174, #5756, #6863

### 2.9 `useActionState` for Server Actions
**Frequency:** Medium (form-related components)
**Confidence:** High
**Trend:** Increasing in later PRs

Server actions use React 19's `useActionState` hook:

```typescript
const [uploadState, uploadFormAction] = useActionState(
  uploadAttachmentAction,
  uploadActionsInitialState,
);
```

**Exemplary PRs:** #5756 (attachments), #6324 (form actions)

---

## 3. USWDS / Design System Patterns

### 3.1 Trussworks React-USWDS as Component Library
**Frequency:** Very high
**Confidence:** High
**Trend:** Consistent

The project uses `@trussworks/react-uswds` extensively for UI primitives: `Button`, `Grid`, `GridContainer`, `Table`, `Modal`, `ModalRef`, `ModalToggleButton`, `Accordion`, `Alert`, `FileInput`, `TextInput`, `Checkbox`, `Label`, `FormGroup`, `ErrorMessage`, `Link`, `PrimaryNav`, `GovBanner`, etc.

USWDS utility classes are used for styling throughout: `margin-*`, `padding-*`, `grid-col-*`, `font-sans-*`, `text-bold`, `display-flex`, `desktop:*` responsive prefixes, etc.

**Exemplary PRs:** Nearly all; #5756, #6863, #5200

### 3.2 Wrapper Components Around USWDS Primitives
**Frequency:** Medium
**Confidence:** High
**Trend:** Increasing

When USWDS components need repeated customization, the team creates wrapper components:

- `SimplerModal` (PR #5174) -- wraps Truss `Modal` with SSR safety, close buttons, and escape key handling
- `SimplerAlert` -- wraps USWDS Alert
- `USWDSIcon` -- icon wrapper
- `FilterCheckbox` -- wraps USWDS `Checkbox`
- `SaveButton` -- wraps button with save-specific behavior
- `DrawerUnit` / `Drawer` -- wraps Modal as a side drawer

The rationale for `SimplerModal`:
> "Wrapper for the Truss Modal component that provides common functionality shared by all modals within the Simpler application: avoids pre-render errors using isSSR hook, allows custom onClose functionality which is not supported by Truss out of the box"

**Exemplary PRs:** #5174 (SimplerModal), #5200 (DrawerUnit)

### 3.3 `useIsSSR` Hook for Portal/Hydration Safety
**Frequency:** Medium
**Confidence:** High
**Trend:** Consolidated into SimplerModal over time

The Truss Modal component throws errors during SSR when `renderToPortal` is true. The `useIsSSR` hook is used to conditionally disable portal rendering on the server. Initially each modal managed this individually; PR #5174 consolidated this into `SimplerModal`.

**Exemplary PRs:** #5174 (consolidation), #6160 (SSR handling in save control)

### 3.4 USWDS Utility Classes Over Custom CSS
**Frequency:** High
**Confidence:** High
**Trend:** Consistent with reviewer enforcement

Reviewers prefer USWDS utility classes over custom styles. When custom CSS is added, reviewers question whether it could be done with utilities:
> "Is there a reason for adding this to the stylesheet, instead of inline?" -- acouch (PR #5200)

Custom styles go in `_uswds-theme-custom-styles.scss` only when Truss components don't expose the needed DOM nodes.

Reviewers also enforce correct USWDS color tokens:
> "Extremely tiny nit but the design specifies `text-gray-50`. The output is almost identical." -- acouch (PR #4304)

**Exemplary PRs:** #5200, #4304, #5168

### 3.5 Font Size on Semantic Elements, Not Links
**Frequency:** Low (corrective)
**Confidence:** Medium
**Trend:** Reviewer correction

> "A font size utility class should go on the heading, not the link." -- andycochran (PR #5168)

**Exemplary PRs:** #5168

---

## 4. i18n Patterns

### 4.1 `useTranslations` from `next-intl` for All User-Facing Strings
**Frequency:** Very high
**Confidence:** High
**Trend:** Consistent

All user-facing text uses `useTranslations` (client) or `getTranslations` (server) from `next-intl`. Translation keys are organized hierarchically in `src/i18n/messages/en/index.ts`.

```typescript
const t = useTranslations("Application.attachments");
return <h2>{t("attachments")}</h2>;
```

Server components use:
```typescript
const t = await getTranslations({ locale, namespace: "SavedSearches" });
```

**Exemplary PRs:** Nearly all; #5756, #6863, #4318

### 4.2 Rich Text Translations with Component Interpolation
**Frequency:** Medium
**Confidence:** High
**Trend:** Consistent

The `t.rich()` pattern is used for translations containing markup:

```typescript
t.rich("betaAlert.alert", {
  ethnioSurveyLink: (chunks) => (
    <a href="https://ethn.io/16188" target="_blank" className="usa-link--external">
      {chunks}
    </a>
  ),
})
```

With corresponding translation string:
```
"Fill out a <ethnioSurveyLink>1-minute survey</ethnioSurveyLink> and share your experience."
```

**Exemplary PRs:** #5764, #5767

### 4.3 Filter Options Moved Out of i18n to Constants
**Frequency:** Low (but significant architectural decision)
**Confidence:** High
**Trend:** Deliberate migration

Filter option labels (sort options, status options, etc.) were originally in the i18n messages file but have been progressively moved to `src/constants/searchFilterOptions.ts` as plain objects. This enables programmatic iteration without i18n context.

A reviewer confirmed: "even though we don't have it in the roadmap to add spanish translations, the team wants to leave all the infrastructure behind the translations in place for now" -- doug-s-nava (PR #6252)

**Exemplary PRs:** #6252, #5178

### 4.4 Mock Pattern for i18n in Tests
**Frequency:** Very high
**Confidence:** High
**Trend:** Consistent

Tests consistently mock `next-intl` with a utility mock that returns translation keys as values:

```typescript
jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

The `useTranslationsMock` from `src/utils/testing/intlMocks.ts` returns the key string so tests can assert against translation keys.

**Exemplary PRs:** Nearly all test files

---

## 5. Corrective Patterns (Reviewer Enforcement)

### 5.1 Use Strict Equality (`!==`) Over Loose Equality (`!=`)
**Confidence:** Medium

> "I'm not a fan of `!=` or `==` largely because I think the Javascript makes it really hard to understand what it means. In this case since we're explicitly expecting values of either `true`, `false` or `null` I think using `!==` makes the most sense" -- doug-s-nava (PR #5204)

### 5.2 Prefer `.map()` Over Imperative Loops
**Confidence:** Medium

> "[nit] this could be more simply implemented with .map" -- doug-s-nava (PR #5204)

### 5.3 Reduce Prop Count by Passing Whole Objects
**Confidence:** High

Reviewers consistently push back on passing many individual props when a data object could be passed instead:

> "thinking about how we'll pass props into this component, I think it will be preferable to be able to pass a full opportunity or summary and then pull out the pieces we want from there, rather than pulling them out ahead of time and passing a list of 13 different props" -- doug-s-nava (PR #5204)

> "I'm assuming all of these props are coming from an opportunity API response object, in which case we can likely just use the response object itself" -- doug-s-nava (PR #5204)

**Exemplary PRs:** #5204

### 5.4 Extract Reusable Utilities From Components
**Confidence:** High

When logic is duplicated, reviewers push for extraction. For example, `formatCurrency` was extracted from `OpportunityAwardInfo` into `src/utils/formatCurrencyUtil.ts` (PR #5204).

> "can we name this variable something other than `number` to avoid a collision with the primitive type?" -- doug-s-nava (PR #5204)

### 5.5 Reduce Props for Domain-Specific Components
**Confidence:** Medium

> "since this is already specific to deleting attachments do we need these values to be flexible? can we cut down on the props by just getting these strings within the component?" -- doug-s-nava (PR #5756)

### 5.6 Calculate Disabled State Centrally, Not Per Widget
**Confidence:** Medium

> "this approach means each widget needs to implement disabling fields based on the 'readonly' prop individually. Since each field is rendered through the 'renderWidget' function, we could do this calculation there instead" -- doug-s-nava (PR #6870)

### 5.7 Use `data-testid` Naming Convention
**Confidence:** Medium

> `data-testid="opportunity-card"` -- reviewer suggestion in PR #5204

### 5.8 No Barrel Files / Index Re-exports
**Confidence:** Medium

> "we're not using this type of pattern at this point. For now can you reference files directly" -- doug-s-nava (PR #5756, regarding an `index.ts` barrel file)

---

## 6. Anti-Patterns (Things to Avoid)

### 6.1 Avoid `React.FC<Props>` Syntax
**Trend:** Being replaced with plain function signatures + type annotations
**Confidence:** Medium

Multiple PRs show the migration from `React.FC<Props>` to destructured props with type annotations. The older pattern is being phased out but not aggressively.

**Exemplary PRs:** #4304 (visible transition)

### 6.2 Avoid Commented-Out Code in Production
**Frequency:** Low (but noted)
**Confidence:** Medium

Some PRs leave commented-out code (e.g., PR #6863 with commented API calls). Reviewers sometimes let this pass when the API isn't ready yet, but it's not the preferred pattern.

### 6.3 Avoid Hardcoded Strings (Use i18n)
**Frequency:** Very low (exception: hotfixes)
**Confidence:** High

PR #8293 (hotfix banner) hardcoded strings directly without i18n, but explicitly noted:
> "As this is temporary, the content is hardcoded and does not make use of i18n. This change is sandwiched in a comment so the code can easily be removed."

This is acceptable only for temporary hotfixes.

### 6.4 Avoid Duplicate `jest.mock()` Calls
**Frequency:** Low
**Confidence:** Medium

In PR #6292, a duplicate `jest.mock("src/services/auth/session"...)` was left in the test file. A reviewer noted:
> "can delete this" -- doug-s-nava

### 6.5 Avoid `useIsSSR` Directly -- Use SimplerModal Instead
**Frequency:** Medium (corrected over time)
**Confidence:** High

After PR #5174 introduced `SimplerModal`, direct use of `useIsSSR` with raw `Modal` is an anti-pattern. All modals should use `SimplerModal` which handles SSR internally.

---

## 7. Conflicts / Multiple Approaches

### 7.1 Test Location: `tests/` Directory vs Co-Located
**Confidence:** Medium
**Trend:** Migration toward co-location in progress

Most tests are in `frontend/tests/components/` mirroring the component path, but newer tests appear co-located:
- `src/components/research-participant-guide/ResearchParticipantGuide.test.tsx`
- `src/components/workspace/OrganizationInvitationReplies.test.tsx`
- `src/components/applyForm/utils.test.ts`
- `src/app/[locale]/(base)/research-participant-guide/page.test.tsx`

No clear consensus on which approach is preferred.

### 7.2 Mock Data: Centralized Fixtures vs Per-Test JSON
**Confidence:** Medium
**Trend:** Preference for centralized fixtures

Mock data exists in two places:
- Centralized: `src/utils/testing/fixtures.ts` (preferred)
- Per-test/story: JSON files like `stories/components/application/opportunity.mock.json`

A reviewer flagged this tension:
> "we should discuss at some point how we want to handle things like this -- I've been defaulting to putting things in .ts files as in fixtures.ts but we have some stuff that is in individual mocks as json as well" -- doug-s-nava (PR #5204)

### 7.3 Export Style: Named vs Default Exports
**Confidence:** Low
**Trend:** Mixed

Components use both named exports (`export const Component = ...` or `export function Component`) and default exports (`export default function Component`). No clear enforcement pattern, though page-level components tend to use default exports while reusable components tend to use named exports.

### 7.4 Component Definition Style: Arrow Functions vs Function Declarations
**Confidence:** Low
**Trend:** Mixed

Both styles are used:
```typescript
// Arrow function (common for smaller/leaf components)
export const SaveIcon = ({ onClick, loading }: SaveIconProps) => { ... }

// Function declaration (common for larger/page-level components)
export default function SearchFilters({ ... }) { ... }
```

No explicit preference documented or enforced.

### 7.5 Feature Flags: `withFeatureFlag` HOC vs `useFeatureFlags` Hook
**Confidence:** Medium
**Trend:** Feature flags are being removed over time

Both patterns exist:
- HOC: `withFeatureFlag(Component, "flagName", onEnabled)` -- used for page-level gating
- Hook: `useFeatureFlags().checkFeatureFlag("flagName")` -- used for inline conditional rendering

Later PRs (#8336, #8363) are removing feature flags entirely as features become stable, which eliminates both patterns.

---

## 8. Testing Patterns Summary

### Standard Test Structure:
1. **Accessibility test** using `jest-axe`
2. **Snapshot test** using `toMatchSnapshot()`
3. **Behavioral tests** using `@testing-library/react` (`render`, `screen`, `userEvent`, `fireEvent`)
4. **Mock hooks/services** at the top of the file using `jest.mock()`
5. **Reset mocks** in `afterEach(() => jest.resetAllMocks())`

### Standard Mock Pattern for Hooks:
```typescript
const mockUpdateQueryParams = jest.fn();
jest.mock("src/hooks/useSearchParamUpdater", () => ({
  useSearchParamUpdater: () => ({
    updateQueryParams: mockUpdateQueryParams,
  }),
}));
```

### Testing Pattern for Typing Mocks:
```typescript
jest.mock("some/mocked/file", () => ({
  originalFunction: (...args: unknown[]) => mockOriginalFunction(args) as unknown,
}));
```

This typing hack is explicitly blessed in the code style documentation (PR #4414):
> "Do not feel bad about hacking around or otherwise not following best typing practices in order to solve problems with typing in unit or e2e test files."

---

## 9. Key Conventions Quick Reference

| Convention | Details |
|---|---|
| Component location | `src/components/` root for shared, subdirectories for feature-specific |
| Props pattern | Destructured in function signature with inline or separate interface |
| Server vs Client | Server by default; add `"use client"` only when needed |
| Translations | `useTranslations("Namespace.key")` from `next-intl` |
| Styling | USWDS utility classes; custom CSS in `_uswds-theme-custom-styles.scss` only when needed |
| Modals | Use `SimplerModal` wrapper, not raw Truss `Modal` |
| Types | Shared types in `src/types/`; local types inline |
| Tests | Accessibility + snapshot + behavioral; in `tests/components/` (or co-located) |
| Naming promises | `varNamePromise` for unresolved, `resolvedVarName` for resolved |
| Equality | Use `===` and `!==`, not `==` and `!=` |
| Mock data | Centralize in `src/utils/testing/fixtures.ts` |
| Types vs Interfaces | Prefer `type`; use `interface` for extendable objects |
| Barrel files | Not used; import files directly |
