# Infrastructure/Terraform Pattern Discovery

**Source:** 172 merged PRs touching `infra/` in HHS/simpler-grants-gov
**Date range:** ~2025-03 through 2026-02
**Analysis date:** 2026-03-27

---

## 1. Module Structure Patterns

### 1.1 Three-Layer Application Structure: `app-config` / `service` / `database`

**Frequency:** Universal -- every application (api, frontend, analytics, nofos, fluentbit) follows this pattern.
**Confidence:** Very High

Each application under `infra/<app_name>/` is organized into three standard layers:

- **`app-config/`** -- Declares application-level configuration: feature flags, environments, database config, environment variables, secrets. Contains per-environment `.tf` files (dev.tf, staging.tf, prod.tf, training.tf) plus an `env-config/` subdirectory with shared variable definitions.
- **`service/`** -- Instantiates the shared `infra/modules/service` module and wires in environment-specific config. Contains `main.tf` plus feature-specific files (e.g., `sqs.tf`, `notifications.tf`, `domain.tf`, `secrets.tf`).
- **`database/`** -- Instantiates the shared `infra/modules/database` module.

**Exemplar PRs:** #4303, #5261, #5278, #8445, #8456
**Trend:** Stable convention since project inception. PR #8456 (template-infra v0.15.7 upgrade) refactored this into even more granular sub-files within service/ (domain.tf, feature_flags.tf, monitoring.tf, storage.tf, database.tf).

### 1.2 Per-Environment Config via Module Calls

**Frequency:** Very High (~40+ PRs)
**Confidence:** Very High

Each environment is configured by calling a shared `env-config` module with environment-specific overrides:

```hcl
module "dev_config" {
  source         = "./env-config"
  environment    = "dev"
  network_name   = "dev"
  domain_name    = "api.dev.simpler.grants.gov"
  enable_https   = true
  ...
}
```

Per-environment files (dev.tf, staging.tf, prod.tf, training.tf) override defaults for instance counts, scaling, database versions, feature flags, and environment-specific URLs.

**Exemplar PRs:** #4362, #4401, #4402, #5261, #5282, #6515

### 1.3 Shared Reusable Modules under `infra/modules/`

**Frequency:** High (~30+ PRs)
**Confidence:** Very High

Reusable modules live under `infra/modules/` and are consumed by application layers:

- `modules/service/` -- ECS service, ALB, CDN, WAF, networking, IAM, API Gateway
- `modules/database/` -- Aurora Serverless cluster
- `modules/sqs-queue/` -- SQS with DLQ (added in PR #8445)
- `modules/domain/data/` and `modules/domain/resources/` -- DNS/cert management (added in PR #8456)
- `modules/feature_flags/` -- SSM-backed feature flags (added in PR #8456)
- `modules/secrets/` -- Secret management via SSM (added in PR #8456)
- `modules/monitoring/` -- CloudWatch alarms and alerting
- `modules/notifications/` -- Pinpoint/SES email
- `modules/identity-provider/` -- Cognito
- `modules/network/data/` and `modules/network/interface/` -- VPC data lookups (added in PR #8456)

**Trend:** Growing. New modules added over time (sqs-queue, domain, feature_flags, secrets, network). PR #8456 introduced a significant modularization upgrade from template-infra v0.15.7.

### 1.4 `project-config` as Global Configuration Module

**Frequency:** Medium
**Confidence:** High

`infra/project-config/` serves as a centralized configuration module referenced by all other layers. Contains `main.tf`, `networks.tf`, `aws_services.tf`, and `outputs.tf`. Provides project-wide values like project name, default region, network configs, and AWS service configurations.

**Exemplar PRs:** #8456 (expanded aws_services.tf significantly)

---

## 2. Resource Patterns

### 2.1 Feature-Gated Resources via `count` and Boolean Variables

**Frequency:** Very High (~25+ PRs)
**Confidence:** Very High

Resources are conditionally created using `count` driven by boolean variables with `default = false`:

```hcl
variable "enable_api_gateway" {
  type    = bool
  default = false
}

resource "aws_api_gateway_rest_api" "api" {
  count = var.enable_api_gateway ? 1 : 0
  name  = var.service_name
  ...
}
```

This pattern is used for: API Gateway, mTLS load balancer, HTTPS listeners, WAF, notifications/Pinpoint, identity provider, CDN, and more.

**Exemplar PRs:** #5228 (API Gateway), #5375 (mTLS ALB), #5294 (Pinpoint), #6504 (security group restrictions)
**Trend:** Consistent and increasing. Boolean flags propagate from `app-config` through to module-level `count` expressions.

### 2.2 IAM: Separate Policy Documents per Concern

**Frequency:** High (~15+ PRs)
**Confidence:** Very High

IAM policies are organized as separate `aws_iam_policy_document` data sources per concern, each with their own `aws_iam_policy` and `aws_iam_role_policy_attachment`:

- `task_executor` -- ECS task execution (ECR pull, secrets, logs)
- `runtime_logs` -- Fluentbit/CloudWatch log writing at runtime
- `email_access` -- Pinpoint/SES sending
- `api_gateway_access` -- API Gateway management

Each gets conditionally created via `count` and attached to the appropriate role.

**Exemplar PRs:** #4303, #5294, #5326, #5328, #5340, #6416
**Trend:** Evolved from monolithic policies toward separated concerns. PR #5326 moved Pinpoint permissions from task_executor to a dedicated email_access policy attached to the app_service role (not task_executor).

### 2.3 SQS Pattern: Main Queue + Dead Letter Queue + Access Policy

**Frequency:** Low (1 PR, but establishes module pattern)
**Confidence:** Medium-High

The `modules/sqs-queue` module (PR #8445) establishes a standard pattern:
- Main queue with SQS-managed SSE encryption
- Dead letter queue with redrive policy
- IAM access policy bundled as module output
- Resource-based queue policies at the consumer level

```hcl
module "sqs_queue" {
  source = "../../modules/sqs-queue"
  name   = "${local.prefix}${local.sqs_config.queue_name}"
  ...
}
```

**Exemplar PRs:** #8445

### 2.4 Checkov Skip Annotations for Known Issues

**Frequency:** Medium (~5+ PRs)
**Confidence:** High

Checkov security scanner is in use. When rules cannot be immediately satisfied, `checkov:skip` comments are added with issue references:

```hcl
# checkov:skip=CKV_AWS_237: Address in future work
# checkov:skip=CKV_AWS_382:Work on restricting outgoing traffic once integrations are more finalized
# checkov:skip=CKV2_AWS_38:TODO(https://github.com/navapbc/template-infra/issues/560) enable DNSSEC
```

**Exemplar PRs:** #5228, #6504, #8456
**Trend:** Skips are being resolved over time. PR #6504 removed the CKV_AWS_382 skip by actually restricting outbound security group traffic.

---

## 3. Variable/Output Patterns

### 3.1 Naming: snake_case, Descriptive, with Type and Description

**Frequency:** Universal
**Confidence:** Very High

All variables follow consistent conventions:
- snake_case naming
- `type` constraint always specified
- `description` field always present
- `default` provided for optional variables (usually `null`, `false`, `""`, or `{}`)

```hcl
variable "enable_api_gateway" {
  description = "Whether to enable API Gateway for the service"
  type        = bool
  default     = false
}

variable "pinpoint_app_id" {
  type        = string
  description = "Pinpoint App ID"
  default     = ""
}
```

### 3.2 Environment Variables: Two-Tier System (Plain + Secrets)

**Frequency:** Very High (~30+ PRs)
**Confidence:** Very High

Environment variables are managed through a two-tier system in `app-config/env-config/environment_variables.tf`:

1. **Plain environment variables** -- stored in `default_extra_environment_variables` locals map, overridable per environment via `service_override_extra_environment_variables`
2. **Secrets** -- stored in a `secrets` locals map with `manage_method` (either `"manual"` or `"generated"`) and `secret_store_name` pointing to AWS SSM Parameter Store paths

```hcl
locals {
  default_extra_environment_variables = {
    ENVIRONMENT = var.environment
    ...
  }

  secrets = {
    API_JWT_PUBLIC_KEY = {
      manage_method     = "manual"
      secret_store_name = "/api/${var.environment}/api-jwt-public-key"
    }
  }
}
```

**SSM path convention:** `/<app_name>/<environment>/<secret-name>` or `/<shared-name>` for cross-app secrets.

**Exemplar PRs:** #4346, #4378, #5278, #6419, #6428, #8359, #8392
**Trend:** Steadily growing as features are added. Feature flags follow the same pattern with `manage_method = "manual"`.

### 3.3 Feature Flags as Secrets with `manage_method = "manual"`

**Frequency:** High (~10+ PRs)
**Confidence:** High

Feature flags are treated as environment variables managed through SSM Parameter Store, following the naming convention `FEATURE_<NAME>_ON` or `FEATURE_<NAME>_OFF`:

```hcl
FEATURE_USER_ADMIN_OFF = {
  manage_method     = "manual"
  secret_store_name = "/${var.app_name}/${var.environment}/feature-user-admin-off"
}
```

Values are set via GitHub Actions workflow or AWS CLI, not in Terraform.

**Exemplar PRs:** #6419, #8359, #4415
**Trend:** PR #8456 introduces a dedicated `feature_flags` module with SSM parameters and validation, signaling a move toward more structured feature flag management.

### 3.4 Outputs Mirror Module Interface

**Frequency:** Universal
**Confidence:** Very High

`app-config` outputs exactly match what `service/` and `database/` layers consume. Each config concern gets its own output:

```hcl
output "database_config"      { value = local.database_config }
output "domain_config"        { value = local.domain_config }
output "feature_flags_config" { value = local.feature_flags_config }
output "monitoring_config"    { value = local.monitoring_config }
output "service_config"       { value = local.service_config }
```

**Trend:** PR #8456 decomposed the monolithic `service_config` output into separate domain-specific outputs.

---

## 4. State Management

### 4.1 Terraform Workspaces for Environment Isolation

**Frequency:** Medium
**Confidence:** High

Terraform workspaces are used to manage multiple environments. The `terraform.workspace` value drives prefix generation for resource naming:

```hcl
prefix = terraform.workspace == "default" ? "" : "${terraform.workspace}-"
```

The `bin/terraform-init` script handles workspace selection per environment.

**Exemplar PRs:** #5258 (fixed run-command to properly call terraform-init before executing)
**Trend:** PR #8456 simplified this by removing the prefix logic from some areas, suggesting a move toward workspace-as-environment without dynamic prefixing.

### 4.2 Lock Files Committed

**Frequency:** High
**Confidence:** Very High

`.terraform.lock.hcl` files are committed to the repository for each service/database layer. Provider version upgrades appear as lock file diffs. AWS provider upgraded from ~5.68.0 to ~6.13.0 during the observed period.

**Exemplar PRs:** #5228, #5258, #6423

---

## 5. Security Patterns

### 5.1 Least-Privilege IAM with Conditional Policies

**Frequency:** High (~15+ PRs)
**Confidence:** Very High

IAM policies are scoped to specific resources and conditionally applied:

```hcl
dynamic "statement" {
  for_each = var.enable_api_gateway ? [1] : []
  content {
    sid     = "AllowGetApiKeys"
    actions = ["apigateway:GET"]
    resources = ["arn:aws:apigateway:${data.aws_region.current.name}::/apikeys/*"]
  }
}
```

Resource ARNs are constructed dynamically from account/region data rather than using wildcards where possible.

**Exemplar PRs:** #6416, #5294, #5326

### 5.2 Security Group Restriction to Specific Ports

**Frequency:** Medium
**Confidence:** High

PR #6504 established the pattern of restricting outbound security group traffic to specific ports (443, 80, 5432) rather than allowing all outbound traffic. ALB egress is scoped to the app security group.

**Exemplar PRs:** #6504

### 5.3 SSM Parameter Store for All Secrets

**Frequency:** Universal
**Confidence:** Very High

All secrets flow through AWS SSM Parameter Store. Manual secrets must be created in SSM before the Terraform change is merged, or deploys will fail. Generated secrets are created by Terraform.

**Reviewer enforcement:** Reviewers consistently verify that SSM parameters exist for all environments before approving. See PR #8392 where `chouinar` asked "Have you added values for all of these into parameter store for every env?"

**Exemplar PRs:** #5278, #6428, #8392

### 5.4 SQS Managed SSE Encryption

**Frequency:** Low (1 module)
**Confidence:** Medium

The SQS module uses `sqs_managed_sse_enabled = true` for at-rest encryption.

**Exemplar PRs:** #8445

### 5.5 mTLS Support for SOAP Proxy

**Frequency:** Low (2-3 PRs)
**Confidence:** Medium

A dedicated mTLS-enabled ALB was created for the SOAP proxy/router, using client certificate passthrough. This avoids prompting browsers for client certificates on the main ALB.

**Exemplar PRs:** #5375, #5339

---

## 6. Corrective Patterns / Reviewer Enforcement

### 6.1 SSM Parameters Must Exist Before Merge

**Frequency:** High (enforced in ~5+ review threads)
**Confidence:** Very High

Reviewers (especially `chouinar`) consistently enforce that SSM parameters are created in all environments before the PR merges. Failing to do so breaks deploys.

> "Have you added values for all of these into parameter store for every env? Even if we don't have actual values yet, if they don't exist, deploys will fail as it tries to fetch them." -- chouinar, PR #8392

**Exemplar PRs:** #8392, #6465, #5278

### 6.2 IAM Permissions on Correct Role

**Frequency:** Medium
**Confidence:** High

PR #5326 caught that Pinpoint permissions were on the wrong IAM role (task_executor vs. app_service). The task_executor role runs during task startup; the app_service role runs during task execution. Email sending happens at runtime, so permissions belong on app_service.

**Exemplar PRs:** #5326, #5328

### 6.3 Conditional Resource Creation Must Be Consistent

**Frequency:** Medium
**Confidence:** High

When a resource is conditionally created (via `count`), all references must use indexed access (`[0]`), and related resources (policies, attachments) must also be conditional. PR #5340 fixed a case where email_access policy was created unconditionally but only attached conditionally, causing failures for services without email.

**Exemplar PRs:** #5340, #5328

### 6.4 Variables Over Locals for Per-Environment Configuration

**Frequency:** Low (1 review thread, but significant)
**Confidence:** Medium

Reviewer `sean-navapbc` pushed back on using locals for SQS config, preferring variables that can be overridden per environment:

> "the config is only defined in the shared locals -- there's no per-environment override mechanism... I prefer variables versus locals always"

**Exemplar PRs:** #8445

### 6.5 Use Environment Variable Pattern, Not Custom Secret Resources

**Frequency:** Medium
**Confidence:** High

Reviewer `chouinar` pushed back on creating custom SSM parameter resources when the existing `environment_variables.tf` secret pattern should be used instead:

> "Are we not able to define this secret / env var like our other secrets?"

**Exemplar PRs:** #6465

---

## 7. Anti-Patterns

### 7.1 Duplicate Resource Definitions

**Confidence:** High

PR #4320 discovered that the same ACM certificate was being fetched twice under different names (`cert` and `certificate`) and passed to the module as both `cert_arn` and `certificate_arn`. The fix consolidated to a single lookup.

**Exemplar PRs:** #4320, #4363

### 7.2 Hardcoding Account IDs

**Confidence:** Medium

PR #4411 hardcoded an AWS account ID (`315341936575`) in environment variables because `data.aws_caller_identity` wasn't available in the `app-config/env-config` context (which runs during `terraform plan` without AWS credentials in CI). This is noted as a pragmatic workaround, not best practice.

**Exemplar PRs:** #4411

### 7.3 Using `data.aws_caller_identity` in app-config

**Confidence:** Medium

PR #4386 added `data.aws_caller_identity` to `app-config/env-config/main.tf`, but PR #4411 immediately reverted it because app-config runs in a context without AWS credentials. Data sources that require AWS API calls should only be used in the `service/` layer.

**Exemplar PRs:** #4386 (introduced), #4411 (reverted)

### 7.4 Feature Flags Set in Wrong Config File

**Confidence:** Medium

PR #8359 review caught that setting feature flag defaults in `.env.development` is wrong because deployed environments use `.env.production`. Feature flag values should be set in SSM for deployed environments.

**Exemplar PRs:** #8359

### 7.5 WAF Rule Overrides with Service Name Prefix Matching

**Confidence:** Low-Medium

PR #5339 used `startswith(var.service_name, "api-")` to conditionally override WAF rules for the API service. This is fragile string matching rather than a proper boolean variable.

**Exemplar PRs:** #5339

---

## 8. Evolution Trends

### 8.1 Template-Infra Upstream Upgrades

The project periodically pulls in upgrades from `navapbc/template-infra`. PR #8456 represents a major upgrade (v0.15.7) that:
- Decomposed monolithic config outputs into domain-specific modules
- Added `modules/domain/`, `modules/secrets/`, `modules/feature_flags/`, `modules/network/`
- Introduced data/resources split pattern for modules (e.g., `modules/domain/data/` vs `modules/domain/resources/`)
- Moved away from workspace-prefix-based naming

### 8.2 Increasing Modularization

Early PRs show more inline resource definitions; later PRs extract reusable modules (sqs-queue, domain, feature_flags, secrets). The trend is toward smaller, composable modules.

### 8.3 Security Hardening Over Time

- PR #6504: Restricted outbound security group traffic (resolved Checkov CKV_AWS_382)
- PR #5375: Added mTLS support
- PR #5339: Added WAF rule overrides for SOAP/XML handling
- PR #6416: Scoped API Gateway IAM to specific actions

### 8.4 Multi-Application Growth

The infrastructure grew from primarily api/frontend to include analytics, nofos, and fluentbit applications, all following the same three-layer pattern. The nofos application (PR #5261, #5278, #5343) demonstrates how the patterns scale to new applications.

### 8.5 AWS Provider Version Progression

Observed upgrade from AWS provider ~5.68.0 to ~6.13.0 across the timeframe. Lock files are updated as part of feature PRs rather than dedicated upgrade PRs.
