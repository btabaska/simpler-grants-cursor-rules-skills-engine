# Frontend Components — Pattern Review

**Reviewer(s):** doug-s-nava
**PRs analyzed:** 293
**Rules proposed:** 16
**Open questions:** 7

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

### 1. Domain-Based Component Directory Organization

**Confidence:** High
**Frequency:** ~90% of new component additions
**Source PRs:** #4414, #5756, #5174

**Proposed Rule:**
> ALWAYS place new components in `src/components/` organized by feature domain. General-purpose components (used across multiple features) MUST live at the root of `src/components/`. Feature-specific components MUST live in a subdirectory named after their feature area (e.g., `search/`, `application/`, `workspace/`). Sub-feature nesting (e.g., `application/attachments/`) is permitted when warranted.

**Rationale:**
Organizes components by their usage context rather than by component type, making it easy to find all components related to a feature. Codified explicitly in project documentation.

**Code Examples:**
```
# From PR #5174 — General-purpose component at root
frontend/src/components/SimplerModal.tsx        # used by multiple features
frontend/src/components/PopoverMenu.tsx         # used by multiple features
frontend/src/components/SaveIcon.tsx            # used by multiple features
frontend/src/components/TableHeader.tsx         # used by multiple features
```

```
# From PR #5756 — Feature-specific component in subdirectory
frontend/src/components/application/attachments/AttachmentsCard.tsx
frontend/src/components/application/attachments/AttachmentsCardForm.tsx
frontend/src/components/application/attachments/AttachmentsCardTable.tsx
frontend/src/components/application/attachments/DeleteAttachmentModal.tsx
```

```
# From PR #4414 — Codified in README
frontend/src/components/README.md:
"All non-page level components should go in this directory. If a component is
for general use throughout the application, it should be placed in this root
directory. If it is specific to a page or a set of pages, it should be placed
in a subdirectory based on where it will be used."
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

### 2. Destructured Props with Type Annotations

**Confidence:** High
**Frequency:** ~95% of components; explicitly enforced by reviewers
**Source PRs:** #5204, #4304

**Proposed Rule:**
> ALWAYS destructure props in the component function signature. NEVER accept a `props` object and access properties via `props.propName`. Use inline type annotations or a separately defined interface/type. PREFER plain function signatures with type annotations over `React.FC<Props>` syntax.

**Rationale:**
Destructuring in the signature makes it immediately clear what props a component accepts. Avoiding `React.FC` removes implicit `children` typing and aligns with modern React conventions.

**Code Examples:**
```typescript
# From PR #5204 — Preferred style: destructured with type annotation
export const OpportunityCard = ({
  opportunityOverview,
}: {
  opportunityOverview: OpportunityOverviewType;
}) => {
```

```diff
# From PR #4304 — Migration from React.FC to plain signature
-const SearchFilterSection: React.FC<SearchFilterSectionProps> = ({
+const SearchFilterSection = ({
   option,
   updateCheckedOption,
   ...
-}) => {
+  facetCounts,
+}: SearchFilterSectionProps) => {
```

**Conflicting Examples:**
None found. The migration from `React.FC` is one-directional.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** The suggested ESLint rule (`react/destructuring-assignment`) has not yet been added. Should it be?

---

### 3. Server Components by Default

**Confidence:** High
**Frequency:** Consistently applied across the codebase
**Source PRs:** #4304, #8363, #5756

**Proposed Rule:**
> ALWAYS default to server components. ONLY add `"use client"` when the component requires client-side interactivity (event handlers, React hooks like `useState`, `useRef`, `useContext`, etc.). When a feature flag or other client-side dependency is removed and the component no longer needs hooks, ALWAYS remove the `"use client"` directive.

**Rationale:**
Server components reduce JavaScript bundle size and enable direct data fetching. `"use client"` should be a deliberate choice, not a default.

**Code Examples:**
```typescript
# From PR #4304 — Server component with async data fetching
export default async function SearchFilters({
  fundingInstrument,
  eligibility,
  agency,
  category,
  opportunityStatus,
  searchResultsPromise,
}: { ... }) {
  const t = useTranslations("Search");
  const agenciesPromise = getAgenciesForFilterOptions();

  let searchResults;
  try {
    searchResults = await searchResultsPromise;
  } catch (e) {
    console.error("Search error, cannot set filter facets", e);
  }
  // ...renders JSX directly
}
```

```diff
# From PR #8363 — Removing "use client" when feature flag is removed
-"use client";
-
-// we can remove the "use client" decorator after we remove the feature flag
-import { useFeatureFlags } from "src/hooks/useFeatureFlags";
 import { completeStatuses, OrganizationInvitation } from "src/types/userTypes";
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

### 4. Promise Props for Non-Blocking Data Fetching

**Confidence:** High
**Frequency:** Medium — primarily in search-related components
**Source PRs:** #4304

**Proposed Rule:**
> When a server component needs data that should not block rendering of the entire section, ALWAYS pass the unresolved promise as a prop from the parent page and await it in the child component. ALWAYS name unresolved promises `varNamePromise` and resolved values `resolvedVarName`.

**Rationale:**
Allows non-critical data to load without blocking the UI. The parent creates the promise so it begins fetching immediately, and the child awaits it when ready.

**Code Examples:**
```typescript
# From PR #4304 — Passing promise from page to component
// In page.tsx — create promise but don't await
const searchResultsPromise = searchForOpportunities(convertedSearchParams);

return (
  <SearchFilters
    searchResultsPromise={searchResultsPromise}
  />
);
```

```typescript
# From PR #4304 — Awaiting promise in child component
export default async function SearchFilters({
  searchResultsPromise,
}: {
  searchResultsPromise: Promise<SearchAPIResponse>;
}) {
  let searchResults;
  try {
    searchResults = await searchResultsPromise;
  } catch (e) {
    console.error("Search error, cannot set filter facets", e);
  }
  const facetCounts = searchResults?.facet_counts || defaultFacetCounts;
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

### 5. Shared Types in `/types` Directory

**Confidence:** High
**Frequency:** High — enforced by reviewers
**Source PRs:** #5204, #5756, #4414

**Proposed Rule:**
> ALWAYS place shared types and interfaces in `src/types/` with domain-specific files (e.g., `attachmentTypes.ts`, `searchFilterTypes.ts`). ONLY define types inline within a component file if they will never be referenced outside that file.

**Rationale:**
Centralizing shared types prevents duplication and makes them discoverable. As codified in PR #4414: "Typings should be placed within the /types directory unless they will only be ever referenced locally within the file where they are defined."

**Code Examples:**
```typescript
# From PR #5204 — Shared type extracted to types directory
// src/types/opportunity/opportunityResponseTypes.ts
export type OpportunityOverview = Pick<
  BaseOpportunity,
  | "opportunity_title"
  | "opportunity_id"
  | "opportunity_number"
  | "agency_name"
  | "agency_code"
  | "opportunity_assistance_listings"
  | "summary"
>;
```

```typescript
# From PR #5756 — Local-only type defined inline
interface Props {
  applicationId: string;
  errorText?: string;
  handleUploadAttachment: (files: FileList | null) => void;
  inputRef: RefObject<FileInputRef | null>;
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

---

### 6. USWDS Wrapper Components for Repeated Customization

**Confidence:** High
**Frequency:** Medium — established pattern with explicit examples
**Source PRs:** #5174

**Proposed Rule:**
> When a `@trussworks/react-uswds` component needs repeated customization or workarounds, ALWAYS create a wrapper component in `src/components/` rather than duplicating the customization at each usage site. For modals specifically, ALWAYS use `SimplerModal` instead of the raw Truss `Modal` component.

**Rationale:**
Consolidates SSR safety, close button styling, Escape key handling, and custom onClose functionality into a single component. Prevents each modal from independently managing these concerns.

**Code Examples:**
```typescript
# From PR #5174 — SimplerModal wrapper
export function SimplerModal({
  modalRef, className, modalId, titleText, children, onKeyDown, onClose,
}: { ... }) {
  const isSSR = useIsSSR();
  return (
    <Modal
      ref={modalRef}
      forceAction={false}
      className={className}
      aria-labelledby={`${modalId}-heading`}
      aria-describedby={`${modalId}-description`}
      id={modalId}
      renderToPortal={!isSSR}
      onClick={(clickEvent) => { /* custom close handling */ }}
      onKeyDown={(keyEvent) => { /* Escape key + custom handler */ }}
    >
      {titleText && <ModalHeading id={`${modalId}-heading`}>{titleText}</ModalHeading>}
      {children}
    </Modal>
  );
}
```

```diff
# From PR #5174 — Consuming SimplerModal instead of raw Modal
-      <Modal
-        ref={modalRef}
-        forceAction
-        renderToPortal={!isSSR}
-        ...
+      <SimplerModal
+        modalRef={modalRef}
+        modalId={"save-search"}
+        titleText={saved ? undefined : t("title")}
+        onClose={onClose}
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

### 7. USWDS Utility Classes Over Custom CSS

**Confidence:** High
**Frequency:** High — enforced by reviewers
**Source PRs:** #5756, #4304, #5168

**Proposed Rule:**
> ALWAYS prefer USWDS utility classes for styling (`margin-*`, `padding-*`, `grid-col-*`, `font-sans-*`, `text-bold`, `display-flex`, `desktop:*`). ONLY add custom CSS in `_uswds-theme-custom-styles.scss` when USWDS primitives or Truss components do not expose the needed DOM nodes. ALWAYS use USWDS color tokens rather than raw hex values. ALWAYS apply font-size utility classes to semantic elements (headings), not to links inside them.

**Rationale:**
USWDS utility classes ensure design system compliance, reduce custom CSS maintenance burden, and maintain visual consistency across the application.

**Code Examples:**
```tsx
# From PR #5756 — USWDS utility classes in component markup
<div className="position-relative display-inline-block">
  <div
    className="border border-base-light bg-white shadow-2 radius-md padding-1
               text-no-wrap position-absolute z-top top-full right-0"
    role="menu"
    ref={menuRef}
  >
```

```
# From PR #4304 — Reviewer enforcing USWDS tokens (acouch)
> "Extremely tiny nit but the design specifies `text-gray-50`. The output is almost identical."

# From PR #5168 — Reviewer enforcing class placement (andycochran)
> "A font size utility class should go on the heading, not the link."
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

### 8. Internationalization via `next-intl`

**Confidence:** High
**Frequency:** Very high — nearly all PRs touching UI text
**Source PRs:** #5756, #8364, #6252

**Proposed Rule:**
> ALWAYS use `useTranslations` (client components) or `getTranslations` (server components) from `next-intl` for all user-facing text. NEVER hardcode user-facing strings except in temporary hotfixes (which must be clearly commented for removal). For translations containing markup, use `t.rich()` with component interpolation. Filter/sort option labels that need programmatic iteration SHOULD live in `src/constants/searchFilterOptions.ts` as plain objects rather than in i18n files.

**Rationale:**
Ensures all text is translatable. The i18n infrastructure is kept in place even though only English is currently used, per team decision: "even though we don't have it in the roadmap to add spanish translations, the team wants to leave all the infrastructure behind the translations in place for now" (doug-s-nava, PR #6252).

**Code Examples:**
```typescript
# From PR #5756 — Client component i18n
const t = useTranslations("Application.attachments");
return (
  <h3 className="margin-top-4">{t("attachments")}</h3>
);
```

```typescript
# From PR #8364 — Server component i18n
export async function generateMetadata({ params }: LocalizedPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const meta: Metadata = {
    title: t("ResearchParticipantGuide.metaTitle"),
    description: t("ResearchParticipantGuide.metaDescription"),
  };
  return meta;
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

**Open Question:** The progressive move of filter options out of i18n into constants creates a hybrid approach. Should there be a clear boundary for what stays in i18n vs. what goes to constants?

---

### 9. Context Providers for Shared State

**Confidence:** High
**Frequency:** Medium — used for LoginModal, Query, User, Attachments, FeatureFlags
**Source PRs:** #6160

**Proposed Rule:**
> When state needs to be shared across multiple components, ALWAYS use a React Context provider pattern. ALWAYS include a custom hook that throws an error if used outside the provider. ALWAYS memoize the context value with `useMemo`.

**Rationale:**
Consolidates shared state (e.g., a single login modal) rather than duplicating instances. The guard hook provides clear error messages when the provider is missing from the tree.

**Code Examples:**
```typescript
# From PR #6160 — LoginModalProvider with guard hook
const LoginModalContext = createContext<LoginModalContextValue | null>(null);

export const useLoginModal = () => {
  const ctx = useContext(LoginModalContext);
  if (ctx === null) {
    throw new Error("useLoginModal must be used within <LoginModalProvider>");
  }
  return ctx;
};

export function LoginModalProvider({ children }: PropsWithChildren) {
  const loginModalRef = useRef<ModalRef | null>(null);
  const [helpText, setHelpText] = useState<string>("");
  // ...
  const contextValue = useMemo(
    () => ({ loginModalRef, setHelpText, setTitleText, ... }),
    [loginModalRef, setHelpText, setTitleText, ...],
  );
  return (
    <LoginModalContext.Provider value={contextValue}>
      {children}
    </LoginModalContext.Provider>
  );
}
```

```typescript
# From PR #6160 — Usage of provider wrapping Layout
<LoginModalProvider>
  <Header locale={locale} />
  <main id="main-content" className="border-top-0">
    {children}
  </main>
</LoginModalProvider>
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

### 10. Standard Test Structure

**Confidence:** High
**Frequency:** ~70-95% of new component test files
**Source PRs:** #5200, #8364, #4414

**Proposed Rule:**
> ALWAYS include an accessibility test using `jest-axe` (`expect(results).toHaveNoViolations()`) for new components. ALWAYS include a snapshot test. ALWAYS mock `next-intl` using the `useTranslationsMock` utility. ALWAYS reset mocks in `afterEach(() => jest.resetAllMocks())`. For async server components, call the component as a function and render the result.

**Rationale:**
Accessibility testing ensures WCAG compliance. Snapshot tests catch unintended visual regressions. Consistent mock patterns reduce boilerplate and make tests easier to write.

**Code Examples:**
```typescript
# From PR #5200 — Standard test structure with a11y + behavioral
const mockClearQueryParams = jest.fn();

jest.mock("src/hooks/useSearchParamUpdater", () => ({
  useSearchParamUpdater: () => ({
    clearQueryParams: (params: unknown) =>
      mockClearQueryParams(params) as unknown,
  }),
}));

describe("ClearSearchButton", () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  it("does not have any accessibility violations", async () => {
    const { container } = render(<ClearSearchButton buttonText="hi" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  it("calls clearQueryParams on click", async () => {
    render(<ClearSearchButton buttonText="hi" />);
    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(mockClearQueryParams).toHaveBeenCalledWith(undefined);
  });
});
```

```typescript
# From PR #8364 — i18n mock pattern
jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
  useMessages: () => mockMessages,
}));
```

**Conflicting Examples:**
Test file location is in flux — see Pattern 12 in Conflicts section below.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 11. Pass Whole Objects, Not Many Individual Props

**Confidence:** High
**Frequency:** Medium — explicitly enforced by reviewers
**Source PRs:** #5204

**Proposed Rule:**
> When a component needs many fields from a single data object, ALWAYS pass the whole object (or a `Pick<>` type of it) as a single prop rather than destructuring it into 10+ individual props at the call site. Helper functions that do not depend on component state SHOULD be defined outside the component body.

**Rationale:**
Reduces prop count, simplifies call sites, and makes refactoring easier when the data shape changes.

**Code Examples:**
```typescript
# From PR #5204 — Resulting implementation after reviewer feedback
type OpportunityOverviewProps = { opportunity: OpportunityOverviewType };

const OpportunityOverview = ({ opportunity }: OpportunityOverviewProps) => {
  const {
    agency_code,
    agency_name,
    opportunity_assistance_listings,
    opportunity_id,
    opportunity_title,
    opportunity_number,
    summary,
  } = opportunity;
  // ...
};
```

```typescript
# From PR #5204 — Helper functions defined outside component
// Defined OUTSIDE the component
const displayDate = (date: string | null) =>
  date ? getConfiguredDayJs()(date).format("MMM D, YYYY hh:mm A z") : null;

const displayAgencyAndCode = (agencyName: string | null, agencyCode: string | null) =>
  (agencyCode && agencyName ? `${agencyName} - ${agencyCode}` : null);
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

### 12. No Barrel Files

**Confidence:** Medium
**Frequency:** Low occurrence — explicitly rejected when introduced
**Source PRs:** #5756

**Proposed Rule:**
> NEVER create `index.ts` barrel files for re-exporting components. ALWAYS import files by their direct path.

**Rationale:**
Avoids circular dependency issues and makes import paths explicit. Keeps the dependency graph transparent.

**Code Examples:**
```
# From PR #5756 — Reviewer rejection (doug-s-nava)
> "we're not using this type of pattern at this point. For now can you reference files directly"
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

**Open Question:** This was stated as a "for now" position. Should it be formally adopted or reconsidered?

---

### 13. Use Strict Equality

**Confidence:** Medium
**Frequency:** Low occurrence (corrective) — enforced when spotted
**Source PRs:** #5204

**Proposed Rule:**
> ALWAYS use `===` and `!==` instead of `==` and `!=` in JavaScript/TypeScript code.

**Rationale:**
Strict equality avoids JavaScript's type coercion rules, which are notoriously confusing.

**Code Examples:**
```
# From PR #5204 — Reviewer correction (doug-s-nava)
> "I'm not a fan of `!=` or `==` largely because I think the Javascript makes
> it really hard to understand what it means. In this case since we're explicitly
> expecting values of either `true`, `false` or `null` I think using `!==` makes
> the most sense"
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

**Open Question:** Should this be enforced via ESLint `eqeqeq` rule?

---

### 14. Centralized Mock Data in Fixtures

**Confidence:** Medium
**Frequency:** Consistently used, with some exceptions for stories
**Source PRs:** #4304, #5204

**Proposed Rule:**
> ALWAYS prefer placing mock/fixture data in `src/utils/testing/fixtures.ts` for reuse across tests. Avoid creating per-test JSON mock files unless there is a specific reason (e.g., Storybook stories).

**Rationale:**
Centralized fixtures reduce duplication, are typed, and ensure consistency across tests.

**Code Examples:**
```typescript
# From PR #4304 — Centralized fixtures
export const fakeSearchAPIResponse: SearchAPIResponse = {
  data: [
    mockOpportunity,
    { ...mockOpportunity, opportunity_status: "forecasted" },
  ],
  pagination_info: fakePaginationInfo,
  facet_counts: fakeFacetCounts,
  message: "anything",
  status_code: 200,
};
```

```
# From PR #5204 — Reviewer flagging the tension (doug-s-nava)
> "we should discuss at some point how we want to handle things like this --
> I've been defaulting to putting things in .ts files as in fixtures.ts but we
> have some stuff that is in individual mocks as json as well"
```

**Conflicting Examples:**
Some Storybook stories use per-story JSON mocks (e.g., `stories/components/application/opportunity.mock.json`). The boundary between centralized `.ts` fixtures and per-story `.json` mocks is not formalized.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** The team has not formally decided on the boundary between centralized `.ts` fixtures and per-story `.json` mocks. This needs tech lead resolution.

---

### 15. `useClientFetch` for Client-Side API Calls

**Confidence:** High
**Frequency:** High — consistently used in client components
**Source PRs:** #5174

**Proposed Rule:**
> ALWAYS use the `useClientFetch` custom hook for client-side API calls rather than raw `fetch`. ALWAYS provide an error message string and configure `jsonResponse` and `authGatedRequest` options.

**Rationale:**
Centralizes error handling, authentication, and response parsing for client-side API calls.

**Code Examples:**
```typescript
# From PR #5174 — Standard usage
const { clientFetch } = useClientFetch<Response>(
  "Error deleting saved search",
  { jsonResponse: false, authGatedRequest: true },
);
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

### 16. `useActionState` for Server Actions

**Confidence:** High
**Frequency:** Medium — used in form-related components
**Source PRs:** #5756

**Proposed Rule:**
> For form submissions using server actions, ALWAYS use React 19's `useActionState` hook to manage action state and pending status.

**Rationale:**
`useActionState` provides a standardized way to handle server action responses and pending states in React 19.

**Code Examples:**
```typescript
# From PR #5756 — Upload and delete actions
const [uploadState, uploadFormAction] = useActionState(
  uploadAttachmentAction,
  uploadActionsInitialState satisfies UploadAttachmentActionState,
);

const [deleteState, deleteActionFormAction, deletePending] = useActionState(
  deleteAttachmentAction,
  deleteUploadActionsInitialState satisfies DeleteAttachmentActionState,
);
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

## Coverage Gaps

1. **No ESLint enforcement for destructured props** — Rule 2 is enforced only by reviewer diligence. The `react/destructuring-assignment` ESLint rule has been suggested but not implemented.
2. **No ESLint enforcement for strict equality** — Rule 13 could be enforced by the `eqeqeq` ESLint rule.
3. **No frontend error boundary strategy** — The frontend uses `<TopLevelError />` and `<NotFound />` for page-level errors, but there is no documented strategy for component-level error boundaries, retry behavior, or user-facing error message standards beyond the i18n pattern. (Cross-domain gap GAP-6)
4. **No formal boundary between i18n and constants** — Rule 8 notes filter options moving from i18n to constants, but no documented policy exists for where the line is.

## Inconsistencies Requiring Resolution

### Conflict 1: Test File Location

**Status:** Migration in progress, no formal decision

Most tests live in `frontend/tests/components/` mirroring the component path. However, newer tests are co-located directly with components:

- Co-located: `src/components/research-participant-guide/ResearchParticipantGuide.test.tsx` (PR #8364)
- Co-located: `src/components/workspace/OrganizationInvitationReplies.test.tsx` (PR #8363)
- Co-located: `src/components/applyForm/utils.test.ts`
- Traditional: `tests/components/SimplerModal.test.tsx` (PR #5174)
- Traditional: `tests/components/search/ClearSearchButton.test.tsx` (PR #5200)

**Question:** Should new tests be co-located or in `tests/`? Is the team actively migrating?

(Also flagged as cross-domain inconsistency INC-6 in Pass 3 synthesis.)

### Conflict 2: Component Definition Style

Both arrow functions and function declarations are used:

```typescript
// Arrow function (common for smaller/leaf components)
export const SaveIcon = ({ onClick, loading }: SaveIconProps) => { ... }

// Function declaration (common for larger/page-level components)
export default function SearchFilters({ ... }) { ... }
```

**Question:** Should one style be preferred, or is the informal convention (arrows for small, declarations for large/page-level) sufficient?

### Conflict 3: Named vs Default Exports

Page-level components tend to use `export default function`, while reusable components tend to use named exports (`export const Component`). This is not formally documented.

**Question:** Should this be codified, or is the implicit convention clear enough?

### Conflict 4: Feature Flag Approach

Both `withFeatureFlag` HOC and `useFeatureFlags` hook exist, but feature flags are being progressively removed (PR #8363 removed `manageUsersOff`). The pattern is temporary by nature.

**Question:** No action needed -- just documenting that both patterns exist during the transition period.

### Cross-Domain: Feature Flag Naming Convention (INC-1)

Three different naming patterns and truthy values exist across frontend and API:
- Frontend: `FEATURE_{NAME}_OFF` with SSM `manage_method = "manual"`
- API: `ENABLE_{FEATURE}_ENDPOINTS = 1`
- Local dev: `ENABLE_{FEATURE}=TRUE`

### Cross-Domain: `server only` vs. `server-only` Directive (INC-5)

Frontend service files inconsistently use `"server only"` (with space) and `"server-only"` (with hyphen). The Next.js official package is `server-only` (with hyphen). This should be standardized.
