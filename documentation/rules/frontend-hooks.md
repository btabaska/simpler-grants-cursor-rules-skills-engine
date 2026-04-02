# Frontend Hooks -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a pending
> marker are awaiting team confirmation. All other patterns reflect
> high-confidence conventions observed consistently across the codebase.

## Overview

The simpler-grants-gov frontend organizes custom React hooks into two locations: standalone hooks in `frontend/src/hooks/` and service-coupled hooks within their respective service directories (e.g., `src/services/auth/useUser.tsx`). This distinction was explicitly documented in PR #4414 via README files added to each directory.

The most critical hook in the codebase is `useClientFetch`, which centralizes all client-side API requests with built-in auth token management, expiration checking, and error handling. It replaced multiple standalone fetcher files and is the required approach for any client-side API call. The hook has a known limitation where including it in `useEffect` dependency arrays causes infinite re-renders -- this must be worked around with `eslint-disable` comments.

Other key hooks include `useSearchParamUpdater` for URL state management, `useRouteChange` for navigation-triggered side effects, and the `useUser` hook exposed via `UserProvider` for centralized auth state. All hooks follow the `use{PascalCaseName}` naming convention and are individually exported from their own files (no barrel exports).

## Rules

### Hook Organization

#### Rule: Standalone vs. Service-Coupled Hook Placement

**Confidence:** High
**Observed in:** Universal convention; documented in READMEs | PR refs: #4414

ALWAYS place standalone custom React hooks in `src/hooks/` as individual `use{PascalCaseName}.ts` files. If a hook is part of a larger service, it MUST live in that service's directory instead (e.g., `src/services/auth/useUser.tsx`).

**DO:**
```markdown
# From PR #4414 -- README added to frontend/src/hooks/
# Hooks

Implemenations of standalone custom React hooks should live in this directory.
If a hook is part of a larger service it can live in the directory for that
service instead.
```

```
# Standalone hooks in src/hooks/
src/hooks/useClientFetch.ts
src/hooks/useCopyToClipboard.ts
src/hooks/useFeatureFlags.ts
src/hooks/useIsSSR.ts
src/hooks/usePrevious.ts
src/hooks/useRouteChange.ts
src/hooks/useSearchParamUpdater.ts
src/hooks/useSnackbar.ts

# Service-coupled hook in service directory
src/services/auth/useUser.tsx
```

**DON'T:**
```
# Anti-pattern -- placing a service-coupled hook in src/hooks/
src/hooks/useUser.ts  # depends heavily on auth service internals
```

> **Rationale:** The distinction prevents hooks with strong service dependencies from cluttering the general hooks directory. Documented in PR #4414 which established conventions for `src/hooks/`, `src/services/`, `src/utils/`, and `src/components/`.

---

### Client-Side Fetching

#### Rule: `useClientFetch` as the Standard Client-Side Fetch Hook

**Confidence:** High
**Observed in:** 2 PRs created/enhanced it; 7+ components adopted it; 2 standalone fetcher files deleted | PR refs: #4521, #4874

ALWAYS use the `useClientFetch<T>` hook for client-side API requests. NEVER create standalone client fetcher files. Inline fetch logic into components using `useClientFetch` instead. See `frontend-services.md` for the full server-side data fetching architecture.

**DO:**
```typescript
// From PR #4521 -- component adoption pattern (DeleteSavedSearchModal)
const { clientFetch } = useClientFetch<Response>(
  "Error deleting saved search",
  { jsonResponse: false, authGatedRequest: true },
);

// Usage in handler:
clientFetch("/api/user/saved-searches", {
  method: "DELETE",
  body: JSON.stringify({ searchId: savedSearchId }),
})
```

```typescript
// From PR #4521 -- named instances for multiple endpoints (OpportunitySaveUserControl)
const { clientFetch: fetchSaved } = useClientFetch<MinimalOpportunity[]>(
  "Error fetching saved opportunity",
);
const { clientFetch: updateSaved } = useClientFetch<{ type: string }>(
  "Error updating saved opportunity",
);
```

**DON'T:**
```typescript
// Anti-pattern -- standalone client fetcher file (these were deleted in PR #4521)
// clientSavedSearchFetcher.ts -- 74 lines of duplicated auth/fetch logic
// clientSearchResultsDownloadFetcher.ts -- 30 lines of duplicated auth/fetch logic
```

> **Rationale:** Centralizing fetch logic eliminates duplicated auth-token handling, expiration checking, and error handling across individual fetcher files. The PR description states: "creates a useClientFetch hook to handle common behavior for all client side fetch calls."

---

#### Rule: `useClientFetch` Must Not Be in Dependency Arrays

**Confidence:** High
**Observed in:** Every component using `useClientFetch` in a `useEffect` (5+ instances) | PR refs: #4521, #4887

NEVER include `clientFetch` from `useClientFetch` in React `useEffect` dependency arrays. This causes infinite re-render loops because the hook depends on `useUser`. Add an `eslint-disable-next-line react-hooks/exhaustive-deps` comment instead.

**DO:**
```typescript
// From PR #4887 -- eslint-disable in consuming components
// ExportSearchResultsButton.tsx
useEffect(() => {
  // ... uses clientFetch
}, [searchParams]);
// eslint-disable-next-line react-hooks/exhaustive-deps

// OpportunitySaveUserControl.tsx
useEffect(() => {
  if (!user?.token) return;
  setLoading(true);
  fetchSaved(`/api/user/saved-opportunities/${opportunityId}`)
  // ...
}, [opportunityId, user?.token]);
// eslint-disable-next-line react-hooks/exhaustive-deps
```

**DON'T:**
```typescript
// Anti-pattern -- including clientFetch in dependency array causes infinite re-renders
useEffect(() => {
  clientFetch("/api/data").then(setData);
}, [clientFetch]); // INFINITE LOOP
```

> **Rationale:** The `useCallback` in `useClientFetch` has an empty dependency array, but the outer hook closure references `useUser` state. Adding it to deps triggers re-renders because `useUser` state changes propagate. PR #4521 code comment: "do not include this in dependency arrays. - DWS"

---

### URL State Management

#### Rule: `useSearchParamUpdater` for URL Query Parameters

**Confidence:** High
**Observed in:** 10+ components across multiple PRs | PR refs: #4667, #5200, #5469, #5692

ALWAYS use `useSearchParamUpdater` for URL query parameter manipulation in search-related components. NEVER use `router.push` directly with query string construction.

**DO:**
```typescript
// From PR #4667 -- using setQueryParam
import { useSearchParamUpdater } from "src/hooks/useSearchParamUpdater";

const { setQueryParam } = useSearchParamUpdater();
const clearAllOptions = () => {
  const clearedSelections = defaultEmptySelection?.size
    ? Array.from(defaultEmptySelection).join(",")
    : "";
  setQueryParam(queryParamKey, clearedSelections);
};
```

```typescript
// From PR #5469 -- using removeQueryParamValue in PillList
const { removeQueryParamValue } = useSearchParamUpdater();
<Pill
  label={label}
  onClose={() => removeQueryParamValue(queryParamKey, queryParamValue)}
/>
```

```typescript
// From PR #5200 -- using clearQueryParams
const { clearQueryParams } = useSearchParamUpdater();
clearQueryParams(paramsToRemove);
```

**DON'T:**
```typescript
// Anti-pattern -- manual query string construction
const router = useRouter();
const params = new URLSearchParams(window.location.search);
params.set("status", "active");
router.push(`/search?${params.toString()}`);
```

> **Rationale:** Centralizing URL state management ensures consistent behavior (scroll control, proper encoding, query string formatting) across all search UI components. The hook wraps Next.js `useRouter` and `useSearchParams` to provide a clean API.

---

### Navigation and Route Changes

#### Rule: `useRouteChange` with Suspense Boundary for `useSearchParams` Consumers

**Confidence:** High
**Observed in:** 1 explicit instance; Suspense requirement applies to all `useSearchParams` consumers | PR refs: #4521

ALWAYS wrap components that use `useSearchParams` in a `<Suspense>` boundary. When monitoring route changes, use the `useRouteChange` hook via a dedicated wrapper component.

**DO:**
```typescript
// From PR #4521 -- RouteChangeWatcher component with Suspense
// this is isolated in its own component because next was adamant that anything using
// useSearchParams needs to be wrapped in a suspense boundary
export const RouteChangeWatcher = () => {
  const { refreshIfExpired } = useUser();
  useRouteChange(async () => {
    await refreshIfExpired();
  });
  return <></>;
};
```

```tsx
// From PR #4521 -- Suspense wrapping in Header
<Suspense>
  <RouteChangeWatcher />
</Suspense>
```

**DON'T:**
```tsx
// Anti-pattern -- using useSearchParams without Suspense boundary
const Header = () => {
  const searchParams = useSearchParams(); // will cause Next.js errors
  // ...
};
```

> **Rationale:** Next.js requires `useSearchParams` consumers to be wrapped in Suspense boundaries. The `RouteChangeWatcher` pattern isolates this requirement into a dedicated component, keeping the Suspense boundary minimal and the auth-checking logic reusable.

---

### Auth State Management

#### Rule: UserProvider as Central Auth State Manager

**Confidence:** High
**Observed in:** 2 PRs significantly modified it; consumed by all auth-dependent components | PR refs: #4521, #4874

ALWAYS manage auth state (user profile, loading, errors, login/logout transitions, token refresh) through `UserProvider` and consume it via the `useUser` hook. NEVER implement auth state management in individual components.

**DO:**
```typescript
// From PR #4521 -- UserProvider exposing auth lifecycle methods
const value = useMemo(
  () => ({
    user: localUser,
    error: userFetchError,
    isLoading,
    refreshUser: getUserSession,
    hasBeenLoggedOut,
    logoutLocalUser,
    resetHasBeenLoggedOut,
    refreshIfExpired,
  }),
  [localUser, userFetchError, isLoading, getUserSession,
   hasBeenLoggedOut, logoutLocalUser, refreshIfExpired, resetHasBeenLoggedOut],
);
```

```typescript
// From PR #4874 -- refreshIfExpiring added
const refreshIfExpiring = useCallback(async () => {
  if (isExpiring(localUser?.expiresAt)) {
    await getUserSession().then(noop).catch(noop);
    return true;
  }
}, [localUser?.expiresAt, getUserSession]);
```

**DON'T:**
```typescript
// Anti-pattern -- managing auth state in individual components
const [user, setUser] = useState(null);
const [token, setToken] = useState(null);
useEffect(() => {
  fetch("/api/auth/session").then(r => r.json()).then(setUser);
}, []);
```

> **Rationale:** Centralizing auth state prevents inconsistencies across components and enables coordinated logout transitions (e.g., showing snackbar when `hasBeenLoggedOut` transitions). The debounced fetcher prevents duplicate session requests on page load.

---

#### Rule: Early Return for Missing Auth Token Before API Requests

**Confidence:** Medium
**Observed in:** Reviewer-enforced across multiple components | PR refs: #4521

ALWAYS check for `user?.token` before making authenticated API requests. Return early or set an error state if the token is missing.

**DO:**
```typescript
// From PR #4521 -- SaveSearchModal
const handleSubmit = useCallback(() => {
  // ...validation...
  if (!user?.token) {
    return;
  }
  // proceed with API request
  clientFetch("/api/user/saved-searches", {
    method: "POST",
    body: JSON.stringify({ ...savedSearchParams, name: savedSearchName }),
  })
```

```typescript
// From PR #4521 -- OpportunitySaveUserControl
useEffect(() => {
  if (!user?.token) return;
  setLoading(true);
  fetchSaved(`/api/user/saved-opportunities/${opportunityId}`)
  // ...
}, [opportunityId, user?.token]);
```

**DON'T:**
```typescript
// Anti-pattern -- making API calls without checking for token
useEffect(() => {
  fetchSaved(`/api/user/saved-opportunities/${opportunityId}`)
    .catch(setError); // will fail with 401, triggering unnecessary refresh cycles
}, [opportunityId]);
```

> **Rationale:** Without token checks, components would make API requests that will fail with 401, triggering unnecessary refresh cycles. The early return pattern prevents wasted network requests and provides cleaner error handling.

---

#### Rule: Debounced User Fetcher to Prevent Duplicate Requests

**Confidence:** High
**Observed in:** 1 PR established the pattern | PR refs: #4521

ALWAYS debounce the user session fetcher with `leading: true, trailing: false` to prevent duplicate requests on page load. The debounced fetcher MUST live in `clientUserFetcher.ts` (not in UserProvider) to avoid circular dependencies with `useClientFetch`.

**DO:**
```typescript
// From PR #4521 -- debounced fetcher (clientUserFetcher.ts)
// if we don't debounce this call we get multiple requests going out on page load
// not using clientFetch since we don't need to check the expiration here
// and also that'd create a circular dependency chain in the clientFetch hook
export const debouncedUserFetcher = debounce(
  async () => {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (response.ok && response.status === 200) {
      const data = (await response.json()) as UserSession;
      return data;
    }
    throw new Error(`Unable to fetch user: ${response.status}`);
  },
  500,
  {
    leading: true,
    trailing: false,
  },
);
```

**DON'T:**
```typescript
// Anti-pattern -- un-debounced user fetcher inside UserProvider
const getUserSession = useCallback(async () => {
  const response = await fetch("/api/auth/session"); // fires multiple times on page load
  // ...
}, []);
```

> **Rationale:** Without debouncing, React's strict mode and component re-renders cause multiple concurrent session fetches on page load. It cannot use `useClientFetch` because that would create a circular dependency (useClientFetch -> useUser -> UserProvider -> debouncedUserFetcher -> useClientFetch).

---

### Auth Constants

#### Rule: Auth Timing Constants in `src/constants/auth.ts`

**Confidence:** Medium (Pending)
**Observed in:** 1 PR established the pattern | PR refs: #4874

ALWAYS define auth timing values (refresh intervals, expiration intervals) in `src/constants/auth.ts`. NEVER hardcode timing values in hooks or components.

**DO:**
```typescript
// From PR #4874 -- constants file (frontend/src/constants/auth.ts)
// 10 minutes
export const clientTokenRefreshInterval = 10 * 60 * 1000;

// 15 minutes
export const clientTokenExpirationInterval = 15 * 60 * 1000;
```

```typescript
// From PR #4874 -- consumed in dateUtil.ts
import { clientTokenRefreshInterval } from "src/constants/auth";

export const isExpiring = (expiration?: number) =>
  !isExpired(expiration) &&
  !!expiration &&
  expiration < Date.now() + clientTokenRefreshInterval;
```

**DON'T:**
```typescript
// Anti-pattern -- hardcoded timing values inline
export const isExpiring = (expiration?: number) =>
  expiration < Date.now() + 10 * 60 * 1000; // magic number
```

> **Rationale:** PR #4521 originally hardcoded `15 * 60 * 1000` inline. PR #4874 extracted these to constants to make timing values configurable and testable.

---

#### Rule: Token Expiration as Milliseconds (Not Date Objects)

**Confidence:** High
**Observed in:** 1 PR fixed this; validated in subsequent PR | PR refs: #4521, #4874

ALWAYS store token expiration as a `number` (milliseconds since epoch) in the `expiresAt` field. NEVER store as a `Date` type. Convert JWT `exp` (seconds) to milliseconds by multiplying by 1000.

**DO:**
```typescript
// From PR #4521 -- type definition
export interface UserProfile {
  email?: string;
  token: string;
  expiresAt?: number;  // milliseconds since epoch
  user_id: string;
}

// From PR #4521 -- conversion in session.ts
expiresAt: exp ? exp * 1000 : undefined,
```

**DON'T:**
```typescript
// Anti-pattern -- using Date objects for token expiration
export interface UserProfile {
  expiresAt: Date;  // Date comparisons are error-prone
}

// Bug that was caught and deleted:
export const isSessionExpired = (userSession: UserProfile): boolean => {
  return userSession.expiresAt > new Date(Date.now()); // inverted comparison!
};
```

> **Rationale:** The JWT `exp` claim is in seconds, but JavaScript Date/comparison APIs use milliseconds. Storing as a number avoids Date construction overhead and the bug where `Date > Date` comparisons are error-prone.

---

### Code Style in Hooks

#### Rule: Simplify Conditional Expressions in Hook Consumers

**Confidence:** Medium (Pending)
**Observed in:** 1 explicit reviewer correction | PR refs: #4521

ALWAYS prefer direct boolean expressions over ternary operators when setting boolean state.

**DO:**
```typescript
// From PR #4521 -- accepted revision
setSaved(data.type === "save");
```

**DON'T:**
```typescript
// Anti-pattern -- verbose ternary for boolean assignment
data.type === "save" ? setSaved(true) : setSaved(false);
```

> **Rationale:** Direct boolean expressions are more concise and less error-prone. Enforced via code review (freddieyebra, PR #4521).

---

#### Rule: Avoid Single-Function Utility Files

**Confidence:** High
**Observed in:** 1 PR documented and enforced; 2+ files deleted | PR refs: #4414

NEVER create utility files that contain or support only a single function. Merge the function into a related utility file instead.

**DO:**
```typescript
// From PR #4414 -- consolidated into domain utility file
import { convertSearchParamsToProperTypes } from "src/utils/search/searchUtils";
```

**DON'T:**
```typescript
// Anti-pattern -- single-function file (was deleted in PR #4414)
// src/utils/search/convertSearchParamsToProperTypes.ts
import { convertSearchParamsToProperTypes } from "src/utils/search/convertSearchParamsToProperTypes";
```

> **Rationale:** Single-function files create unnecessary indirection and file proliferation. Grouping related utilities by domain (e.g., `searchUtils.ts`) makes code more discoverable.

---

## Anti-Patterns

### Anti-Pattern: Standalone Client Fetcher Files

Creating individual client-side fetcher files (e.g., `clientSavedSearchFetcher.ts`) with duplicated auth/fetch logic. These were all deleted in PR #4521 when `useClientFetch` was introduced.

### Anti-Pattern: Including `clientFetch` in useEffect Dependencies

Adding `clientFetch` to React `useEffect` dependency arrays causes infinite re-render loops due to the `useUser` dependency chain. Always use an `eslint-disable-next-line react-hooks/exhaustive-deps` comment instead.

### Anti-Pattern: Date Objects for Token Expiration

Using `Date` objects instead of millisecond timestamps for token expiration. The original implementation had an inverted comparison bug that was caught during refactoring (PR #4521).

## Known Inconsistencies

### `useClientFetch` Infinite Re-render Issue

The `useClientFetch` hook has a documented infinite re-render issue when included in dependency arrays. The current workaround (eslint-disable comments) is accepted but there is an open question about whether this should be architecturally resolved (e.g., using `useRef` for the fetch function).

### `useSearchParamUpdater` Type Signature

The hook's return type was expanded in PR #5692 to accept `{ savedSearch?: string }` alongside `ValidSearchQueryParamData`. Whether the type signature should be unified is an open question.

### UserProvider Complexity

`UserProvider` complexity is growing with each auth lifecycle method added. Whether it should be split into smaller context providers (e.g., separate token-management from user-profile concerns) is an open question.

## Related Documents
- **Cursor Rules:** `.cursor/rules/frontend-hooks.md`
- **Related Domains:** `frontend-components.md` (Context providers, component patterns), `frontend-services.md` (server-side fetching, `useClientFetch` integration), `frontend-tests.md` (mock patterns for hooks)
