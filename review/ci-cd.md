# CI/CD Workflow Patterns — Pattern Review

**Reviewer(s):** chouinar, doug-s-nava
**PRs analyzed:** 124
**Rules proposed:** 18
**Open questions:** 14

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

### 1. Per-Application CD Workflow with Serialized Environment Matrix

**Confidence:** High
**Frequency:** Universal -- present in all 4 CD workflows (cd-api, cd-analytics, cd-frontend, cd-nofos).
**Source PRs:** #6299, #5022, #8402

**Proposed Rule:**
> ALWAYS structure each deployable application's CD workflow (`cd-{app}.yml`) as a three-job pipeline: `checks -> deploy -> send-slack-notification`. The deploy job MUST use `max-parallel: 1` and `fail-fast: false` to serialize environment deployments.

**Rationale:**
Serialized deployments (`max-parallel: 1`) prevent race conditions in Terraform state and ensure that if a lower environment fails, higher environments are not skipped but still processed sequentially. `fail-fast: false` ensures one environment failure does not cancel other deployments.

**Code Examples:**
```yaml
# From PR #6299 — adding training environment to the serialized matrix (cd-api.yml)
    strategy:
      max-parallel: 1
      fail-fast: false
      matrix:
        envs: ${{ fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.event_name == 'release' && '["prod", "training"]' || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]')  }}
```

```yaml
# From PR #5022 — NOFOs CD following the same three-job pattern (cd-nofos.yml)
jobs:
  checks:
    name: Checks
    uses: ./.github/workflows/ci-nofos.yml
    with:
      version: ${{ inputs.version || 'main' }}

  deploy:
    name: Deploy
    needs: [checks]
    uses: ./.github/workflows/deploy-nofos.yml
    with:
      environment: ${{ inputs.environment || 'dev' }}
      version: ${{ inputs.version || 'main' }}

  send-slack-notification:
    if: failure()
```

**Conflicting Examples:**
The environment matrix ternary expression has become increasingly complex and has been a source of bugs (see Pattern 11). The nofos workflow uses a simpler structure without a matrix, relying on a single environment input.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: The environment matrix ternary expression has become a maintenance liability. Should the matrix logic be extracted to a shared reusable action or a script that outputs the environment list?_

---

### 2. Reusable Workflow Composition via `workflow_call`

**Confidence:** High
**Frequency:** High -- 15+ workflows use `workflow_call`. Key reusable workflows include `vulnerability-scans.yml`, `build-and-publish.yml`, `deploy.yml`, `deploy-nofos.yml`, `send-slack-notification.yml`, `e2e-create-report.yml`.
**Source PRs:** #8446, #8754

**Proposed Rule:**
> ALWAYS extract shared CI/CD logic into reusable workflows (invoked via `uses: ./.github/workflows/{name}.yml`) when the same job-level logic is needed by more than one workflow. NEVER duplicate multi-step job definitions across workflow files.

**Rationale:**
Reusable workflows reduce duplication and ensure consistency across deployment pipelines. When a shared process changes (e.g., vulnerability scanning tool version), it only needs updating in one place.

**Code Examples:**
```yaml
# From PR #8446 — extracting e2e report creation as a reusable workflow
# e2e-create-report.yml
name: Create Merged Test Report
on:
  workflow_call:
    inputs:
      run_id:
        description: "github actions id for run to grab artifacts from"
        type: string
      artifact-ids:
        description: "comma separated string of test report artifact ids to download"
        type: string
```

```yaml
# From PR #8754 — consuming the reusable workflow from ci-frontend-e2e.yml
  create-report:
    name: Create Merged Test Report
    if: ${{ !cancelled() }}
    needs: e2e-tests-local
    uses: ./.github/workflows/e2e-create-report.yml
    secrets: inherit
    with:
      run_id: ${{ github.run_id }}
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

### 3. Composite Actions for Shared Step-Level Logic

**Confidence:** High
**Frequency:** Moderate and growing -- currently 3 composite actions (`e2e/action.yml`, `configure-aws-credentials/`, `setup-terraform/`), with the e2e action being the most recently developed.
**Source PRs:** #8446, #8754

**Proposed Rule:**
> ALWAYS use composite actions under `.github/actions/` for step-level reuse across workflows. When the same sequence of steps appears in multiple jobs, extract it into a composite action with configurable inputs.

**Rationale:**
Composite actions sit between reusable workflows (job-level) and raw step duplication (step-level). They are the right abstraction when the same steps are needed within different job contexts, especially across local vs deployed e2e tests.

**Code Examples:**
```yaml
# From PR #8446 — creating the e2e composite action
# .github/actions/e2e/action.yml
name: Run Playwright
description: Composite action to run Playwright against specified environment

inputs:
  version:
    description: "ref / sha / branch to run tests against"
    required: true
  target:
    description: "application environment to run tests against (dev / prod TK)"
    required: true
    default: "local"
  total_shards:
    description: "total number of test shards in parent run"
    default: "1"
  current_shard:
    description: "total number of test shards in parent run"
    default: "1"

runs:
  using: "composite"
  steps:
    - name: Validate environment
      shell: bash
      env:
        PLAYWRIGHT_TARGET_ENV: ${{ inputs.target }}
      run: |
        if [[ $PLAYWRIGHT_TARGET_ENV != "local" && $PLAYWRIGHT_TARGET_ENV != "staging" ]]; then echo "invalid e2e test target provided" && exit 1; fi
```

```yaml
# From PR #8754 — adding optional flags to the composite action
  needs_node_setup:
    description: "does this action need to set up node and install deps"
    default: "true"
  api_logs:
    description: "print api logs on failure?"
    default: "false"
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should all composite actions follow a consistent naming/directory pattern? Currently the structure under `.github/actions/` is ad hoc._

---

### 4. `ci-{app}` / `cd-{app}` Naming Convention

**Confidence:** High
**Frequency:** Universal -- all 124 PRs in this domain follow or extend this convention.
**Source PRs:** #4913, #4943, #8769

**Proposed Rule:**
> ALWAYS name CI check workflows `ci-{app}.yml` and CD deploy workflows `cd-{app}.yml`. Supporting workflows MUST use descriptive prefixes: `deploy-{app}.yml` for deployment execution, `vulnerability-scans-{app}.yml` for scanning, `e2e-{target}.yml` for e2e test targets, and `lint-{description}.yml` for governance linters.

**Rationale:**
Consistent naming enables quick identification of workflow purpose in the GitHub Actions UI, path-based CODEOWNERS rules (when that was active), and mental mapping between application directories and their CI/CD pipelines.

**Code Examples:**
```yaml
# From PR #4913 — initial creation of ci-nofos (note: initially had wrong name, fixed in PR #4943)
# .github/workflows/ci-nofos.yml
name: API Checks  # <-- Bug: wrong name, fixed in PR #4943 to "NOFOs Checks"

on:
  workflow_call:
    inputs:
      version:
        description: "Version to run tests against"
        default: "main"
        type: string
```

```yaml
# From PR #8769 — e2e workflow name evolution following the convention
name: E2E Tests (Local Github Target)  # Evolved from "Frontend E2E Tests" -> "E2E Tests (Local)"
```

**Conflicting Examples:**
The naming for e2e workflows diverges slightly (`ci-frontend-e2e.yml`, `e2e-staging.yml`). These do not follow a single consistent prefix pattern.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should e2e workflows be standardized to something like `e2e-local.yml` / `e2e-staging.yml`?_

---

### 5. Path-Filtered Triggers with Shared Module Inclusion

**Confidence:** High
**Frequency:** Universal across all CD workflows. PR #4920 was a corrective fix that established the shared modules requirement.
**Source PRs:** #4920, #8769

**Proposed Rule:**
> ALWAYS include `paths:` filters on `push` triggers for CD workflows to limit deployments to relevant code changes. ALWAYS include `infra/modules/**` in the paths filter for all service CD workflows, since shared Terraform modules can affect any service.

**Rationale:**
In a monorepo, path filters prevent unnecessary deployments when unrelated code changes. The shared modules fix (#4920) addressed a real bug where Terraform module changes were not triggering dependent service deployments.

**Code Examples:**
```yaml
# From PR #4920 — adding shared modules to all CD workflow triggers
# cd-api.yml
on:
  push:
    branches: ["main"]
    paths:
      - "api/**"
      - "infra/api/**"
      - "infra/modules/**"    # <-- Added in PR #4920
```

```yaml
# From PR #8769 — e2e workflow covering both api and frontend paths
on:
  push:
    branches:
      - "main"
    paths:
      - "api/**"
      - "frontend/**"
      - "infra/api/**"
      - "infra/frontend/**"
      - "infra/modules/**"
      - ".github/workflows/ci-frontend-e2e.yml"
```

**Conflicting Examples:**
Some workflows include their own workflow file in the paths filter (e.g., `.github/workflows/ci-frontend-e2e.yml`), while others do not.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should the workflow file itself always be included in its own paths filter?_

---

### 6. Environment Promotion Chain with Prod-First Ordering

**Confidence:** High
**Frequency:** High -- all CD workflows follow this pattern. The prod-first ordering was explicitly requested in PR #6299 review.
**Source PRs:** #6299, #8887

**Proposed Rule:**
> ALWAYS follow the environment promotion chain: push-to-main deploys to `["dev", "staging"]`, release deploys to `["prod", "training"]`. In the release matrix, ALWAYS list `"prod"` before `"training"` to avoid blocking production fixes on training deployments.

**Rationale:**
Serialized deployments with `max-parallel: 1` mean ordering directly impacts time-to-production. Prod must come first so that production incidents are not delayed by non-critical environment deployments.

**Code Examples:**
```yaml
# From PR #6299 — reviewer requesting prod-first ordering
# Before review (training listed first):
envs: ${{ ... || github.event_name == 'release' && '["training", "prod"]' || ... }}

# After review (prod moved first):
envs: ${{ ... || github.event_name == 'release' && '["prod", "training"]' || ... }}
```

Reviewer comment (mdragon): _"I think the order here matters and we'd want Prod to be first so that we're not waiting on Training if we're fixing downtime, etc."_

```yaml
# From PR #8887 — scheduled daily staging e2e runs
  schedule:
    # Run every day at (6/7am Eastern) before the start of the workday
    - cron: "0 11 * * *"
```

**Conflicting Examples:**
The `grantee1` environment appears in the nofos workflow (PR #8799) but not in other CD workflows.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: The `grantee1` environment appears in the nofos workflow but not in other CD workflows. Is this a nofos-only environment, or should it be added to the standard promotion chain?_

---

### 7. Concurrency Controls for Deploy Isolation

**Confidence:** High
**Frequency:** High -- present in all deploy and e2e workflows.
**Source PRs:** #5022, #8446

**Proposed Rule:**
> ALWAYS set a `concurrency` group on deploy workflows keyed to the environment name to prevent overlapping deployments. For CI workflows, use `cancel-in-progress: true` to save resources on superseded runs.

**Rationale:**
Overlapping Terraform applies to the same environment can corrupt state or cause deployment failures. Concurrency groups ensure only one deployment runs per environment at a time. CI cancellation saves compute costs when a newer commit supersedes an in-progress check.

**Code Examples:**
```yaml
# From PR #5022 — deploy-level concurrency keyed to environment (deploy-nofos.yml)
concurrency: cd-nofos-${{ inputs.environment || 'dev' }}
```

```yaml
# From PR #8446 — e2e test concurrency with cancel-in-progress
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
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

### 8. Docker Image Caching Between CI and CD Jobs

**Confidence:** High
**Frequency:** NOFOs-specific but architecturally significant. PR #5071 was a corrective fix for stale cache key.
**Source PRs:** #5022, #5071

**Proposed Rule:**
> When deploying an application from an external repository, ALWAYS use `actions/cache/save` and `actions/cache/restore` to pass Docker images between CI (build/test) and CD (deploy) jobs. ALWAYS include `github.run_id` in the cache key to prevent stale images from being deployed on workflow re-runs.

**Rationale:**
For external apps (like NOFOs from HHS/simpler-grants-pdf-builder), Docker images must be built once in CI and reused in deploy. Without `run_id`, re-running a workflow would pick up a stale cached image from a previous run with the same SHA.

**Code Examples:**
```yaml
# From PR #5022 — initial cache implementation (ci-nofos.yml)
      - name: Cache Docker image
        uses: actions/cache/save@v4
        with:
          path: /tmp/docker-image.tar
          key: nofos-image-${{ github.sha }}
```

```yaml
# From PR #5071 — adding run_id for uniqueness
          key: nofos-image-${{ github.sha }}-${{ github.run_id }}
```

Reviewer exchange (mdragon/pcraig3): _"Wouldn't this be a different run because you're kicking the deploy manually after the ci has run automatically?" / "When we kick off a manual run, it runs the ci and then deploy actions, so it's the same id for both. We just tested this also and it works."_

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Is `actions/cache` the best mechanism here, or would `actions/upload-artifact`/`actions/download-artifact` be more reliable for cross-job artifact passing within the same run?_

---

### 9. App-Specific Git Hashes for Smart Container Reuse

**Confidence:** Medium
**Frequency:** One significant PR (#5189), but affects all platform app build-and-publish flows.
**Source PRs:** #5189

**Proposed Rule:**
> ALWAYS use the most recent commit hash within each application's folder (not the repo-level HEAD) when determining whether a container image already exists. This requires `fetch-depth: 1000` on the checkout action.

**Rationale:**
In a monorepo, the top-level git hash changes with every merge, even if only one app was modified. Using app-folder-specific hashes avoids unnecessary rebuilds for unchanged apps during production releases that deploy all services.

**Code Examples:**
```yaml
# From PR #5189 — using app-folder-specific commit hash (build-and-publish.yml)
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.ref }}
          fetch-depth: 1000
      - name: Get commit hash
        id: get-commit-hash
        run: |
          APP_COMMIT_HASH=$(git log --pretty=format:'%H' -n 1 ${{inputs.ref}} ${{ inputs.app_name}})
          COMMIT_HASH=$(git rev-parse ${{ inputs.ref }})
          echo "Commit hash: $COMMIT_HASH, App: $APP_COMMIT_HASH"
          echo "commit_hash=$APP_COMMIT_HASH" >> "$GITHUB_OUTPUT"
```

Author comment (mdragon): _"The risk of having this number too low is if an App hasn't had a change in more than this number of commits it will not return an existing container hash and we'll rebuild, so not a huge deal, but something we want to avoid as much as possible."_

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open questions: (1) The `fetch-depth: 1000` is a heuristic. Should this be made configurable or is 1000 sufficient? (2) Should the `is-image-published` script be unit tested, given its critical role in build avoidance?_

---

### 10. Dual Vulnerability Scanning with False Positive Management

**Confidence:** High
**Frequency:** High -- all deployed applications. Multiple PRs demonstrate ongoing maintenance.
**Source PRs:** #5117, #5145, #5156

**Proposed Rule:**
> ALWAYS run vulnerability scans (Trivy + Anchore/Grype + Dockle) on all deployed container images. ALWAYS manage false positives through `TRIVY_SKIP_FILES`, `.trivyignore`, and `.dockleignore` rather than disabling scans. ALWAYS use the staging bypass (`fail_on_vulns: false` for staging) so deployments to staging are not blocked by known vulnerabilities.

**Rationale:**
Multiple scanning tools provide defense in depth. False positives are inevitable with container scanning, and the team documents each suppression with comments linking to upstream issues. The staging bypass allows developers to continue testing while security issues are being addressed.

**Code Examples:**
```yaml
# From PR #5145 — managing Trivy false positive for PyJWT (vulnerability-scans-nofos.yml)
        env:
          TRIVY_SKIP_JAVA_DB_UPDATE: true
          # PyJWT has an example with a fake JWT that Trivy flags.
          # see: https://github.com/aquasecurity/trivy/discussions/5772
          TRIVY_SKIP_FILES: "/app/.venv/lib/python*/site-packages/PyJWT-*.dist-info/METADATA"
```

```yaml
# From PR #5156 — creating a .dockleignore for the latest-tag warning
      - name: Create temporary .dockleignore
        run: echo "DKL-DI-0006" > .dockleignore
```

```yaml
# From PR #5117 — upgrading Anchore/Grype from v4 to v6
-        uses: anchore/scan-action@v4
+        uses: anchore/scan-action@v6
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should there be a policy for periodic review of `.trivyignore` / `.dockleignore` entries to ensure suppressions are still valid? (See also cross-domain GAP-7: No Dependency Update Policy.)_

---

### 11. Guard Against Null `inputs` on Push-Triggered Workflows

**Confidence:** High
**Frequency:** Critical bug fix applied to 3 files simultaneously in PR #8402.
**Source PRs:** #8402

**Proposed Rule:**
> ALWAYS handle the case where `inputs.environment` is `null` in CD workflow expressions. On `push` events, `workflow_dispatch` inputs are not set, so any expression referencing `inputs.environment` MUST include a null check (e.g., `inputs.environment != null && ...`). ALWAYS apply such fixes across all CD workflow files simultaneously.

**Rationale:**
The `inputs` context is only populated for `workflow_dispatch` and `workflow_call` events. On `push` events, `inputs.environment` is `null`, causing `fromJSON(null)` to fail. This is a recurring source of bugs in the environment matrix expression.

**Code Examples:**
```yaml
# From PR #8402 — fixing null input handling in fail_on_vulns expression
# (applied identically to cd-api.yml, cd-analytics.yml, cd-frontend.yml)

# Before (broken on push events):
      fail_on_vulns: ${{ ! contains(fromJSON(inputs.environment), 'staging') }}

# After (null-safe):
      fail_on_vulns: ${{ ! contains(fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.ref_name == 'main' && '["staging"]' || '["dev"]'), 'staging') }}
```

**Conflicting Examples:**
This is itself an anti-pattern accumulating technical debt. The environment matrix ternary is now deeply nested and has caused multiple bugs.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: This is an anti-pattern accumulating technical debt. The environment matrix ternary is deeply nested and has caused multiple bugs. Should it be refactored into a composite action or a shell script that outputs the environment list?_

---

### 12. E2E Test Sharding with Merged Report Creation

**Confidence:** High
**Frequency:** High -- central e2e test strategy. Shards increased from 3 to 4 in PR #4922, report creation extracted as reusable workflow in PR #8446.
**Source PRs:** #4922, #8446

**Proposed Rule:**
> ALWAYS shard Playwright e2e tests using a matrix strategy with 4 shards. ALWAYS produce blob reports from each shard and merge them into a single HTML report via a separate `create-report` job. Use `if: ${{ !cancelled() }}` on the report job to ensure reports are generated even when some shards fail.

**Rationale:**
Sharding distributes long-running e2e tests across parallel runners, reducing total CI time. Merged reports provide a single artifact for debugging failures.

**Code Examples:**
```yaml
# From PR #4922 — increasing shards from 3 to 4
    strategy:
      matrix:
-        shard: [1, 2, 3]
-        total_shards: [3]
+        shard: [1, 2, 3, 4]
+        total_shards: [4]
```

```yaml
# From PR #8446 — merged report creation as reusable workflow
  create-report:
    name: Create Merged Test Report
    if: ${{ !cancelled() }}
    needs: e2e-tests-deployed
    uses: ./.github/workflows/e2e-create-report.yml
    secrets: inherit
    with:
      run_id: ${{ github.run_id }}
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Is 4 shards optimal? As the test suite grows, should the shard count be made configurable via workflow inputs?_

---

### 13. E2E Spoofed Login for Auth-Dependent Tests

**Confidence:** High
**Frequency:** Established in PR #6318, used by all subsequent authenticated e2e tests.
**Source PRs:** #6318

**Proposed Rule:**
> ALWAYS use spoofed session cookies for e2e tests that require authenticated users, rather than scripting the actual login.gov authentication flow. The API MUST generate an e2e auth token during database seeding, and the frontend MUST inject it as a session cookie via `createSpoofedSessionCookie`.

**Rationale:**
Scripting real login.gov authentication in CI was unreliable (undiagnosed auth flow issues in CI environments). Spoofed cookies provide deterministic, fast authentication that bypasses external dependencies.

**Code Examples:**
```typescript
// From PR #6318 — spoofed login implementation (frontend/tests/e2e/loginUtils.ts)
export const createSpoofedSessionCookie = async (context: BrowserContext) => {
  const token = await generateSpoofedSession();
  await context.addCookies([
    {
      name: "session",
      value: token,
      url: "http://localhost:3000",
    },
  ]);
};
```

```typescript
// From PR #6318 — usage in test (saved-opportunities.spec.ts)
test("shows save / search cta if logged in", async ({ page, context }, {
  project,
}) => {
  await createSpoofedSessionCookie(context);
  await page.goto("http://localhost:3000/?_ff=authOn:true");
```

**Conflicting Examples:**
The staging e2e tests appear to use real login credentials (secrets for `STAGING_TEST_USER_EMAIL/PASSWORD/MFA_KEY`). Local e2e uses spoofed login; deployed e2e uses real auth.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Is there a plan to also spoof login for staged environments, or is real auth required for those tests?_

---

### 14. Governance Linters as Event-Driven Workflows

**Confidence:** High
**Frequency:** High -- substantial investment across PRs #5130, #5164, #5206, #6417, #6446, #6467, #6569.
**Source PRs:** #5164, #5206

**Proposed Rule:**
> ALWAYS implement project governance automation (milestone propagation, deliverable field inheritance, sprint rollover) as shell scripts under `.github/linters/scripts/` with corresponding workflow files under `.github/workflows/lint-*.yml`. ALWAYS support `--dry-run` mode and ALWAYS test linter scripts in CI via `ci-project-linters.yml` using dry-run against known test issues.

**Rationale:**
Event-driven linters automate repetitive project management tasks. Dry-run mode enables CI testing without side effects. However, this pattern has a known gap: dry-run mode cannot validate that the workflow has sufficient write permissions (see Pattern 15).

**Code Examples:**
```bash
# From PR #5164 — linter script with dry-run support (inherit-parent-milestone.sh)
#!/usr/bin/env bash
set -euo pipefail

log() { echo "[info] $1"; }
err() { echo "[error] $1" >&2; exit 1; }

dry_run=false
# ... argument parsing ...

if [[ "$dry_run" == "true" ]]; then
  log "[DRY RUN] Would update issue #$issue_number milestone to \"$parent_milestone_title\""
else
  gh issue edit \
    --repo "$issue_repo" \
    --milestone "$parent_milestone_title" \
    "$issue_number"
fi
```

```yaml
# From PR #5164 — CI testing of linter scripts (ci-project-linters.yml)
      - name: Dry run - Inherit parent milestone
        run: |
          ./scripts/inherit-parent-milestone.sh "${ISSUE_WITH_PARENT}" \
            --dry-run

      - name: Dry run - Propagate milestone to sub-issues
        run: |
          ./scripts/propagate-milestone-to-sub-issues.sh "${ISSUE_WITH_SUB_ISSUES}" \
            --dry-run
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should there be a write-mode integration test (perhaps against a sandbox repo) to catch permission issues before they hit production?_

---

### 15. Explicit Minimal Permissions with Dry-Run Gap

**Confidence:** High
**Frequency:** Moderate -- present in all linter workflows. PR #6277 was a corrective fix for this specific gap.
**Source PRs:** #6277

**Proposed Rule:**
> ALWAYS declare explicit `permissions:` blocks in workflow files, requesting only the minimum access needed. NEVER assume `issues: read` is sufficient when the workflow updates issue fields -- verify that write operations work before merging to main.

**Rationale:**
Minimal permissions follow the principle of least privilege. However, dry-run testing creates a blind spot where permission issues are not caught until the workflow runs in production mode.

**Code Examples:**
```yaml
# From PR #6277 — fixing insufficient permissions (coplanning-sync-fider-to-gh.yml)
 permissions:
-  issues: read
+  issues: write
```

Author's explanation: _"This wasn't caught by the CI previously because we only run the script in --dry-run mode which logs the issues that will be updated but doesn't actually attempt to update the issue body."_

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should the team implement a periodic integration test that runs linter scripts with actual write permissions against a test repository?_

---

### 16. Cross-Repo Deployment Requires Special Pipeline

**Confidence:** High
**Frequency:** NOFOs-specific but represents a critical architectural constraint. PR #8548 broke the nofos pipeline by using the generic deploy workflow, and PR #8799 had to restore the nofos-specific pipeline.
**Source PRs:** #8548, #8799

**Proposed Rule:**
> NEVER use the generic `deploy.yml` workflow for applications sourced from external repositories. Applications without a source directory in the monorepo (e.g., NOFOs from HHS/simpler-grants-pdf-builder) MUST use a dedicated `deploy-{app}.yml` workflow that handles external repository checkout, Docker image caching, and non-standard build paths.

**Rationale:**
The generic deploy workflow assumes the application source code exists as a directory in the monorepo. External apps break this assumption. This was a regression caught only after the deploy failed in production.

**Code Examples:**
```yaml
# From PR #8799 — restoring the nofos-specific deploy pipeline after template-infra migration broke it
# cd-nofos.yml restored to use nofos-specific pipeline
  deploy:
    name: Deploy
-    uses: ./.github/workflows/deploy.yml
+    needs: [checks, vulnerability-scans]
+    uses: ./.github/workflows/deploy-nofos.yml
    with:
-      app_name: nofos
      environment: ${{ inputs.environment || 'dev' }}
-      version: ${{ inputs.version || 'main' }}
+      version: ${{ inputs.version || github.ref || 'main' }}
```

PR body: _"The generic build-and-publish.yml fails with `fatal: ambiguous argument 'nofos': unknown revision or path not in the working tree` because it expects a `nofos/` directory."_

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open questions: (1) Should there be a CI check or test that validates cross-repo workflows can resolve their source directories before merge? (2) As more external apps may be added, should there be a standardized "external app deploy" workflow template?_

---

### 17. Avoid Bundling Unrelated Changes in CD PRs

**Confidence:** Medium
**Frequency:** Occasional -- flagged by reviewers in PR #4869.
**Source PRs:** #4869

**Proposed Rule:**
> NEVER bundle unrelated changes (e.g., infrastructure capacity changes) with CD workflow modifications. Each PR touching CD workflows should be focused on a single concern to maintain clear change tracking and reviewability.

**Rationale:**
Mixed-concern PRs make it harder to understand the intent of a change, complicate rollbacks, and can lead to unintended side effects.

**Code Examples:**
```yaml
# From PR #4869 — re-enabling dev deploys bundled with database capacity changes across 8 files
# .github/workflows/cd-api.yml (the CD change)
-        # dev deploys disabled so the ...
-        envs: ${{ ... || github.ref_name == 'main' && '["staging"]' || '["staging"]')  }}
-        # envs: ${{ ... || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]')  }}
+        envs: ${{ ... || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]')  }}
```

Author's own review comment on the PR: _"this is unrelated >_>"_

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: This is more of a process guideline than a technical pattern. Should the PR template explicitly ask whether the PR contains only related changes?_

---

### 18. Feature Flags for New API Capabilities in Terraform

**Confidence:** High
**Frequency:** Moderate -- seen in CommonGrants (#6542), Apply endpoints, SOAP API.
**Source PRs:** #6542

**Proposed Rule:**
> ALWAYS gate new API capabilities (endpoints, integrations) behind environment variables set in Terraform configs. Enable in dev/staging first, then prod after validation. The feature flag variable MUST follow the pattern `ENABLE_{FEATURE}_ENDPOINTS = 1`.

**Rationale:**
Feature flags decouple deployment from release, allowing code to be deployed but not activated until ready. Per-environment activation enables staged rollouts.

**Code Examples:**
```terraform
# From PR #6542 — feature flag for CommonGrants endpoints in Terraform
# infra/api/app-config/dev.tf
ENABLE_COMMON_GRANTS_ENDPOINTS = 1
```

```env
# From PR #6542 — local development env var
ENABLE_AUTH_ENDPOINT=TRUE
ENABLE_APPLY_ENDPOINTS=TRUE
ENABLE_COMMON_GRANTS_ENDPOINTS=TRUE
```

**Conflicting Examples:**
Cross-domain inconsistency (INC-1 from Pass 3): The naming is inconsistent between Terraform (`= 1`) and local env (`=TRUE`). Frontend uses `FEATURE_{NAME}_OFF` with SSM-backed secrets. Three different naming patterns and truthy values coexist. There is no centralized registry of feature flags (cross-domain GAP-2).

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open questions: (1) Should there be a standard truthy value across Terraform (`1`), local dev (`TRUE`), and SSM-backed flags? (2) Should a centralized feature flag registry be created? (See cross-domain INC-1 and GAP-2.)_

---

## Coverage Gaps

1. **No local workflow testing capability.** The NOFOs CI setup required 4 sequential fix PRs (#4913, #4943, #4944, #4945), suggesting a lack of local workflow testing. This is a known GitHub Actions limitation but could be partially addressed with `act` or similar tools.

2. **No centralized feature flag registry.** Feature flags are scattered across Terraform configs, SSM parameters, and code references. There is no single view of all active flags, their state per environment, or cleanup status (cross-domain GAP-2).

3. **No dependency update policy.** Vulnerability scanning is well-documented (Pattern 10), but there is no policy for how frequently dependencies are updated, who reviews `.trivyignore` / `.dockleignore` suppressions, or SLA for addressing discovered vulnerabilities (cross-domain GAP-7).

4. **No CODEOWNERS replacement documentation.** PR #8851 removed CODEOWNERS in favor of a GitHub Action-based review assignment model, but the replacement system's behavior and rules are not documented as a formal pattern.

5. **No standardized external app deploy template.** The NOFOs cross-repo deployment pattern (Pattern 16) is ad hoc. If more external apps are added, there is no template to follow.

## Inconsistencies Requiring Resolution

1. **Environment matrix ternary complexity.** The inline ternary expression for environment selection has caused multiple bugs (PR #8402) and is deeply nested. It should be refactored into a reusable action or script. (Pattern 1 / Pattern 11 open question)

2. **E2E workflow naming divergence.** E2E workflows use inconsistent names (`ci-frontend-e2e.yml`, `e2e-staging.yml`) rather than a single prefix pattern. (Pattern 4 open question)

3. **Feature flag naming conventions.** Three different naming patterns coexist: `ENABLE_{FEATURE}_ENDPOINTS = 1` (API Terraform), `FEATURE_{NAME}_OFF` (frontend SSM), `ENABLE_{FEATURE}=TRUE` (local dev). These should be unified. (Pattern 18 open question; cross-domain INC-1)

4. **Self-referencing workflow paths.** Some workflows include their own file in the `paths:` filter; others do not. This is inconsistent. (Pattern 5 open question)

5. **`grantee1` environment scope.** This environment appears only in the nofos workflow. Its relationship to the standard promotion chain is unclear. (Pattern 6 open question)

6. **Docker image caching vs. artifacts.** The NOFOs pipeline uses `actions/cache` for cross-job Docker image passing. Whether `actions/upload-artifact`/`actions/download-artifact` would be more reliable has not been evaluated. (Pattern 8 open question)

7. **Spoofed vs. real auth in e2e.** Local e2e tests use spoofed session cookies; staging e2e tests use real login credentials. Whether this is intentional variation or a gap to close is undocumented. (Pattern 13 open question)

8. **Dry-run permission testing gap.** CI only runs linter scripts in `--dry-run` mode, which cannot detect insufficient workflow permissions. PR #6277 was a real-world failure caused by this gap. (Pattern 14 / Pattern 15 open question)

9. **Composite action directory structure.** There is no consistent naming or directory pattern for composite actions under `.github/actions/`. (Pattern 3 open question)
