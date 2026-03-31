# Frontend Services — Pattern Review

**Reviewer(s):** doug-s-nava
**PRs analyzed:** 90
**Rules proposed:** 17 (including 2 anti-patterns)
**Open questions:** 5

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

### 1. Centralized Fetch Factory (`requesterForEndpoint`)

**Confidence:** High
**Frequency:** Pervasive — appears in 40+ PRs; every new API endpoint follows this pattern.
**Source PRs:** #4437, #6962

**Proposed Rule:**
> ALWAYS create API client functions using `requesterForEndpoint()` from `fetchers.ts` with an `EndpointConfig` object. NEVER write raw `fetch()` calls to the backend API from server-side code.

**Rationale:**
Centralizes URL construction, default headers (including API key headers), and error handling. Each endpoint is configured declaratively, making it easy to add new endpoints without duplicating boilerplate.

**Code Examples:**
```typescript
# From PR #4437 — Static endpoint config and cached fetcher
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

```typescript
# From PR #6962 — Thin domain fetcher wrapping the factory
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

**Conflicting Examples:**
Reviewer (doug-s-nava, PR #4437) noted the thin wrapper layer "demonstrates the limitations of this layer of abstraction" and suggested using `fetchApplicationWithMethod` directly in components.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** Should thin fetcher wrappers continue to be created, or should components use `fetchApplicationWithMethod` directly?

---

### 2. `useClientFetch` Hook for Client-Side Requests

**Confidence:** High
**Frequency:** High — introduced in PR #4521, adopted in 15+ subsequent PRs. All prior client-side fetcher files were deleted.
**Source PRs:** #4521, #6863

**Proposed Rule:**
> ALWAYS use the `useClientFetch<T>()` hook for client-side API requests. NEVER use raw `fetch()` in client components for API calls (except for the logout endpoint, which is explicitly called out as an exception in the codebase).

**Rationale:**
Consolidates token expiration checking, automatic logout on 401, and JSON parsing. Replaced multiple one-off client fetcher files, reducing code duplication.

**Code Examples:**
```typescript
# From PR #6863 — Basic usage with JSON response
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

```typescript
# From PR #4521 — Named instances for multiple endpoints
const { clientFetch: fetchSaved } = useClientFetch<MinimalOpportunity[]>(
  "Error fetching saved opportunity",
);
const { clientFetch: updateSaved } = useClientFetch<{ type: string }>(
  "Error updating saved opportunity",
);
```

**Conflicting Examples:**
Known bug documented in code (PR #4521): Adding `clientFetch` to `useEffect` dependency arrays causes infinite re-render loops due to `useUser` dependency.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 3. Server-Side Data Fetching with `Promise.all` in RSC Pages

**Confidence:** High
**Frequency:** Very High — 20+ PRs follow this pattern.
**Source PRs:** #6863, #4414

**Proposed Rule:**
> ALWAYS fetch data in async server components by (1) calling `getSession()`, (2) creating named promise variables, (3) resolving in parallel with `Promise.all`, and (4) passing resolved data to child components. ALWAYS name unresolved promises as `varNamePromise` and resolved values as `resolvedVarName`.

**Rationale:**
Parallel fetching minimizes page load time. The naming convention (documented in PR #4414's code style guide) makes it immediately clear whether a variable holds a promise or a resolved value.

**Code Examples:**
```typescript
# From PR #6863 — Workspace page with parallel fetches
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

```javascript
# From PR #4414 — Promise naming convention from code style doc
const bunnyPromises = getBunnyPromises();
const resolvedBunnies = Promise.all(bunnyPromises);
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

### 4. `X-SGG-Token` Header for Authenticated Server Requests

**Confidence:** High
**Frequency:** Very High — every authenticated fetcher in the codebase follows this exact pattern.
**Source PRs:** #6879, #6793, #6962

**Proposed Rule:**
> ALWAYS pass the user's session token via an `X-SGG-Token` header when making authenticated server-side API calls. Construct the header as `{ "X-SGG-Token": token }` and pass it via `additionalHeaders`.

**Rationale:**
Separates user-scoped authentication (per-request token) from system-level API auth (`X-AUTH` / `X-API-KEY` headers set in `getDefaultHeaders()`).

**Code Examples:**
```typescript
# From PR #6879 — User privilege check
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

```typescript
# From PR #6962 — Applications fetcher
const ssgToken = { "X-SGG-Token": token };
const resp = await fetchUserWithMethod("POST")({
  subPath: `${userId}/applications`,
  additionalHeaders: ssgToken,
  body: { pagination: { ... } },
});
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

### 5. `ApiRequestError` Hierarchy and `parseErrorStatus` for Error Handling

**Confidence:** High
**Frequency:** Very High — 20+ PRs use this pattern.
**Source PRs:** #4414, #6962

**Proposed Rule:**
> ALWAYS use the `ApiRequestError` class hierarchy from `src/errors.ts` for API error handling. ALWAYS use `parseErrorStatus()` to extract HTTP status codes from caught errors in page components. For 404 errors, return `<NotFound />`; for other errors, return `<TopLevelError />` or a domain-specific error component.

**Rationale:**
Provides structured error handling with consistent status code extraction. The hierarchy (`ApiRequestError`, `UnauthorizedError`, `BadRequestError`) enables type-safe error branching.

**Code Examples:**
```typescript
# From PR #4414 — Standard page-level error handling
try {
  const response = await getCompetitionDetails(id);
} catch (error) {
  if (parseErrorStatus(error as ApiRequestError) === 404) {
    return <NotFound />;
  }
  return <TopLevelError />;
}
```

```typescript
# From PR #6962 — UnauthorizedError propagation
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

### 6. `"server only"` / `"server-only"` Directive on Server Fetchers

**Confidence:** High
**Frequency:** Moderate — 5+ PRs explicitly show this.
**Source PRs:** #6962, #6879

**Proposed Rule:**
> ALWAYS add the `"server only"` or `"server-only"` directive at the top of server-side fetcher files to prevent client-side bundling.

**Rationale:**
Next.js build-time enforcement that server-only code (which may access secrets, session tokens, or internal APIs) is never accidentally included in client bundles.

**Code Examples:**
```typescript
# From PR #6962 — Applications fetcher
"server-only";

import { UnauthorizedError } from "src/errors";
import { getSession } from "src/services/auth/session";
// ...
```

```typescript
# From PR #6879 — User fetcher
"server only";

import { JSONRequestBody } from "src/services/fetch/fetcherHelpers";
// ...
```

**Conflicting Examples:**
Both `"server only"` (with space) and `"server-only"` (with hyphen) forms appear in the codebase. The Next.js official package is `"server-only"` (with hyphen).

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** Both forms exist in the codebase. The Next.js official package is `"server-only"` (with hyphen). Should this be standardized? (Also flagged as cross-domain inconsistency INC-5.)

---

### 7. `getSession()` as the Sole Server-Side Auth Entry Point

**Confidence:** High
**Frequency:** Very High — every authenticated page and server action uses this.
**Source PRs:** #6793, #6962

**Proposed Rule:**
> ALWAYS use `getSession()` from `src/services/auth/session.ts` to obtain session data (token, user_id) on the server side. ALWAYS check for null session and missing token before proceeding with authenticated operations.

**Rationale:**
Single entry point for auth state prevents inconsistencies. Centralizes JWT verification logic.

**Code Examples:**
```typescript
# From PR #6793 — Server action auth check
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

```typescript
# From PR #6962 — Fetcher with session check
export const fetchApplications = async (): Promise<ApplicationDetail[]> => {
  const session = await getSession();
  if (!session || !session.token) {
    throw new UnauthorizedError("No active session");
  }
  const applications = await getApplications(session.token, session.user_id);
  return applications;
};
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

### 8. Types in `/types` Directory; Prefer `type` over `interface`

**Confidence:** High
**Frequency:** Very High — documented norm from PR #4414, enforced in reviews.
**Source PRs:** #6863, #6793, #6879

**Proposed Rule:**
> ALWAYS place shared TypeScript types in `src/types/` unless they are only referenced locally. ALWAYS use `type` by default. Use `interface` only when the type will be extended (inheritance).

**Rationale:**
From the code style doc (PR #4414): "When in doubt, use a type. If typing an object, feel free to use an interface, especially if it may be extended." Keeps type declarations consistent and predictable.

**Code Examples:**
```typescript
# From PR #6863 — type for non-extended types
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

```typescript
# From PR #6793, #6879 — interface when extending
// src/types/userTypes.ts
export interface RoleDefinition {
  role_id: string;
  role_name: string;
}
export interface UserRole extends RoleDefinition {
  privileges: Privileges[];
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

### 9. API Response Types Follow `{ data: T }` Envelope

**Confidence:** High
**Frequency:** Very High — every server-side fetcher follows this.
**Source PRs:** #6793, #6962, #7054

**Proposed Rule:**
> ALWAYS type API responses using the `{ data: T }` envelope pattern. Cast JSON responses as `{ data: T }` and extract the `.data` property before returning.

**Rationale:**
The backend API consistently wraps responses in a `{ data: ... }` envelope. Matching this pattern on the frontend ensures type safety and consistent data extraction.

**Code Examples:**
```typescript
# From PR #6793 — Organization roles
const json = (await resp.json()) as { data: UserRole[] };
return json.data;
```

```typescript
# From PR #7054 — Organization invitations
const json = (await response.json()) as { data: OrganizationInviteRecord };
return json.data;
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

### 10. Zod Validation for Server Actions

**Confidence:** High
**Frequency:** Moderate — 3-4 PRs, but consistent pattern in all form submissions.
**Source PRs:** #6793

**Proposed Rule:**
> ALWAYS use Zod schemas for server-side form validation in server actions. Use `schema.safeParse()` and return `error.flatten().fieldErrors` on validation failure. ALWAYS use translated validation messages via `getTranslations()`.

**Rationale:**
Server-side validation prevents bypassing client-side checks. Zod provides type-safe schema definitions. Using `getTranslations` keeps error messages localized.

**Code Examples:**
```typescript
# From PR #6793 — Invite user form validation
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

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** Should a shared Zod validation helper be created for common patterns (email, required string, etc.)?

---

### 11. Server Actions with `useActionState` for Forms

**Confidence:** Medium-High
**Frequency:** Growing — 3+ PRs in later batches, and reviewer (doug-s-nava) explicitly directed contributors to use server actions.
**Source PRs:** #6793

**Proposed Rule:**
> ALWAYS use Next.js server actions with React's `useActionState` hook for form submissions. NEVER use `useClientFetch` for form POST submissions when a server action is possible.

**Rationale:**
Server actions provide built-in progressive enhancement, eliminate client-side fetch boilerplate, and integrate naturally with React's concurrent features. Reviewer comment (doug-s-nava): "let's use a server action for this."

**Code Examples:**
```typescript
# From PR #6793 — Invite user form
const [formState, formAction, isPending] = useActionState(inviteUser, {
  success: false,
});

// ...
<form action={formAction}>
  {/* form fields */}
  <UserInviteButton disabled={isPending || showSuccess} success={showSuccess} />
</form>
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

**Open Question:** Reviewer noted: "might be worth building out a wrapper to do with `useClientFetch` is doing but for server actions, so that we don't have to worry about this boilerplate." Should a server-action wrapper be created?

---

### 12. Test Fixtures in Centralized `fixtures.ts`

**Confidence:** High
**Frequency:** High — fixtures file grows across many PRs.
**Source PRs:** #6879, #6863

**Proposed Rule:**
> ALWAYS define fake/mock data for tests in `src/utils/testing/fixtures.ts`. ALWAYS add explicit type annotations to fixture values. NEVER define inline test data when a reusable fixture would serve.

**Rationale:**
Centralizing test data avoids duplication, keeps fixtures in sync with type changes, and makes it easy to find fake data for any resource type.

**Code Examples:**
```typescript
# From PR #6879 — Typed fixture
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

```typescript
# From PR #6863 — Organization invitation fixture
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

### 13. Accessibility Tests on All Components

**Confidence:** High
**Frequency:** Very High — nearly every component test file includes this.
**Source PRs:** #6962, #6863

**Proposed Rule:**
> ALWAYS include a `jest-axe` accessibility test for every new component. The test should render the component and assert `expect(results).toHaveNoViolations()`.

**Rationale:**
Ensures baseline WCAG compliance. Government projects require accessibility compliance.

**Code Examples:**
```typescript
# From PR #6962 — Applications page
it("passes accessibility scan", async () => {
  const component = await Applications({ params: localeParams });
  const { container } = render(component);
  const results = await waitFor(() => axe(container));
  expect(results).toHaveNoViolations();
});
```

```typescript
# From PR #6863 — Organization invitation replies
it("has no basic accessibility violations", async () => {
  const { container } = render(
    <OrganizationInvitationReplies userInvitations={invites} />,
  );
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
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

### 14. `withFeatureFlag` HOC for Feature-Gated Pages

**Confidence:** High
**Frequency:** Moderate — 5+ PRs, stable pattern. Flags are periodically cleaned up (PR #8336 removed stale flags).
**Source PRs:** #6879, #8336

**Proposed Rule:**
> ALWAYS use `withFeatureFlag(Component, "flagName", fallback)` to gate pages behind feature flags. Feature flags MUST be named in camelCase with a boolean-off default (e.g., `applyFormPrototypeOff`). When creating a new feature flag, ALWAYS update the Terraform configuration.

**Rationale:**
Provides a clean, declarative way to toggle pages during rollout. The naming convention (default `false` / "off") ensures consistent behavior.

**Code Examples:**
```typescript
# From PR #6879 — Feature-gated page export
export default withFeatureFlag<OrganizationDetailPageProps, never>(
  OrganizationDetailPage,
  "userAdminOff",
  () => redirect("/maintenance"),
);
```

```typescript
# From PR #8336 — Flag cleanup removes withFeatureFlag when no longer needed
// Before (with flag):
export default withFeatureFlag<SearchPageProps, never>(
  Search, "searchOff", () => redirect("/maintenance"),
);
// After (flag removed):
export default Search;
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

### 15. `AuthorizationGate` and `AuthenticationGate` for Access Control

**Confidence:** High
**Frequency:** Moderate — 4-5 PRs, growing as more pages are gated.
**Source PRs:** #6962, #6879

**Proposed Rule:**
> ALWAYS use `AuthenticationGate` for pages requiring login. Use `AuthorizationGate` for pages requiring specific privileges, passing `requiredPrivileges` and `resourcePromises`. NEVER perform client-side privilege checking -- always use the server-side API endpoint.

**Rationale:**
PR #6765 removed client-side privilege checking (`src/utils/authUtils.ts`) in favor of server-side API calls. The gate components provide a declarative, composable authorization boundary.

**Code Examples:**
```typescript
# From PR #6962 — AuthenticationGate in layout
export default function ApplicationsLayout({ children }: LayoutProps) {
  return (
    <AuthenticationGate>{children}</AuthenticationGate>
  );
}
```

```typescript
# From PR #6879 — AuthorizationGate with resource promises
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

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** This pattern is still evolving. The `AuthorizationGate` was significantly refactored in PR #6765 and first used as a POC in PR #6879. Should the API be considered stable?

---

### 16. Reviewer-Enforced Code Style Rules

**Confidence:** High
**Frequency:** Moderate — each rule appears in 2-5 review comments across the corpus.
**Source PRs:** #6962, #4414

**Proposed Rule:**
> These rules are enforced through code review by the tech lead (doug-s-nava):
>
> 1. NEVER use inline styles. Use USWDS utility classes or CSS modules.
> 2. ALWAYS use descriptive variable names. No abbreviations. Think about searchability.
> 3. ALWAYS call `useTranslations` with the lowest common namespace and call `t()` directly where values are used. NEVER pre-assign translated strings to variables.
> 4. ALWAYS capitalize type names.
> 5. ALWAYS pack large argument lists into an object parameter to avoid argument-order bugs.
> 6. NEVER use module-level mutable state. Use React state instead.
> 7. Use error variable name `e` rather than `error` or `err` (exception to the abbreviation rule, documented in code style guide).

**Rationale:**
Consistency, readability, and maintainability. Documented in `documentation/frontend/code-style.md`.

**Code Examples:**
```
# From PR #6962 — Translation namespace guidance (review comment)
> doug-s-nava: "[nit] since this component is only using strings namespaced below
> 'Application.noApplicationsMessage' you can save a bit of real estate by calling
> `useTranslations("Applications.noApplicationMessage")` and referencing only
> 'primary' and 'secondary' below"
```

```typescript
# From PR #6962 — Component props typing (review comment)
// Preferred:
const PageLayout = ({ children }: PropsWithChildren) => {
// Not:
const PageLayout: React.FC<PropsWithChildren> = ({ children }) => {
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

### 17. Dual API Key Headers During Gateway Migration

**Confidence:** High
**Frequency:** Low — single PR (#6786) established this pattern.
**Source PRs:** #6786

**Proposed Rule:**
> ALWAYS include both `X-API-KEY` (API Gateway) and `X-AUTH` (legacy) headers in `getDefaultHeaders()` when both environment variables are configured. The headers are conditionally included based on whether `API_GW_AUTH` and `API_AUTH_TOKEN` are set.

**Rationale:**
Supports a gradual migration from direct API auth to API Gateway. Both keys can coexist, allowing the team to test and roll back without code changes.

**Code Examples:**
```typescript
# From PR #6786 — Dual header setup
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

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** Once API Gateway migration is complete, the legacy `X-AUTH` header and `API_AUTH_TOKEN` env var should be removed. Is there a timeline for this?

---

### Anti-Pattern A: Commented-Out API Calls (Stub Implementations)

**Confidence:** Medium
**Frequency:** Moderate — 3-4 PRs shipped stubs during workspace feature development.
**Source PRs:** #6863, #7054

**Proposed Rule:**
> NEVER merge commented-out API call implementations. If the API endpoint is not ready, create a follow-up ticket and wire up real calls as soon as the endpoint is available.

**Rationale:**
Stub implementations with fake data create false confidence and technical debt.

**Code Examples:**
```typescript
# From PR #6863 — ANTI-PATTERN (shipped with fake data, cleaned up in PR #7054)
export const inviteUserToOrganization = async (_token, requestData) => {
  console.log("!!! updating", organizationId, roleId, email);
  return Promise.resolve(fakeOrganizationInviteRecord);
  //   const resp = await fetchOrganizationWithMethod("POST")({...});
  //   const json = (await response.json()) as { data: OrganizationInviteRecord };
  //   return json.data;
};
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

### Anti-Pattern B: Client-Side Privilege Checking

**Confidence:** High
**Frequency:** Low — corrected once in PR #6765, which removed `src/utils/authUtils.ts`.
**Source PRs:** #6765

**Proposed Rule:**
> NEVER check user privileges on the client side. ALWAYS use the server-side `checkUserPrivilege` API call via `AuthorizationGate`.

**Rationale:**
Client-side privilege checking can be bypassed. Server-side checks are authoritative.

**Code Examples:**
```
# From PR #6765 — Removed src/utils/authUtils.ts (which had client-side
# privilege checking logic) and replaced with server-side API call pattern
# via checkUserPrivilege
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

1. **No frontend error boundary strategy** — The frontend uses `<TopLevelError />` and `<NotFound />` for page-level errors, and `parseErrorStatus()` for status code extraction. But there is no documented strategy for component-level error boundaries, retry behavior, or user-facing error message standards beyond the i18n pattern. (Cross-domain gap GAP-6)
2. **No centralized feature flag registry** — Feature flags are scattered across Terraform configs, SSM parameters, and code references. There is no single registry showing all active flags, their current state per environment, or their cleanup status. (Cross-domain gap GAP-2)
3. **Validation framework dual stack** — Zod is used for frontend server actions while the API uses Marshmallow/Pydantic. Four different validation libraries exist across the stack. (Cross-domain inconsistency INC-3)

## Inconsistencies Requiring Resolution

### `"server only"` vs. `"server-only"` (INC-5)

Both forms appear in the codebase. The Next.js official package is `server-only` (with hyphen). All files should be standardized to `"server-only"`.

### Feature Flag Naming Convention (INC-1)

Frontend uses `FEATURE_{NAME}_OFF` with SSM, API uses `ENABLE_{FEATURE}_ENDPOINTS = 1`, local dev uses `ENABLE_{FEATURE}=TRUE`. Three different patterns should be unified.

### Thin Fetcher Wrapper Value

Reviewer (doug-s-nava) questioned whether thin fetcher wrappers add value over using `fetchApplicationWithMethod` directly. The team should decide whether to continue creating thin wrappers or use the factory functions directly in components.

### Cross-Domain: Accessibility Testing (CCP-7)

Accessibility testing is mandatory across frontend domains. E2E tests run across Chromium, Firefox, WebKit, and Mobile Chrome. This is well-established but should be documented as a cross-cutting requirement.
