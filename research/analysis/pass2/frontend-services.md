# Pass 2: Pattern Codification -- Frontend Services / API Integration

**Domain:** `frontend/src/services/`, `frontend/src/hooks/`, `frontend/src/services/fetch/`
**Source:** 90 merged PRs (PR #4359 through #9200), sampled 18 PRs in depth
**Analysis date:** 2026-03-30
**Pass 1 reference:** `analysis/pass1/frontend-services.md`

---

## Pattern 1: Centralized Fetch Factory (`requesterForEndpoint`)

### Rule Statement
ALWAYS create API client functions using `requesterForEndpoint()` from `fetchers.ts` with an `EndpointConfig` object. NEVER write raw `fetch()` calls to the backend API from server-side code.

### Confidence: High
### Frequency: Pervasive -- appears in 40+ PRs; every new API endpoint follows this pattern.

### Code Examples

**Example 1 -- Static endpoint config and cached fetcher (PR #4437):**
```typescript
// frontend/src/services/fetch/endpointConfigs.ts
export const fetchApplicationsEndpoint = {
  basePath: environment.API_URL,
  version: "alpha",
  namespace: "applications",
  method: "POST" as ApiMethod,
};

// frontend/src/services/fetch/fetchers/fetchers.ts
export const fetchCompetition = cache(
  requesterForEndpoint(fetchCompetitionEndpoint),
);
```

**Example 2 -- Dynamic method-parameterized variant (PR #4437):**
```typescript
// frontend/src/services/fetch/endpointConfigs.ts
export const toDynamicApplicationsEndpoint = (type: "POST" | "GET" | "PUT") => {
  return {
    basePath: environment.API_URL,
    version: "alpha",
    namespace: "applications",
    method: type as ApiMethod,
  };
};

// frontend/src/services/fetch/fetchers/fetchers.ts
export const fetchApplicationWithMethod = (type: "POST" | "GET" | "PUT") =>
  requesterForEndpoint(toDynamicApplicationsEndpoint(type));
```

**Example 3 -- Thin domain fetcher wrapping the factory (PR #6962):**
```typescript
// frontend/src/services/fetch/fetchers/applicationsFetcher.ts
"server-only";

export const getApplications = async (
  token: string,
  userId: string,
): Promise<ApplicationDetail[]> => {
  const ssgToken = { "X-SGG-Token": token };
  const resp = await fetchUserWithMethod("POST")({
    subPath: `${userId}/applications`,
    additionalHeaders: ssgToken,
    body: { pagination: { page_offset: 1, page_size: 5000, ... } },
  });
  const json = (await resp.json()) as { data: [] };
  return json.data;
};
```

### Rationale
Centralizes URL construction, default headers (including API key headers), and error handling. Each endpoint is configured declaratively, making it easy to add new endpoints without duplicating boilerplate.

### Open Questions
- Reviewer (doug-s-nava, PR #4437) noted the thin wrapper layer "demonstrates the limitations of this layer of abstraction" and suggested using `fetchApplicationWithMethod` directly in components. The team should decide if thin wrappers add value or just indirection.

---

## Pattern 2: `useClientFetch` Hook for Client-Side Requests

### Rule Statement
ALWAYS use the `useClientFetch<T>()` hook for client-side API requests. NEVER use raw `fetch()` in client components for API calls (except for the logout endpoint, which is explicitly called out as an exception in the codebase).

### Confidence: High
### Frequency: High -- introduced in PR #4521, adopted in 15+ subsequent PRs. All prior client-side fetcher files were deleted.

### Code Examples

**Example 1 -- Basic usage with JSON response (PR #4521 / #6863):**
```typescript
const { clientFetch } = useClientFetch<OrganizationInvitation>(
  "unable to respond to invitation",
);

clientFetch(
  `/api/user/organization-invitations/${userInvitation.organization_invitation_id}`,
  { method: "POST", body: JSON.stringify({ accepted }) },
)
  .then((response: OrganizationInvitation) => {
    setInvitationStatus(response.status);
  })
  .catch((e) => {
    setApiError(e as Error);
  });
```

**Example 2 -- Non-JSON response with auth gating (PR #4521):**
```typescript
const { clientFetch } = useClientFetch<Response>(
  "Error deleting saved search",
  { jsonResponse: false, authGatedRequest: true },
);

clientFetch("/api/user/saved-searches", {
  method: "DELETE",
  body: JSON.stringify({ searchId: savedSearchId }),
});
```

**Example 3 -- Named instances for multiple endpoints (PR #4521, OpportunitySaveUserControl):**
```typescript
const { clientFetch: fetchSaved } = useClientFetch<MinimalOpportunity[]>(
  "Error fetching saved opportunity",
);
const { clientFetch: updateSaved } = useClientFetch<{ type: string }>(
  "Error updating saved opportunity",
);
```

### Rationale
Consolidates token expiration checking, automatic logout on 401, and JSON parsing. Replaced multiple one-off client fetcher files, reducing code duplication.

### Open Questions
- **Known bug documented in code (PR #4521):** Adding `clientFetch` to `useEffect` dependency arrays causes infinite re-render loops due to `useUser` dependency. The code comment warns "do not include this in dependency arrays." This is a known technical debt item.

---

## Pattern 3: Server-Side Data Fetching with `Promise.all` in RSC Pages

### Rule Statement
ALWAYS fetch data in async server components by (1) calling `getSession()`, (2) creating named promise variables, (3) resolving in parallel with `Promise.all`, and (4) passing resolved data to child components. ALWAYS name unresolved promises as `varNamePromise` and resolved values as `resolvedVarName`.

### Confidence: High
### Frequency: Very High -- 20+ PRs follow this pattern.

### Code Examples

**Example 1 -- Workspace page with parallel fetches (PR #6863):**
```typescript
const session = await getSession();
// ...
const userRolesPromise = getUserPrivileges(session.token, session.user_id);
const userOrganizationsPromise = getUserOrganizations(
  session.token,
  session.user_id,
);
const userInvitationsPromise = getUserInvitations(
  session.token,
  session.user_id,
);
try {
  [userRoles, userOrganizations, userInvitations] = await Promise.all([
    userRolesPromise,
    userOrganizationsPromise,
    userInvitationsPromise,
  ]);
} catch (e) {
  console.error("Unable to fetch user details or organizations", e);
}
```

**Example 2 -- Promise naming convention from code style doc (PR #4414):**
```javascript
const bunnyPromises = getBunnyPromises();
const resolvedBunnies = Promise.all(bunnyPromies);
```

### Rationale
Parallel fetching minimizes page load time. The naming convention (documented in PR #4414's code style guide) makes it immediately clear whether a variable holds a promise or a resolved value.

### Open Questions
- None. This pattern is stable and well-documented.

---

## Pattern 4: `X-SGG-Token` Header for Authenticated Server Requests

### Rule Statement
ALWAYS pass the user's session token via an `X-SGG-Token` header when making authenticated server-side API calls. Construct the header as `{ "X-SGG-Token": token }` and pass it via `additionalHeaders`.

### Confidence: High
### Frequency: Very High -- every authenticated fetcher in the codebase follows this exact pattern.

### Code Examples

**Example 1 -- User privilege check (PR #6879):**
```typescript
const ssgToken = { "X-SGG-Token": token };
await fetchUserWithMethod("POST")({
  subPath: `${userId}/can_access`,
  additionalHeaders: ssgToken,
  body: {
    resource_type: resourceType,
    resource_id: resourceId,
    privileges: [privilege],
  },
});
```

**Example 2 -- Organization roles fetch (PR #6793):**
```typescript
const ssgToken = { "X-SGG-Token": token };
const resp = await fetchOrganizationWithMethod("POST")({
  subPath: `${organizationId}/roles/list`,
  additionalHeaders: ssgToken,
});
```

**Example 3 -- Applications fetcher (PR #6962):**
```typescript
const ssgToken = { "X-SGG-Token": token };
const resp = await fetchUserWithMethod("POST")({
  subPath: `${userId}/applications`,
  additionalHeaders: ssgToken,
  body: { pagination: { ... } },
});
```

### Rationale
Separates user-scoped authentication (per-request token) from system-level API auth (`X-AUTH` / `X-API-KEY` headers set in `getDefaultHeaders()`).

### Open Questions
- None. Consistent across all PRs reviewed.

---

## Pattern 5: `ApiRequestError` Hierarchy and `parseErrorStatus` for Error Handling

### Rule Statement
ALWAYS use the `ApiRequestError` class hierarchy from `src/errors.ts` for API error handling. ALWAYS use `parseErrorStatus()` to extract HTTP status codes from caught errors in page components. For 404 errors, return `<NotFound />`; for other errors, return `<TopLevelError />` or a domain-specific error component.

### Confidence: High
### Frequency: Very High -- 20+ PRs use this pattern.

### Code Examples

**Example 1 -- Standard page-level error handling (from formPrototype page, PR #4414 file reference):**
```typescript
try {
  const response = await getCompetitionDetails(id);
} catch (error) {
  if (parseErrorStatus(error as ApiRequestError) === 404) {
    return <NotFound />;
  }
  return <TopLevelError />;
}
```

**Example 2 -- UnauthorizedError propagation (PR #6962):**
```typescript
// applicationsFetcher.ts
export const fetchApplications = async (): Promise<ApplicationDetail[]> => {
  const session = await getSession();
  if (!session || !session.token) {
    throw new UnauthorizedError("No active session");
  }
  // ...
};

// page.tsx
try {
  userApplications = await fetchApplications();
} catch (error) {
  if (error instanceof UnauthorizedError) {
    throw error; // let auth gate handle it
  }
  return <ApplicationsErrorPage />;
}
```

**Example 3 -- `readError` in API route handlers (PR #4437):**
```typescript
} catch (e) {
  const { status, message } = readError(e as Error, 500);
  return Response.json(
    { message: `Error attempting to start application: ${message}` },
    { status },
  );
}
```

### Rationale
Provides structured error handling with consistent status code extraction. The hierarchy (`ApiRequestError`, `UnauthorizedError`, `BadRequestError`) enables type-safe error branching.

### Open Questions
- None. Well-established pattern.

---

## Pattern 6: `"server only"` / `"server-only"` Directive on Server Fetchers

### Rule Statement
ALWAYS add the `"server only"` or `"server-only"` directive at the top of server-side fetcher files to prevent client-side bundling.

### Confidence: High
### Frequency: Moderate -- 5+ PRs explicitly show this.

### Code Examples

**Example 1 -- Applications fetcher (PR #6962):**
```typescript
"server-only";

import { UnauthorizedError } from "src/errors";
import { getSession } from "src/services/auth/session";
// ...
```

**Example 2 -- User fetcher (PR #6879):**
```typescript
"server only";

import { JSONRequestBody } from "src/services/fetch/fetcherHelpers";
// ...
```

### Rationale
Next.js build-time enforcement that server-only code (which may access secrets, session tokens, or internal APIs) is never accidentally included in client bundles.

### Open Questions
- Both `"server only"` and `"server-only"` forms appear in the codebase. Need to standardize on one form. The Next.js official package is `"server-only"` (with hyphen).

---

## Pattern 7: `getSession()` as the Sole Server-Side Auth Entry Point

### Rule Statement
ALWAYS use `getSession()` from `src/services/auth/session.ts` to obtain session data (token, user_id) on the server side. ALWAYS check for null session and missing token before proceeding with authenticated operations.

### Confidence: High
### Frequency: Very High -- every authenticated page and server action uses this.

### Code Examples

**Example 1 -- Server action auth check (PR #6793):**
```typescript
export const inviteUserAction = async (
  _prevState: unknown,
  formData: FormData,
  organizationId: string,
): Promise<OrganizationInviteResponse> => {
  const session = await getSession();
  if (!session || !session.token || !session.user_id) {
    return { errorMessage: "Not logged in" };
  }
  // ...
};
```

**Example 2 -- Fetcher with session check (PR #6962):**
```typescript
export const fetchApplications = async (): Promise<ApplicationDetail[]> => {
  const session = await getSession();
  if (!session || !session.token) {
    throw new UnauthorizedError("No active session");
  }
  const applications = await getApplications(session.token, session.user_id);
  return applications;
};
```

### Rationale
Single entry point for auth state prevents inconsistencies. Centralizes JWT verification logic.

### Open Questions
- None. Universally followed.

---

## Pattern 8: Types in `/types` Directory; Prefer `type` over `interface`

### Rule Statement
ALWAYS place shared TypeScript types in `src/types/` unless they are only referenced locally. ALWAYS use `type` by default. Use `interface` only when the type will be extended (inheritance).

### Confidence: High
### Frequency: Very High -- documented norm from PR #4414, enforced in reviews.

### Code Examples

**Example 1 -- `type` for non-extended types (PR #6863):**
```typescript
// src/types/userTypes.ts
export type OrganizationInvitation = {
  organization_invitation_id: string;
  organization: { organization_id: string; organization_name: string };
  status: string;
  created_at: string;
  expires_at: string;
  inviter: UserDetail;
  roles: UserRole[];
};
```

**Example 2 -- `interface` when extending (PR #6793, #6879):**
```typescript
// src/types/userTypes.ts
export interface RoleDefinition {
  role_id: string;
  role_name: string;
}
export interface UserRole extends RoleDefinition {
  privileges: Privileges[];
}
```

**Example 3 -- Reviewer enforcement (PR #6879):**
```typescript
// Privileges narrowed from string to union type
export type Privileges =
  | "manage_org_members"
  | "manage_org_admin_members"
  | "view_org_membership"
  | "start_application"
  | "list_application"
  | "view_application"
  // ...
```

### Rationale
From the code style doc (PR #4414): "When in doubt, use a type. If typing an object, feel free to use an interface, especially if it may be extended." Keeps type declarations consistent and predictable.

### Open Questions
- None. Well-documented and enforced.

---

## Pattern 9: API Response Types Follow `{ data: T }` Envelope

### Rule Statement
ALWAYS type API responses using the `{ data: T }` envelope pattern. Cast JSON responses as `{ data: T }` and extract the `.data` property before returning.

### Confidence: High
### Frequency: Very High -- every server-side fetcher follows this.

### Code Examples

**Example 1 -- Organization roles (PR #6793):**
```typescript
const json = (await resp.json()) as { data: UserRole[] };
return json.data;
```

**Example 2 -- Applications (PR #6962):**
```typescript
const json = (await resp.json()) as { data: [] };
return json.data;
```

**Example 3 -- Organization invitations (PR #7054):**
```typescript
const json = (await response.json()) as { data: OrganizationInviteRecord };
return json.data;
```

### Rationale
The backend API consistently wraps responses in a `{ data: ... }` envelope. Matching this pattern on the frontend ensures type safety and consistent data extraction.

### Open Questions
- None.

---

## Pattern 10: Zod Validation for Server Actions

### Rule Statement
ALWAYS use Zod schemas for server-side form validation in server actions. Use `schema.safeParse()` and return `error.flatten().fieldErrors` on validation failure. ALWAYS use translated validation messages via `getTranslations()`.

### Confidence: High
### Frequency: Moderate -- 3-4 PRs, but consistent pattern in all form submissions.

### Code Examples

**Example 1 -- Invite user form validation (PR #6793):**
```typescript
const validateInviteUserAction = async (formData: FormData) => {
  const t = await getTranslations("ManageUsers.inviteUser.validationErrors");
  const schema = z.object({
    email: z.string().min(1, { message: t("email") }),
    role: z.string().min(1, { message: t("role") }),
  });

  const validatedFields = schema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!validatedFields.success) {
    return validatedFields.error.flatten().fieldErrors;
  }
};
```

### Rationale
Server-side validation prevents bypassing client-side checks. Zod provides type-safe schema definitions. Using `getTranslations` keeps error messages localized.

### Open Questions
- Should a shared Zod validation helper be created for common patterns (email, required string, etc.)?

---

## Pattern 11: Server Actions with `useActionState` for Forms

### Rule Statement
ALWAYS use Next.js server actions with React's `useActionState` hook for form submissions. NEVER use `useClientFetch` for form POST submissions when a server action is possible.

### Confidence: Medium-High
### Frequency: Growing -- 3+ PRs in later batches, and reviewer (doug-s-nava) explicitly directed contributors to use server actions.

### Code Examples

**Example 1 -- Invite user form (PR #6793):**
```typescript
const [formState, formAction, isPending] = useActionState(inviteUser, {
  success: false,
});

// ...
<form action={formAction}>
  {/* form fields */}
  <UserInviteButton disabled={isPending || showSuccess} success={showSuccess} />
</form>
```

### Rationale
Server actions provide built-in progressive enhancement, eliminate client-side fetch boilerplate, and integrate naturally with React's concurrent features. Reviewer comment (doug-s-nava): "let's use a server action for this."

### Open Questions
- Reviewer noted: "might be worth building out a wrapper to do with `useClientFetch` is doing but for server actions, so that we don't have to worry about this boilerplate." A server-action equivalent of `useClientFetch` may emerge.

---

## Pattern 12: Test Fixtures in Centralized `fixtures.ts`

### Rule Statement
ALWAYS define fake/mock data for tests in `src/utils/testing/fixtures.ts`. ALWAYS add explicit type annotations to fixture values. NEVER define inline test data when a reusable fixture would serve.

### Confidence: High
### Frequency: High -- fixtures file grows across many PRs.

### Code Examples

**Example 1 -- Typed fixture (PR #6879):**
```typescript
export const fakeUserRole: UserRole = {
  role_id: "1",
  role_name: "role_1",
  privileges: ["view_application", "manage_org_members"],
};

export const fakeUserPrivilegesResponse: UserPrivilegesResponse = {
  user_id: "1",
  organization_users: [ /* ... */ ],
};
```

**Example 2 -- Organization invitation fixture (PR #6863):**
```typescript
export const fakeOrganizationInvitation: OrganizationInvitation = {
  organization_invitation_id: "uuid",
  organization: {
    organization_id: "uuid",
    organization_name: "Example Organization",
  },
  status: "pending",
  // ...
};
```

### Rationale
Centralizing test data avoids duplication, keeps fixtures in sync with type changes, and makes it easy to find fake data for any resource type.

### Open Questions
- None.

---

## Pattern 13: Accessibility Tests on All Components

### Rule Statement
ALWAYS include a `jest-axe` accessibility test for every new component. The test should render the component and assert `expect(results).toHaveNoViolations()`.

### Confidence: High
### Frequency: Very High -- nearly every component test file includes this.

### Code Examples

**Example 1 -- Applications page (PR #6962):**
```typescript
it("passes accessibility scan", async () => {
  const component = await Applications({ params: localeParams });
  const { container } = render(component);
  const results = await waitFor(() => axe(container));
  expect(results).toHaveNoViolations();
});
```

**Example 2 -- Organization invitation replies (PR #6863):**
```typescript
it("has no basic accessibility violations", async () => {
  const { container } = render(
    <OrganizationInvitationReplies userInvitations={invites} />,
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Rationale
Ensures baseline WCAG compliance for all UI components. Government projects require accessibility compliance.

### Open Questions
- None. Universally adopted.

---

## Pattern 14: `withFeatureFlag` HOC for Feature-Gated Pages

### Rule Statement
ALWAYS use `withFeatureFlag(Component, "flagName", fallback)` to gate pages behind feature flags. Feature flags MUST be named in camelCase with a boolean-off default (e.g., `applyFormPrototypeOff`). When creating a new feature flag, ALWAYS update the Terraform configuration.

### Confidence: High
### Frequency: Moderate -- 5+ PRs, stable pattern. Flags are periodically cleaned up (PR #8336 removed stale flags).

### Code Examples

**Example 1 -- Feature-gated page export (PR #6879):**
```typescript
export default withFeatureFlag<OrganizationDetailPageProps, never>(
  OrganizationDetailPage,
  "userAdminOff",
  () => redirect("/maintenance"),
);
```

**Example 2 -- Flag cleanup removes withFeatureFlag when no longer needed (PR #8336):**
```typescript
// Before (with flag):
export default withFeatureFlag<SearchPageProps, never>(
  Search, "searchOff", () => redirect("/maintenance"),
);
// After (flag removed):
export default Search;
```

### Rationale
Provides a clean, declarative way to toggle pages during rollout. The naming convention (default `false` / "off") ensures consistent behavior.

### Open Questions
- Reviewer (doug-s-nava) enforces that new flags must include Terraform updates. This should be part of a PR checklist.

---

## Pattern 15: `AuthorizationGate` and `AuthenticationGate` for Access Control

### Rule Statement
ALWAYS use `AuthenticationGate` for pages requiring login. Use `AuthorizationGate` for pages requiring specific privileges, passing `requiredPrivileges` and `resourcePromises`. NEVER perform client-side privilege checking -- always use the server-side API endpoint.

### Confidence: High
### Frequency: Moderate -- 4-5 PRs, growing as more pages are gated.

### Code Examples

**Example 1 -- AuthenticationGate in layout (PR #6962):**
```typescript
export default function ApplicationsLayout({ children }: LayoutProps) {
  return (
    <AuthenticationGate>{children}</AuthenticationGate>
  );
}
```

**Example 2 -- AuthorizationGate with resource promises (PR #6879):**
```typescript
<AuthorizationGate
  resourcePromises={{
    organizationDetails: getOrganizationDetails(session?.token || "", id),
  }}
  requiredPrivileges={[
    {
      resourceId: id,
      resourceType: "organization",
      privilege: "manage_org_members",
    },
  ]}
  onUnauthorized={() => <UnauthorizedMessage />}
>
  <OrganizationDetail organizationId={id} />
</AuthorizationGate>
```

### Rationale
PR #6765 removed client-side privilege checking (`src/utils/authUtils.ts`) in favor of server-side API calls. The gate components provide a declarative, composable authorization boundary.

### Open Questions
- This pattern is still evolving. The `AuthorizationGate` was significantly refactored in PR #6765 and first used as a POC in PR #6879. More pages will adopt it.

---

## Pattern 16: Reviewer-Enforced Code Style Rules

### Rule Statement
These rules are enforced through code review by the tech lead (doug-s-nava):

1. **NEVER use inline styles.** Use USWDS utility classes or CSS modules.
2. **ALWAYS use descriptive variable names.** No abbreviations. Think about searchability.
3. **ALWAYS call `useTranslations` with the lowest common namespace** and call `t()` directly where values are used. NEVER pre-assign translated strings to variables.
4. **ALWAYS capitalize type names.**
5. **ALWAYS pack large argument lists into an object parameter** to avoid argument-order bugs.
6. **NEVER use module-level mutable state.** Use React state instead.
7. **Use error variable name `e`** rather than `error` or `err` (exception to the abbreviation rule, documented in code style guide).

### Confidence: High
### Frequency: Moderate -- each rule appears in 2-5 review comments across the corpus.

### Code Examples

**Example 1 -- Translation namespace guidance (PR #6962, review comment):**
> doug-s-nava: "[nit] since this component is only using strings namespaced below 'Application.noApplicationsMessage' you can save a bit of real estate by calling `useTranslations("Applications.noApplicationMessage")` and referencing only 'primary' and 'secondary' below"

**Example 2 -- Naming overloaded terms (PR #6962, review comment):**
> doug-s-nava: "since `layout` is sort of an overloaded term in Nextjs, can we rename this to avoid confusion? Maybe `ApplicationsPageWrapper`?"

**Example 3 -- Component props typing (PR #6962, review comment):**
> doug-s-nava: "the pattern we're generally following is to type the props for components rather than the function."
```typescript
// Preferred:
const PageLayout = ({ children }: PropsWithChildren) => {
// Not:
const PageLayout: React.FC<PropsWithChildren> = ({ children }) => {
```

### Rationale
Consistency, readability, and maintainability. Documented in `documentation/frontend/code-style.md`.

### Open Questions
- None. These are enforced through review.

---

## Pattern 17: Dual API Key Headers During Gateway Migration

### Rule Statement
ALWAYS include both `X-API-KEY` (API Gateway) and `X-AUTH` (legacy) headers in `getDefaultHeaders()` when both environment variables are configured. The headers are conditionally included based on whether `API_GW_AUTH` and `API_AUTH_TOKEN` are set.

### Confidence: High
### Frequency: Low -- single PR (#6786) established this pattern.

### Code Examples

**Example 1 -- Dual header setup (PR #6786):**
```typescript
// frontend/src/services/fetch/fetcherHelpers.ts
export function getDefaultHeaders(): HeadersDict {
  const headers: HeadersDict = {};

  if (environment.API_GW_AUTH) {
    headers["X-API-KEY"] = environment.API_GW_AUTH;
  }

  if (environment.API_AUTH_TOKEN) {
    headers["X-AUTH"] = environment.API_AUTH_TOKEN;
  }

  headers["Content-Type"] = "application/json";
  return headers;
}
```

### Rationale
Supports a gradual migration from direct API auth to API Gateway. Both keys can coexist, allowing the team to test and roll back without code changes.

### Open Questions
- Once API Gateway migration is complete, the legacy `X-AUTH` header and `API_AUTH_TOKEN` env var should be removed.

---

## Anti-Patterns (Documented as Wrong)

### Anti-Pattern A: Commented-Out API Calls (Stub Implementations)

**Rule Statement:** NEVER merge commented-out API call implementations. If the API endpoint is not ready, create a follow-up ticket and wire up real calls as soon as the endpoint is available.

**Confidence:** Medium
**Frequency:** Moderate -- 3-4 PRs shipped stubs during workspace feature development.

**Example (PR #6863, later cleaned up in PR #7054):**
```typescript
// ANTI-PATTERN -- shipped with fake data and commented-out real call
export const inviteUserToOrganization = async (_token, requestData) => {
  console.log("!!! updating", organizationId, roleId, email);
  return Promise.resolve(fakeOrganizationInviteRecord);
  //   const resp = await fetchOrganizationWithMethod("POST")({...});
  //   const json = (await response.json()) as { data: OrganizationInviteRecord };
  //   return json.data;
};
```

PR #7054 cleaned this up by uncommenting and wiring up the real API call.

### Anti-Pattern B: Client-Side Privilege Checking

**Rule Statement:** NEVER check user privileges on the client side. ALWAYS use the server-side `checkUserPrivilege` API call via `AuthorizationGate`.

**Confidence:** High
**Frequency:** Low -- corrected once in PR #6765, which removed `src/utils/authUtils.ts`.

---

## File Organization Reference

| Directory | Purpose |
|---|---|
| `src/services/fetch/endpointConfigs.ts` | Declarative endpoint configuration objects |
| `src/services/fetch/fetchers/fetchers.ts` | `requesterForEndpoint` factory + cached instances |
| `src/services/fetch/fetchers/<domain>Fetcher.ts` | Domain-specific thin wrappers |
| `src/services/fetch/fetcherHelpers.ts` | Headers, URL construction, error utilities |
| `src/services/auth/session.ts` | `getSession()` server-side auth |
| `src/services/auth/useUser.ts` | Client-side user context hook |
| `src/services/featureFlags/` | Feature flag HOC and utilities |
| `src/hooks/useClientFetch.ts` | Client-side fetch wrapper hook |
| `src/types/` | Shared TypeScript types (non-local) |
| `src/utils/testing/fixtures.ts` | Centralized test fixtures |
| `src/errors.ts` | `ApiRequestError` hierarchy |
