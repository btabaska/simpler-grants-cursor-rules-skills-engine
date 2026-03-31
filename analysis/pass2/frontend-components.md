# Pass 2: Pattern Codification -- Frontend Components

Domain: `frontend/src/components/` in the HHS/simpler-grants-gov monorepo
Based on Pass 1 discovery of 293 merged PRs (April 2025 -- March 2026).
Validated against 18 representative PRs with actual diff analysis.

---

## Rule 1: Domain-Based Component Directory Organization

**Pattern Name:** Domain-Based Subdirectory Structure

**Rule Statement:** ALWAYS place new components in `src/components/` organized by feature domain. General-purpose components (used across multiple features) MUST live at the root of `src/components/`. Feature-specific components MUST live in a subdirectory named after their feature area (e.g., `search/`, `application/`, `workspace/`). Sub-feature nesting (e.g., `application/attachments/`) is permitted when warranted.

**Confidence:** High

**Frequency:** ~90% of new component additions follow this pattern

**Code Examples:**

1. General-purpose component at root (PR #5174 -- SimplerModal):
```
frontend/src/components/SimplerModal.tsx        # used by multiple features
frontend/src/components/PopoverMenu.tsx         # used by multiple features
frontend/src/components/SaveIcon.tsx            # used by multiple features
frontend/src/components/TableHeader.tsx         # used by multiple features
```

2. Feature-specific component in subdirectory (PR #5756 -- Attachments):
```
frontend/src/components/application/attachments/AttachmentsCard.tsx
frontend/src/components/application/attachments/AttachmentsCardForm.tsx
frontend/src/components/application/attachments/AttachmentsCardTable.tsx
frontend/src/components/application/attachments/DeleteAttachmentModal.tsx
```

3. Codified in README (PR #4414):
```
frontend/src/components/README.md:
"All non-page level components should go in this directory. If a component is
for general use throughout the application, it should be placed in this root
directory. If it is specific to a page or a set of pages, it should be placed
in a subdirectory based on where it will be used."
```

**Rationale:** Organizes components by their usage context rather than by component type, making it easy to find all components related to a feature. Codified explicitly in project documentation.

**Open Questions:** None -- this is well established and documented.

---

## Rule 2: Destructured Props with Type Annotations

**Pattern Name:** Destructured Props Pattern

**Rule Statement:** ALWAYS destructure props in the component function signature. NEVER accept a `props` object and access properties via `props.propName`. Use inline type annotations or a separately defined interface/type. PREFER plain function signatures with type annotations over `React.FC<Props>` syntax.

**Confidence:** High

**Frequency:** ~95% of components; explicitly enforced by reviewers

**Code Examples:**

1. Preferred style -- destructured with type annotation (PR #5204 -- OpportunityCard):
```typescript
export const OpportunityCard = ({
  opportunityOverview,
}: {
  opportunityOverview: OpportunityOverviewType;
}) => {
```

2. Migration from React.FC to plain signature (PR #4304 -- SearchFilterSection):
```diff
-const SearchFilterSection: React.FC<SearchFilterSectionProps> = ({
+const SearchFilterSection = ({
   option,
   updateCheckedOption,
   ...
-}) => {
+  facetCounts,
+}: SearchFilterSectionProps) => {
```

3. Reviewer enforcement (PR #5204 -- doug-s-nava):
> "[nit] I haven't consciously thought about this but I believe all of the signatures for our components destructure the props in the signature along the lines of `const Component = ({ propOne, propTwo }) =>` rather than `const Component = (props) =>`"
> "It'd probably be a good idea to implement this eslint rule to enforce that convention"

**Rationale:** Destructuring in the signature makes it immediately clear what props a component accepts. Avoiding `React.FC` removes implicit `children` typing and aligns with modern React conventions.

**Open Questions:** The suggested ESLint rule (`react/destructuring-assignment`) has not yet been added. Should it be?

---

## Rule 3: Server Components by Default

**Pattern Name:** Server-First Component Architecture

**Rule Statement:** ALWAYS default to server components. ONLY add `"use client"` when the component requires client-side interactivity (event handlers, React hooks like `useState`, `useRef`, `useContext`, etc.). When a feature flag or other client-side dependency is removed and the component no longer needs hooks, ALWAYS remove the `"use client"` directive.

**Confidence:** High

**Frequency:** Consistently applied across the codebase

**Code Examples:**

1. Server component with async data fetching (PR #4304 -- SearchFilters):
```typescript
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

2. Removing "use client" when feature flag is removed (PR #8363 -- OrganizationInvitationReplies):
```diff
-"use client";
-
-// we can remove the "use client" decorator after we remove the feature flag
-import { useFeatureFlags } from "src/hooks/useFeatureFlags";
 import { completeStatuses, OrganizationInvitation } from "src/types/userTypes";
```

3. Client component -- only when hooks are needed (PR #5756 -- AttachmentsCard):
```typescript
"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";

export const AttachmentsCard = ({ applicationId, attachments }: AttachmentsCardProps) => {
  const [uploads, setUploads] = useState<AttachmentCardItem[]>([]);
  // ... uses useState, useRef, useEffect, useActionState
```

**Rationale:** Server components reduce JavaScript bundle size and enable direct data fetching. `"use client"` should be a deliberate choice, not a default.

**Open Questions:** None.

---

## Rule 4: Promise Props for Non-Blocking Data Fetching

**Pattern Name:** Promise-as-Props Pattern

**Rule Statement:** When a server component needs data that should not block rendering of the entire section, ALWAYS pass the unresolved promise as a prop from the parent page and await it in the child component. ALWAYS name unresolved promises `varNamePromise` and resolved values `resolvedVarName`.

**Confidence:** High

**Frequency:** Medium -- primarily in search-related components

**Code Examples:**

1. Passing promise from page to component (PR #4304 -- search/page.tsx):
```typescript
// In page.tsx -- create promise but don't await
const searchResultsPromise = searchForOpportunities(convertedSearchParams);

return (
  <SearchFilters
    searchResultsPromise={searchResultsPromise}
  />
);
```

2. Awaiting promise in child component (PR #4304 -- SearchFilters.tsx):
```typescript
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

3. Reviewer rationale (PR #4304 -- doug-s-nava):
> "the tricky piece here is that we have an async call in this component, but the component is not suspended. I did it this way because all we care about from the search response is the facet count, which is not vitally important to the functionality of the page. If we suspended on this, it would make the entire filter section unusable until the search results load"

**Rationale:** Allows non-critical data to load without blocking the UI. The parent creates the promise so it begins fetching immediately, and the child awaits it when ready.

**Open Questions:** None.

---

## Rule 5: Shared Types in `/types` Directory

**Pattern Name:** Centralized Type Definitions

**Rule Statement:** ALWAYS place shared types and interfaces in `src/types/` with domain-specific files (e.g., `attachmentTypes.ts`, `searchFilterTypes.ts`). ONLY define types inline within a component file if they will never be referenced outside that file.

**Confidence:** High

**Frequency:** High -- enforced by reviewers

**Code Examples:**

1. Shared type extracted to types directory (PR #5204 -- OpportunityOverview):
```typescript
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

2. Local-only type defined inline (PR #5756 -- AttachmentsCardForm):
```typescript
interface Props {
  applicationId: string;
  errorText?: string;
  handleUploadAttachment: (files: FileList | null) => void;
  inputRef: RefObject<FileInputRef | null>;
}
```

3. Reviewer enforcement (PR #5756 -- doug-s-nava):
> "can these be moved to a types file?"

**Rationale:** Centralizing shared types prevents duplication and makes them discoverable. As codified in PR #4414: "Typings should be placed within the /types directory unless they will only be ever referenced locally within the file where they are defined."

**Open Questions:** None.

---

## Rule 6: USWDS Wrapper Components for Repeated Customization

**Pattern Name:** Simpler Wrapper Components

**Rule Statement:** When a `@trussworks/react-uswds` component needs repeated customization or workarounds, ALWAYS create a wrapper component in `src/components/` rather than duplicating the customization at each usage site. For modals specifically, ALWAYS use `SimplerModal` instead of the raw Truss `Modal` component.

**Confidence:** High

**Frequency:** Medium -- established pattern with explicit examples

**Code Examples:**

1. SimplerModal wrapper (PR #5174):
```typescript
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

2. Consuming SimplerModal instead of raw Modal (PR #5174 -- SaveSearchModal):
```diff
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

**Rationale:** Consolidates SSR safety, close button styling, Escape key handling, and custom onClose functionality into a single component. Prevents each modal from independently managing these concerns.

**Open Questions:** None.

---

## Rule 7: USWDS Utility Classes Over Custom CSS

**Pattern Name:** USWDS-First Styling

**Rule Statement:** ALWAYS prefer USWDS utility classes for styling (`margin-*`, `padding-*`, `grid-col-*`, `font-sans-*`, `text-bold`, `display-flex`, `desktop:*`). ONLY add custom CSS in `_uswds-theme-custom-styles.scss` when USWDS primitives or Truss components do not expose the needed DOM nodes. ALWAYS use USWDS color tokens rather than raw hex values. ALWAYS apply font-size utility classes to semantic elements (headings), not to links inside them.

**Confidence:** High

**Frequency:** High -- enforced by reviewers

**Code Examples:**

1. USWDS utility classes in component markup (PR #5756 -- PopoverMenu):
```tsx
<div className="position-relative display-inline-block">
  <div
    className="border border-base-light bg-white shadow-2 radius-md padding-1
               text-no-wrap position-absolute z-top top-full right-0"
    role="menu"
    ref={menuRef}
  >
```

2. Reviewer enforcing USWDS tokens (PR #4304 -- acouch):
> "Extremely tiny nit but the design specifies `text-gray-50`. The output is almost identical."

3. Reviewer enforcing class placement (PR #5168 -- andycochran):
> "A font size utility class should go on the heading, not the link."

**Rationale:** USWDS utility classes ensure design system compliance, reduce custom CSS maintenance burden, and maintain visual consistency across the application.

**Open Questions:** None.

---

## Rule 8: Internationalization via `next-intl`

**Pattern Name:** Mandatory i18n for User-Facing Strings

**Rule Statement:** ALWAYS use `useTranslations` (client components) or `getTranslations` (server components) from `next-intl` for all user-facing text. NEVER hardcode user-facing strings except in temporary hotfixes (which must be clearly commented for removal). For translations containing markup, use `t.rich()` with component interpolation. Filter/sort option labels that need programmatic iteration SHOULD live in `src/constants/searchFilterOptions.ts` as plain objects rather than in i18n files.

**Confidence:** High

**Frequency:** Very high -- nearly all PRs touching UI text

**Code Examples:**

1. Client component i18n (PR #5756 -- AttachmentsCard):
```typescript
const t = useTranslations("Application.attachments");
return (
  <h3 className="margin-top-4">{t("attachments")}</h3>
);
```

2. Server component i18n (PR #8364 -- ResearchParticipantGuide page):
```typescript
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

3. Filter options moved to constants (PR #6252 -- sortOptions moved out of i18n):
```diff
// Removed from i18n/messages/en/index.ts:
-      options: {
-        postedDateDesc: "Posted date (Newest)",
-        ...
-      },

// Added to src/constants/searchFilterOptions.ts:
+export const sortOptions: FilterOption[] = [
+  { label: "Most relevant (Default)", value: "relevancy", id: "relevancy" },
+  { label: "Close date (Furthest)", value: "closeDateDesc", id: "closeDateDesc" },
+  ...
+];
```

**Rationale:** Ensures all text is translatable. The i18n infrastructure is kept in place even though only English is currently used, per team decision: "even though we don't have it in the roadmap to add spanish translations, the team wants to leave all the infrastructure behind the translations in place for now" (doug-s-nava, PR #6252).

**Open Questions:** The progressive move of filter options out of i18n into constants creates a hybrid approach. Should there be a clear boundary for what stays in i18n vs. what goes to constants?

---

## Rule 9: Context Providers for Shared State

**Pattern Name:** React Context with Guard Hook

**Rule Statement:** When state needs to be shared across multiple components, ALWAYS use a React Context provider pattern. ALWAYS include a custom hook that throws an error if used outside the provider. ALWAYS memoize the context value with `useMemo`.

**Confidence:** High

**Frequency:** Medium -- used for LoginModal, Query, User, Attachments, FeatureFlags

**Code Examples:**

1. LoginModalProvider with guard hook (PR #6160):
```typescript
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

2. Usage of provider wrapping Layout (PR #6160):
```typescript
<LoginModalProvider>
  <Header locale={locale} />
  <main id="main-content" className="border-top-0">
    {children}
  </main>
</LoginModalProvider>
```

**Rationale:** Consolidates shared state (e.g., a single login modal) rather than duplicating instances. The guard hook provides clear error messages when the provider is missing from the tree.

**Open Questions:** None.

---

## Rule 10: Standard Test Structure

**Pattern Name:** Accessibility + Snapshot + Behavioral Tests

**Rule Statement:** ALWAYS include an accessibility test using `jest-axe` (`expect(results).toHaveNoViolations()`) for new components. ALWAYS include a snapshot test. ALWAYS mock `next-intl` using the `useTranslationsMock` utility. ALWAYS reset mocks in `afterEach(() => jest.resetAllMocks())`. For async server components, call the component as a function and render the result.

**Confidence:** High

**Frequency:** ~70-95% of new component test files

**Code Examples:**

1. Standard test structure with a11y + snapshot (PR #5200 -- ClearSearchButton):
```typescript
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

2. i18n mock pattern (PR #8364 -- ResearchParticipantGuide page test):
```typescript
jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
  useMessages: () => mockMessages,
}));
```

3. Test-file typing hack -- explicitly blessed (PR #4414 -- code-style.md):
```typescript
jest.mock("some/mocked/file", () => ({
  originalFunction: (...args: unknown[]) => mockOriginalFunction(args) as unknown,
}));
```
> "Do not feel bad about hacking around or otherwise not following best typing practices in order to solve problems with typing in unit or e2e test files."

**Rationale:** Accessibility testing ensures WCAG compliance. Snapshot tests catch unintended visual regressions. Consistent mock patterns reduce boilerplate and make tests easier to write.

**Open Questions:** Test file location is in flux -- see Rule 12.

---

## Rule 11: Pass Whole Objects, Not Many Individual Props

**Pattern Name:** Object Props Over Prop Sprawl

**Rule Statement:** When a component needs many fields from a single data object, ALWAYS pass the whole object (or a `Pick<>` type of it) as a single prop rather than destructuring it into 10+ individual props at the call site. Helper functions that do not depend on component state SHOULD be defined outside the component body.

**Confidence:** High

**Frequency:** Medium -- explicitly enforced by reviewers

**Code Examples:**

1. Reviewer feedback on prop sprawl (PR #5204 -- doug-s-nava):
> "thinking about how we'll pass props into this component, I think it will be preferable to be able to pass a full opportunity or summary and then pull out the pieces we want from there, rather than pulling them out ahead of time and passing a list of 13 different props"

2. Resulting implementation (PR #5204 -- OpportunityCard after revision):
```typescript
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

3. Helper functions outside the component (PR #5204 -- doug-s-nava):
> "since each of these helper functions take in their dependencies as arguments, they can function independent of the component. As such it would be a minor improvement to define them outside of the component"

Result:
```typescript
// Defined OUTSIDE the component
const displayDate = (date: string | null) =>
  date ? getConfiguredDayJs()(date).format("MMM D, YYYY hh:mm A z") : null;

const displayAgencyAndCode = (agencyName: string | null, agencyCode: string | null) =>
  (agencyCode && agencyName ? `${agencyName} - ${agencyCode}` : null);
```

**Rationale:** Reduces prop count, simplifies call sites, and makes refactoring easier when the data shape changes.

**Open Questions:** None.

---

## Rule 12: No Barrel Files

**Pattern Name:** Direct Imports Only

**Rule Statement:** NEVER create `index.ts` barrel files for re-exporting components. ALWAYS import files by their direct path.

**Confidence:** Medium

**Frequency:** Low occurrence -- explicitly rejected when introduced

**Code Examples:**

1. Reviewer rejection (PR #5756 -- doug-s-nava):
> "we're not using this type of pattern at this point. For now can you reference files directly"

**Rationale:** Avoids circular dependency issues and makes import paths explicit. Keeps the dependency graph transparent.

**Open Questions:** This was stated as a "for now" position. Should it be formally adopted or reconsidered?

---

## Rule 13: Use Strict Equality

**Pattern Name:** Strict Equality Operators

**Rule Statement:** ALWAYS use `===` and `!==` instead of `==` and `!=` in JavaScript/TypeScript code.

**Confidence:** Medium

**Frequency:** Low occurrence (corrective) -- enforced when spotted

**Code Examples:**

1. Reviewer correction (PR #5204 -- doug-s-nava):
> "I'm not a fan of `!=` or `==` largely because I think the Javascript makes it really hard to understand what it means. In this case since we're explicitly expecting values of either `true`, `false` or `null` I think using `!==` makes the most sense"

**Rationale:** Strict equality avoids JavaScript's type coercion rules, which are notoriously confusing.

**Open Questions:** Should this be enforced via ESLint `eqeqeq` rule?

---

## Rule 14: Centralized Mock Data in Fixtures

**Pattern Name:** Centralized Test Fixtures

**Rule Statement:** ALWAYS prefer placing mock/fixture data in `src/utils/testing/fixtures.ts` for reuse across tests. Avoid creating per-test JSON mock files unless there is a specific reason (e.g., Storybook stories).

**Confidence:** Medium

**Frequency:** Consistently used, with some exceptions for stories

**Code Examples:**

1. Centralized fixtures (PR #4304 -- fixtures.ts):
```typescript
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

2. Reviewer flagging the tension (PR #5204 -- doug-s-nava):
> "we should discuss at some point how we want to handle things like this -- I've been defaulting to putting things in .ts files as in fixtures.ts but we have some stuff that is in individual mocks as json as well"

**Rationale:** Centralized fixtures reduce duplication, are typed, and ensure consistency across tests.

**Open Questions:** The team has not formally decided on the boundary between centralized `.ts` fixtures and per-story `.json` mocks. This needs tech lead resolution.

---

## Rule 15: `useClientFetch` for Client-Side API Calls

**Pattern Name:** Standardized Client Fetch Hook

**Rule Statement:** ALWAYS use the `useClientFetch` custom hook for client-side API calls rather than raw `fetch`. ALWAYS provide an error message string and configure `jsonResponse` and `authGatedRequest` options.

**Confidence:** High

**Frequency:** High -- consistently used in client components

**Code Examples:**

1. Standard usage (PR #5174 -- DeleteSavedSearchModal):
```typescript
const { clientFetch } = useClientFetch<Response>(
  "Error deleting saved search",
  { jsonResponse: false, authGatedRequest: true },
);
```

**Rationale:** Centralizes error handling, authentication, and response parsing for client-side API calls.

**Open Questions:** None.

---

## Rule 16: `useActionState` for Server Actions

**Pattern Name:** React 19 Server Action Pattern

**Rule Statement:** For form submissions using server actions, ALWAYS use React 19's `useActionState` hook to manage action state and pending status.

**Confidence:** High

**Frequency:** Medium -- used in form-related components

**Code Examples:**

1. Upload and delete actions (PR #5756 -- AttachmentsCard):
```typescript
const [uploadState, uploadFormAction] = useActionState(
  uploadAttachmentAction,
  uploadActionsInitialState satisfies UploadAttachmentActionState,
);

const [deleteState, deleteActionFormAction, deletePending] = useActionState(
  deleteAttachmentAction,
  deleteUploadActionsInitialState satisfies DeleteAttachmentActionState,
);
```

**Rationale:** `useActionState` provides a standardized way to handle server action responses and pending states in React 19.

**Open Questions:** None.

---

## Conflicts and Ambiguities Requiring Tech Lead Review

### Conflict 1: Test File Location

**Status:** Migration in progress, no formal decision

Most tests live in `frontend/tests/components/` mirroring the component path. However, newer tests are co-located directly with components:

- Co-located: `src/components/research-participant-guide/ResearchParticipantGuide.test.tsx` (PR #8364)
- Co-located: `src/components/workspace/OrganizationInvitationReplies.test.tsx` (PR #8363)
- Co-located: `src/components/applyForm/utils.test.ts`
- Traditional: `tests/components/SimplerModal.test.tsx` (PR #5174)
- Traditional: `tests/components/search/ClearSearchButton.test.tsx` (PR #5200)

**Question:** Should new tests be co-located or in `tests/`? Is the team actively migrating?

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
