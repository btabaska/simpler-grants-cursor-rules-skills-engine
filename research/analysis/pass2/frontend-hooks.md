# Pattern Codification: Frontend Hooks (`frontend/src/hooks/`)

**Source:** 22 merged PRs from HHS/simpler-grants-gov
**Date range:** 2025-04-07 to 2025-05-06 (and ongoing through group)
**Primary authors:** doug-s-nava, acouch

---

## Pattern 1: Hooks Directory Convention -- Standalone vs. Service-Coupled

**Rule:** ALWAYS place standalone custom React hooks in `src/hooks/` as individual `use{PascalCaseName}.ts` files. If a hook is part of a larger service, it MUST live in that service's directory instead (e.g., `src/services/auth/useUser.tsx`).

**Confidence:** High
**Frequency:** Universal -- all hook files follow this convention; documented in READMEs added to each directory.

### Code Examples

From PR #4414 -- README added to `frontend/src/hooks/`:
```markdown
# Hooks

Implemenations of standalone custom React hooks should live in this directory.
If a hook is part of a larger service it can live in the directory for that
service instead.
```

From PR #4414 -- README added to `frontend/src/services/`:
```markdown
# Services

This is the home for functionality that either runs across multiple parts of
the application, or serves a specific purpose supporting a feature but does
not constitute a standalone hook or set of components.
```

Existing hook file names in `src/hooks/` (observed across PRs):
- `useClientFetch.ts`, `useCopyToClipboard.ts`, `useFeatureFlags.ts`, `useIsSSR.ts`, `usePrevious.ts`, `useRouteChange.ts`, `useSearchParamUpdater.ts`, `useSnackbar.ts`

### Rationale

PR #4414 was a foundational PR that documented and enforced existing conventions discussed between doug-s-nava and acouch. The distinction between `src/hooks/` (standalone) and service-directory hooks (coupled to a service) prevents hooks with strong service dependencies from cluttering the general hooks directory.

### Open Questions

- Should there be a maximum complexity threshold for when a standalone hook should be promoted to a service? (e.g., `useClientFetch` depends heavily on `useUser` but lives in `src/hooks/`)

---

## Pattern 2: `useClientFetch` as the Standard Client-Side Fetch Hook

**Rule:** ALWAYS use the `useClientFetch<T>` hook for client-side API requests. NEVER create standalone client fetcher files. Inline fetch logic into components using `useClientFetch` instead.

**Confidence:** High
**Frequency:** 2 PRs created/enhanced it (#4521, #4874); 7+ components adopted it; 2 standalone fetcher files deleted.

### Code Examples

From PR #4521 -- the hook definition (`frontend/src/hooks/useClientFetch.ts`):
```typescript
export const useClientFetch = <T>(
  errorMessage: string,
  { jsonResponse = true, authGatedRequest = false } = {},
) => {
  const { refreshIfExpired, refreshUser, refreshIfExpiring } = useUser();
  const router = useRouter();

  const fetchWithAuthCheck = async (
    url: string,
    options: RequestInit = {},
  ): Promise<Response> => {
    const expired = await refreshIfExpired();
    if (expired && authGatedRequest) {
      router.refresh();
      throw new Error("local token expired, logging out");
    }
    await refreshIfExpiring();
    const response = await fetch(url, options);
    if (response.status === 401) {
      await refreshUser();
      if (authGatedRequest) {
        router.refresh();
      }
      return response;
    }
    return response;
  };
  // ...
```

From PR #4521 -- component adoption pattern (`DeleteSavedSearchModal`):
```typescript
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

From PR #4521 -- standalone fetcher file deleted (`clientSavedSearchFetcher.ts`, 74 lines removed; `clientSearchResultsDownloadFetcher.ts`, 30 lines removed).

From PR #4874 -- `refreshIfExpiring` added to the fetch flow:
```typescript
const { refreshIfExpired, refreshUser, refreshIfExpiring } = useUser();
// ...
await refreshIfExpiring();
const response = await fetch(url, options);
```

### Rationale

Centralizing fetch logic eliminates duplicated auth-token handling, expiration checking, and error handling across individual fetcher files. The PR description states: "creates a useClientFetch hook to handle common behavior for all client side fetch calls."

### Open Questions

- The hook has a documented infinite re-render issue when included in dependency arrays (requires `eslint-disable` comments). Should this be architecturally resolved, or is the workaround acceptable long-term?

---

## Pattern 3: `useClientFetch` Must Not Be in Dependency Arrays (Known Limitation)

**Rule:** NEVER include `clientFetch` from `useClientFetch` in React `useEffect` dependency arrays. This causes infinite re-render loops because the hook depends on `useUser`. Add an `eslint-disable-next-line react-hooks/exhaustive-deps` comment instead.

**Confidence:** High
**Frequency:** Every component using `useClientFetch` in a `useEffect` (5+ instances across PRs #4521, #4887).

### Code Examples

From PR #4521 -- code comment in hook definition:
```typescript
// when this function is used in a useEffect block the linter will want you to add it to the
// dependency array. Unfortunately, right now, likely because this hook depends on useUser,
// adding this a dependency will cause an infinite re-render loop. We should look into fixing this
// but for the moment do not include this in dependency arrays. - DWS
const clientFetch = useCallback(
  async (url: string, options: RequestInit = {}): Promise<T> => {
    // ...
  },
  [],
);
```

From PR #4887 -- eslint-disable added to the hook itself:
```typescript
    throw new Error(`${errorMessage}: ${response.status}`);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
```

From PR #4887 -- eslint-disable added to consuming components:
```typescript
// ExportSearchResultsButton.tsx
  }, [searchParams]);\n  // eslint-disable-next-line react-hooks/exhaustive-deps

// SaveSearchSelector.tsx
  }, [user?.token, setSavedSearches]);\n  // eslint-disable-next-line react-hooks/exhaustive-deps

// OpportunitySaveUserControl.tsx
  }, [opportunityId, user?.token]);\n  // eslint-disable-next-line react-hooks/exhaustive-deps
```

### Rationale

The `useCallback` in `useClientFetch` has an empty dependency array, but the outer hook closure references `useUser` state. Adding it to deps triggers re-renders because `useUser` state changes propagate. PR #4887 formalized the workaround by adding explicit eslint-disable comments across all affected components.

### Open Questions

- Is there a planned architectural fix for this (e.g., using `useRef` for the fetch function)?
- Should this limitation be documented in the hooks README?

---

## Pattern 4: `useSearchParamUpdater` as the URL State Management Hook

**Rule:** ALWAYS use `useSearchParamUpdater` for URL query parameter manipulation in search-related components. NEVER use `router.push` directly with query string construction.

**Confidence:** High
**Frequency:** Used by 10+ components across PRs #4667, #5200, #5469, #5692; incrementally extended in each.

### Code Examples

From PR #4667 -- `setQueryParam` method added:
```typescript
const setQueryParam = (key: string, value: string, scroll = false) => {
  params.set(key, value);
  router.push(`${pathname}?${params.toString()}`, { scroll });
};
```

From PR #5200 -- `clearQueryParams` method added:
```typescript
const clearQueryParams = (paramsToRemove?: string[]) => {
  const paramsToClear = paramsToRemove || Array.from(params.keys());
  paramsToClear.forEach((paramKey) => {
    params.delete(paramKey);
  });
  router.push(`${pathname}${paramsToFormattedQuery(params)}`);
};
```

From PR #4667 -- consumer component (`AnyOptionCheckbox`):
```typescript
import { useSearchParamUpdater } from "src/hooks/useSearchParamUpdater";

const { setQueryParam } = useSearchParamUpdater();
// ...
const clearAllOptions = () => {
  const clearedSelections = defaultEmptySelection?.size
    ? Array.from(defaultEmptySelection).join(",")
    : "";
  setQueryParam(queryParamKey, clearedSelections);
};
```

From PR #5469 -- `PillList` component using `removeQueryParamValue`:
```typescript
const { removeQueryParamValue } = useSearchParamUpdater();
// ...
<Pill
  label={label}
  onClose={() => removeQueryParamValue(queryParamKey, queryParamValue)}
/>
```

### Rationale

Centralizing URL state management ensures consistent behavior (scroll control, proper encoding, query string formatting) across all search UI components. The hook wraps Next.js `useRouter` and `useSearchParams` to provide a clean API.

### Open Questions

- The hook's return type was expanded in PR #5692 to accept `{ savedSearch?: string }` alongside `ValidSearchQueryParamData`. Should the type signature be unified?

---

## Pattern 5: `useRouteChange` with Suspense Boundary for `useSearchParams` Consumers

**Rule:** ALWAYS wrap components that use `useSearchParams` in a `<Suspense>` boundary. When monitoring route changes, use the `useRouteChange` hook via a dedicated wrapper component.

**Confidence:** High
**Frequency:** 1 explicit instance (PR #4521), but the Suspense requirement applies to all `useSearchParams` consumers.

### Code Examples

From PR #4521 -- `useRouteChange` hook (`frontend/src/hooks/useRouteChange.ts`):
```typescript
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export const useRouteChange = (onRouteChange: () => void | Promise<void>) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // eslint-disable-next-line
    onRouteChange();
  }, [pathname, searchParams, onRouteChange]);
};
```

From PR #4521 -- `RouteChangeWatcher` component with Suspense:
```typescript
// RouteChangeWatcher.tsx
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

From PR #4521 -- Suspense wrapping in Header:
```tsx
<Suspense>
  <RouteChangeWatcher />
</Suspense>
```

### Rationale

Next.js requires `useSearchParams` consumers to be wrapped in Suspense boundaries. The `RouteChangeWatcher` pattern isolates this requirement into a dedicated component, keeping the Suspense boundary minimal and the auth-checking logic reusable.

### Open Questions

- None. This is a Next.js framework requirement.

---

## Pattern 6: UserProvider as Central Auth State Manager

**Rule:** ALWAYS manage auth state (user profile, loading, errors, login/logout transitions, token refresh) through `UserProvider` and consume it via the `useUser` hook. NEVER implement auth state management in individual components.

**Confidence:** High
**Frequency:** 2 PRs significantly modified it (#4521, #4874); consumed by all auth-dependent components.

### Code Examples

From PR #4521 -- UserProvider exposing auth lifecycle methods:
```typescript
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

From PR #4874 -- `refreshIfExpiring` added:
```typescript
// if token is less than 10 mins from its expiration, refresh the user to get a token refresh
const refreshIfExpiring = useCallback(async () => {
  if (isExpiring(localUser?.expiresAt)) {
    await getUserSession().then(noop).catch(noop);
    return true;
  }
}, [localUser?.expiresAt, getUserSession]);
```

From PR #4521 -- logout state tracking:
```typescript
const getUserSession = useCallback(async (): Promise<void> => {
  setHasBeenLoggedOut(false);
  setIsLoading(true);
  try {
    const fetchedUser: UserSession = await debouncedUserFetcher();
    if (fetchedUser) {
      if (localUser?.token && !fetchedUser.token) {
        setHasBeenLoggedOut(true);
      }
      setLocalUser(fetchedUser);
      // ...
```

### Rationale

Centralizing auth state prevents inconsistencies across components and enables coordinated logout transitions (e.g., showing snackbar when `hasBeenLoggedOut` transitions). The debounced fetcher prevents duplicate session requests on page load.

### Open Questions

- `UserProvider` complexity is growing. Should it be split into smaller context providers (e.g., separate token-management from user-profile concerns)?

---

## Pattern 7: Auth Timing Constants Extracted to `src/constants/auth.ts`

**Rule:** ALWAYS define auth timing values (refresh intervals, expiration intervals) in `src/constants/auth.ts`. NEVER hardcode timing values in hooks or components.

**Confidence:** Medium
**Frequency:** 1 PR established the pattern (#4874); consumed in `dateUtil.ts` and `sessionUtils.ts`.

### Code Examples

From PR #4874 -- constants file (`frontend/src/constants/auth.ts`):
```typescript
// 10 minutes
export const clientTokenRefreshInterval = 10 * 60 * 1000;

// 15 minutes
export const clientTokenExpirationInterval = 15 * 60 * 1000;
```

From PR #4874 -- consumed in `dateUtil.ts`:
```typescript
import { clientTokenRefreshInterval } from "src/constants/auth";

export const isExpired = (expiration?: number) =>
  !!expiration && expiration < Date.now();

// is a token less than 10 minutes from expiring?
export const isExpiring = (expiration?: number) =>
  !isExpired(expiration) &&
  !!expiration &&
  expiration < Date.now() + clientTokenRefreshInterval;
```

From PR #4874 -- consumed in `sessionUtils.ts`:
```typescript
import { clientTokenExpirationInterval } from "src/constants/auth";

export const newExpirationDate = () =>
  new Date(Date.now() + clientTokenExpirationInterval);
```

### Rationale

PR #4521 originally hardcoded `15 * 60 * 1000` inline. PR #4874 extracted these to constants to make timing values configurable and testable (the PR description explicitly suggests changing the constant for local testing).

### Open Questions

- Should these constants align with server-side JWT configuration, and if so, how is that alignment verified?

---

## Pattern 8: Components Must Not Live in Page Directories

**Rule:** NEVER place reusable components in `src/app/[locale]/` page directories. ALWAYS place them in `src/components/` (general-use at root, page-specific in subdirectories).

**Confidence:** High
**Frequency:** 1 foundational PR (#4414); 6+ components moved.

### Code Examples

From PR #4414 -- component import path changes:
```typescript
// BEFORE (anti-pattern):
import ResearchArchetypes from "src/app/[locale]/research/ResearchArchetypes";
import FeatureFlagsTable from "src/app/[locale]/dev/feature-flags/FeatureFlagsTable";

// AFTER (correct):
import ResearchArchetypes from "src/components/research/ResearchArchetypes";
import FeatureFlagsTable from "src/components/dev/FeatureFlagsTable";
```

From PR #4414 -- components README:
```markdown
# Components

All non-page level components should go in this directory. If a component is
for general use throughout the application, it should be placed in this root
directory. If it is specific to a page or a set of pages, it should be placed
in a subdirectory based on where it will be used.
```

### Rationale

Co-locating components with pages creates ambiguity about reusability and makes refactoring harder. The convention matches Next.js best practices of keeping `app/` for routing and pages only.

### Open Questions

- None. This is an established, documented convention.

---

## Pattern 9: Early Return for Missing Auth Token Before API Requests

**Rule:** ALWAYS check for `user?.token` before making authenticated API requests. Return early or set an error state if the token is missing.

**Confidence:** Medium
**Frequency:** Reviewer-enforced across multiple components in PR #4521.

### Code Examples

From PR #4521 -- `SaveSearchModal`:
```typescript
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

From PR #4521 -- `SaveSearchSelector`:
```typescript
const fetchSavedSearches = useCallback(() => {
  if (!user?.token) {
    setApiError(new Error("Not logged in, can't fetch saved searches"));
  }
  // ...
```

From PR #4521 -- `OpportunitySaveUserControl`:
```typescript
useEffect(() => {
  if (!user?.token) return;
  setLoading(true);
  fetchSaved(`/api/user/saved-opportunities/${opportunityId}`)
  // ...
}, [opportunityId, user?.token]);
```

Reviewer comment (freddieyebra, PR #4521):
> "Should we set an error here similar to how an error is raised if no token prior to the fetchSavedSearch?"

### Rationale

Without token checks, components would make API requests that will fail with 401, triggering unnecessary refresh cycles. The early return pattern prevents wasted network requests and provides cleaner error handling.

### Open Questions

- Should this check be built into `useClientFetch` itself (via the `authGatedRequest` option) rather than repeated in each component?

---

## Pattern 10: Simplify Conditional Expressions in Hook Consumers

**Rule:** ALWAYS prefer direct boolean expressions over ternary operators when setting boolean state. Write `setSaved(data.type === "save")` instead of `data.type === "save" ? setSaved(true) : setSaved(false)`.

**Confidence:** Medium
**Frequency:** 1 explicit reviewer correction (PR #4521), but applies generally.

### Code Examples

From PR #4521 -- reviewer suggestion (freddieyebra):
```typescript
// BEFORE (anti-pattern):
data.type === "save" ? setSaved(true) : setSaved(false);

// AFTER (accepted):
setSaved(data.type === "save");
```

### Rationale

Direct boolean expressions are more concise and less error-prone. This aligns with general clean code principles and was enforced via code review.

### Open Questions

- Should this be codified as a lint rule?

---

## Pattern 11: Debounced User Fetcher to Prevent Duplicate Requests

**Rule:** ALWAYS debounce the user session fetcher with `leading: true, trailing: false` to prevent duplicate requests on page load. The debounced fetcher MUST live in `clientUserFetcher.ts` (not in UserProvider) to avoid circular dependencies with `useClientFetch`.

**Confidence:** High
**Frequency:** 1 PR established the pattern (#4521).

### Code Examples

From PR #4521 -- debounced fetcher (`clientUserFetcher.ts`):
```typescript
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

### Rationale

Without debouncing, React's strict mode and component re-renders cause multiple concurrent session fetches on page load. The `leading: true, trailing: false` configuration ensures the first call fires immediately while subsequent rapid calls are suppressed. It cannot use `useClientFetch` because that would create a circular dependency (useClientFetch -> useUser -> UserProvider -> debouncedUserFetcher -> useClientFetch).

### Open Questions

- Is 500ms the right debounce interval, or should it be configurable?

---

## Pattern 12: Token Expiration as Milliseconds (Not Date Objects)

**Rule:** ALWAYS store token expiration as a `number` (milliseconds since epoch) in the `expiresAt` field. NEVER store as a `Date` type. Convert JWT `exp` (seconds) to milliseconds by multiplying by 1000.

**Confidence:** High
**Frequency:** 1 PR fixed this (#4521); validated in #4874.

### Code Examples

From PR #4521 -- type change in `authTypes.ts`:
```typescript
export interface UserProfile {
  email?: string;
  token: string;
  expiresAt?: number;  // Changed from `expiresAt: Date`
  user_id: string;
}
```

From PR #4521 -- conversion in `session.ts`:
```typescript
// expiration timestamp in the token is in seconds, in order to compare using
// JS date functions it should be in ms
expiresAt: exp ? exp * 1000 : undefined,
```

From PR #4521 -- buggy utility that was deleted (`authUtil.ts`):
```typescript
// BUG: This checked if expiry is AFTER now (not expired), opposite of intent
export const isSessionExpired = (userSession: UserProfile): boolean => {
  if (!userSession?.expiresAt) {
    return false;
  }
  return userSession.expiresAt > new Date(Date.now());
};
```

### Rationale

The JWT `exp` claim is in seconds, but JavaScript Date/comparison APIs use milliseconds. Storing as a number avoids Date construction overhead and the bug where `Date > Date` comparisons are error-prone. The old `isSessionExpired` utility had an inverted comparison that was caught during the refactoring.

### Open Questions

- None. This is a correctness fix.

---

## Pattern 13: Avoid Single-Function Utility Files

**Rule:** NEVER create utility files that contain or support only a single function. Merge the function into a related utility file instead.

**Confidence:** High
**Frequency:** 1 PR documented and enforced (#4414); 2+ files deleted.

### Code Examples

From PR #4414 -- files consolidated:
```typescript
// DELETED: src/utils/search/convertSearchParamsToProperTypes.ts (single function)
// MOVED TO: src/utils/search/searchUtils.ts

// Import path changes:
// BEFORE:
import { convertSearchParamsToProperTypes } from "src/utils/search/convertSearchParamsToProperTypes";
// AFTER:
import { convertSearchParamsToProperTypes } from "src/utils/search/searchUtils";
```

### Rationale

Single-function files create unnecessary indirection and file proliferation. Grouping related utilities by domain (e.g., `searchUtils.ts`) makes code more discoverable.

### Open Questions

- What is the threshold for when a utility file becomes too large and should be split?
