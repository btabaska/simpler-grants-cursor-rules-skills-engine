# Pattern Discovery: Frontend Hooks (`frontend/src/hooks/`)

**Source:** 22 merged PRs analyzed from HHS/simpler-grants-gov
**Date range:** 2025-04-07 to 2025-05-06
**Primary authors:** doug-s-nava, acouch

---

## 1. Structural Patterns

### SP-1: Documented directory conventions for hooks, services, utils, components
PR #4414 established and documented conventions for frontend code organization:
- `src/hooks/` - Standalone custom React hooks
- `src/services/` - Cross-cutting functionality or feature-specific support (not standalone hooks, not components)
- `src/utils/` - Utility functions grouped by usage; avoid single-function files
- `src/components/` - All non-page-level components; general-use at root, page-specific in subdirectories
- `src/types/` - Typings unless only referenced locally

READMEs were added to each directory explaining the convention.

**Exemplar PRs:** #4414
**Frequency:** 1 foundational PR, but affects all subsequent work
**Trend:** Established and enforced
**Confidence:** High

### SP-2: Hooks as `use{Name}.ts` files in `src/hooks/`
Custom hooks follow the `use{PascalCaseName}` naming convention and live as individual files in `src/hooks/`:
- `useClientFetch.ts`
- `useCopyToClipboard.ts`
- `useFeatureFlags.ts`
- `useIsSSR.ts`
- `usePrevious.ts`
- `useRouteChange.ts`
- `useSearchParamUpdater.ts`
- `useSnackbar.ts`

**Frequency:** All hook files follow this pattern
**Trend:** Stable
**Confidence:** High

### SP-3: Service-coupled hooks live in service directories
Hooks that are part of a larger service (e.g., `useUser`) live in the service directory (`src/services/auth/useUser.tsx`) rather than in `src/hooks/`. The README explicitly states: "If a hook is part of a larger service it can live in the directory for that service instead."

**Exemplar PRs:** #4414 (documentation), `useUser` location
**Frequency:** 1 documented instance
**Trend:** Stable convention
**Confidence:** High

### SP-4: Components moved out of page directories into `src/components/`
Components that were co-located with pages (e.g., `src/app/[locale]/research/ResearchArchetypes.tsx`) were moved to `src/components/` subdirectories (e.g., `src/components/research/ResearchArchetypes.tsx`).

**Exemplar PRs:** #4414 (moved 6+ components)
**Frequency:** 1 large refactoring PR
**Trend:** One-time cleanup establishing convention
**Confidence:** High

### SP-5: Types extracted to `src/types/` directory
Types previously defined in service files (e.g., `src/services/auth/types.tsx`) were moved to `src/types/` (e.g., `src/types/authTypes.ts`).

**Exemplar PRs:** #4414
**Frequency:** 1 PR, affected 6+ files
**Trend:** Established convention
**Confidence:** High

### SP-6: Feature flags via HOC in services
`withFeatureFlag` moved from `src/hoc/` to `src/services/featureFlags/withFeatureFlag.tsx`, aligning with the service directory convention.

**Exemplar PRs:** #4414
**Frequency:** 1 PR
**Confidence:** Medium

---

## 2. Code Patterns

### CP-1: `useClientFetch` as the standard client-side fetch hook
A central `useClientFetch<T>` hook was introduced to standardize all client-side API requests. It handles:
- Token expiration checking (calls `refreshIfExpired`)
- Token refresh if expiring (calls `refreshIfExpiring`)
- Automatic JSON parsing (configurable via `jsonResponse` option)
- 401 handling with `refreshUser` and optional page refresh
- Auth-gated requests (configurable via `authGatedRequest` option)
- Error throwing on non-200 responses

Components that previously used standalone fetcher functions (e.g., `clientSavedSearchFetcher.ts`, `clientSearchResultsDownloadFetcher.ts`) were migrated to use `useClientFetch`.

**Exemplar PRs:** #4521 (created), #4874 (enhanced with refresh)
**Frequency:** 2 PRs created/enhanced it; 7+ components adopted it
**Trend:** Centralizing; standalone fetcher files were deleted
**Confidence:** High

### CP-2: Eliminating standalone client fetcher files
Individual client-side fetcher files (`clientSavedSearchFetcher.ts`, `clientSearchResultsDownloadFetcher.ts`) were removed. Their logic was inlined into components using `useClientFetch`. This eliminates a layer of abstraction.

**Exemplar PRs:** #4521
**Frequency:** 2 files deleted
**Trend:** Consolidating toward hook-based fetching
**Confidence:** High

### CP-3: `useRouteChange` for navigation-triggered side effects
A `useRouteChange` hook monitors `pathname` and `searchParams` changes and fires a callback. Used to check auth token expiration on every navigation.

Pattern:
```typescript
export const useRouteChange = (onRouteChange: () => void | Promise<void>) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => { onRouteChange(); }, [pathname, searchParams, onRouteChange]);
};
```

**Exemplar PRs:** #4521
**Frequency:** 1 PR; single use via `RouteChangeWatcher` component
**Trend:** Stable; purpose-built for auth expiration checking
**Confidence:** High

### CP-4: Suspense boundary for `useSearchParams` consumers
Components using `useSearchParams` (which Next.js requires to be wrapped in Suspense) are isolated into their own component. Example: `RouteChangeWatcher` is wrapped in `<Suspense>` in the Header.

**Exemplar PRs:** #4521 (comment: "this is isolated in its own component because next was adamant that anything using useSearchParams needs to be wrapped in a suspense boundary")
**Frequency:** 1 explicit instance
**Trend:** Next.js requirement, followed when needed
**Confidence:** High

### CP-5: `useSnackbar` with configurable duration and infinite mode
The snackbar hook was enhanced to support configurable visible time with a default constant, and passing `-1` (or `0`) keeps it visible indefinitely (no auto-hide timeout). Functions wrapped in `useCallback` for stability.

**Exemplar PRs:** #4521
**Frequency:** 1 PR
**Trend:** Enhanced for logout notification use case
**Confidence:** Medium

### CP-6: UserProvider as central auth state manager
`UserProvider` manages all auth state: user profile, loading, errors, login/logout transitions. It exposes multiple callbacks through context:
- `refreshUser` - re-fetch session
- `refreshIfExpired` - check expiration and refresh if needed
- `refreshIfExpiring` - check if expiring within threshold (10 min) and refresh
- `logoutLocalUser` - clear local state
- `hasBeenLoggedOut` / `resetHasBeenLoggedOut` - track logout transitions for snackbar

**Exemplar PRs:** #4521, #4874
**Frequency:** 2 PRs significantly modified it
**Trend:** Growing in complexity; handles more auth lifecycle events
**Confidence:** High

### CP-7: Debounced user fetcher to prevent duplicate requests
The user session fetcher is debounced with `leading: true, trailing: false` at 500ms to prevent duplicate requests on page load. This was moved from `UserProvider` into `clientUserFetcher.ts` to avoid circular dependencies with `useClientFetch`.

**Exemplar PRs:** #4521
**Frequency:** 1 PR
**Trend:** Architectural decision to avoid circular deps
**Confidence:** High

### CP-8: `useSearchParamUpdater` as URL state management hook
A hook that wraps Next.js router to provide `updateQueryParams`, `replaceQueryParams`, `removeQueryParam`, and `setQueryParam` functions. Used extensively by search filter components.

**Exemplar PRs:** #4667 (added `setQueryParam`)
**Frequency:** 1 PR enhanced it; used by many components
**Trend:** Stable, incrementally extended
**Confidence:** High

### CP-9: Token expiration stored as milliseconds
JWT expiration (`exp`) is stored in seconds but converted to milliseconds (`exp * 1000`) for JavaScript Date compatibility. The `expiresAt` field type changed from `Date` to `number | undefined`.

**Exemplar PRs:** #4521
**Frequency:** 1 PR
**Trend:** Bug fix / normalization
**Confidence:** High

### CP-10: Constants file for auth timing
Auth timing values (`clientTokenRefreshInterval`, `clientTokenExpirationInterval`) are defined in `src/constants/auth.ts` rather than hardcoded in components.

**Exemplar PRs:** #4874
**Frequency:** 1 PR
**Trend:** New; extracting magic numbers to constants
**Confidence:** Medium

---

## 3. Corrective Patterns (Reviewer Enforcement)

### RE-1: Consolidate and document file organization conventions
Reviewer (acouch) requested that existing coding conventions from `development.md` be moved to the new `code-style.md` to avoid duplication.

**Exemplar PRs:** #4414 ("I'd suggest we remove that section and move Naming resolved and unresolved promises into this file")
**Frequency:** 1 PR
**Confidence:** High

### RE-2: Accessibility concerns on snackbar/alert components
Reviewer (acouch) flagged that a snackbar requiring user acknowledgment should use `role="alertdialog"` and a `<dialog>` element instead of `role="status"`.

**Exemplar PRs:** #4521
**Frequency:** 1 PR
**Trend:** Accessibility is reviewed but not always fully resolved in the same PR
**Confidence:** Medium

### RE-3: Simplify conditional expressions
Reviewer (freddieyebra) suggested replacing ternary with direct boolean expression: `data.type === "save" ? setSaved(true) : setSaved(false)` to `setSaved(data.type === "save")`.

**Exemplar PRs:** #4521
**Frequency:** 1 PR
**Confidence:** Medium

### RE-4: Early return for missing auth token
Reviewer flagged that components should check for `user?.token` before making API requests, setting error state or returning early if missing.

**Exemplar PRs:** #4521 (reviewer on SaveSearchModal)
**Frequency:** 1 PR
**Confidence:** Medium

---

## 4. Anti-Patterns (Flagged as Wrong)

### AP-1: Components co-located with page files
Components like `FeatureFlagsTable` and research components were placed inside `src/app/[locale]/` page directories. These were moved to `src/components/` subdirectories.

**Exemplar PRs:** #4414
**Confidence:** High

### AP-2: Standalone client fetcher files as an abstraction layer
Individual fetcher files (e.g., `clientSavedSearchFetcher.ts`) that wrapped `fetch()` with auth token passing and error handling were replaced by the `useClientFetch` hook, which handles these concerns centrally.

**Exemplar PRs:** #4521
**Confidence:** High

### AP-3: Session expiration stored as wrong type
`expiresAt` was stored as a `Date` type but the JWT `exp` value is a Unix timestamp in seconds. This was corrected to store as `number` (milliseconds) for proper comparison.

**Exemplar PRs:** #4521
**Confidence:** High

### AP-4: `isSessionExpired` utility with incorrect comparison
The `authUtil.ts` function `isSessionExpired` had a bug: `userSession.expiresAt > new Date(Date.now())` (checking if expiry is in the future, which is the opposite of expired). This file was removed entirely and the logic was moved into `UserProvider` using `dateUtil.isExpired()`.

**Exemplar PRs:** #4521
**Confidence:** High

### AP-5: Single-function utility files
The conventions doc states: "avoid files that contain or support only a single function." Files like `isSummary.ts` and `convertSearchParamsToProperTypes.ts` were deleted; their content was merged into related utility files.

**Exemplar PRs:** #4414
**Confidence:** High

### AP-6: `useClientFetch` in dependency arrays causes infinite re-renders
A known issue documented in the code: adding `clientFetch` to useEffect dependency arrays causes infinite re-render loops because the hook depends on `useUser`. The workaround is to not include it in deps, acknowledged via eslint-disable comment.

**Exemplar PRs:** #4521 (code comment: "do not include this in dependency arrays")
**Confidence:** High (documented known issue)

---

## 5. Connections to Other Domains

### CD-1: Frontend Hooks <-> API Auth
The `useClientFetch` hook implements the client-side of the auth contract:
- Checks token expiration before requests
- Sends tokens via appropriate headers (`X-SGG-Token`)
- Handles 401 responses by refreshing user session
- Token refresh interval (10 min) and expiration (15 min) mirror API JWT settings from PR #4378

**Exemplar PRs:** #4521, #4874, #4378
**Connection strength:** Strong (contractual)

### CD-2: Frontend Hooks <-> API Validation
Frontend components consume validation error types from the API. The `ValidationErrorType` enum values are the contract the frontend uses to map errors to localized messages. Hook-based fetch functions surface these errors to components.

**Exemplar PRs:** Indirect; validation error types inform frontend message mapping
**Connection strength:** Medium (contractual but not directly in hooks code)

### CD-3: Frontend Hooks <-> Frontend Services/Auth
Multiple hooks depend on `useUser` from `src/services/auth/useUser.tsx`:
- `useClientFetch` uses `refreshIfExpired`, `refreshUser`, `refreshIfExpiring`
- `RouteChangeWatcher` uses `refreshIfExpired`
- Various components use `useUser` for auth state

The `UserProvider` is the central state manager that hooks consume.

**Exemplar PRs:** #4521, #4874
**Connection strength:** Strong (architectural dependency)

### CD-4: Frontend Hooks <-> Search Components
`useSearchParamUpdater` is the bridge between search UI components and URL state:
- `SearchFilterAccordion` uses it to update filter query params
- `SearchBar` uses it for query term updates
- `SearchPagination` uses it for page navigation
- `SaveSearchSelector` uses it for applying saved searches
- `AnyOptionCheckbox` uses `setQueryParam` to clear filters

**Exemplar PRs:** #4667, #4414
**Connection strength:** Strong (architectural dependency)

### CD-5: Frontend Hooks <-> Next.js Framework
Several hooks wrap or adapt Next.js primitives:
- `useRouteChange` wraps `usePathname()` and `useSearchParams()`
- `useSearchParamUpdater` wraps `useRouter()` and `useSearchParams()`
- `useClientFetch` uses `useRouter()` for refresh-on-401
- Suspense boundaries required for `useSearchParams` consumers

**Connection strength:** Strong (framework coupling)
