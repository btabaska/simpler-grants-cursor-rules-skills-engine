# Frontend E2E Tests Rules

## Execution Tags (Required)

EVERY test MUST have exactly ONE execution tag:
- `@smoke` — Runs on every PR
- `@core-regression` — Runs on merge to main
- `@full-regression` — Runs daily
- `@extended` — Runs weekly

NEVER create a test without an execution tag.

## Feature Tags (Optional)

Feature tags categorize tests by domain: `@grantor`, `@grantee`, `@opportunity-search`, `@apply`, `@static`, `@auth`, `@user-management`.

ALWAYS define tags in `frontend/tests/e2e/tags.ts`. NEVER use ad-hoc tag strings.

## Test File Naming

ALWAYS use `happy-path-*.spec.ts` for success path tests. ALWAYS use `failure-path-*.spec.ts` for error path tests.

## Directory Organization

ALWAYS organize tests by feature area in subdirectories:
```
frontend/tests/e2e/
  tags.ts
  search/
    search.spec.ts
    searchSpecUtil.ts
  apply/
    happy-path-*.spec.ts
    failure-path-*.spec.ts
    fixtures/
```

## Page Object Pattern

ALWAYS use utility-based page objects (exported functions), NOT OOP classes. ALWAYS place shared utilities in `utils/`.

Example from codebase:
```typescript
export async function authenticateUser(page: Page, credentials: UserCredentials) {
  await page.goto("/login");
  await page.fill('[name="email"]', credentials.email);
  await page.click('button[type="submit"]');
  await page.waitForURL("/dashboard");
}
```

## Playwright Configuration

- Timeouts: 75s (local), 120s (staging/prod)
- Workers: 10 default, configurable via `PLAYWRIGHT_WORKERS`
- Sharding: 4 shards via `TOTAL_SHARDS`/`CURRENT_SHARD`
- Retries: 0 (local), 3 (CI)

NEVER write tests that assume specific timeout values.

## Assertions

ALWAYS use Playwright's built-in assertions. NEVER use `page.waitForTimeout()`.
