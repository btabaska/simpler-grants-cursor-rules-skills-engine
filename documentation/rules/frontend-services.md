# Frontend Services -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a pending
> marker are awaiting team confirmation. All other patterns reflect
> high-confidence conventions observed consistently across the codebase.

## Overview

The simpler-grants-gov frontend service layer is organized under `frontend/src/services/` and `frontend/src/services/fetch/`, providing a structured approach to API communication. Server-side data fetching uses a centralized fetch factory (`requesterForEndpoint`) that produces typed fetch functions from declarative endpoint configurations. Client-side fetching is handled exclusively through the `useClientFetch` hook (see `frontend-hooks.md`).

Authentication follows a clear server/client split: server-side code obtains session data via `getSession()` from `src/services/auth/session.ts`, while client-side code uses the `useUser` hook from `UserProvider`. All authenticated server requests pass the user's token via an `X-SGG-Token` header. The API response envelope consistently follows `{ data: T }`, and errors are handled through a structured `ApiRequestError` hierarchy with `parseErrorStatus()` for status code extraction. See the error handling conventions documented here and in the cross-domain synthesis for the API-frontend error contract.

The service layer enforces a strict boundary between server and client code: server-side fetcher files include a `"server-only"` directive to prevent client-side bundling, and feature-gated pages use the `withFeatureFlag` HOC pattern with camelCase flag names.

## Rules

### Server-Side Fetch Architecture

#### Rule: Centralized Fetch Factory (`requesterForEndpoint`)

**Confidence:** High
**Observed in:** 40+ PRs; every new API endpoint follows this pattern | PR refs: #4437, #6962

ALWAYS create API client functions using `requesterForEndpoint()` from `fetchers.ts` with an `EndpointConfig` object. NEVER write raw `fetch()` calls to the backend API from server-side code.

**DO:**
```typescript
// From PR #4437 -- Static endpoint config
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
// From PR #4437 -- Dynamic method-parameterized variant
export const toDynamicApplicationsEndpoint = (type: "POST" | "GET" | "PUT") => {
  return {
    basePath: environment.API_URL,
    version: "alpha",
    namespace: "applications",
    method: type as ApiMethod,
  };
};

export const fetchApplicationWithMethod = (type: "POST" | "GET" | "PUT") =>
  requesterForEndpoint(toDynamicApplicationsEndpoint(type));
```

**DON'T:**
```typescript
// Anti-pattern -- raw fetch call in server-side code
const response = await fetch(`${process.env.API_URL}/v1/applications`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-AUTH": token },
  body: JSON.stringify(data),
});
```

> **Rationale:** Centralizes URL construction, default headers (including API key headers), and error handling. Each endpoint is configured declaratively, making it easy to add new endpoints without duplicating boilerplate.

---

#### Rule: Thin Domain Fetcher Wrappers

**Confidence:** High
**Observed in:** Every new endpoint across multiple PRs | PR refs: #6962

Each API resource gets a dedicated fetcher file in `frontend/src/services/fetch/fetchers/` that wraps the base `requesterForEndpoint` function. These wrappers handle session retrieval, header construction, and response extraction.

**DO:**
```typescript
// From PR #6962 -- thin domain fetcher
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

**DON'T:**
```typescript
// Anti-pattern -- duplicating fetch boilerplate in page components
const response = await fetch(`${API_URL}/alpha/users/${userId}/applications`, {
  method: "POST",
  headers: { "X-SGG-Token": token, "X-AUTH": apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({ pagination: { page_offset: 1, page_size: 5000 } }),
});
```

> **Rationale:** Thin wrappers keep fetch logic DRY while providing domain-specific typing and parameter handling. The directory structure (`src/services/fetch/fetchers/`) makes it easy to find the fetcher for any API resource.

---

#### Rule: `"server-only"` Directive on Server Fetchers

**Confidence:** High
**Observed in:** 5+ PRs explicitly show this | PR refs: #6962, #6879

ALWAYS add the `"server-only"` directive at the top of server-side fetcher files to prevent client-side bundling.

**DO:**
```typescript
// From PR #6962 -- applications fetcher
"server-only";

import { UnauthorizedError } from "src/errors";
import { getSession } from "src/services/auth/session";
// ...
```

**DON'T:**
```typescript
// Anti-pattern -- server-only code without the directive
// Could accidentally be imported in client components, leaking secrets
import { getSession } from "src/services/auth/session";
export const getApplications = async (token: string) => { ... };
```

> **Rationale:** Next.js build-time enforcement that server-only code (which may access secrets, session tokens, or internal APIs) is never accidentally included in client bundles.

---

### Client-Side Fetching

#### Rule: `useClientFetch` Hook for Client-Side Requests

**Confidence:** High
**Observed in:** Introduced in PR #4521, adopted in 15+ subsequent PRs | PR refs: #4521, #6863

ALWAYS use the `useClientFetch<T>()` hook for client-side API requests. NEVER use raw `fetch()` in client components for API calls. See `frontend-hooks.md` for the full hook specification including the dependency array limitation.

**DO:**
```typescript
// From PR #6863 -- basic usage with JSON response
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
// From PR #4521 -- non-JSON response with auth gating
const { clientFetch } = useClientFetch<Response>(
  "Error deleting saved search",
  { jsonResponse: false, authGatedRequest: true },
);
```

**DON'T:**
```typescript
// Anti-pattern -- standalone client fetcher file (these were all deleted)
// clientSavedSearchFetcher.ts -- duplicated auth/fetch logic
export const deleteSavedSearch = async (token: string, searchId: string) => {
  const response = await fetch("/api/user/saved-searches", { ... });
  // duplicated 401 handling, token checking, etc.
};
```

> **Rationale:** Consolidates token expiration checking, automatic logout on 401, and JSON parsing. Replaced multiple one-off client fetcher files, reducing code duplication.

---

### Server-Side Data Fetching Patterns

#### Rule: `Promise.all` for Parallel Fetches in RSC Pages

**Confidence:** High
**Observed in:** 20+ PRs follow this pattern | PR refs: #6863, #4414

ALWAYS fetch data in async server components by (1) calling `getSession()`, (2) creating named promise variables, (3) resolving in parallel with `Promise.all`, and (4) passing resolved data to child components. ALWAYS name unresolved promises as `varNamePromise` and resolved values as `resolvedVarName`.

**DO:**
```typescript
// From PR #6863 -- Workspace page with parallel fetches
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

**DON'T:**
```typescript
// Anti-pattern -- sequential fetches (slower)
const userRoles = await getUserPrivileges(session.token, session.user_id);
const userOrganizations = await getUserOrganizations(session.token, session.user_id);
const userInvitations = await getUserInvitations(session.token, session.user_id);
```

> **Rationale:** Parallel fetching minimizes page load time. The naming convention (documented in PR #4414's code style guide) makes it immediately clear whether a variable holds a promise or a resolved value.

---

### Authentication

#### Rule: `X-SGG-Token` Header for Authenticated Server Requests

**Confidence:** High
**Observed in:** Every authenticated fetcher in the codebase | PR refs: #6879, #6793, #6962

ALWAYS pass the user's session token via an `X-SGG-Token` header when making authenticated server-side API calls. Construct the header as `{ "X-SGG-Token": token }` and pass it via `additionalHeaders`.

**DO:**
```typescript
// From PR #6879 -- user privilege check
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

**DON'T:**
```typescript
// Anti-pattern -- passing token in body or query params
await fetchUserWithMethod("POST")({
  subPath: `${userId}/can_access`,
  body: { token: session.token, resource_type: resourceType },
});
```

> **Rationale:** Separates user-scoped authentication (per-request token) from system-level API auth (`X-AUTH` / `X-API-KEY` headers set in `getDefaultHeaders()`).

---

#### Rule: `getSession()` as the Sole Server-Side Auth Entry Point

**Confidence:** High
**Observed in:** Every authenticated page and server action | PR refs: #6793, #6962

ALWAYS use `getSession()` from `src/services/auth/session.ts` to obtain session data (token, user_id) on the server side. ALWAYS check for null session and missing token before proceeding with authenticated operations.

**DO:**
```typescript
// From PR #6793 -- server action auth check
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
// From PR #6962 -- fetcher with session check
export const fetchApplications = async (): Promise<ApplicationDetail[]> => {
  const session = await getSession();
  if (!session || !session.token) {
    throw new UnauthorizedError("No active session");
  }
  const applications = await getApplications(session.token, session.user_id);
  return applications;
};
```

**DON'T:**
```typescript
// Anti-pattern -- accessing cookies/headers directly for auth
import { cookies } from "next/headers";
const token = cookies().get("session_token")?.value;
```

> **Rationale:** Single entry point for auth state prevents inconsistencies. Centralizes JWT verification logic.

---

#### Rule: Dual API Key Headers During Gateway Migration

**Confidence:** High
**Observed in:** 1 PR established this pattern | PR refs: #6786

ALWAYS include both `X-API-KEY` (API Gateway) and `X-AUTH` (legacy) headers in `getDefaultHeaders()` when both environment variables are configured.

**DO:**
```typescript
// From PR #6786 -- dual header setup
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

**DON'T:**
```typescript
// Anti-pattern -- only including one auth header
headers["X-AUTH"] = environment.API_AUTH_TOKEN; // missing API Gateway header
```

> **Rationale:** Supports a gradual migration from direct API auth to API Gateway. Both keys can coexist, allowing the team to test and roll back without code changes.

---

### Error Handling

#### Rule: `ApiRequestError` Hierarchy and `parseErrorStatus`

**Confidence:** High
**Observed in:** 20+ PRs use this pattern | PR refs: #4414, #6962

ALWAYS use the `ApiRequestError` class hierarchy from `src/errors.ts` for API error handling. ALWAYS use `parseErrorStatus()` to extract HTTP status codes from caught errors in page components. For 404 errors, return `<NotFound />`; for other errors, return `<TopLevelError />` or a domain-specific error component.

**DO:**
```typescript
// From PR #4414 -- standard page-level error handling
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
// From PR #6962 -- UnauthorizedError propagation
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

**DON'T:**
```typescript
// Anti-pattern -- checking error messages as strings
try {
  const data = await fetchApplications();
} catch (e) {
  if (e.message.includes("404")) { ... } // fragile string matching
}
```

> **Rationale:** Provides structured error handling with consistent status code extraction. The hierarchy (`ApiRequestError`, `UnauthorizedError`, `BadRequestError`) enables type-safe error branching.

---

### API Response Types

#### Rule: `{ data: T }` Response Envelope

**Confidence:** High
**Observed in:** Every server-side fetcher | PR refs: #6793, #6962, #7054

ALWAYS type API responses using the `{ data: T }` envelope pattern. Cast JSON responses as `{ data: T }` and extract the `.data` property before returning.

**DO:**
```typescript
// From PR #6793 -- organization roles
const json = (await resp.json()) as { data: UserRole[] };
return json.data;
```

```typescript
// From PR #7054 -- organization invitations
const json = (await response.json()) as { data: OrganizationInviteRecord };
return json.data;
```

**DON'T:**
```typescript
// Anti-pattern -- returning the raw response without unwrapping
const json = await resp.json();
return json; // consumer has to know about the envelope
```

> **Rationale:** The backend API consistently wraps responses in a `{ data: ... }` envelope. Matching this pattern on the frontend ensures type safety and consistent data extraction.

---

### Types

#### Rule: Types in `/types` Directory; Prefer `type` over `interface`

**Confidence:** High
**Observed in:** Documented norm from PR #4414, enforced in reviews | PR refs: #6863, #6793, #6879

ALWAYS place shared TypeScript types in `src/types/` unless they are only referenced locally. ALWAYS use `type` by default. Use `interface` only when the type will be extended (inheritance).

**DO:**
```typescript
// From PR #6863 -- type for non-extended types
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
// From PR #6793 -- interface when extending
export interface RoleDefinition {
  role_id: string;
  role_name: string;
}
export interface UserRole extends RoleDefinition {
  privileges: Privileges[];
}
```

**DON'T:**
```typescript
// Anti-pattern -- using interface for non-extended types
interface OrganizationInvitation { // should be type unless extended
  organization_invitation_id: string;
  // ...
}
```

> **Rationale:** From the code style doc (PR #4414): "When in doubt, use a type. If typing an object, feel free to use an interface, especially if it may be extended."

---

### Form Validation

#### Rule: Zod Validation for Server Actions

**Confidence:** High
**Observed in:** 3-4 PRs with consistent pattern | PR refs: #6793

ALWAYS use Zod schemas for server-side form validation in server actions. Use `schema.safeParse()` and return `error.flatten().fieldErrors` on validation failure. ALWAYS use translated validation messages via `getTranslations()`.

**DO:**
```typescript
// From PR #6793 -- invite user form validation
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

**DON'T:**
```typescript
// Anti-pattern -- manual validation without Zod
const email = formData.get("email");
if (!email || typeof email !== "string") {
  return { errors: { email: "Email is required" } }; // not type-safe, not translated
}
```

> **Rationale:** Server-side validation prevents bypassing client-side checks. Zod provides type-safe schema definitions. Using `getTranslations` keeps error messages localized.

---

### Server Actions

#### Rule: Server Actions with `useActionState` for Forms

**Confidence:** Medium-High (Pending)
**Observed in:** 3+ PRs in later batches | PR refs: #6793

ALWAYS use Next.js server actions with React's `useActionState` hook for form submissions. NEVER use `useClientFetch` for form POST submissions when a server action is possible.

**DO:**
```typescript
// From PR #6793 -- invite user form
const [formState, formAction, isPending] = useActionState(inviteUser, {
  success: false,
});

<form action={formAction}>
  {/* form fields */}
  <UserInviteButton disabled={isPending || showSuccess} success={showSuccess} />
</form>
```

**DON'T:**
```typescript
// Anti-pattern -- using useClientFetch for form submissions
const { clientFetch } = useClientFetch("Error submitting form");
const handleSubmit = () => {
  clientFetch("/api/invite", { method: "POST", body: JSON.stringify(data) });
};
```

> **Rationale:** Server actions provide built-in progressive enhancement, eliminate client-side fetch boilerplate, and integrate naturally with React's concurrent features. Reviewer (doug-s-nava): "let's use a server action for this."

---

### Feature Flags

#### Rule: `withFeatureFlag` HOC for Feature-Gated Pages

**Confidence:** High
**Observed in:** 5+ PRs, stable pattern | PR refs: #6879, #8336

ALWAYS use `withFeatureFlag(Component, "flagName", fallback)` to gate pages behind feature flags. Feature flags MUST be named in camelCase with a boolean-off default (e.g., `applyFormPrototypeOff`). When creating a new feature flag, ALWAYS update the Terraform configuration.

**DO:**
```typescript
// From PR #6879 -- feature-gated page export
export default withFeatureFlag<OrganizationDetailPageProps, never>(
  OrganizationDetailPage,
  "userAdminOff",
  () => redirect("/maintenance"),
);
```

**DON'T:**
```typescript
// Anti-pattern -- inline feature flag check in component body
const { userAdminOff } = useFeatureFlags();
if (userAdminOff) return redirect("/maintenance");
// duplicated in every gated page
```

> **Rationale:** Provides a clean, declarative way to toggle pages during rollout. When flags are no longer needed, removal is straightforward (PR #8336 shows cleanup).

---

#### Rule: `AuthorizationGate` and `AuthenticationGate` for Access Control

**Confidence:** High
**Observed in:** 4-5 PRs, growing as more pages are gated | PR refs: #6962, #6879

ALWAYS use `AuthenticationGate` for pages requiring login. Use `AuthorizationGate` for pages requiring specific privileges, passing `requiredPrivileges` and `resourcePromises`. NEVER perform client-side privilege checking.

**DO:**
```typescript
// From PR #6879 -- AuthorizationGate with resource promises
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

**DON'T:**
```typescript
// Anti-pattern -- client-side privilege checking (removed in PR #6765)
import { hasPrivilege } from "src/utils/authUtils";
if (!hasPrivilege(user, "manage_org_members")) {
  return <UnauthorizedMessage />;
}
```

> **Rationale:** PR #6765 removed client-side privilege checking in favor of server-side API calls. The gate components provide a declarative, composable authorization boundary.

---

### Code Style (Reviewer-Enforced)

#### Rule: Descriptive Variable Names and Translation Namespace Scoping

**Confidence:** High
**Observed in:** 2-5 review comments across the corpus | PR refs: #6962

These rules are enforced through code review by the tech lead (doug-s-nava):
- NEVER use inline styles; use USWDS utility classes or CSS modules
- ALWAYS use descriptive variable names; no abbreviations (exception: `e` for error variables)
- ALWAYS call `useTranslations` with the lowest common namespace; NEVER pre-assign translated strings to variables
- ALWAYS pack large argument lists into an object parameter

**DO:**
```typescript
// From PR #6962 -- narrow translation namespace
// Reviewer: "since this component is only using strings namespaced below
// 'Application.noApplicationsMessage' you can save a bit of real estate"
const t = useTranslations("Applications.noApplicationMessage");
// references only 'primary' and 'secondary' below
```

**DON'T:**
```typescript
// Anti-pattern -- overloaded naming (reviewer flagged in PR #6962)
// "since `layout` is sort of an overloaded term in Nextjs, can we rename
// this to avoid confusion? Maybe `ApplicationsPageWrapper`?"
const PageLayout = ({ children }: PropsWithChildren) => { ... };
```

> **Rationale:** Consistency, readability, and maintainability. Documented in `documentation/frontend/code-style.md`.

---

## Anti-Patterns

### Anti-Pattern: Commented-Out API Calls (Stub Implementations)

NEVER merge commented-out API call implementations. If the API endpoint is not ready, create a follow-up ticket and wire up real calls as soon as the endpoint is available.

```typescript
// From PR #6863 -- shipped with fake data (later cleaned up in PR #7054)
export const inviteUserToOrganization = async (_token, requestData) => {
  console.log("!!! updating", organizationId, roleId, email);
  return Promise.resolve(fakeOrganizationInviteRecord);
  //   const resp = await fetchOrganizationWithMethod("POST")({...});
};
```

### Anti-Pattern: Client-Side Privilege Checking

NEVER check user privileges on the client side. ALWAYS use the server-side `checkUserPrivilege` API call via `AuthorizationGate`. Client-side auth utils (`src/utils/authUtils.ts`) were removed in PR #6765.

## Known Inconsistencies

### `"server only"` vs. `"server-only"` Directive

Both `"server only"` (with space) and `"server-only"` (with hyphen) forms appear in the codebase. The Next.js official package is `server-only` (with hyphen). This should be standardized. See cross-domain inconsistency INC-5.

### Thin Wrapper Necessity

Reviewer (doug-s-nava, PR #4437) noted the thin wrapper layer "demonstrates the limitations of this layer of abstraction" and suggested using `fetchApplicationWithMethod` directly in components. The team should decide if thin wrappers add value or just indirection.

### Feature Flag Naming Convention

Frontend flags use `FEATURE_{NAME}_OFF` backed by SSM parameters, while API flags use `ENABLE_{FEATURE}_ENDPOINTS = 1`. Three different naming patterns exist across the stack. See cross-domain inconsistency INC-1.

## Related Documents
- **Cursor Rules:** `.cursor/rules/frontend-services.md`
- **Related Domains:** `frontend-hooks.md` (useClientFetch hook specification), `frontend-components.md` (data fetching in components, AuthorizationGate usage), `frontend-tests.md` (service mock patterns, fixtures), `frontend-i18n.md` (translated validation messages)
