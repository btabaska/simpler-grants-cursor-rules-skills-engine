# CI/CD Workflows — Conventions & Rules

> **Status:** Draft — pending tech lead validation. Items marked (⏳) are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The Simpler Grants CI/CD system is built entirely on GitHub Actions, organized around a per-application workflow model. Each deployable application (api, frontend, analytics, nofos) has its own `ci-{app}.yml` and `cd-{app}.yml` workflow pair, following a consistent three-job pipeline structure (checks, deploy, notifications). The deployment pipeline uses serialized environment promotion — push-to-main deploys to dev and staging, release events deploy to prod and training — with Terraform state management requiring strict concurrency controls.

The team has invested heavily in reusable workflow composition via `workflow_call` and composite actions under `.github/actions/`, reducing duplication across the growing number of deployment targets. E2E testing uses Playwright with sharded execution across 4 parallel runners and multi-browser coverage (Chromium, Firefox, WebKit, Mobile Chrome). Spoofed authentication cookies replace real login.gov flows in local E2E tests for reliability.

**mdragon** serves as the primary CI/CD pipeline authority, enforcing deployment ordering and cross-repo patterns. The project governance automation (milestone propagation, deliverable field inheritance, sprint rollover) operates through event-driven linter scripts under `.github/linters/`. For related infrastructure patterns, see [Infrastructure Conventions](infra.md). For cross-cutting feature flag patterns, see [Cross-Domain Conventions](cross-domain.md).

## Rules

### Workflow Structure

#### Rule: Per-Application CD Workflow with Serialized Environment Matrix
**Confidence:** High
**Observed in:** 4 of 4 CD workflows | PR refs: #6299, #5022

ALWAYS structure each deployable application's CD workflow (`cd-{app}.yml`) as a three-job pipeline: `checks -> deploy -> send-slack-notification`. The deploy job MUST use `max-parallel: 1` and `fail-fast: false` to serialize environment deployments.

**DO:**
```yaml
# From PR #5022 — NOFOs CD following the three-job pattern (cd-nofos.yml)
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

**DON'T:**
```yaml
# Anti-pattern — parallel environment deploys risk Terraform state corruption
strategy:
  max-parallel: 4  # WRONG: environments must deploy serially
  fail-fast: true   # WRONG: one failure cancels remaining environments
```

> **Rationale:** Serialized deployments (`max-parallel: 1`) prevent race conditions in Terraform state and ensure that if a lower environment fails, higher environments are not skipped but still processed sequentially. `fail-fast: false` ensures one environment failure does not cancel other deployments.

---

#### Rule: Reusable Workflow Composition via `workflow_call`
**Confidence:** High
**Observed in:** 15+ workflows | PR refs: #8446, #8754

ALWAYS extract shared CI/CD logic into reusable workflows (invoked via `uses: ./.github/workflows/{name}.yml`) when the same job-level logic is needed by more than one workflow. NEVER duplicate multi-step job definitions across workflow files.

**DO:**
```yaml
# From PR #8754 — consuming a reusable workflow from ci-frontend-e2e.yml
  create-report:
    name: Create Merged Test Report
    if: ${{ !cancelled() }}
    needs: e2e-tests-local
    uses: ./.github/workflows/e2e-create-report.yml
    secrets: inherit
    with:
      run_id: ${{ github.run_id }}
```

**DON'T:**
```yaml
# Anti-pattern — duplicating the same multi-step report creation job
# across ci-frontend-e2e.yml, e2e-staging.yml, and other workflows
  create-report:
    steps:
      - name: Download artifacts
        # ... 15 lines of report creation logic duplicated in each file
```

> **Rationale:** Reusable workflows reduce duplication and ensure consistency across deployment pipelines. When a shared process changes (e.g., vulnerability scanning tool version), it only needs updating in one place.

---

#### Rule: Composite Actions for Shared Step-Level Logic
**Confidence:** High
**Observed in:** 3 composite actions, growing | PR refs: #8446, #8754

ALWAYS use composite actions under `.github/actions/` for step-level reuse across workflows. When the same sequence of steps appears in multiple jobs, extract it into a composite action with configurable inputs.

**DO:**
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

**DON'T:**
```yaml
# Anti-pattern — duplicating Playwright setup steps across multiple workflow files
# instead of extracting into a composite action
```

> **Rationale:** Composite actions sit between reusable workflows (job-level) and raw step duplication (step-level). They are the right abstraction when the same steps are needed within different job contexts, especially across local vs deployed e2e tests.

---

#### Rule: `ci-{app}` / `cd-{app}` Naming Convention
**Confidence:** High
**Observed in:** 124 of 124 PRs | PR refs: #4913, #8769

ALWAYS name CI check workflows `ci-{app}.yml` and CD deploy workflows `cd-{app}.yml`. Supporting workflows MUST use descriptive prefixes: `deploy-{app}.yml` for deployment execution, `vulnerability-scans-{app}.yml` for scanning, `e2e-{target}.yml` for e2e test targets, and `lint-{description}.yml` for governance linters.

**DO:**
```yaml
# From PR #4913 — following the naming convention
# .github/workflows/ci-nofos.yml
name: NOFOs Checks
```

**DON'T:**
```yaml
# Anti-pattern — misleading workflow name (was initially "API Checks" for NOFOs CI)
# PR #4943 fixed this from "API Checks" to "NOFOs Checks"
name: API Checks  # WRONG: this is the NOFOs CI workflow, not API
```

> **Rationale:** Consistent naming enables quick identification of workflow purpose in the GitHub Actions UI, path-based rules, and mental mapping between application directories and their CI/CD pipelines.

---

### Deployment Patterns

#### Rule: Path-Filtered Triggers with Shared Module Inclusion
**Confidence:** High
**Observed in:** All CD workflows | PR refs: #4920, #8769

ALWAYS include `paths:` filters on `push` triggers for CD workflows to limit deployments to relevant code changes. ALWAYS include `infra/modules/**` in the paths filter for all service CD workflows, since shared Terraform modules can affect any service.

**DO:**
```yaml
# From PR #4920 — adding shared modules to all CD workflow triggers
# cd-api.yml
on:
  push:
    branches: ["main"]
    paths:
      - "api/**"
      - "infra/api/**"
      - "infra/modules/**"    # Added in PR #4920
```

**DON'T:**
```yaml
# Anti-pattern — missing infra/modules/** causes shared module changes
# to not trigger dependent service deployments
on:
  push:
    branches: ["main"]
    paths:
      - "api/**"
      - "infra/api/**"
      # WRONG: missing infra/modules/** — shared module changes won't trigger deploy
```

> **Rationale:** In a monorepo, path filters prevent unnecessary deployments when unrelated code changes. The shared modules fix (#4920) addressed a real bug where Terraform module changes were not triggering dependent service deployments.

---

#### Rule: Environment Promotion Chain with Prod-First Ordering
**Confidence:** High
**Observed in:** All CD workflows | PR refs: #6299

ALWAYS follow the environment promotion chain: push-to-main deploys to `["dev", "staging"]`, release deploys to `["prod", "training"]`. In the release matrix, ALWAYS list `"prod"` before `"training"` to avoid blocking production fixes on training deployments.

**DO:**
```yaml
# From PR #6299 — prod-first ordering after reviewer feedback
envs: ${{ ... || github.event_name == 'release' && '["prod", "training"]' || ... }}
```

**DON'T:**
```yaml
# Anti-pattern — training before prod delays production fixes
envs: ${{ ... || github.event_name == 'release' && '["training", "prod"]' || ... }}
# Reviewer mdragon: "I think the order here matters and we'd want Prod to be first
# so that we're not waiting on Training if we're fixing downtime, etc."
```

> **Rationale:** Serialized deployments with `max-parallel: 1` mean ordering directly impacts time-to-production. Prod must come first so that production incidents are not delayed by non-critical environment deployments.

---

#### Rule: Concurrency Controls for Deploy Isolation
**Confidence:** High
**Observed in:** All deploy and e2e workflows | PR refs: #5022, #8446

ALWAYS set a `concurrency` group on deploy workflows keyed to the environment name to prevent overlapping deployments. For CI workflows, use `cancel-in-progress: true` to save resources on superseded runs.

**DO:**
```yaml
# From PR #5022 — deploy-level concurrency keyed to environment
concurrency: cd-nofos-${{ inputs.environment || 'dev' }}
```

**DON'T:**
```yaml
# Anti-pattern — no concurrency group allows overlapping Terraform applies
# which can corrupt state or cause deployment failures
```

> **Rationale:** Overlapping Terraform applies to the same environment can corrupt state or cause deployment failures. Concurrency groups ensure only one deployment runs per environment at a time. CI cancellation saves compute costs when a newer commit supersedes an in-progress check.

---

#### Rule: Guard Against Null `inputs` on Push-Triggered Workflows
**Confidence:** High
**Observed in:** 3 files simultaneously fixed | PR refs: #8402

ALWAYS handle the case where `inputs.environment` is `null` in CD workflow expressions. On `push` events, `workflow_dispatch` inputs are not set, so any expression referencing `inputs.environment` MUST include a null check (e.g., `inputs.environment != null && ...`). ALWAYS apply such fixes across all CD workflow files simultaneously.

**DO:**
```yaml
# From PR #8402 — null-safe expression
fail_on_vulns: ${{ ! contains(fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.ref_name == 'main' && '["staging"]' || '["dev"]'), 'staging') }}
```

**DON'T:**
```yaml
# Anti-pattern — fails on push events where inputs.environment is null
fail_on_vulns: ${{ ! contains(fromJSON(inputs.environment), 'staging') }}
# fromJSON(null) causes a workflow failure
```

> **Rationale:** The `inputs` context is only populated for `workflow_dispatch` and `workflow_call` events. On `push` events, `inputs.environment` is `null`, causing `fromJSON(null)` to fail. This is a recurring source of bugs in the environment matrix expression.

---

#### Rule: Cross-Repo Deployment Requires Special Pipeline
**Confidence:** High
**Observed in:** NOFOs-specific (architecturally significant) | PR refs: #8799, #8548

NEVER use the generic `deploy.yml` workflow for applications sourced from external repositories. Applications without a source directory in the monorepo (e.g., NOFOs from HHS/simpler-grants-pdf-builder) MUST use a dedicated `deploy-{app}.yml` workflow that handles external repository checkout, Docker image caching, and non-standard build paths.

**DO:**
```yaml
# From PR #8799 — restoring nofos-specific deploy pipeline
# cd-nofos.yml
  deploy:
    name: Deploy
    needs: [checks, vulnerability-scans]
    uses: ./.github/workflows/deploy-nofos.yml
    with:
      environment: ${{ inputs.environment || 'dev' }}
      version: ${{ inputs.version || github.ref || 'main' }}
```

**DON'T:**
```yaml
# Anti-pattern — using generic deploy for external repo app
# PR #8548 broke nofos by using the generic deploy workflow:
# "fatal: ambiguous argument 'nofos': unknown revision or path not in the working tree"
  deploy:
    uses: ./.github/workflows/deploy.yml
    with:
      app_name: nofos  # WRONG: no nofos/ directory exists in the monorepo
```

> **Rationale:** The generic deploy workflow assumes the application source code exists as a directory in the monorepo. External apps break this assumption. This was a regression caught only after the deploy failed in production.

---

### Build & Artifacts

#### Rule: Docker Image Caching Between CI and CD Jobs
**Confidence:** High
**Observed in:** NOFOs-specific but architecturally significant | PR refs: #5022, #5071

When deploying an application from an external repository, ALWAYS use `actions/cache/save` and `actions/cache/restore` to pass Docker images between CI (build/test) and CD (deploy) jobs. ALWAYS include `github.run_id` in the cache key to prevent stale images from being deployed on workflow re-runs.

**DO:**
```yaml
# From PR #5071 — adding run_id for uniqueness
- name: Cache Docker image
  uses: actions/cache/save@v4
  with:
    path: /tmp/docker-image.tar
    key: nofos-image-${{ github.sha }}-${{ github.run_id }}
```

**DON'T:**
```yaml
# Anti-pattern — cache key without run_id causes stale images on re-runs
key: nofos-image-${{ github.sha }}
# Re-running the workflow picks up a stale cached image from a previous run
```

> **Rationale:** For external apps, Docker images must be built once in CI and reused in deploy. Without `run_id`, re-running a workflow would pick up a stale cached image from a previous run with the same SHA.

---

#### Rule: App-Specific Git Hashes for Smart Container Reuse (⏳)
**Confidence:** Medium
**Observed in:** 1 significant PR | PR refs: #5189

ALWAYS use the most recent commit hash within each application's folder (not the repo-level HEAD) when determining whether a container image already exists. This requires `fetch-depth: 1000` on the checkout action.

**DO:**
```yaml
# From PR #5189 — using app-folder-specific commit hash
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

**DON'T:**
```yaml
# Anti-pattern — using repo-level hash causes unnecessary rebuilds
# In a monorepo, the top-level git hash changes with every merge,
# even if only one app was modified
echo "commit_hash=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"
```

> **Rationale:** In a monorepo, the top-level git hash changes with every merge, even if only one app was modified. Using app-folder-specific hashes avoids unnecessary rebuilds for unchanged apps during production releases that deploy all services.

---

### Security & Scanning

#### Rule: Dual Vulnerability Scanning with False Positive Management
**Confidence:** High
**Observed in:** All deployed applications | PR refs: #5117, #5145, #5156

ALWAYS run vulnerability scans (Trivy + Anchore/Grype + Dockle) on all deployed container images. ALWAYS manage false positives through `TRIVY_SKIP_FILES`, `.trivyignore`, and `.dockleignore` rather than disabling scans. ALWAYS use the staging bypass (`fail_on_vulns: false` for staging) so deployments to staging are not blocked by known vulnerabilities.

**DO:**
```yaml
# From PR #5145 — managing Trivy false positive for PyJWT
env:
  TRIVY_SKIP_JAVA_DB_UPDATE: true
  # PyJWT has an example with a fake JWT that Trivy flags.
  # see: https://github.com/aquasecurity/trivy/discussions/5772
  TRIVY_SKIP_FILES: "/app/.venv/lib/python*/site-packages/PyJWT-*.dist-info/METADATA"
```

**DON'T:**
```yaml
# Anti-pattern — disabling scans entirely instead of managing false positives
# TRIVY_SKIP_DB_UPDATE: true  # WRONG: suppresses all scanning
```

> **Rationale:** Multiple scanning tools provide defense in depth. False positives are inevitable with container scanning, and the team documents each suppression with comments linking to upstream issues. The staging bypass allows developers to continue testing while security issues are being addressed.

---

#### Rule: Explicit Minimal Permissions with Dry-Run Gap
**Confidence:** High
**Observed in:** All linter workflows | PR refs: #6277

ALWAYS declare explicit `permissions:` blocks in workflow files, requesting only the minimum access needed. NEVER assume `issues: read` is sufficient when the workflow updates issue fields — verify that write operations work before merging to main.

**DO:**
```yaml
# From PR #6277 — fixing insufficient permissions
permissions:
  issues: write  # Needed because the script updates issue bodies
```

**DON'T:**
```yaml
# Anti-pattern — read permission when writes are needed
permissions:
  issues: read  # WRONG: script updates issues but CI only tests in --dry-run mode
# Author's explanation: "This wasn't caught by the CI previously because we only
# run the script in --dry-run mode which logs the issues that will be updated
# but doesn't actually attempt to update the issue body."
```

> **Rationale:** Minimal permissions follow the principle of least privilege. However, dry-run testing creates a blind spot where permission issues are not caught until the workflow runs in production mode.

---

### E2E Testing

#### Rule: E2E Test Sharding with Merged Report Creation
**Confidence:** High
**Observed in:** Central e2e strategy | PR refs: #4922, #8446

ALWAYS shard Playwright e2e tests using a matrix strategy with 4 shards. ALWAYS produce blob reports from each shard and merge them into a single HTML report via a separate `create-report` job. Use `if: ${{ !cancelled() }}` on the report job to ensure reports are generated even when some shards fail.

**DO:**
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

**DON'T:**
```yaml
# Anti-pattern — no report merge, losing results from partial failures
  create-report:
    if: ${{ success() }}  # WRONG: reports not created when shards fail
```

> **Rationale:** Sharding distributes long-running e2e tests across parallel runners, reducing total CI time. Merged reports provide a single artifact for debugging failures. `!cancelled()` ensures reports are generated even on partial failure.

---

#### Rule: E2E Spoofed Login for Auth-Dependent Tests
**Confidence:** High
**Observed in:** All subsequent authenticated e2e tests | PR refs: #6318

ALWAYS use spoofed session cookies for e2e tests that require authenticated users, rather than scripting the actual login.gov authentication flow. The API MUST generate an e2e auth token during database seeding, and the frontend MUST inject it as a session cookie via `createSpoofedSessionCookie`.

**DO:**
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

**DON'T:**
```typescript
// Anti-pattern — scripting real login.gov authentication in CI
// Unreliable due to undiagnosed auth flow issues in CI environments
await page.goto("https://idp.int.identitysandbox.gov/sign_in");
await page.fill("#user_email", process.env.TEST_EMAIL);
// ... fragile multi-step login flow
```

> **Rationale:** Scripting real login.gov authentication in CI was unreliable. Spoofed cookies provide deterministic, fast authentication that bypasses external dependencies.

---

### Governance & Linting

#### Rule: Governance Linters as Event-Driven Workflows
**Confidence:** High
**Observed in:** 7+ PRs | PR refs: #5164, #6417

ALWAYS implement project governance automation (milestone propagation, deliverable field inheritance, sprint rollover) as shell scripts under `.github/linters/scripts/` with corresponding workflow files under `.github/workflows/lint-*.yml`. ALWAYS support `--dry-run` mode and ALWAYS test linter scripts in CI via `ci-project-linters.yml` using dry-run against known test issues.

**DO:**
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

**DON'T:**
```bash
# Anti-pattern — governance script without dry-run mode
# Cannot be tested in CI without making real changes to project data
gh issue edit --repo "$issue_repo" --milestone "$title" "$issue_number"
```

> **Rationale:** Event-driven linters automate repetitive project management tasks. Dry-run mode enables CI testing without side effects. However, this pattern has a known gap: dry-run mode cannot validate that the workflow has sufficient write permissions (see explicit minimal permissions rule above).

---

#### Rule: Feature Flags for New API Capabilities in Terraform
**Confidence:** High
**Observed in:** Moderate (CommonGrants, Apply, SOAP API) | PR refs: #6542

ALWAYS gate new API capabilities (endpoints, integrations) behind environment variables set in Terraform configs. Enable in dev/staging first, then prod after validation. The feature flag variable MUST follow the pattern `ENABLE_{FEATURE}_ENDPOINTS = 1`.

**DO:**
```terraform
# From PR #6542 — feature flag for CommonGrants endpoints
# infra/api/app-config/dev.tf
ENABLE_COMMON_GRANTS_ENDPOINTS = 1
```

**DON'T:**
```terraform
# Anti-pattern — deploying new endpoints without a feature flag
# No way to disable the feature without a code rollback
```

> **Rationale:** Feature flags decouple deployment from release, allowing code to be deployed but not activated until ready. Per-environment activation enables staged rollouts.

---

#### Rule: Avoid Bundling Unrelated Changes in CD PRs (⏳)
**Confidence:** Medium
**Observed in:** Occasional | PR refs: #4869

NEVER bundle unrelated changes (e.g., infrastructure capacity changes) with CD workflow modifications. Each PR touching CD workflows should be focused on a single concern.

**DO:**
```text
# From PR #4869 — reviewer's own comment on bundled changes:
# "this is unrelated >_>"
# The CD change (re-enabling dev deploys) was bundled with database capacity
# changes across 8 files.
```

**DON'T:**
```yaml
# Anti-pattern — bundling CD workflow change with unrelated infra changes
# in the same PR, making rollbacks and change tracking harder
```

> **Rationale:** Mixed-concern PRs make it harder to understand the intent of a change, complicate rollbacks, and can lead to unintended side effects.

---

## Anti-Patterns

### Complex Inline Ternary Expressions in YAML
The environment matrix expression has grown into a deeply nested ternary that has caused multiple bugs (PR #8402). It is now:
```yaml
envs: ${{ fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.event_name == 'release' && '["prod", "training"]' || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]') }}
```
This expression should be refactored into a composite action or shell script that outputs the environment list. It has been a source of bugs and requires identical fixes to be applied across multiple files simultaneously.

### Iterative Workflow Fixes (Trial-and-Error Pattern)
The NOFOs CI setup required 4 sequential fix PRs (#4913, #4943, #4944, #4945) for wrong name, wrong trigger type, and wrong working directory. This pattern suggests a lack of local workflow testing capability, which is common with GitHub Actions.

### Dry-Run Permission Gap
Running linter scripts in `--dry-run` mode during CI missed a permission error in PR #6277 (`issues: read` vs `issues: write`). The dry-run mode logged actions but never attempted the writes that would have exposed the insufficient permissions.

---

## Known Inconsistencies

1. **Feature Flag Naming:** Terraform uses `ENABLE_{FEATURE}_ENDPOINTS = 1`, local dev uses `ENABLE_{FEATURE}=TRUE`, and frontend flags use `FEATURE_{NAME}_OFF` backed by SSM. No centralized registry exists.

2. **E2E Workflow Naming:** The naming for e2e workflows diverges slightly (`ci-frontend-e2e.yml`, `e2e-staging.yml`). It is unclear if these should be standardized to `e2e-local.yml` / `e2e-staging.yml`.

3. **Self-Referencing Workflow Paths:** Some CD workflows include their own workflow file in the `paths:` filter; others do not. No consistent policy exists.

---

## Related Documents

- [Infrastructure Conventions](infra.md) — Terraform patterns, SSM secrets, feature flags in infra
- [Cross-Domain Conventions](cross-domain.md) — CCP-8 (Feature Flags), CCP-10 (SSM Parameters Before Merge)
- [Forms Vertical](forms-vertical.md) — E2E form testing patterns (Page Object Model)
- `analysis/pass2/ci-cd.md` — Full Pass 2 codification with all code examples
- `analysis/pass1/ci-cd.md` — Pass 1 pattern discovery with PR corpus details
