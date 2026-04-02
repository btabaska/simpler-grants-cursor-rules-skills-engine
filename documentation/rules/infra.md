# Infrastructure / Terraform — Conventions & Rules

> **Status:** Draft — pending tech lead validation. Items marked (⏳) are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The Simpler Grants infrastructure is managed entirely through Terraform, following a modular, layered architecture that separates configuration from resource creation. All infrastructure code lives under `infra/` in the monorepo, organized by application (api, frontend, analytics, nofos, fluentbit) with shared reusable modules under `infra/modules/`. The architecture enforces a strict three-layer separation — `app-config` (pure configuration, no AWS API calls), `service` (resource creation via shared modules), and `database` (Aurora cluster) — that enables safe CI planning without AWS credentials and isolated blast radius per layer.

The infrastructure team relies heavily on reviewer-enforced conventions, with **chouinar** serving as the primary authority on environment variables, SSM patterns, and secret management, and **sean-navapbc** enforcing Terraform module design principles. Boolean feature gating, SSM-backed secrets, and Checkov security scanning form the backbone of the resource management and security posture. The project periodically pulls upstream upgrades from `navapbc/template-infra`, most recently v0.15.7 (PR #8456), which introduced significant modularization improvements.

For related patterns, see [CI/CD Conventions](ci-cd.md) for deployment workflows that consume this infrastructure, and [Cross-Domain Conventions](cross-domain.md) for feature flag lifecycle and SSM parameter patterns that span infrastructure and application code.

## Rules

### Application Structure

#### Rule: Three-Layer Application Structure
**Confidence:** High
**Observed in:** 172 of 172 PRs | PR refs: #4362, #5228, #8456

ALWAYS organize each application under `infra/<app_name>/` into three standard layers: `app-config/` (configuration and environment variables), `service/` (ECS service, ALB, networking), and `database/` (Aurora cluster). NEVER place service-level resource definitions in `app-config/` or configuration logic in `service/`.

**DO:**
```hcl
# From PR #4362 — app-config layer with per-environment modules
# infra/api/app-config/prod.tf
module "prod_config" {
  source                          = "./env-config"
  environment                     = "prod"
  network_name                    = "prod"
  domain_name                     = "api.simpler.grants.gov"
  enable_https                    = true
  has_database                    = local.has_database
  database_enable_http_endpoint   = true
  has_incident_management_service = local.has_incident_management_service
}
```

**DON'T:**
```hcl
# Anti-pattern — mixing resource creation into app-config
# infra/api/app-config/env-config/main.tf
resource "aws_ecs_service" "api" {  # WRONG: belongs in service/ layer
  name = "api"
  ...
}
```

> **Rationale:** Separating configuration from resource creation enables safe `terraform plan` without AWS credentials (app-config), isolated blast radius per layer, and consistent onboarding of new applications.

---

#### Rule: No AWS Data Sources in `app-config`
**Confidence:** High
**Observed in:** 2 of 172 PRs (corrective) | PR refs: #4386, #4411

NEVER use AWS API-dependent data sources (e.g., `data.aws_caller_identity`, `data.aws_vpc`) in the `app-config/` layer. The `app-config` layer runs during `terraform plan` in CI without AWS credentials. ALWAYS place AWS data source lookups in the `service/` layer.

**DO:**
```hcl
# From PR #4411 — hardcoded workaround when data source unavailable in app-config
# infra/frontend/app-config/env-config/environment_variables.tf
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = "315341936575"
```

**DON'T:**
```hcl
# Anti-pattern — data source in app-config breaks CI (no AWS credentials)
# infra/frontend/app-config/env-config/main.tf
data "aws_caller_identity" "current" {}  # WRONG: requires AWS API call

NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = data.aws_caller_identity.current.account_id
```

> **Rationale:** PR #4386 added `data.aws_caller_identity` to `app-config/env-config/main.tf`. PR #4411 had to immediately revert it because CI runs `terraform plan` on `app-config` without AWS credentials, causing failures. This is an architectural constraint of the three-layer structure.

---

#### Rule: Decomposed Config Outputs Mirror Module Interfaces
**Confidence:** High
**Observed in:** 172 of 172 PRs (refined in #8456) | PR refs: #8456

ALWAYS structure `app-config` outputs to match what consuming layers need. ALWAYS use separate outputs per domain concern (database_config, domain_config, service_config, monitoring_config, feature_flags_config). NEVER combine unrelated concerns into a single monolithic output.

**DO:**
```hcl
# From PR #8456 — decomposed outputs per domain concern
# infra/frontend/app-config/env-config/outputs.tf
output "database_config" {
  value = local.database_config
}

output "feature_flags_config" {
  value = local.feature_flags_config
}

output "monitoring_config" {
  value = local.monitoring_config
}

output "domain_config" {
  value = local.domain_config
}

output "service_config" {
  value = local.service_config
}
```

**DON'T:**
```hcl
# Anti-pattern — monolithic output combining unrelated concerns
output "config" {
  value = {
    service_name  = "frontend"
    database_host = "..."
    domain_name   = "..."
    monitoring    = { ... }
    feature_flags = { ... }
  }
}
```

> **Rationale:** Decomposed outputs enable modules to evolve independently. When `service_config` was monolithic, any change to monitoring or domain config required modifying the same output block. Separation reduces merge conflicts and improves clarity.

---

### Resource Management

#### Rule: Feature-Gated Resources via `count` and Boolean Variables
**Confidence:** High
**Observed in:** 25+ of 172 PRs | PR refs: #5228, #5340, #5375

ALWAYS use `count = var.enable_<feature> ? 1 : 0` to conditionally create resources. ALWAYS define the gating variable with `type = bool` and `default = false`. When a resource is conditionally created, ALWAYS use indexed access (`[0]`) on all references, and ALWAYS make related resources (policies, attachments) conditional with the same guard.

**DO:**
```hcl
# From PR #5228 — API Gateway gated by boolean
# infra/modules/service/variables.tf
variable "enable_api_gateway" {
  description = "Whether to enable API Gateway for the service"
  type        = bool
  default     = false
}

# infra/modules/service/api_gateway.tf
resource "aws_api_gateway_rest_api" "api" {
  count = var.enable_api_gateway ? 1 : 0
  name  = var.service_name
}
```

**DON'T:**
```hcl
# Anti-pattern — conditional resource without indexed access on references
resource "aws_iam_policy" "email_access" {
  count  = length(var.pinpoint_app_id) > 0 ? 1 : 0
  policy = data.aws_iam_policy_document.email_access.json  # WRONG: missing [0]
}
```

> **Rationale:** Boolean-gated resources allow features to be safely added to shared modules without affecting applications that do not opt in. The `default = false` convention ensures new features are explicitly enabled, preventing accidental resource creation. PR #5340 fixed a case where missing indexed access caused failures for services without email.

---

#### Rule: Separate IAM Policy Documents Per Concern
**Confidence:** High
**Observed in:** 15+ of 172 PRs | PR refs: #5326, #6416

ALWAYS create a separate `aws_iam_policy_document`, `aws_iam_policy`, and `aws_iam_role_policy_attachment` for each distinct IAM concern (task execution, runtime logs, email access, API Gateway access). ALWAYS attach runtime permissions to the `app_service` role (not `task_executor`). NEVER combine unrelated permissions into a single policy document.

**DO:**
```hcl
# From PR #5326 — email permissions attached to app_service (runtime), not task_executor
# infra/modules/service/access_control.tf
data "aws_iam_policy_document" "email_access" {
  dynamic "statement" {
    for_each = length(var.pinpoint_app_id) > 0 ? [1] : []
    content {
      sid       = "SendViaPinpoint"
      actions   = ["mobiletargeting:SendMessages"]
      resources = ["arn:aws:mobiletargeting:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:apps/${var.pinpoint_app_id}/messages"]
    }
  }
}

resource "aws_iam_role_policy_attachment" "email_access" {
  role       = aws_iam_role.app_service.name  # app_service, not task_executor
  policy_arn = aws_iam_policy.email_access[0].arn
}
```

**DON'T:**
```hcl
# Anti-pattern — attaching runtime permissions to the wrong role
resource "aws_iam_role_policy_attachment" "email_access" {
  role       = aws_iam_role.task_executor.name  # WRONG: task_executor is startup-only
  policy_arn = aws_iam_policy.email_access[0].arn
}
```

> **Rationale:** PR #5326 demonstrated the real-world consequence of wrong-role attachment: Pinpoint permissions placed on `task_executor` (startup-only) rather than `app_service` (runtime) caused email sending to fail silently. Separating concerns by policy document makes auditing straightforward and reduces blast radius of IAM changes.

---

#### Rule: Restrict Security Group Egress to Specific Ports
**Confidence:** High
**Observed in:** 1 of 172 PRs (establishes pattern for all services) | PR refs: #6504

NEVER allow unrestricted outbound traffic (`protocol = "-1"`, `from_port = 0`, `to_port = 0`) on application security groups. ALWAYS restrict egress to the specific ports the application needs (typically 443 for HTTPS, 80 for HTTP, 5432 for PostgreSQL). For ALB security groups, scope egress to the application security group.

**DO:**
```hcl
# From PR #6504 — restricted app egress to specific ports
resource "aws_security_group" "app" {
  egress {
    description = "All TCP traffic outbound"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

**DON'T:**
```hcl
# Anti-pattern — unrestricted outbound traffic (fails Checkov CKV_AWS_382)
resource "aws_security_group" "app" {
  egress {
    description = "Allow all outgoing traffic from application"
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

> **Rationale:** This resolved Checkov rule CKV_AWS_382. Restricting outbound traffic is a defense-in-depth measure that limits lateral movement in case of compromise.

---

#### Rule: SQS Queue Module Pattern (Main + DLQ + Access Policy) (⏳)
**Confidence:** Medium-High
**Observed in:** 1 of 172 PRs (establishes module pattern) | PR refs: #8445

When creating SQS queues, ALWAYS use the `infra/modules/sqs-queue` module. ALWAYS include a dead letter queue with a redrive policy. ALWAYS enable `sqs_managed_sse_enabled = true`. ALWAYS expose `access_policy_arn` as a module output.

**DO:**
```hcl
# From PR #8445 — module with DLQ and encryption
# infra/modules/sqs-queue/main.tf
resource "aws_sqs_queue" "dead_letter" {
  name                      = "${var.name}_dlq"
  message_retention_seconds = var.message_retention_seconds
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "main" {
  name                       = var.name
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = var.max_receive_count
  })
}
```

**DON'T:**
```hcl
# Anti-pattern — inline SQS without DLQ or encryption
resource "aws_sqs_queue" "main" {
  name = "my-queue"
  # Missing: DLQ, encryption, access policy
}
```

> **Rationale:** Bundling the DLQ and encryption into the module ensures every queue gets these critical features by default. Keeping resource-based policies at the consumer level allows different services to have different access patterns for the same module.

---

### Environment Variables & Secrets

#### Rule: Two-Tier Environment Variables (Plain + Secrets via SSM)
**Confidence:** High
**Observed in:** 30+ of 172 PRs | PR refs: #5278, #8392, #6465

ALWAYS manage environment variables through the two-tier system in `app-config/env-config/environment_variables.tf`. Plain values go in `default_extra_environment_variables` (overridable via `service_override_extra_environment_variables`). Sensitive values go in the `secrets` map with `manage_method = "manual"` and an SSM path following `/<app_name>/<environment>/<secret-name>`. NEVER create custom SSM parameter resources outside this pattern.

**DO:**
```hcl
# From PR #5278 — secrets with manual management
# infra/nofos/app-config/env-config/environment_variables.tf
locals {
  default_extra_environment_variables = {
    DEBUG = "false"
  }

  secrets = {
    API_TOKEN = {
      manage_method     = "manual"
      secret_store_name = "/nofos/${var.environment}/api-token"
    }
    SECRET_KEY = {
      manage_method     = "manual"
      secret_store_name = "/nofos/${var.environment}/secret-key"
    }
  }
}
```

**DON'T:**
```hcl
# Anti-pattern — creating a custom SSM parameter instead of using the secrets map
# Reviewer chouinar rejected this approach in PR #6465:
# "Are we not able to define this secret / env var like our other secrets?"
resource "aws_ssm_parameter" "custom_api_key" {
  name  = "/api/dev/custom-key"
  type  = "SecureString"
  value = "placeholder"
}
```

> **Rationale:** Centralizing all environment variable definitions in one file per app provides a single source of truth, makes auditing straightforward, and ensures the deployment pipeline can consistently resolve all secrets. The SSM path convention (`/<app>/<env>/<name>`) enables cross-environment management.

---

#### Rule: SSM Parameters Must Exist Before Merge
**Confidence:** High
**Observed in:** 5+ of 172 PRs (reviewer-enforced) | PR refs: #8392, #6465

ALWAYS create SSM parameters in all environments (dev, staging, training, prod) before merging a PR that references them. Even placeholder values are acceptable. NEVER merge a PR that adds new secret references without confirming the SSM parameters exist.

**DO:**
```text
# From PR #8392 — reviewer enforcement by chouinar:
# "Have you added values for all of these into parameter store for every env?
#  Even if we don't have actual values yet, if they don't exist, deploys will fail
#  as it tries to fetch them."
#
# Author responded with a screenshot confirming parameters were created
# in dev, staging, training, and prod.
```

**DON'T:**
```text
# Anti-pattern — merging a PR that references new SSM parameters
# without creating them first. The deployment pipeline fetches all
# SSM parameters during terraform apply; missing parameters cause
# immediate deploy failure across all environments.
```

> **Rationale:** The deployment pipeline fetches all SSM parameters during `terraform apply`. Missing parameters cause immediate deploy failure across all environments. Creating parameters before merge is a safety gate.

---

#### Rule: Feature Flags as Secrets with `manage_method = "manual"`
**Confidence:** High
**Observed in:** 10+ of 172 PRs | PR refs: #6419, #8359, #8456

ALWAYS define feature flags in `environment_variables.tf` using the naming convention `FEATURE_<NAME>_ON` or `FEATURE_<NAME>_OFF` with `manage_method = "manual"` and SSM path `/<app_name>/<environment>/feature-<kebab-name>`. Feature flag values MUST be set in SSM Parameter Store (not in `.env` files) for deployed environments.

**DO:**
```hcl
# From PR #6419 — adding a feature flag
# infra/frontend/app-config/env-config/environment_variables.tf
FEATURE_USER_ADMIN_OFF = {
  manage_method     = "manual"
  secret_store_name = "/${var.app_name}/${var.environment}/feature-user-admin-off"
},
```

**DON'T:**
```env
# Anti-pattern — setting feature flags in .env files for deployed environments
# PR #8359 review caught this: .env.development is wrong because deployed
# environments use .env.production. Use SSM for deployed environments.
FEATURE_USER_ADMIN_OFF=true
```

> **Rationale:** Treating feature flags as SSM-backed secrets enables runtime toggling without redeployment. The `manual` manage_method prevents Terraform from overwriting values that operators set in the console or via CLI.

---

### Module Design

#### Rule: Shared Reusable Modules under `infra/modules/`
**Confidence:** High
**Observed in:** 30+ of 172 PRs | PR refs: #8445

ALWAYS place reusable infrastructure components in `infra/modules/<module_name>/`. ALWAYS consume these modules from the application `service/` layer (not `app-config/`). When creating a new module, ALWAYS include: `main.tf` (resources), `variables.tf` (with type and description on every variable), and `outputs.tf` (exposing values consumers need, including IAM access policy ARNs).

**DO:**
```hcl
# From PR #8445 — module consumption from service layer
# infra/api/service/sqs.tf
module "sqs_queue" {
  source = "../../modules/sqs-queue"

  name                       = "${local.prefix}${local.sqs_config.queue_name}"
  visibility_timeout_seconds = local.sqs_config.visibility_timeout_seconds
  message_retention_seconds  = local.sqs_config.message_retention_seconds
  max_receive_count          = local.sqs_config.max_receive_count
}
```

**DON'T:**
```hcl
# Anti-pattern — duplicating resource definitions inline instead of using a module
# infra/frontend/service/main.tf
resource "aws_sqs_queue" "main" {
  name = "frontend-queue"
  # Duplicating logic that belongs in a shared module
}
```

> **Rationale:** Shared modules enforce consistency across applications, reduce duplication, and provide a single place to apply security standards (e.g., encryption settings, DLQ policies). Bundling IAM access policies as outputs simplifies consumer wiring.

---

#### Rule: Variable Declarations with Type, Description, and Default
**Confidence:** High
**Observed in:** 172 of 172 PRs | PR refs: #8445, #5375

ALWAYS declare variables with `type`, `description`, and (for optional variables) a `default` value. ALWAYS use `snake_case` naming. ALWAYS prefer variables over locals for configuration that may need per-environment overrides.

**DO:**
```hcl
# From PR #8445 — standard variable declaration
variable "sqs_visibility_timeout_seconds" {
  description = "The visibility timeout for the SQS queue in seconds"
  type        = number
  default     = 600
}

variable "sqs_message_retention_seconds" {
  description = "The number of seconds Amazon SQS retains a message"
  type        = number
  default     = 1209600
}
```

**DON'T:**
```hcl
# Anti-pattern — using locals for per-environment configuration
# Reviewer sean-navapbc in PR #8445:
# "the config is only defined in the shared locals -- there's no per-environment
#  override mechanism. I prefer variables versus locals always"
locals {
  sqs_config = {
    visibility_timeout_seconds = 600
    message_retention_seconds  = 1209600
  }
}
```

> **Rationale:** Consistent variable declarations enable tooling (documentation generation, validation), improve readability, and make per-environment customization possible. The "variables over locals" preference was explicitly stated by the platform team.

---

### Security & Compliance

#### Rule: Checkov Skip Annotations with Issue References
**Confidence:** High
**Observed in:** 5+ of 172 PRs | PR refs: #5228, #6504

When a Checkov security rule cannot be immediately satisfied, ALWAYS add a `checkov:skip` comment with the rule ID and either a GitHub issue link or a brief explanation. NEVER skip a Checkov rule without documenting why. Resolve Checkov skips as soon as practical.

**DO:**
```hcl
# From PR #5228 — skip with explanation
resource "aws_api_gateway_rest_api" "api" {
  count = var.enable_api_gateway ? 1 : 0
  name  = var.service_name

  # checkov:skip=CKV_AWS_237: Address in future work
}
```

**DON'T:**
```hcl
# Anti-pattern — unannotated skip
resource "aws_api_gateway_rest_api" "api" {
  # checkov:skip=CKV_AWS_237
  # WRONG: no explanation of why the skip exists
}
```

> **Rationale:** Checkov enforces security baselines. Annotated skips create traceability — reviewers can verify that the skip is intentional and track when it should be resolved. PR #6504 resolved CKV_AWS_382 by actually restricting outbound security group traffic, demonstrating the lifecycle.

---

#### Rule: Lock Files Committed to Repository
**Confidence:** High
**Observed in:** 172 of 172 PRs | PR refs: #5228

ALWAYS commit `.terraform.lock.hcl` files for each deployable layer (service/, database/). Provider upgrades MUST appear as lock file diffs in PRs.

**DO:**
```text
# From PR #5228 — lock file diff from new provider addition
# infra/api/service/.terraform.lock.hcl
+provider "registry.terraform.io/hashicorp/local" {
+  version = "2.5.3"
+  hashes = [
+    "h1:MCzg+hs1/ZQ32u56VzJMWP9ONRQPAAqAjuHuzbyshvI=",
+    ...
+  ]
+}
```

**DON'T:**
```text
# Anti-pattern — .terraform.lock.hcl in .gitignore
# This prevents reproducible builds across developer machines and CI.
```

> **Rationale:** Committed lock files ensure reproducible builds across developer machines and CI. They also make provider version changes explicitly visible in code review.

---

#### Rule: Avoid Duplicate Resource Definitions
**Confidence:** High
**Observed in:** 1 of 172 PRs (corrective) | PR refs: #4320

NEVER define the same data source or resource under multiple names. When consolidating duplicates, ALWAYS update all references to use the surviving name consistently.

**DO:**
```hcl
# From PR #4320 — single data source after consolidation
data "aws_acm_certificate" "cert" {
  count       = local.service_config.enable_https ? 1 : 0
  domain      = local.service_config.domain_name
  most_recent = true
}
```

**DON'T:**
```hcl
# Anti-pattern — two data sources fetching the same certificate
data "aws_acm_certificate" "cert" {
  count  = local.service_config.domain_name != null ? 1 : 0
  domain = local.service_config.domain_name
}

data "aws_acm_certificate" "certificate" {
  count  = local.service_config.enable_https ? 1 : 0
  domain = local.service_config.domain_name
}
```

> **Rationale:** Duplicate resources cause confusion (which one is canonical?), waste API calls, and create opportunities for drift where one is updated but the other is not.

---

## Anti-Patterns

### Anti-Pattern A: Fragile String Matching for Conditional Logic (⏳)
**Confidence:** Medium
**Observed in:** 1 PR | PR ref: #5339

NEVER use `startswith()` or other string matching on `var.service_name` to conditionally apply configuration. ALWAYS use explicit boolean variables for feature gating.

```hcl
# Anti-pattern from PR #5339
# infra/modules/service/waf.tf
dynamic "rule_action_override" {
  for_each = startswith(var.service_name, "api-") ? [1] : []  # WRONG: brittle
  content {
    action_to_use { count {} }
    name = "CrossSiteScripting_BODY"
  }
}

# Should use: var.enable_waf_xss_body_override instead
```

> **Rationale:** String-based conditionals are brittle — they break if naming conventions change, and they obscure the intent. Boolean variables are self-documenting and can be set independently.

---

### Anti-Pattern B: Hardcoding AWS Account IDs (⏳)
**Confidence:** Medium
**Observed in:** 1 PR | PR ref: #4411

AVOID hardcoding AWS account IDs in Terraform configuration. When `data.aws_caller_identity` is unavailable (as in `app-config`), surface the account ID through `project-config` or accept it as a variable.

```hcl
# Workaround from PR #4411
# infra/frontend/app-config/env-config/environment_variables.tf
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = "315341936575"
# Known trade-off: works but fragile if the project moves to a different AWS account
```

> **Rationale:** This was necessary because `data.aws_caller_identity` cannot be used in `app-config` (no AWS credentials in CI). The hardcoded value works but is fragile.

---

## Known Inconsistencies

1. **Feature Flag Naming Convention (INC-1):** Frontend flags use `FEATURE_{NAME}_OFF` with SSM `manage_method = "manual"`, while API flags use `ENABLE_{FEATURE}_ENDPOINTS = 1` as plain env vars, and local dev uses `ENABLE_{FEATURE}=TRUE`. Three different naming patterns and three different truthy values. See [Cross-Domain Conventions](cross-domain.md) for details.

2. **Monolithic vs. Decomposed Outputs:** The API application may still use the older monolithic output style while frontend has adopted decomposed outputs (PR #8456). Migration status is unclear.

3. **`enable_*` Booleans vs. String-Length Guards:** Some conditional resources use `length(var.pinpoint_app_id) > 0` rather than a dedicated `enable_*` boolean. Whether these should be refactored for consistency is an open question.

---

## Related Documents

- [CI/CD Conventions](ci-cd.md) — Deployment workflows, environment promotion, feature flags in Terraform
- [Cross-Domain Conventions](cross-domain.md) — CCP-8 (Feature Flag Lifecycle), CCP-10 (SSM Parameters Must Exist Before Merge)
- `analysis/pass2/infra.md` — Full Pass 2 codification with all code examples
- `analysis/pass1/infra.md` — Pass 1 pattern discovery with PR corpus details
