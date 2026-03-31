# Pattern Discovery: Frontend Services / API Integration

**Domain:** `frontend/src/services/`, `frontend/src/hooks/`, `frontend/src/services/fetch/`
**Source:** 90 merged PRs spanning 2025-03-27 to ~2025-12 (batches b0, b1)
**Analysis date:** 2026-03-27

---

## 1. API Client Patterns

### 1a. `requesterForEndpoint` — Centralized Fetch Factory
**Frequency:** Pervasive (appears in 40+ PRs)
**Confidence:** Very High
**Trend:** Stable foundation, incrementally extended

The core API client pattern is a factory function `requesterForEndpoint()` defined in `frontend/src/services/fetch/fetchers/fetchers.ts`. Each API endpoint is configured via an `EndpointConfig` object (basePath, version, namespace, method) in `endpointConfigs.ts`, and `requesterForEndpoint` produces a typed fetch function.

- **Endpoint configs** are simple declarative objects: `{ basePath, version, namespace, method }` (PRs #4415, #4437, #6962).
- Server-side fetchers (e.g., `fetchOpportunity`, `fetchCompetition`, `fetchForm`) are created by wrapping `requesterForEndpoint()` with React's `cache()` for deduplication: `export const fetchOpportunity = cache(requesterForEndpoint(fetchOpportunityEndpoint))`.
- Method-parameterized variants exist for user and organization endpoints: `fetchUserWithMethod("POST")`, `fetchOrganizationWithMethod("GET")`. Initially user-method was typed as `"POST" | "DELETE" | "PUT"`, later expanded to include `"GET"` (multiple PRs in b1).
- **Exemplar PRs:** #4415, #4437, #6786, #6793, #6879, #6962

### 1b. `useClientFetch` Hook — Client-Side Fetch Wrapper
**Frequency:** High (introduced in PR #4521, adopted in 15+ subsequent PRs)
**Confidence:** Very High
**Trend:** Growing adoption; became the standard for all client-side API calls

PR #4521 introduced `useClientFetch<T>()`, a hook that wraps all client-side fetches with:
- Automatic token expiration checking (`refreshIfExpired`)
- Automatic logout on 401 responses
- JSON parsing by default (opt-out with `{ jsonResponse: false }`)
- Auth-gated request mode (`{ authGatedRequest: true }`) that triggers page refresh on auth failure
- Error message parameter for consistent error context

**Usage pattern:**
```typescript
const { clientFetch } = useClientFetch<ResponseType>("Error message");
// ...
clientFetch("/api/some-endpoint", { method: "POST", body: JSON.stringify(data) })
```

This replaced many individual client-side fetcher files (e.g., `clientSavedSearchFetcher.ts`, `clientSearchResultsDownloadFetcher.ts` were deleted).

**Known issue (documented in code):** Adding `clientFetch` to useEffect dependency arrays causes infinite re-render loops due to useUser dependency. The code comment warns: "do not include this in dependency arrays."

**Exemplar PRs:** #4521 (creation), #6863 (OrganizationInvitationReply), #6793 (UserInviteForm)

### 1c. Default Headers / API Key Management
**Frequency:** Moderate (2-3 PRs)
**Confidence:** High
**Trend:** Evolving toward API Gateway auth

`getDefaultHeaders()` in `fetcherHelpers.ts` builds standard headers. PR #6786 added a second auth header (`X-API-KEY` via `API_GW_AUTH`) for API Gateway alongside the existing `X-AUTH` token, establishing a dual-key fallback pattern during API Gateway rollout.

**Exemplar PRs:** #6786

---

## 2. Data Fetching Patterns

### 2a. Server-Side Fetching in Page Components (RSC)
**Frequency:** Very High (20+ PRs)
**Confidence:** Very High
**Trend:** Stable, dominant pattern

Pages use async server components to fetch data before rendering. The standard approach:
1. Call `getSession()` to get auth token
2. Create promise(s) for needed data
3. `await Promise.all([...])` to resolve in parallel
4. Pass resolved data to child components

**Example from workspace page (PR #6863):**
```typescript
const userRolesPromise = getUserPrivileges(session.token, session.user_id);
const userOrganizationsPromise = getUserOrganizations(session.token, session.user_id);
const userInvitationsPromise = getUserInvitations(session.token, session.user_id);
[userRoles, userOrganizations, userInvitations] = await Promise.all([...]);
```

**Naming convention (documented in PR #4414):**
- Unresolved promises: `varNamePromise(s)` (e.g., `userRolesPromise`)
- Resolved values: `resolvedVarName(s)` (e.g., `resolvedBunnies`)

### 2b. Next.js Revalidation / Caching
**Frequency:** Low-Moderate (seen in agencies fetcher, search)
**Confidence:** Moderate
**Trend:** Used selectively

Some fetchers pass `nextOptions: { revalidate: N }` to control caching. The agencies fetcher uses `revalidate: 604800` (1 week). Most user-specific fetches do not use revalidation.

**Exemplar PRs:** #4359 (agenciesFetcher)

### 2c. Server-Side Fetcher Layer (Thin Wrappers)
**Frequency:** High (every new endpoint)
**Confidence:** Very High
**Trend:** Consistent pattern; reviewer noted it may be over-abstracted

Each API resource gets a dedicated fetcher file in `frontend/src/services/fetch/fetchers/` that wraps the base `requesterForEndpoint` function. These are thin:

```typescript
export const getCompetitionDetails = async (id: string) => {
  const response = await fetchCompetition({ subPath: id });
  return (await response.json()) as CompetitionsDetailApiResponse;
};
```

Reviewer comment (doug-s-nava, PR #4437): "the usage here sort of demonstrates the limitations of this layer of abstraction. At this point we'd probably be good just using the `fetchApplicationWithMethod` function directly within the components."

**Exemplar PRs:** #4415, #4437, #6793, #6962

### 2d. `"server only"` / `"server-only"` Directive
**Frequency:** Moderate (5+ PRs)
**Confidence:** High
**Trend:** Enforced for server-side fetchers

Server-only fetcher files use the `"server only"` or `"server-only"` string directive at the top to prevent client-side bundling. PR #4414 added `"server only"` to `sessionUtils.ts`.

---

## 3. Error Handling Patterns

### 3a. `ApiRequestError` + `parseErrorStatus` — Structured API Errors
**Frequency:** Very High (20+ PRs)
**Confidence:** Very High
**Trend:** Stable and well-established

The codebase uses a custom `ApiRequestError` class hierarchy defined in `src/errors.ts`:
- `ApiRequestError` (base) — carries status code
- `UnauthorizedError` (401)
- `BadRequestError` (400)
- `parseErrorStatus()` extracts status from error

Standard error handling in page components:
```typescript
try {
  const response = await getCompetitionDetails(id);
  // ...
} catch (error) {
  if (parseErrorStatus(error as ApiRequestError) === 404) {
    return <NotFound />;
  }
  return <TopLevelError />;
}
```

### 3b. Silent Failure with Console Warnings for Auth Failures
**Frequency:** Moderate (5+ PRs)
**Confidence:** High
**Trend:** Established for non-critical fetchers

Several server-side fetchers return empty arrays on auth failure rather than throwing:
```typescript
if (!session || !session.token) {
  console.warn("user fetching saved opportunities not logged in (should not happen)");
  return [];
}
```

This was later cleaned up -- in a subsequent PR the console.warn calls were removed in favor of proper handling.

### 3c. `readError` for API Route Handlers
**Frequency:** Moderate
**Confidence:** Moderate
**Trend:** Used in Next.js API route handlers

API route handlers (in `src/app/api/`) use `readError(e as Error, fallbackStatus)` to extract status and message from caught errors, returning appropriate HTTP responses.

### 3d. Zod Validation for Server Actions
**Frequency:** Moderate (3-4 PRs)
**Confidence:** High
**Trend:** Growing; standard for form submissions

Server actions use Zod schemas for form data validation:
```typescript
const schema = z.object({
  email: z.string().min(1, { message: t("email") }),
  role: z.string().min(1, { message: t("role") }),
});
const validatedFields = schema.safeParse({ ... });
if (!validatedFields.success) {
  return validatedFields.error.flatten().fieldErrors;
}
```

**Exemplar PRs:** #6793

---

## 4. Type Patterns

### 4a. Types in Dedicated `/types` Directory
**Frequency:** Very High
**Confidence:** Very High
**Trend:** Enforced by documented norms (PR #4414)

PR #4414 established the norm: "Typings should be placed within the /types directory unless they will only be ever referenced locally." This PR moved auth types from `src/services/auth/types.tsx` to `src/types/authTypes.ts`.

### 4b. `type` Preferred Over `interface` (Unless Extending)
**Frequency:** High
**Confidence:** High
**Trend:** Documented norm from PR #4414

From the code style doc: "When in doubt, use a type. If typing an object, feel free to use an interface, especially if it may be extended." This is enforced in reviews -- reviewer comment (PR #6879+): "types should be preferred to interfaces unless inheritance is in play."

Observable in code: `MinimalOpportunity` changed from `interface` to `type` (PR #4414). `UserPrivilegeDefinition` uses `interface` because it is extended by `UserPrivilegeResult` (PR #6765).

### 4c. API Response Types Follow `{ data: T }` Pattern
**Frequency:** Very High
**Confidence:** Very High
**Trend:** Stable

API responses are consistently typed as `{ data: T }`:
```typescript
const json = (await resp.json()) as { data: UserPrivilegesResponse };
return json.data;
```

Dedicated response types extend `APIResponse`:
```typescript
export interface CompetitionsDetailApiResponse extends APIResponse {
  data: { competition_forms: [...]; competition_id: string; };
}
```

### 4d. Privilege Type Narrowing
**Frequency:** Low-Moderate (2-3 PRs)
**Confidence:** High
**Trend:** Progressive narrowing from loose to strict

Initially `privilege: string`, later narrowed to a union type `Privileges` (PR #6879):
```typescript
export type Privileges = "manage_org_members" | "view_org_membership" | "start_application" | ...;
```

---

## 5. Auth Integration Patterns

### 5a. `X-SGG-Token` Header for Authenticated Requests
**Frequency:** Very High (20+ PRs)
**Confidence:** Very High
**Trend:** Stable convention for all user-scoped server-side requests

Every authenticated server-side fetcher follows:
```typescript
const ssgToken = { "X-SGG-Token": token };
const resp = await fetchUserWithMethod("POST")({
  subPath: `${userId}/some-resource`,
  additionalHeaders: ssgToken,
  body: { ... },
});
```

### 5b. `getSession()` as Server-Side Auth Gate
**Frequency:** Very High
**Confidence:** Very High
**Trend:** Stable, used in all authenticated pages and server actions

`getSession()` from `src/services/auth/session.ts` is the single entry point for obtaining session data (token, user_id) on the server side. Pattern:
```typescript
const session = await getSession();
if (!session || !session.token || !session.user_id) {
  return { errorMessage: "Not logged in" };
}
```

### 5c. Session Duration in JWT (HHS Compliance)
**Frequency:** Low (1 PR)
**Confidence:** High
**Trend:** One-time compliance change

PR #4378 added `session_duration_minutes` to the JWT payload and set a 15-minute default (`API_JWT_TOKEN_EXPIRATION_MINUTES = 15`) to meet HHS session timeout requirements.

### 5d. Token Expiration Handling
**Frequency:** Moderate (2-3 PRs)
**Confidence:** High
**Trend:** Introduced in PR #4521, refined over time

PR #4521 implemented automatic token expiration detection:
- `RouteChangeWatcher` component checks session validity on every route change
- `useClientFetch` checks before every client-side API call
- On expiration: user is logged out, snackbar notification displayed
- Token refresh endpoint (`postTokenRefresh`) added for session extension

### 5e. `AuthorizationGate` / `AuthenticationGate` Components
**Frequency:** Moderate (4-5 PRs)
**Confidence:** High
**Trend:** Growing; becoming standard for gated pages

Two gate components:
- `AuthenticationGate` — checks if user is logged in, renders `UnauthenticatedMessage` if not
- `AuthorizationGate` — checks privileges via API (`checkUserPrivilege`), fetches gated resources, passes `AuthorizedData` to children via `useAuthorizedData` context

The authorization gate was significantly refactored in PR #6765 to:
- Hit API endpoint for permission checks (instead of client-side privilege checking)
- Support both `requiredPrivileges` and `resourcePromises`
- Pass down `FetchedResourceMap` and `confirmedPrivileges` to child components

PR #6879 wired it up for the organization detail page as a real-world POC.

**Exemplar PRs:** #6765, #6879

---

## 6. Corrective Patterns (Reviewer Enforcement)

### 6a. Variable Naming Enforcement
**Frequency:** High
**Confidence:** High

- doug-s-nava consistently enforces descriptive naming: "Should avoid arbitrary variable naming" (PR review on create opportunity)
- "this is a pretty vague variable name - how about `SortedUserAgencyRecords`?" (review comment)
- "can we rename this accordingly? maybe `handleFormAction`?" (PR review)

### 6b. No Inline Styles
**Frequency:** Moderate
**Confidence:** High

Reviewer (doug-s-nava): "unless there's a really compelling reason we should not use inline styling" (PR review in b1)

### 6c. Use Server Actions for Form Submissions
**Frequency:** Moderate
**Confidence:** High

Reviewer (doug-s-nava): "let's use a server action for this - that may change the general approach here a little" (PR review in b1). Also noted: "might be worth building out a wrapper to do with `useClientFetch` is doing but for server actions, so that we don't have to worry about this boilerplate."

### 6d. Follow Translation Pattern (Call `t` Directly)
**Frequency:** Moderate
**Confidence:** High

Reviewer (doug-s-nava): "Since defining variables like this leads to some bloat in the file, I'd rather follow the usual pattern and call `t` directly where these values are being used." Also: "call useTranslations with the lowest level common namespace for the component."

### 6e. Type Capitalization and Preferences
**Frequency:** Moderate
**Confidence:** High

Reviewer (doug-s-nava): "type names should be capitalized" and "types should be preferred to interfaces unless inheritance is in play" -- citing the documented code style guide.

### 6f. Pack Large Argument Lists into Objects
**Frequency:** Low-Moderate
**Confidence:** Moderate

Reviewer (doug-s-nava): "wow that's a lot of arguments... what do you say to packing this into an object argument so that we don't have to worry about argument order?"

### 6g. Feature Flag Terraform Must Be Updated
**Frequency:** Low-Moderate
**Confidence:** High

Reviewer (doug-s-nava): "if this PR is creating a new feature flag, it should also update the terraform, see [docs link]"

---

## 7. Anti-Patterns (Flagged as Wrong)

### 7a. Module-Level Mutable State Instead of React State
**Frequency:** Low (1 instance flagged)
**Confidence:** High

Reviewer (doug-s-nava): "we should track things like this, if necessary, in component state rather than in module globals. React will handle this better than the module will (as the file may be re-loaded at weird times, and state may be reset as result)."

### 7b. Commented-Out API Calls in Fetchers (Stub Implementations)
**Frequency:** Moderate (3-4 PRs during workspace feature development)
**Confidence:** Moderate
**Trend:** Temporary, cleared in later PRs

Several fetchers during the workspace/organization feature work shipped with commented-out real API calls and hardcoded fake data:
```typescript
export const checkUserPrivilege = async (...) => {
  if (privilegeDefinition.resourceId === "1") return Promise.resolve([]);
  return Promise.reject(new ApiRequestError("", "", 403));
  // const resp = await fetchUserWithMethod("POST")({...});
};
```
These were wired up to real endpoints in subsequent PRs (e.g., PR #6879 uncommented `checkUserPrivilege`).

### 7c. Client-Side Privilege Checking (Replaced by API Call)
**Frequency:** Low (1 corrective PR)
**Confidence:** High

PR #6765 removed `src/utils/authUtils.ts` which had client-side privilege checking logic (`checkPrivileges`, `getAgencyPrivileges`), replacing it with a server-side API call pattern via `checkUserPrivilege`. The reviewer/author noted this was needed to "hit new API endpoint to check access" rather than doing it on the frontend.

### 7d. `useState` Misunderstanding (Immediate Value Access)
**Frequency:** Low (1 instance)
**Confidence:** High

A contributor tried using module-level variables because "useState() is not working the way I need it to. The value is not set right away but after all code execution is done." This was corrected through review discussion.

---

## 8. File Organization Patterns

### 8a. Services Directory Structure
**Frequency:** High (codified in PR #4414)
**Confidence:** Very High
**Trend:** Stable, enforced

Per PR #4414's README and restructuring:
- `src/services/` — cross-cutting functionality (auth, fetch, search, featureFlags)
- `src/hooks/` — standalone custom React hooks
- `src/types/` — shared TypeScript types
- `src/utils/` — utility functions grouped by usage
- `src/components/` — all non-page components, organized by feature subdirectory

Components were moved out of page directories (e.g., `src/app/[locale]/research/ResearchArchetypes.tsx` to `src/components/research/ResearchArchetypes.tsx`).

### 8b. Fetcher File Organization
**Frequency:** Very High
**Confidence:** Very High
**Trend:** Stable

- `endpointConfigs.ts` — endpoint configuration objects
- `fetchers/fetchers.ts` — `requesterForEndpoint` + cached fetcher instances
- `fetchers/<domain>Fetcher.ts` — domain-specific thin wrappers (e.g., `userFetcher.ts`, `organizationsFetcher.ts`, `applicationsFetcher.ts`)
- `fetcherHelpers.ts` — utilities (headers, URL construction, error throwing)

### 8c. Test Fixtures in Centralized File
**Frequency:** High
**Confidence:** Very High
**Trend:** Growing; fixtures file expanded across many PRs

`src/utils/testing/fixtures.ts` is the single source for fake data used in tests (e.g., `fakeUserPrivilegesResponse`, `fakeOrganizationInvitation`, `mockOpportunity`). Typed fixtures are preferred -- later PRs added explicit type annotations (e.g., `fakeUserRole: UserRole`).

---

## 9. Emerging Patterns

### 9a. Server Actions with `useActionState`
**Frequency:** Growing (3+ PRs in later batch)
**Confidence:** Moderate-High
**Trend:** Increasing for form submissions

Forms increasingly use Next.js server actions with React's `useActionState`:
```typescript
const [formState, formAction] = useActionState(submitApplyForm, initialState);
```

This replaces the older pattern of client-side POST requests through `useClientFetch` for form submissions.

**Exemplar PRs:** #6793 (inviteUserAction), #4415 (submitApplyForm)

### 9b. `withFeatureFlag` HOC for Feature Gating
**Frequency:** Moderate (5+ PRs)
**Confidence:** High
**Trend:** Stable; moved from `src/hoc/` to `src/services/featureFlags/` in PR #4414

Feature-flagged pages wrap their export: `export default withFeatureFlag(Component, "flagName", () => redirect("/maintenance"))`.

### 9c. Accessibility Testing as Standard
**Frequency:** Very High in tests
**Confidence:** Very High
**Trend:** Standard practice for all new components

Nearly every new component test includes `jest-axe` accessibility validation:
```typescript
it("should not have accessibility violations", async () => {
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

---

## Summary of Key Conventions

| Convention | Status | Enforced By |
|---|---|---|
| `requesterForEndpoint` for all API calls | Established | Code structure |
| `useClientFetch` for client-side fetches | Established | Code review |
| `X-SGG-Token` header for auth | Established | Code structure |
| Types in `/types` directory | Documented | PR #4414 code style doc |
| `type` preferred over `interface` | Documented | Code review |
| Promise naming (`varNamePromise` / `resolvedVarName`) | Documented | PR #4414 code style doc |
| Zod for server action validation | Emerging | Code examples |
| Server actions for form submissions | Emerging | Code review |
| Accessibility tests on all components | Established | Code review |
| No inline styles | Enforced | Code review |
| Descriptive variable names | Enforced | Code review (doug-s-nava) |
