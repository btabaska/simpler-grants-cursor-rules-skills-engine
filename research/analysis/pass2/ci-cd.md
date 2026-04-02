# CI/CD Workflow Patterns -- Pattern Codification (Pass 2)

> **Source:** Pass 1 discovery document + review of 18 representative PRs from the ci-cd domain
> **PR corpus:** 124 merged PRs touching `.github/` in HHS/simpler-grants-gov
> **Date range:** ~2025-04-02 to 2026-03-10
> **Analysis date:** 2026-03-30

---

## Pattern 1: Per-Application CD Workflow with Serialized Environment Matrix

### Rule Statement
ALWAYS structure each deployable application's CD workflow (`cd-{app}.yml`) as a three-job pipeline: `checks -> deploy -> send-slack-notification`. The deploy job MUST use `max-parallel: 1` and `fail-fast: false` to serialize environment deployments.

### Confidence
High

### Frequency
Universal -- present in all 4 CD workflows (cd-api, cd-analytics, cd-frontend, cd-nofos). Every CD-related PR maintains this structure.

### Code Examples

**PR #6299** -- Adding training environment to the serialized matrix (cd-api.yml):
```yaml
    strategy:
      max-parallel: 1
      fail-fast: false
      matrix:
        envs: ${{ fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.event_name == 'release' && '["prod", "training"]' || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]')  }}
```

**PR #5022** -- NOFOs CD following the same three-job pattern (cd-nofos.yml):
```yaml
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

### Rationale
Serialized deployments (`max-parallel: 1`) prevent race conditions in Terraform state and ensure that if a lower environment fails, higher environments are not skipped but still processed sequentially. `fail-fast: false` ensures one environment failure does not cancel other deployments.

### Open Questions
- The environment matrix ternary expression has become a maintenance liability (see Pattern 11). Should the matrix logic be extracted to a shared reusable action or a script that outputs the environment list?

---

## Pattern 2: Reusable Workflow Composition via `workflow_call`

### Rule Statement
ALWAYS extract shared CI/CD logic into reusable workflows (invoked via `uses: ./.github/workflows/{name}.yml`) when the same job-level logic is needed by more than one workflow. NEVER duplicate multi-step job definitions across workflow files.

### Confidence
High

### Frequency
High -- 15+ workflows use `workflow_call`. Key reusable workflows include `vulnerability-scans.yml`, `build-and-publish.yml`, `deploy.yml`, `deploy-nofos.yml`, `send-slack-notification.yml`, `e2e-create-report.yml`.

### Code Examples

**PR #8446** -- Extracting e2e report creation as a reusable workflow:
```yaml
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

**PR #8754** -- Consuming the reusable workflow from ci-frontend-e2e.yml:
```yaml
  create-report:
    name: Create Merged Test Report
    if: ${{ !cancelled() }}
    needs: e2e-tests-local
    uses: ./.github/workflows/e2e-create-report.yml
    secrets: inherit
    with:
      run_id: ${{ github.run_id }}
```

### Rationale
Reusable workflows reduce duplication and ensure consistency across deployment pipelines. When a shared process changes (e.g., vulnerability scanning tool version), it only needs updating in one place.

### Open Questions
- None. This pattern is well-established and consistently applied.

---

## Pattern 3: Composite Actions for Shared Step-Level Logic

### Rule Statement
ALWAYS use composite actions under `.github/actions/` for step-level reuse across workflows. When the same sequence of steps appears in multiple jobs, extract it into a composite action with configurable inputs.

### Confidence
High

### Frequency
Moderate and growing -- currently 3 composite actions (`e2e/action.yml`, `configure-aws-credentials/`, `setup-terraform/`), with the e2e action being the most recently developed.

### Code Examples

**PR #8446** -- Creating the e2e composite action:
```yaml
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

**PR #8754** -- Adding optional flags (`needs_node_setup`, `api_logs`) to the composite action:
```yaml
  needs_node_setup:
    description: "does this action need to set up node and install deps"
    default: "true"
  api_logs:
    description: "print api logs on failure?"
    default: "false"
```

### Rationale
Composite actions sit between reusable workflows (job-level) and raw step duplication (step-level). They are the right abstraction when the same steps are needed within different job contexts, especially across local vs deployed e2e tests.

### Open Questions
- Should all composite actions follow a consistent naming/directory pattern? Currently the structure under `.github/actions/` is ad hoc.

---

## Pattern 4: `ci-{app}` / `cd-{app}` Naming Convention

### Rule Statement
ALWAYS name CI check workflows `ci-{app}.yml` and CD deploy workflows `cd-{app}.yml`. Supporting workflows MUST use descriptive prefixes: `deploy-{app}.yml` for deployment execution, `vulnerability-scans-{app}.yml` for scanning, `e2e-{target}.yml` for e2e test targets, and `lint-{description}.yml` for governance linters.

### Confidence
High

### Frequency
Universal -- all 124 PRs in this domain follow or extend this convention.

### Code Examples

**PR #4913** -- Initial creation of ci-nofos (note: initially had wrong name "API Checks", fixed in PR #4943):
```yaml
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

**PR #8769** -- E2E workflow name evolution following the convention:
```yaml
name: E2E Tests (Local Github Target)  # Evolved from "Frontend E2E Tests" -> "E2E Tests (Local)"
```

### Rationale
Consistent naming enables quick identification of workflow purpose in the GitHub Actions UI, path-based CODEOWNERS rules (when that was active), and mental mapping between application directories and their CI/CD pipelines.

### Open Questions
- The naming for e2e workflows diverges slightly (`ci-frontend-e2e.yml`, `e2e-staging.yml`). Should these be standardized to something like `e2e-local.yml` / `e2e-staging.yml`?

---

## Pattern 5: Path-Filtered Triggers with Shared Module Inclusion

### Rule Statement
ALWAYS include `paths:` filters on `push` triggers for CD workflows to limit deployments to relevant code changes. ALWAYS include `infra/modules/**` in the paths filter for all service CD workflows, since shared Terraform modules can affect any service.

### Confidence
High

### Frequency
Universal across all CD workflows. PR #4920 was a corrective fix that established the shared modules requirement.

### Code Examples

**PR #4920** -- Adding shared modules to all CD workflow triggers:
```yaml
# cd-api.yml
on:
  push:
    branches: ["main"]
    paths:
      - "api/**"
      - "infra/api/**"
      - "infra/modules/**"    # <-- Added in PR #4920
```

**PR #8769** -- E2E workflow covering both api and frontend paths:
```yaml
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

### Rationale
In a monorepo, path filters prevent unnecessary deployments when unrelated code changes. The shared modules fix (#4920) addressed a real bug where Terraform module changes were not triggering dependent service deployments.

### Open Questions
- Should the workflow file itself (e.g., `.github/workflows/cd-api.yml`) always be included in its own paths filter? Some workflows include this, others do not.

---

## Pattern 6: Environment Promotion Chain with Prod-First Ordering

### Rule Statement
ALWAYS follow the environment promotion chain: push-to-main deploys to `["dev", "staging"]`, release deploys to `["prod", "training"]`. In the release matrix, ALWAYS list `"prod"` before `"training"` to avoid blocking production fixes on training deployments.

### Confidence
High

### Frequency
High -- all CD workflows follow this pattern. The prod-first ordering was explicitly requested in PR #6299 review.

### Code Examples

**PR #6299** -- Reviewer requesting prod-first ordering:
```yaml
# Before review (training listed first):
envs: ${{ ... || github.event_name == 'release' && '["training", "prod"]' || ... }}

# After review (prod moved first):
envs: ${{ ... || github.event_name == 'release' && '["prod", "training"]' || ... }}
```

Reviewer comment (mdragon): _"I think the order here matters and we'd want Prod to be first so that we're not waiting on Training if we're fixing downtime, etc."_

**PR #8887** -- Scheduled daily staging e2e runs:
```yaml
  schedule:
    # Run every day at (6/7am Eastern) before the start of the workday
    - cron: "0 11 * * *"
```

### Rationale
Serialized deployments with `max-parallel: 1` mean ordering directly impacts time-to-production. Prod must come first so that production incidents are not delayed by non-critical environment deployments.

### Open Questions
- The `grantee1` environment appears in the nofos workflow (PR #8799) but not in other CD workflows. Is this a nofos-only environment, or should it be added to the standard promotion chain?

---

## Pattern 7: Concurrency Controls for Deploy Isolation

### Rule Statement
ALWAYS set a `concurrency` group on deploy workflows keyed to the environment name to prevent overlapping deployments. For CI workflows, use `cancel-in-progress: true` to save resources on superseded runs.

### Confidence
High

### Frequency
High -- present in all deploy and e2e workflows.

### Code Examples

**PR #5022** -- Deploy-level concurrency keyed to environment (deploy-nofos.yml):
```yaml
concurrency: cd-nofos-${{ inputs.environment || 'dev' }}
```

**PR #8446** -- E2E test concurrency with cancel-in-progress:
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Rationale
Overlapping Terraform applies to the same environment can corrupt state or cause deployment failures. Concurrency groups ensure only one deployment runs per environment at a time. CI cancellation saves compute costs when a newer commit supersedes an in-progress check.

### Open Questions
- None. This is a well-understood best practice.

---

## Pattern 8: Docker Image Caching Between CI and CD Jobs

### Rule Statement
When deploying an application from an external repository, ALWAYS use `actions/cache/save` and `actions/cache/restore` to pass Docker images between CI (build/test) and CD (deploy) jobs. ALWAYS include `github.run_id` in the cache key to prevent stale images from being deployed on workflow re-runs.

### Confidence
High

### Frequency
NOFOs-specific but architecturally significant. PR #5071 was a corrective fix for stale cache key.

### Code Examples

**PR #5022** -- Initial cache implementation (ci-nofos.yml):
```yaml
      - name: Cache Docker image
        uses: actions/cache/save@v4
        with:
          path: /tmp/docker-image.tar
          key: nofos-image-${{ github.sha }}
```

**PR #5071** -- Adding `run_id` for uniqueness:
```yaml
          key: nofos-image-${{ github.sha }}-${{ github.run_id }}
```

Reviewer exchange (mdragon/pcraig3): _"Wouldn't this be a different run because you're kicking the deploy manually after the ci has run automatically?" / "When we kick off a manual run, it runs the ci and then deploy actions, so it's the same id for both. We just tested this also and it works."_

### Rationale
For external apps (like NOFOs from HHS/simpler-grants-pdf-builder), Docker images must be built once in CI and reused in deploy. Without `run_id`, re-running a workflow would pick up a stale cached image from a previous run with the same SHA.

### Open Questions
- Is `actions/cache` the best mechanism here, or would `actions/upload-artifact`/`actions/download-artifact` be more reliable for cross-job artifact passing within the same run?

---

## Pattern 9: App-Specific Git Hashes for Smart Container Reuse

### Rule Statement
ALWAYS use the most recent commit hash within each application's folder (not the repo-level HEAD) when determining whether a container image already exists. This requires `fetch-depth: 1000` on the checkout action.

### Confidence
Medium

### Frequency
One significant PR (#5189), but affects all platform app build-and-publish flows.

### Code Examples

**PR #5189** -- Using app-folder-specific commit hash (build-and-publish.yml):
```yaml
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

### Rationale
In a monorepo, the top-level git hash changes with every merge, even if only one app was modified. Using app-folder-specific hashes avoids unnecessary rebuilds for unchanged apps during production releases that deploy all services.

### Open Questions
- The `fetch-depth: 1000` is a heuristic. Should this be made configurable or is 1000 sufficient for all foreseeable cases?
- Should the `is-image-published` script be unit tested, given its critical role in build avoidance?

---

## Pattern 10: Dual Vulnerability Scanning with False Positive Management

### Rule Statement
ALWAYS run vulnerability scans (Trivy + Anchore/Grype + Dockle) on all deployed container images. ALWAYS manage false positives through `TRIVY_SKIP_FILES`, `.trivyignore`, and `.dockleignore` rather than disabling scans. ALWAYS use the staging bypass (`fail_on_vulns: false` for staging) so deployments to staging are not blocked by known vulnerabilities.

### Confidence
High

### Frequency
High -- all deployed applications. Multiple PRs (#5117, #5145, #5156) demonstrate the ongoing maintenance of this pattern.

### Code Examples

**PR #5145** -- Managing Trivy false positive for PyJWT (vulnerability-scans-nofos.yml):
```yaml
        env:
          TRIVY_SKIP_JAVA_DB_UPDATE: true
          # PyJWT has an example with a fake JWT that Trivy flags.
          # see: https://github.com/aquasecurity/trivy/discussions/5772
          TRIVY_SKIP_FILES: "/app/.venv/lib/python*/site-packages/PyJWT-*.dist-info/METADATA"
```

**PR #5156** -- Creating a `.dockleignore` for the latest-tag warning:
```yaml
      - name: Create temporary .dockleignore
        run: echo "DKL-DI-0006" > .dockleignore
```

**PR #5117** -- Upgrading Anchore/Grype from v4 to v6:
```yaml
-        uses: anchore/scan-action@v4
+        uses: anchore/scan-action@v6
```

### Rationale
Multiple scanning tools provide defense in depth. False positives are inevitable with container scanning, and the team documents each suppression with comments linking to upstream issues. The staging bypass allows developers to continue testing while security issues are being addressed.

### Open Questions
- Should there be a policy for periodic review of `.trivyignore` / `.dockleignore` entries to ensure suppressions are still valid?

---

## Pattern 11: Guard Against Null `inputs` on Push-Triggered Workflows

### Rule Statement
ALWAYS handle the case where `inputs.environment` is `null` in CD workflow expressions. On `push` events, `workflow_dispatch` inputs are not set, so any expression referencing `inputs.environment` MUST include a null check (e.g., `inputs.environment != null && ...`). ALWAYS apply such fixes across all CD workflow files simultaneously.

### Confidence
High

### Frequency
Critical bug fix applied to 3 files simultaneously in PR #8402.

### Code Examples

**PR #8402** -- Fixing null input handling in fail_on_vulns expression (applied identically to cd-api.yml, cd-analytics.yml, cd-frontend.yml):
```yaml
# Before (broken on push events):
      fail_on_vulns: ${{ ! contains(fromJSON(inputs.environment), 'staging') }}

# After (null-safe):
      fail_on_vulns: ${{ ! contains(fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.ref_name == 'main' && '["staging"]' || '["dev"]'), 'staging') }}
```

### Rationale
The `inputs` context is only populated for `workflow_dispatch` and `workflow_call` events. On `push` events, `inputs.environment` is `null`, causing `fromJSON(null)` to fail. This is a recurring source of bugs in the environment matrix expression.

### Open Questions
- **This is an anti-pattern accumulating technical debt.** The environment matrix ternary is now deeply nested and has caused multiple bugs. Should it be refactored into a composite action or a shell script that outputs the environment list?

---

## Pattern 12: E2E Test Sharding with Merged Report Creation

### Rule Statement
ALWAYS shard Playwright e2e tests using a matrix strategy with 4 shards. ALWAYS produce blob reports from each shard and merge them into a single HTML report via a separate `create-report` job. Use `if: ${{ !cancelled() }}` on the report job to ensure reports are generated even when some shards fail.

### Confidence
High

### Frequency
High -- central e2e test strategy. Shards increased from 3 to 4 in PR #4922, report creation extracted as reusable workflow in PR #8446.

### Code Examples

**PR #4922** -- Increasing shards from 3 to 4:
```yaml
    strategy:
      matrix:
-        shard: [1, 2, 3]
-        total_shards: [3]
+        shard: [1, 2, 3, 4]
+        total_shards: [4]
```

**PR #8446** -- Merged report creation as reusable workflow:
```yaml
  create-report:
    name: Create Merged Test Report
    if: ${{ !cancelled() }}
    needs: e2e-tests-deployed
    uses: ./.github/workflows/e2e-create-report.yml
    secrets: inherit
    with:
      run_id: ${{ github.run_id }}
```

### Rationale
Sharding distributes long-running e2e tests across parallel runners, reducing total CI time. Merged reports provide a single artifact for debugging failures.

### Open Questions
- Is 4 shards optimal? As the test suite grows, should the shard count be made configurable via workflow inputs?

---

## Pattern 13: E2E Spoofed Login for Auth-Dependent Tests

### Rule Statement
ALWAYS use spoofed session cookies for e2e tests that require authenticated users, rather than scripting the actual login.gov authentication flow. The API MUST generate an e2e auth token during database seeding, and the frontend MUST inject it as a session cookie via `createSpoofedSessionCookie`.

### Confidence
High

### Frequency
Established in PR #6318, used by all subsequent authenticated e2e tests.

### Code Examples

**PR #6318** -- Spoofed login implementation (frontend/tests/e2e/loginUtils.ts):
```typescript
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

**PR #6318** -- Usage in test (saved-opportunities.spec.ts):
```typescript
test("shows save / search cta if logged in", async ({ page, context }, {
  project,
}) => {
  await createSpoofedSessionCookie(context);
  await page.goto("http://localhost:3000/?_ff=authOn:true");
```

### Rationale
Scripting real login.gov authentication in CI was unreliable (undiagnosed auth flow issues in CI environments). Spoofed cookies provide deterministic, fast authentication that bypasses external dependencies.

### Open Questions
- The staging e2e tests appear to use real login credentials (secrets for `STAGING_TEST_USER_EMAIL/PASSWORD/MFA_KEY`). Is there a plan to also spoof login for staged environments, or is real auth required for those tests?

---

## Pattern 14: Governance Linters as Event-Driven Workflows

### Rule Statement
ALWAYS implement project governance automation (milestone propagation, deliverable field inheritance, sprint rollover) as shell scripts under `.github/linters/scripts/` with corresponding workflow files under `.github/workflows/lint-*.yml`. ALWAYS support `--dry-run` mode and ALWAYS test linter scripts in CI via `ci-project-linters.yml` using dry-run against known test issues.

### Confidence
High

### Frequency
High -- substantial investment across PRs #5130, #5164, #5206, #6417, #6446, #6467, #6569.

### Code Examples

**PR #5164** -- Linter script with dry-run support (inherit-parent-milestone.sh):
```bash
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

**PR #5164** -- CI testing of linter scripts (ci-project-linters.yml):
```yaml
      - name: Dry run - Inherit parent milestone
        run: |
          ./scripts/inherit-parent-milestone.sh "${ISSUE_WITH_PARENT}" \
            --dry-run

      - name: Dry run - Propagate milestone to sub-issues
        run: |
          ./scripts/propagate-milestone-to-sub-issues.sh "${ISSUE_WITH_SUB_ISSUES}" \
            --dry-run
```

### Rationale
Event-driven linters automate repetitive project management tasks. Dry-run mode enables CI testing without side effects. However, this pattern has a known gap: dry-run mode cannot validate that the workflow has sufficient write permissions (see Pattern 15).

### Open Questions
- Should there be a write-mode integration test (perhaps against a sandbox repo) to catch permission issues before they hit production?

---

## Pattern 15: Explicit Minimal Permissions with Dry-Run Gap

### Rule Statement
ALWAYS declare explicit `permissions:` blocks in workflow files, requesting only the minimum access needed. NEVER assume `issues: read` is sufficient when the workflow updates issue fields -- verify that write operations work before merging to main.

### Confidence
High

### Frequency
Moderate -- present in all linter workflows. PR #6277 was a corrective fix for this specific gap.

### Code Examples

**PR #6277** -- Fixing insufficient permissions (coplanning-sync-fider-to-gh.yml):
```yaml
 permissions:
-  issues: read
+  issues: write
```

Author's explanation: _"This wasn't caught by the CI previously because we only run the script in --dry-run mode which logs the issues that will be updated but doesn't actually attempt to update the issue body."_

### Rationale
Minimal permissions follow the principle of least privilege. However, dry-run testing creates a blind spot where permission issues are not caught until the workflow runs in production mode.

### Open Questions
- Should the team implement a periodic integration test that runs linter scripts with actual write permissions against a test repository?

---

## Pattern 16: Cross-Repo Deployment Requires Special Pipeline

### Rule Statement
NEVER use the generic `deploy.yml` workflow for applications sourced from external repositories. Applications without a source directory in the monorepo (e.g., NOFOs from HHS/simpler-grants-pdf-builder) MUST use a dedicated `deploy-{app}.yml` workflow that handles external repository checkout, Docker image caching, and non-standard build paths.

### Confidence
High

### Frequency
NOFOs-specific but this represents a critical architectural constraint. PR #8548 broke the nofos pipeline by using the generic deploy workflow, and PR #8799 had to restore the nofos-specific pipeline.

### Code Examples

**PR #8799** -- Restoring the nofos-specific deploy pipeline after template-infra migration broke it:
```yaml
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

### Rationale
The generic deploy workflow assumes the application source code exists as a directory in the monorepo. External apps break this assumption. This was a regression caught only after the deploy failed in production.

### Open Questions
- Should there be a CI check or test that validates cross-repo workflows can resolve their source directories before merge?
- As more external apps may be added, should there be a standardized "external app deploy" workflow template?

---

## Pattern 17: Avoid Bundling Unrelated Changes in CD PRs

### Rule Statement
NEVER bundle unrelated changes (e.g., infrastructure capacity changes) with CD workflow modifications. Each PR touching CD workflows should be focused on a single concern to maintain clear change tracking and reviewability.

### Confidence
Medium

### Frequency
Occasional -- flagged by reviewers in PR #4869.

### Code Examples

**PR #4869** -- Re-enabling dev deploys bundled with database capacity changes across 8 files:
```yaml
# .github/workflows/cd-api.yml (the CD change)
-        # dev deploys disabled so the ...
-        envs: ${{ ... || github.ref_name == 'main' && '["staging"]' || '["staging"]')  }}
-        # envs: ${{ ... || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]')  }}
+        envs: ${{ ... || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]')  }}
```

Author's own review comment on the PR: _"this is unrelated >_>"_

### Rationale
Mixed-concern PRs make it harder to understand the intent of a change, complicate rollbacks, and can lead to unintended side effects.

### Open Questions
- This is more of a process guideline than a technical pattern. Should the PR template explicitly ask whether the PR contains only related changes?

---

## Pattern 18: Feature Flags for New API Capabilities in Terraform

### Rule Statement
ALWAYS gate new API capabilities (endpoints, integrations) behind environment variables set in Terraform configs. Enable in dev/staging first, then prod after validation. The feature flag variable MUST follow the pattern `ENABLE_{FEATURE}_ENDPOINTS = 1`.

### Confidence
High

### Frequency
Moderate -- seen in CommonGrants (#6542), Apply endpoints, SOAP API.

### Code Examples

**PR #6542** -- Feature flag for CommonGrants endpoints in Terraform:
```terraform
# infra/api/app-config/dev.tf
ENABLE_COMMON_GRANTS_ENDPOINTS = 1
```

**PR #6542** -- Local development env var:
```env
ENABLE_AUTH_ENDPOINT=TRUE
ENABLE_APPLY_ENDPOINTS=TRUE
ENABLE_COMMON_GRANTS_ENDPOINTS=TRUE
```

### Rationale
Feature flags decouple deployment from release, allowing code to be deployed but not activated until ready. Per-environment activation enables staged rollouts.

### Open Questions
- The naming is inconsistent between Terraform (`= 1`) and local env (`=TRUE`). Should there be a standard truthy value?
- There is no centralized registry of feature flags. Should one be created?

---

## Summary of Rule Confidence Levels

| # | Pattern | Confidence | Key Risk |
|---|---------|------------|----------|
| 1 | Per-app CD with serialized matrix | High | Matrix ternary complexity |
| 2 | Reusable workflows via `workflow_call` | High | None |
| 3 | Composite actions for step reuse | High | Naming convention unclear |
| 4 | `ci-`/`cd-` naming convention | High | E2E naming divergence |
| 5 | Path-filtered triggers + shared modules | High | Self-referencing workflow paths inconsistent |
| 6 | Environment promotion with prod-first | High | `grantee1` env unclear |
| 7 | Concurrency controls | High | None |
| 8 | Docker image caching with `run_id` | High | Cache vs artifact trade-off |
| 9 | App-specific git hashes | Medium | `fetch-depth` heuristic |
| 10 | Dual vuln scanning + false positive mgmt | High | Suppression review cadence |
| 11 | Null input guard on push events | High | **Anti-pattern: ternary debt** |
| 12 | E2E sharding with merged reports | High | Shard count scalability |
| 13 | Spoofed login for e2e | High | Staging uses real auth |
| 14 | Governance linters as event-driven workflows | High | Dry-run permission gap |
| 15 | Explicit minimal permissions | High | Dry-run blind spot |
| 16 | Cross-repo deploy requires special pipeline | High | Regression risk |
| 17 | No unrelated changes in CD PRs | Medium | Process enforcement |
| 18 | Feature flags in Terraform | High | Naming inconsistency |
