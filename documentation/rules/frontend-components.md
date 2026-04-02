# Frontend Components -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a pending
> marker are awaiting team confirmation. All other patterns reflect
> high-confidence conventions observed consistently across the codebase.

## Overview

The simpler-grants-gov frontend organizes React components under `frontend/src/components/` using a domain-based subdirectory structure. Components are categorized by feature area (e.g., `search/`, `application/`, `workspace/`) rather than by component type, with general-purpose components living at the root level. This convention was explicitly codified in PR #4414 with a README added to the components directory.

The project follows a server-first architecture based on Next.js App Router conventions. Components default to server components and only add `"use client"` when client-side interactivity is genuinely required. Props are always destructured in function signatures, types are centralized in `src/types/`, and styling is driven primarily by USWDS utility classes. All user-facing text goes through the `next-intl` internationalization pipeline (see `frontend-i18n.md`).

A standard test structure accompanies every new component: accessibility scanning via `jest-axe`, snapshot tests for complex UI, and behavioral tests using React Testing Library. Mock data is centralized in `src/utils/testing/fixtures.ts` and translation mocks use shared utilities from `intlMocks.ts`. See `frontend-tests.md` for the full testing convention set.

## Rules

### Component Organization

#### Rule: Domain-Based Component Directory Structure

**Confidence:** High
**Observed in:** ~90% of new component additions | PR refs: #4414, #5174, #5756

General-purpose components (used across multiple features) MUST live at the root of `src/components/`. Feature-specific components MUST live in a subdirectory named after their feature area. Sub-feature nesting (e.g., `application/attachments/`) is permitted when warranted.

**DO:**
```
# From PR #5174 -- General-purpose component at root
frontend/src/components/SimplerModal.tsx
frontend/src/components/PopoverMenu.tsx
frontend/src/components/SaveIcon.tsx
frontend/src/components/TableHeader.tsx

# From PR #5756 -- Feature-specific components in subdirectory
frontend/src/components/application/attachments/AttachmentsCard.tsx
frontend/src/components/application/attachments/AttachmentsCardForm.tsx
frontend/src/components/application/attachments/AttachmentsCardTable.tsx
frontend/src/components/application/attachments/DeleteAttachmentModal.tsx
```

**DON'T:**
```
# Anti-pattern -- placing reusable components in page directories
frontend/src/app/[locale]/research/ResearchArchetypes.tsx
frontend/src/app/[locale]/dev/feature-flags/FeatureFlagsTable.tsx
```

> **Rationale:** Organizes components by their usage context rather than by component type, making it easy to find all components related to a feature. Codified explicitly in `frontend/src/components/README.md` (PR #4414): "All non-page level components should go in this directory."

---

#### Rule: Components Must Not Live in Page Directories

**Confidence:** High
**Observed in:** 6+ components moved in foundational PR | PR refs: #4414

NEVER place reusable components in `src/app/[locale]/` page directories. ALWAYS place them in `src/components/` (general-use at root, page-specific in subdirectories).

**DO:**
```typescript
// From PR #4414 -- correct import paths
import ResearchArchetypes from "src/components/research/ResearchArchetypes";
import FeatureFlagsTable from "src/components/dev/FeatureFlagsTable";
```

**DON'T:**
```typescript
// Anti-pattern -- components co-located with pages
import ResearchArchetypes from "src/app/[locale]/research/ResearchArchetypes";
import FeatureFlagsTable from "src/app/[locale]/dev/feature-flags/FeatureFlagsTable";
```

> **Rationale:** Co-locating components with pages creates ambiguity about reusability and makes refactoring harder. The convention matches Next.js best practices of keeping `app/` for routing and pages only.

---

#### Rule: No Barrel Files

**Confidence:** Medium (Pending)
**Observed in:** 1 explicit rejection | PR refs: #5756

NEVER create `index.ts` barrel files for re-exporting components. ALWAYS import files by their direct path.

**DO:**
```typescript
// Direct import by file path
import { AttachmentsCard } from "src/components/application/attachments/AttachmentsCard";
```

**DON'T:**
```typescript
// Anti-pattern -- barrel file re-exports
// src/components/application/attachments/index.ts
export { AttachmentsCard } from "./AttachmentsCard";
export { AttachmentsCardForm } from "./AttachmentsCardForm";
```

> **Rationale:** Avoids circular dependency issues and makes import paths explicit. Keeps the dependency graph transparent. Reviewer (doug-s-nava, PR #5756): "we're not using this type of pattern at this point. For now can you reference files directly."

---

### Component Signatures and Props

#### Rule: Destructured Props with Type Annotations

**Confidence:** High
**Observed in:** ~95% of components | PR refs: #5204, #4304

ALWAYS destructure props in the component function signature. NEVER accept a `props` object and access properties via `props.propName`. PREFER plain function signatures with type annotations over `React.FC<Props>` syntax.

**DO:**
```typescript
// From PR #5204 -- destructured with inline type annotation
export const OpportunityCard = ({
  opportunityOverview,
}: {
  opportunityOverview: OpportunityOverviewType;
}) => {
```

**DON'T:**
```typescript
// Anti-pattern -- React.FC syntax with non-destructured props
const SearchFilterSection: React.FC<SearchFilterSectionProps> = (props) => {
  const option = props.option; // accessing via props object
```

> **Rationale:** Destructuring in the signature makes it immediately clear what props a component accepts. Avoiding `React.FC` removes implicit `children` typing and aligns with modern React conventions. Reviewer (doug-s-nava, PR #5204): "I believe all of the signatures for our components destructure the props in the signature."

---

#### Rule: Object Props Over Prop Sprawl

**Confidence:** High
**Observed in:** Explicitly enforced by reviewer | PR refs: #5204

When a component needs many fields from a single data object, ALWAYS pass the whole object (or a `Pick<>` type of it) as a single prop rather than destructuring it into 10+ individual props at the call site. Helper functions that do not depend on component state SHOULD be defined outside the component body.

**DO:**
```typescript
// From PR #5204 -- pass whole object, destructure inside
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

// Defined OUTSIDE the component
const displayDate = (date: string | null) =>
  date ? getConfiguredDayJs()(date).format("MMM D, YYYY hh:mm A z") : null;
```

**DON'T:**
```typescript
// Anti-pattern -- passing 13 individual props at the call site
<OpportunityOverview
  agencyCode={opp.agency_code}
  agencyName={opp.agency_name}
  opportunityTitle={opp.opportunity_title}
  opportunityId={opp.opportunity_id}
  // ... 9 more props
/>
```

> **Rationale:** Reduces prop count, simplifies call sites, and makes refactoring easier when the data shape changes. Reviewer (doug-s-nava, PR #5204): "I think it will be preferable to be able to pass a full opportunity or summary and then pull out the pieces we want from there, rather than pulling them out ahead of time and passing a list of 13 different props."

---

### Server/Client Component Architecture

#### Rule: Server Components by Default

**Confidence:** High
**Observed in:** Consistently applied across the codebase | PR refs: #4304, #8363, #5756

ALWAYS default to server components. ONLY add `"use client"` when the component requires client-side interactivity (event handlers, React hooks like `useState`, `useRef`, `useContext`, etc.). When a feature flag or other client-side dependency is removed and the component no longer needs hooks, ALWAYS remove the `"use client"` directive.

**DO:**
```typescript
// From PR #4304 -- server component with async data fetching
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

**DON'T:**
```typescript
// Anti-pattern -- "use client" left in place after feature flag removed
"use client";

// we can remove the "use client" decorator after we remove the feature flag
import { useFeatureFlags } from "src/hooks/useFeatureFlags";
```

> **Rationale:** Server components reduce JavaScript bundle size and enable direct data fetching. `"use client"` should be a deliberate choice, not a default. PR #8363 demonstrates removing the directive when no longer needed.

---

#### Rule: Promise Props for Non-Blocking Data Fetching

**Confidence:** High
**Observed in:** Primarily in search-related components | PR refs: #4304

When a server component needs data that should not block rendering of the entire section, ALWAYS pass the unresolved promise as a prop from the parent page and await it in the child component. ALWAYS name unresolved promises `varNamePromise` and resolved values `resolvedVarName`.

**DO:**
```typescript
// From PR #4304 -- page.tsx creates promise but doesn't await
const searchResultsPromise = searchForOpportunities(convertedSearchParams);

return (
  <SearchFilters
    searchResultsPromise={searchResultsPromise}
  />
);
```

```typescript
// From PR #4304 -- child component awaits the promise
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

**DON'T:**
```typescript
// Anti-pattern -- awaiting non-critical data in the parent, blocking all children
const searchResults = await searchForOpportunities(convertedSearchParams);
return <SearchFilters searchResults={searchResults} />;
```

> **Rationale:** Allows non-critical data to load without blocking the UI. The parent creates the promise so it begins fetching immediately, and the child awaits it when ready. Reviewer (doug-s-nava, PR #4304): "If we suspended on this, it would make the entire filter section unusable until the search results load."

---

### Types and Data Modeling

#### Rule: Shared Types in `/types` Directory

**Confidence:** High
**Observed in:** Enforced by reviewers | PR refs: #5204, #5756, #4414

ALWAYS place shared types and interfaces in `src/types/` with domain-specific files (e.g., `attachmentTypes.ts`, `searchFilterTypes.ts`). ONLY define types inline within a component file if they will never be referenced outside that file.

**DO:**
```typescript
// From PR #5204 -- shared type in types directory
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

**DON'T:**
```typescript
// Anti-pattern -- shared types defined in a component utility file
// src/components/application/attachments/utils.ts
export type AttachmentCardItem = { ... }; // reviewer: "can these be moved to a types file?"
```

> **Rationale:** Centralizing shared types prevents duplication and makes them discoverable. Codified in PR #4414: "Typings should be placed within the /types directory unless they will only be ever referenced locally within the file where they are defined."

---

### Styling

#### Rule: USWDS Utility Classes Over Custom CSS

**Confidence:** High
**Observed in:** Enforced by reviewers | PR refs: #5756, #4304, #5168

ALWAYS prefer USWDS utility classes for styling. ONLY add custom CSS in `_uswds-theme-custom-styles.scss` when USWDS primitives or Truss components do not expose the needed DOM nodes. ALWAYS use USWDS color tokens rather than raw hex values. ALWAYS apply font-size utility classes to semantic elements (headings), not to links inside them.

**DO:**
```tsx
// From PR #5756 -- USWDS utility classes in component markup
<div className="position-relative display-inline-block">
  <div
    className="border border-base-light bg-white shadow-2 radius-md padding-1
               text-no-wrap position-absolute z-top top-full right-0"
    role="menu"
    ref={menuRef}
  >
```

**DON'T:**
```tsx
// Anti-pattern -- raw hex colors or inline styles
<div style={{ color: "#6b6b6b", marginLeft: "16px" }}>
```

> **Rationale:** USWDS utility classes ensure design system compliance, reduce custom CSS maintenance burden, and maintain visual consistency across the application. Reviewer (acouch, PR #4304): "Extremely tiny nit but the design specifies `text-gray-50`."

---

### USWDS Wrapper Components

#### Rule: Simpler Wrapper Components for Repeated Customization

**Confidence:** High
**Observed in:** Established pattern with explicit examples | PR refs: #5174

When a `@trussworks/react-uswds` component needs repeated customization or workarounds, ALWAYS create a wrapper component in `src/components/` rather than duplicating the customization at each usage site. For modals specifically, ALWAYS use `SimplerModal` instead of the raw Truss `Modal` component.

**DO:**
```typescript
// From PR #5174 -- consuming SimplerModal instead of raw Modal
<SimplerModal
  modalRef={modalRef}
  modalId={"save-search"}
  titleText={saved ? undefined : t("title")}
  onClose={onClose}
>
```

**DON'T:**
```typescript
// Anti-pattern -- duplicating modal workarounds at every usage site
<Modal
  ref={modalRef}
  forceAction
  renderToPortal={!isSSR}
  aria-labelledby="save-search-heading"
  aria-describedby="save-search-description"
  onClick={(e) => { /* custom close handling duplicated here */ }}
  onKeyDown={(e) => { /* Escape key handling duplicated here */ }}
>
```

> **Rationale:** Consolidates SSR safety, close button styling, Escape key handling, and custom onClose functionality into a single component. Prevents each modal from independently managing these concerns.

---

### Context and Shared State

#### Rule: React Context with Guard Hook

**Confidence:** High
**Observed in:** Used for LoginModal, Query, User, Attachments, FeatureFlags | PR refs: #6160

When state needs to be shared across multiple components, ALWAYS use a React Context provider pattern. ALWAYS include a custom hook that throws an error if used outside the provider. ALWAYS memoize the context value with `useMemo`. See `frontend-hooks.md` for related hook patterns.

**DO:**
```typescript
// From PR #6160 -- LoginModalProvider with guard hook
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

**DON'T:**
```typescript
// Anti-pattern -- no guard hook, null checks scattered in consumers
const ctx = useContext(LoginModalContext);
if (!ctx) return null; // duplicated in every consumer
```

> **Rationale:** Consolidates shared state (e.g., a single login modal) rather than duplicating instances. The guard hook provides clear error messages when the provider is missing from the tree.

---

### Internationalization

#### Rule: Mandatory i18n for User-Facing Strings

**Confidence:** High
**Observed in:** Nearly all PRs touching UI text | PR refs: #5756, #8364, #6252

ALWAYS use `useTranslations` (client components) or `getTranslations` (server components) from `next-intl` for all user-facing text. NEVER hardcode user-facing strings. For translations containing markup, use `t.rich()` with component interpolation. See `frontend-i18n.md` for the full i18n convention set.

**DO:**
```typescript
// From PR #5756 -- client component i18n
const t = useTranslations("Application.attachments");
return (
  <h3 className="margin-top-4">{t("attachments")}</h3>
);
```

```typescript
// From PR #8364 -- server component i18n
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

**DON'T:**
```typescript
// Anti-pattern -- hardcoded user-facing strings
return <h3 className="margin-top-4">Attachments</h3>;
```

> **Rationale:** Ensures all text is translatable. The i18n infrastructure is maintained even though only English is currently used, per team decision (doug-s-nava, PR #6252): "even though we don't have it in the roadmap to add spanish translations, the team wants to leave all the infrastructure behind the translations in place for now."

---

### Client-Side Data Fetching

#### Rule: `useClientFetch` for Client-Side API Calls

**Confidence:** High
**Observed in:** Consistently used in client components | PR refs: #5174

ALWAYS use the `useClientFetch` custom hook for client-side API calls rather than raw `fetch`. ALWAYS provide an error message string and configure `jsonResponse` and `authGatedRequest` options. See `frontend-hooks.md` for the full hook specification and `frontend-services.md` for the server-side data fetching patterns.

**DO:**
```typescript
// From PR #5174 -- standard useClientFetch usage
const { clientFetch } = useClientFetch<Response>(
  "Error deleting saved search",
  { jsonResponse: false, authGatedRequest: true },
);
```

**DON'T:**
```typescript
// Anti-pattern -- raw fetch in a client component
const response = await fetch("/api/user/saved-searches", {
  method: "DELETE",
  body: JSON.stringify({ searchId }),
});
```

> **Rationale:** Centralizes error handling, authentication, and response parsing for client-side API calls.

---

### Server Actions

#### Rule: `useActionState` for Server Actions

**Confidence:** High
**Observed in:** Form-related components | PR refs: #5756

For form submissions using server actions, ALWAYS use React 19's `useActionState` hook to manage action state and pending status.

**DO:**
```typescript
// From PR #5756 -- upload and delete actions
const [uploadState, uploadFormAction] = useActionState(
  uploadAttachmentAction,
  uploadActionsInitialState satisfies UploadAttachmentActionState,
);

const [deleteState, deleteActionFormAction, deletePending] = useActionState(
  deleteAttachmentAction,
  deleteUploadActionsInitialState satisfies DeleteAttachmentActionState,
);
```

**DON'T:**
```typescript
// Anti-pattern -- manual state management for server action responses
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const handleSubmit = async () => {
  setLoading(true);
  try { await serverAction(data); } catch (e) { setError(e); }
  setLoading(false);
};
```

> **Rationale:** `useActionState` provides a standardized way to handle server action responses and pending states in React 19.

---

### Code Style

#### Rule: Use Strict Equality

**Confidence:** Medium (Pending)
**Observed in:** Corrective enforcement when spotted | PR refs: #5204

ALWAYS use `===` and `!==` instead of `==` and `!=` in JavaScript/TypeScript code.

**DO:**
```typescript
// Strict equality
if (value !== null) { ... }
```

**DON'T:**
```typescript
// Anti-pattern -- loose equality
if (value != null) { ... }
```

> **Rationale:** Strict equality avoids JavaScript's type coercion rules, which are notoriously confusing. Reviewer (doug-s-nava, PR #5204): "I'm not a fan of `!=` or `==` largely because I think the Javascript makes it really hard to understand what it means."

---

### Testing

#### Rule: Standard Component Test Structure

**Confidence:** High
**Observed in:** ~70-95% of new component test files | PR refs: #5200, #8364, #4414

ALWAYS include an accessibility test using `jest-axe` for new components. ALWAYS include a snapshot test for complex UI. ALWAYS mock `next-intl` using the `useTranslationsMock` utility. ALWAYS reset mocks in `afterEach(() => jest.resetAllMocks())`. For async server components, call the component as a function and render the result. See `frontend-tests.md` for the complete testing conventions.

**DO:**
```typescript
// From PR #5200 -- standard test structure
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

**DON'T:**
```typescript
// Anti-pattern -- no accessibility test, no mock reset
describe("ClearSearchButton", () => {
  it("works", () => {
    render(<ClearSearchButton buttonText="hi" />);
    // no axe check, no mock cleanup
  });
});
```

> **Rationale:** Accessibility testing ensures WCAG compliance. Snapshot tests catch unintended visual regressions. Consistent mock patterns reduce boilerplate and make tests easier to write.

---

#### Rule: Centralized Test Fixtures

**Confidence:** Medium
**Observed in:** Consistently used, with some exceptions for stories | PR refs: #4304, #5204

ALWAYS prefer placing mock/fixture data in `src/utils/testing/fixtures.ts` for reuse across tests.

**DO:**
```typescript
// From PR #4304 -- centralized fixtures
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

**DON'T:**
```typescript
// Anti-pattern -- defining large mock objects inline in individual test files
const response = {
  data: [{ opportunity_title: "test", opportunity_id: 1, /* 20 more fields */ }],
  // duplicated in every test file
};
```

> **Rationale:** Centralized fixtures reduce duplication, are typed, and ensure consistency across tests.

---

## Anti-Patterns

### Anti-Pattern: Prop Sprawl

Passing 10+ individual primitive props from a data object to a component, rather than passing the object itself. Caught and corrected in PR #5204.

### Anti-Pattern: Leaving `"use client"` After Removing Client Dependencies

When a feature flag or hook dependency is removed but the `"use client"` directive is left in place. Demonstrated as fixed in PR #8363.

### Anti-Pattern: Components in Page Directories

Placing reusable components under `src/app/[locale]/` instead of `src/components/`. Cleaned up in PR #4414.

### Anti-Pattern: Barrel File Re-Exports

Creating `index.ts` files that re-export from sibling modules. Rejected in PR #5756.

## Known Inconsistencies

### Test File Location

Most tests live in `frontend/tests/components/` mirroring the component path. However, newer tests are co-located directly with components (e.g., `src/components/research-participant-guide/ResearchParticipantGuide.test.tsx` in PR #8364). The team has not formally decided on a standard. See cross-domain inconsistency INC-6.

### Component Definition Style

Both arrow functions and function declarations are used. Arrow functions are common for smaller/leaf components (`export const SaveIcon = ...`), while function declarations are common for larger/page-level components (`export default function SearchFilters ...`). No formal decision has been documented.

### Named vs. Default Exports

Page-level components tend to use `export default function`, while reusable components tend to use named exports (`export const Component`). This is not formally documented.

### Feature Flag Approach

Both `withFeatureFlag` HOC and `useFeatureFlags` hook exist, but feature flags are being progressively removed (PR #8363 removed `manageUsersOff`). The pattern is temporary by nature.

## Related Documents
- **Cursor Rules:** `.cursor/rules/frontend-components.md`
- **Related Domains:** `frontend-hooks.md` (hook patterns, Context providers), `frontend-services.md` (data fetching, `useClientFetch`), `frontend-i18n.md` (internationalization conventions), `frontend-tests.md` (testing conventions)
