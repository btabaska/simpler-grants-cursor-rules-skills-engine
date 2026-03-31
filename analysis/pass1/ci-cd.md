# CI/CD Workflow Patterns -- Pattern Discovery (Pass 1)

> **Source:** 124 merged PRs touching `.github/` in HHS/simpler-grants-gov
> **Date range:** ~2025-04-02 to 2026-03-10
> **Analysis date:** 2026-03-27

---

## 1. Workflow Structure Patterns

### 1a. Per-Application CD Workflows with Identical Structure
**Frequency:** Very high -- core architecture visible across all 3 primary apps (api, frontend, analytics) plus nofos
**Confidence:** High

Each deployable application has its own `cd-{app}.yml` that follows a consistent three-job pipeline: `checks -> deploy -> send-slack-notification`. The deployment job uses a matrix strategy with `max-parallel: 1` and `fail-fast: false` to serialize environment deploys.

**Key expression pattern** for environment matrix (seen in cd-api, cd-analytics, cd-frontend):
```yaml
envs: ${{ fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.event_name == 'release' && '["prod", "training"]' || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]') }}
```

**Exemplar PRs:** #4690 (disable dev deploys), #4869 (re-enable), #6295 (add training), #6299 (add training to release), #8402 (fix push-triggered `inputs.environment` null handling)

**Trend:** This expression has grown in complexity over time and has been a source of bugs. PR #8402 fixed a case where `inputs.environment` was null on push events -- an edge case the original conditional did not handle. The ever-growing ternary is an emerging maintenance concern.

---

### 1b. Reusable Workflow Composition via `workflow_call`
**Frequency:** High -- at least 15+ workflows use `workflow_call`
**Confidence:** High

The project extensively uses reusable workflows invoked with `uses: ./.github/workflows/{name}.yml`. Examples include:
- `vulnerability-scans.yml` (called by all CD workflows)
- `build-and-publish.yml` (shared image build/publish)
- `deploy.yml` (shared deploy logic for platform apps)
- `send-slack-notification.yml` (failure notifications)
- `e2e-create-report.yml` (shared test report creation)

**Exemplar PRs:** #5016 (cd-nofos uses ci-nofos and deploy), #8446 (e2e-create-report extracted as reusable), #8754 (local e2e uses shared composite action)

**Trend:** Increasing extraction of shared logic into reusable workflows and composite actions over time. By 2026, the team created a composite action `.github/actions/e2e/action.yml` to share Playwright execution logic across local and deployed e2e tests.

---

### 1c. Composite Actions for Shared Step Logic
**Frequency:** Moderate (growing)
**Confidence:** High

Beyond reusable workflows, the project uses composite actions under `.github/actions/` for step-level reuse:
- `.github/actions/e2e/action.yml` -- Run Playwright against a specified environment
- `.github/actions/configure-aws-credentials/` -- AWS credential setup
- `.github/actions/setup-terraform/` -- Terraform initialization

**Exemplar PRs:** #8446 (created e2e composite action), #8754 (extended with `needs_node_setup` and `api_logs` flags)

**Trend:** Composite actions are becoming the preferred mechanism for sharing step-level CI logic, especially as e2e testing expands to multiple environments.

---

### 1d. Naming Convention: `ci-{app}` for Checks, `cd-{app}` for Deploys
**Frequency:** Universal
**Confidence:** High

Workflows follow a strict naming convention:
- `ci-frontend.yml`, `ci-api.yml`, `ci-nofos.yml` -- CI checks (lint, test, build)
- `cd-frontend.yml`, `cd-api.yml`, `cd-nofos.yml` -- CD deploy orchestration
- `deploy.yml`, `deploy-nofos.yml` -- Lower-level deploy execution
- `vulnerability-scans.yml`, `vulnerability-scans-nofos.yml` -- Security scanning

**Exemplar PRs:** #4913 (ci-nofos added), #5016 (cd-nofos added)

---

### 1e. Path-Filtered Triggers for Monorepo Efficiency
**Frequency:** Universal across CD workflows
**Confidence:** High

All CD workflows use `paths:` filters under the `push` trigger to only deploy when relevant code changes:
```yaml
on:
  push:
    branches: ["main"]
    paths:
      - "api/**"
      - "infra/api/**"
      - "infra/modules/**"
```

The addition of `infra/modules/**` was a corrective fix in PR #4920, recognizing that shared Terraform modules could affect any service.

**Exemplar PRs:** #4920 (add shared modules to triggers), #5022 (nofos workflow paths refined), #8769 (e2e on all main merges)

---

## 2. Deployment Patterns

### 2a. Environment Promotion: dev -> staging -> (training) -> prod
**Frequency:** High -- all CD workflows
**Confidence:** High

Environments follow a clear promotion chain:
- **Push to main:** Deploys to `dev` and `staging` (serialized)
- **GitHub release:** Deploys to `prod` (and later `training`)
- **Manual dispatch:** Allows deploying to any environment

Training was added as a new environment in September 2025 (PRs #6295, #6299), deployed alongside prod on release events. A reviewer noted the importance of ordering: "prod should be first so we're not waiting on Training if we're fixing downtime."

**Exemplar PRs:** #6295, #6299, #8548 (nofos template-infra migration)

---

### 2b. Concurrency Controls to Prevent Overlapping Deploys
**Frequency:** High
**Confidence:** High

Deploy workflows use GitHub Actions concurrency groups to prevent overlapping deployments to the same environment:
```yaml
concurrency: cd-nofos-${{ inputs.environment || 'dev' }}
```

CD workflows also use `cancel-in-progress: true` for CI workflows to save resources on superseded runs.

**Exemplar PRs:** #5022 (nofos concurrency), #8446 (e2e concurrency)

---

### 2c. Docker Image Caching Between CI and CD Jobs
**Frequency:** Specific to nofos (external app pattern)
**Confidence:** High

The NOFOs app (sourced from a separate repository, HHS/simpler-grants-pdf-builder) uses `actions/cache/save` and `actions/cache/restore` to pass Docker images between CI and deploy jobs:
```yaml
key: nofos-image-${{ github.sha }}-${{ github.run_id }}
```

Initially keyed by `github.sha` alone, the cache key was refined to include `github.run_id` in PR #5071 after stale images were being deployed on re-runs.

**Exemplar PRs:** #5022 (initial caching), #5071 (fix cache key uniqueness)

---

### 2d. Smart Container Reuse via App-Specific Git Hashes
**Frequency:** One significant PR
**Confidence:** Moderate

PR #5189 changed the build-and-publish workflow to use the most recent commit hash within each app's folder (not the repo-level hash) to determine if a container already exists. This avoids unnecessary rebuilds when only one app in the monorepo changed. Required `fetch-depth: 1000` for checkout.

**Exemplar PRs:** #5189

---

### 2e. Temporary Environment Disabling for Testing
**Frequency:** Occasional (anti-pattern adjacent)
**Confidence:** High

PR #4690 disabled dev deploys by commenting out the environment in the matrix expression, leaving the old line as a comment. PR #4869 re-enabled it 9 days later. A reviewer noted: "this is unrelated >_>" when it was bundled with infrastructure changes.

This pattern of inline commenting to toggle deploy targets is fragile but expedient.

**Exemplar PRs:** #4690 (disable dev), #4869 (re-enable)

---

## 3. Testing in CI

### 3a. E2E Test Sharding with Playwright
**Frequency:** High -- central e2e strategy
**Confidence:** High

E2E tests use Playwright with a sharding matrix strategy:
```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
    total_shards: [4]
```

Shards were increased from 3 to 4 in PR #4922. Each shard produces a blob report that gets merged into a single report via a separate `create-report` job.

**Exemplar PRs:** #4922 (increase shards 3->4), #8446 (extract shared report creation), #8754 (refactor to use composite action)

---

### 3b. E2E Test Evolution: Local vs Deployed Targets
**Frequency:** High -- multiple PRs over time
**Confidence:** High

The e2e testing infrastructure has evolved significantly:
1. **Initially:** Single `ci-frontend-e2e.yml` running against a locally spun up API
2. **PR #6318:** Added spoofed login support for authenticated e2e tests
3. **PR #8446:** Created separate workflows for local (`ci-frontend-e2e.yml`) and deployed (`e2e-staging.yml`) targets, plus a shared composite action
4. **PR #8769:** Added push trigger on main to run e2e on all merges
5. **PR #8887:** Scheduled daily e2e runs against staging

The naming evolved from "Frontend E2E Tests" -> "E2E Tests (Local)" -> "E2E Tests (Local Github Target)".

**Exemplar PRs:** #6318, #8446, #8754, #8769, #8887

---

### 3c. E2E Test Flakiness Addressed Through Infrastructure
**Frequency:** Moderate -- several PRs
**Confidence:** High

Multiple PRs address e2e flakiness through infrastructure improvements rather than just test code:
- PR #4376: Fixed agency-related flakiness by seeding test data with agencies
- PR #4922: Increased Playwright retries from 2 to 3 in CI
- PR #6318: Replaced actual login flow with spoofed login cookies to avoid auth flakiness in CI
- PR #8710: E2E test adjustments for Next.js 16 upgrade (different timeouts for local vs deployed)

**Exemplar PRs:** #4376, #4922, #6318, #8710

---

### 3d. CI for External Repository (NOFOs cross-repo pattern)
**Frequency:** NOFOs-specific but architecturally notable
**Confidence:** High

The ci-nofos workflow checks out a different repository (`HHS/simpler-grants-pdf-builder`) for CI/CD, representing a cross-repo deployment pattern. This required several iterations to get right:
1. PR #4913: Initial CI (wrong working directory, wrong name)
2. PR #4943: Fix name ("API Checks" -> "NOFOs Checks")
3. PR #4944: Fix trigger (`workflow_call` -> `workflow_dispatch`)
4. PR #4945: Add `pull_request` trigger, use Docker for tests

**Exemplar PRs:** #4913, #4943, #4944, #4945

---

### 3e. Project Linter CI Testing
**Frequency:** Moderate
**Confidence:** High

Linter scripts under `.github/linters/` have their own CI workflow (`ci-project-linters.yml`) that runs them in `--dry-run` mode against known test issues. This ensures linter scripts remain functional without actually modifying project data.

**Exemplar PRs:** #5164 (added milestone linter tests), #5206 (added deliverable field linter tests)

---

## 4. Security Patterns

### 4a. Dual Vulnerability Scanning: Trivy + Anchore/Grype + Dockle
**Frequency:** High -- all deployed applications
**Confidence:** High

The vulnerability scanning workflow runs three tools:
- **Trivy:** Container image scanning with cached vulnerability DBs
- **Anchore/Grype:** Secondary vulnerability scanner (upgraded from v4 to v6 in PR #5117)
- **Dockle:** Container best-practice linting

Scanning results are cached daily and uploaded to GitHub Security via SARIF format.

**Exemplar PRs:** #5113 (nofos vuln scans), #5117 (grype v4->v6), #5145 (PyJWT false positive), #5156 (Dockle :latest tag ignore)

---

### 4b. Vulnerability Scan Gating with Staging Bypass
**Frequency:** High
**Confidence:** High

Vulnerability scans can block deploys but have a staging bypass mechanism:
```yaml
fail_on_vulns: ${{ ! contains(fromJSON(inputs.environment ...), 'staging') }}
```

This allows staging deploys to proceed even with known vulnerabilities, while dev and prod require clean scans. PR #8402 fixed a bug where this expression failed when `inputs.environment` was null on push events.

**Exemplar PRs:** #5202 (require scans before nofos deploy), #8402 (fix null input handling)

---

### 4c. Explicit Minimal Permissions
**Frequency:** Moderate
**Confidence:** High

Workflows declare explicit permissions blocks. PR #6277 corrected a permission from `issues: read` to `issues: write` after discovering the sync script needed write access to update issue bodies -- a case that wasn't caught because CI ran in `--dry-run` mode.

**Exemplar PRs:** #6277 (permission fix)

---

### 4d. Trivy False Positive Management
**Frequency:** Low but notable
**Confidence:** High

The team manages Trivy false positives through:
- `.trivyignore` files for known acceptable findings
- `TRIVY_SKIP_FILES` env var to skip files triggering false positives (e.g., PyJWT METADATA containing example JWTs)
- Dockle's `.dockleignore` for suppressing warnings (e.g., DKL-DI-0006 for `:latest` tag)

**Exemplar PRs:** #5145 (PyJWT false positive), #5156 (Dockle :latest ignore)

---

## 5. Release Patterns

### 5a. Release-Triggered Production Deploys
**Frequency:** High -- all CD workflows
**Confidence:** High

Production deployments are triggered by GitHub release events:
```yaml
on:
  release:
    types: [published]
```

When a release is published, the CD workflow deploys to `["prod", "training"]` (with prod first to avoid blocking production fixes on training deploys).

**Exemplar PRs:** #6299 (training added to release deploy, reviewer insisted prod go first)

---

### 5b. Manual Dispatch as Escape Hatch
**Frequency:** Universal
**Confidence:** High

All CD workflows support `workflow_dispatch` with environment and version inputs, allowing manual deployment of any git reference to any environment. The environment input uses a `type: choice` dropdown:
```yaml
options:
  - dev
  - staging
  - training
  - prod
```

This serves as both a deployment override and a debugging tool.

---

## 6. Corrective / Governance Patterns

### 6a. CODEOWNERS Evolution and Eventual Removal
**Frequency:** High -- 7+ PRs touched CODEOWNERS
**Confidence:** High

The `.github/CODEOWNERS` file underwent extensive evolution:
1. Multiple PRs added team members and refined path ownership (#4891, #4953, #6257)
2. Path patterns became increasingly specific (e.g., `/.github/workflows/*nofos*` for nofos-specific reviewers)
3. **PR #8851 removed CODEOWNERS entirely**, replacing it with a GitHub Action-based review assignment model

The removal was motivated by "blast notifications on every PR" and a desire for a more flexible hybrid review system where PR authors manually request reviews, with automated reminders after one hour.

**Exemplar PRs:** #4891, #4953, #6257, #8851

**Trend:** Moving away from CODEOWNERS toward a more programmatic review assignment system. This is a significant governance shift.

---

### 6b. Issue Template Governance via Linters
**Frequency:** High -- substantial investment
**Confidence:** High

The team built a sophisticated system of GitHub-event-driven linters:
- **Sprint rollover:** Automatically moves open tickets to current sprint (#5130)
- **Milestone inheritance:** Propagates milestones from parent to sub-issues (#5164)
- **Deliverable field propagation:** Inherits deliverable field from parent (#5206)
- **Deliverable body linting:** Validates acceptance criteria and metrics sections exist (#6417, #6446)
- **Co-planning sync:** Syncs GitHub issues to Fider voting platform (#6277, #6569)

These are organized under `.github/linters/` with scripts, GraphQL queries, and dedicated workflows.

**Exemplar PRs:** #5130, #5164, #5206, #6417, #6446, #6467, #6569

---

### 6c. PR Template Evolution
**Frequency:** 3 PRs
**Confidence:** High

The PR template was refined through team discussion:
1. PR #4835: Simplified template, changed helper text to HTML comments, added "Validation steps" replacing "Additional information", removed "Time to review"
2. PR #4877: Fixed typo ("taht" -> "that")

The template stabilized at: Summary, Changes proposed, Context for reviewers, Validation steps.

**Exemplar PRs:** #4835, #4877

---

### 6d. Issue Templates for Structured Governance
**Frequency:** Moderate
**Confidence:** High

Several issue templates were added or modified:
- Blank issues temporarily enabled/disabled due to GitHub bug (#4659, #4796)
- Epic template simplified by removing LOE and delivery date fields (#5116)
- Proposal template added for co-planning (#6414)
- Deliverable template linked to linter documentation (#6446)

**Exemplar PRs:** #4659, #4796, #5116, #6414, #6446

---

## 7. Anti-Patterns and Issues

### 7a. Complex Inline Ternary Expressions in YAML
**Frequency:** High -- all CD workflows
**Confidence:** High

The environment matrix expression is a deeply nested ternary that has caused bugs:
```yaml
envs: ${{ fromJSON(inputs.environment != null && format('["{0}"]', inputs.environment) || github.event_name == 'release' && '["prod", "training"]' || github.ref_name == 'main' && '["dev", "staging"]' || '["dev"]') }}
```

PR #8402 fixed a case where `inputs.environment` was null on push events, requiring the same fix to be applied across 3 files. This expression should ideally be extracted to a reusable action or strategy.

**Exemplar PRs:** #8402

---

### 7b. Iterative Workflow Fixes (Trial-and-Error Pattern)
**Frequency:** Moderate -- especially for new services
**Confidence:** High

The NOFOs CI setup required 4 sequential fix PRs:
1. #4913: Wrong name ("API Checks"), wrong working directory
2. #4943: Fix name
3. #4944: Fix trigger type
4. #4945: Actually run tests properly

This pattern suggests a lack of local workflow testing capability, which is common with GitHub Actions.

**Exemplar PRs:** #4913, #4943, #4944, #4945

---

### 7c. Cross-Repo Workflow Overwritten by Template Migration
**Frequency:** One incident
**Confidence:** High

PR #8548 migrated nofos infrastructure to template-infra management, which replaced the custom nofos CD workflow with a generic one. However, the generic workflow assumed a local source directory (`nofos/`), which doesn't exist since nofos is an external repo. PR #8799 had to restore the nofos-specific pipeline.

**Exemplar PRs:** #8548 (broke it), #8799 (fixed it)

---

### 7d. Unrelated Changes Bundled in CD PRs
**Frequency:** Occasional
**Confidence:** Moderate

PR #4869 bundled re-enabling dev deploys with database capacity changes across 8 files. A reviewer noted "this is unrelated >_>". While pragmatic, this practice makes change tracking harder.

**Exemplar PRs:** #4869

---

### 7e. `--dry-run` CI Gap for Permission Testing
**Frequency:** One notable instance
**Confidence:** Moderate

PR #6277 revealed that running linter scripts in `--dry-run` mode during CI missed a permission error (`issues: read` vs `issues: write`). The dry-run mode logged actions but never attempted the writes that would have exposed the insufficient permissions.

**Exemplar PRs:** #6277

---

## 8. Infrastructure-as-Code Patterns in CI/CD

### 8a. Terraform Deployed Through GitHub Actions
**Frequency:** High -- all services
**Confidence:** High

All service deployments use Terraform via GitHub Actions, with:
- AWS credentials configured via OIDC (`id-token: write` permission)
- Terraform state stored in S3 backends
- Per-environment Terraform configurations (`dev.tf`, `staging.tf`, `prod.tf`)
- Shared modules under `infra/modules/`

---

### 8b. Feature Flags for New Endpoints
**Frequency:** Moderate
**Confidence:** High

New API capabilities (CommonGrants, SOAP API, Apply endpoints) are gated by environment variables set in Terraform configs:
```terraform
ENABLE_COMMON_GRANTS_ENDPOINTS = 1
ENABLE_APPLY_ENDPOINTS = 1
ENABLE_SOAP_API = 1
```

Enabled selectively per environment (dev/staging first, prod later).

**Exemplar PRs:** #6542 (CommonGrants feature flag)

---

## Summary of Key Trends

| Trend | Direction | Evidence |
|-------|-----------|----------|
| E2E test infrastructure | Expanding rapidly | Local, staging, scheduled, composite actions |
| Workflow reuse | Increasing | Composite actions, `workflow_call`, shared reports |
| Environment count | Growing | Added training, grantee1 |
| CODEOWNERS | Abandoned | Replaced with GH Action-based review |
| Vulnerability scanning | Maturing | Trivy+Grype+Dockle, false positive management |
| Linter/automation scripts | Growing significantly | Milestones, deliverables, co-planning sync |
| Complex YAML expressions | Accumulating debt | Matrix ternary repeatedly causing bugs |
| Cross-repo deploys | Established but fragile | NOFOs pattern requires special handling |
