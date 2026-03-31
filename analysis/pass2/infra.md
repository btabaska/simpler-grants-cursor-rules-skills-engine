# Infrastructure/Terraform -- Pass 2: Codified Patterns

**Source:** 172 merged PRs in the `infra` domain of HHS/simpler-grants-gov
**Date range:** ~2025-03 through 2026-02
**Pass 1 document:** `analysis/pass1/infra.md`
**Analysis date:** 2026-03-30

---

## Pattern 1: Three-Layer Application Structure

**Rule Statement:** ALWAYS organize each application under `infra/<app_name>/` into three standard layers: `app-config/` (configuration and environment variables), `service/` (ECS service, ALB, networking), and `database/` (Aurora cluster). NEVER place service-level resource definitions in `app-config/` or configuration logic in `service/`.

**Confidence:** High
**Frequency:** Universal -- every application (api, frontend, analytics, nofos, fluentbit) follows this structure across all 172 PRs.

### Code Examples

**Example 1 -- app-config layer with per-environment modules (PR #4362):**
```hcl
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
```

**Example 2 -- service layer consuming app-config outputs (PR #5228):**
```hcl
# infra/api/service/main.tf
module "service" {
  source       = "../../modules/service"
  service_name = local.service_config.service_name
  # ...
  enable_api_gateway = true
```

**Example 3 -- PR #8456 decomposed service/ into sub-files:**
New files in `infra/frontend/service/`: `database.tf`, `domain.tf`, `feature_flags.tf`, `monitoring.tf`, `secrets.tf` -- each wiring a specific concern from `app-config` to a shared module.

### Rationale
Separating configuration from resource creation enables safe `terraform plan` without AWS credentials (app-config), isolated blast radius per layer, and consistent onboarding of new applications.

### Open Questions
- PR #8456 introduced significant sub-file decomposition within `service/`. Should all applications converge to the new granular file layout (domain.tf, monitoring.tf, etc.), or can they retain the monolithic `main.tf` approach?

---

## Pattern 2: Feature-Gated Resources via `count` and Boolean Variables

**Rule Statement:** ALWAYS use `count = var.enable_<feature> ? 1 : 0` to conditionally create resources. ALWAYS define the gating variable with `type = bool` and `default = false`. When a resource is conditionally created, ALWAYS use indexed access (`[0]`) on all references, and ALWAYS make related resources (policies, attachments) conditional with the same guard.

**Confidence:** High
**Frequency:** Very High (~25+ PRs)

### Code Examples

**Example 1 -- API Gateway gated by boolean (PR #5228):**
```hcl
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
  # ...
}
```

**Example 2 -- Consistent indexing for conditional resources (PR #5340, fixing PR #5326):**
```hcl
# infra/modules/service/access_control.tf
resource "aws_iam_policy" "email_access" {
  count  = length(var.pinpoint_app_id) > 0 ? 1 : 0
  name   = "${var.service_name}-email-access-role-policy"
  policy = data.aws_iam_policy_document.email_access[0].json  # indexed access
}

resource "aws_iam_role_policy_attachment" "email_access" {
  count = length(var.pinpoint_app_id) > 0 ? 1 : 0  # same guard
  role       = aws_iam_role.app_service.name
  policy_arn = aws_iam_policy.email_access[0].arn   # indexed access
}
```

**Example 3 -- mTLS load balancer gated by boolean (PR #5375):**
```hcl
variable "enable_mtls_load_balancer" {
  type        = bool
  description = "Stand up a second twin LB that will support mTLS client certificate auth passthrough"
  default     = false
}
```

### Rationale
Boolean-gated resources allow features to be safely added to shared modules without affecting applications that do not opt in. The `default = false` convention ensures new features are explicitly enabled, preventing accidental resource creation.

### Open Questions
- Some guards use `length(var.pinpoint_app_id) > 0` rather than a dedicated boolean. Should these be refactored to use explicit `enable_*` booleans for consistency?

---

## Pattern 3: Separate IAM Policy Documents Per Concern

**Rule Statement:** ALWAYS create a separate `aws_iam_policy_document`, `aws_iam_policy`, and `aws_iam_role_policy_attachment` for each distinct IAM concern (task execution, runtime logs, email access, API Gateway access). ALWAYS attach runtime permissions to the `app_service` role (not `task_executor`). NEVER combine unrelated permissions into a single policy document.

**Confidence:** High
**Frequency:** High (~15+ PRs)

### Code Examples

**Example 1 -- Separate policy documents per concern (PR #5326):**
```hcl
# infra/modules/service/access_control.tf

# Task startup permissions
data "aws_iam_policy_document" "task_executor" { ... }

# Runtime log permissions (Fluentbit)
data "aws_iam_policy_document" "runtime_logs" { ... }

# Email permissions -- attached to app_service, NOT task_executor
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

**Example 2 -- API Gateway access as its own policy (PR #6416):**
```hcl
data "aws_iam_policy_document" "api_gateway_access" {
  count = var.enable_api_gateway ? 1 : 0

  statement {
    sid     = "AllowGetApiKeys"
    actions = ["apigateway:GET"]
    resources = [
      "arn:aws:apigateway:${data.aws_region.current.name}::/apikeys/*",
    ]
  }

  statement {
    sid     = "AllowImportApiKeys"
    actions = ["apigateway:POST"]
    resources = [
      "arn:aws:apigateway:${data.aws_region.current.name}::/apikeys",
    ]
  }
}
```

### Rationale
PR #5326 demonstrated the real-world consequence of wrong-role attachment: Pinpoint permissions placed on `task_executor` (startup-only) rather than `app_service` (runtime) caused email sending to fail silently. Separating concerns by policy document makes auditing straightforward and reduces blast radius of IAM changes.

### Open Questions
- None. This pattern is well-established and consistently enforced by reviewers.

---

## Pattern 4: Two-Tier Environment Variables (Plain + Secrets via SSM)

**Rule Statement:** ALWAYS manage environment variables through the two-tier system in `app-config/env-config/environment_variables.tf`. Plain values go in `default_extra_environment_variables` (overridable via `service_override_extra_environment_variables`). Sensitive values go in the `secrets` map with `manage_method = "manual"` and an SSM path following `/<app_name>/<environment>/<secret-name>`. NEVER create custom SSM parameter resources outside this pattern -- use the existing secrets mechanism instead.

**Confidence:** High
**Frequency:** Very High (~30+ PRs)

### Code Examples

**Example 1 -- Secrets with manual management (PR #5278):**
```hcl
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
    DJANGO_ALLOWED_HOSTS = {
      manage_method     = "manual"
      secret_store_name = "/nofos/${var.environment}/django-allowed-hosts"
    }
    SECRET_KEY = {
      manage_method     = "manual"
      secret_store_name = "/nofos/${var.environment}/secret-key"
    }
  }
}
```

**Example 2 -- Adding new secrets for SOAP Gateway (PR #8392):**
```hcl
SOAP_PARTNER_GATEWAY_URI = {
  manage_method     = "manual"
  secret_store_name = "/api/${var.environment}/soap-partner-gateway-uri"
}

SOAP_PARTNER_GATEWAY_AUTH_KEY = {
  manage_method     = "manual"
  secret_store_name = "/api/${var.environment}/soap-partner-gateway-auth-key"
}
```

**Example 3 -- Reviewer enforcing the pattern (PR #6465):**
Reviewer `chouinar` pushed back on creating a custom SSM parameter resource:
> "Are we not able to define this secret / env var like our other secrets? [...] If this is manually set, I think we just need to add it to that list unless there's something more complex I'm missing here"

### Rationale
Centralizing all environment variable definitions in one file per app provides a single source of truth, makes auditing straightforward, and ensures the deployment pipeline can consistently resolve all secrets. The SSM path convention (`/<app>/<env>/<name>`) enables cross-environment management.

### Open Questions
- PR #8392 reviewer noted `SOAP_PARTNER_GATEWAY_URI` should have been a plain environment variable, not a secret. Where is the line between "should be secret" vs. "should be plain"?

---

## Pattern 5: SSM Parameters Must Exist Before Merge

**Rule Statement:** ALWAYS create SSM parameters in all environments (dev, staging, training, prod) before merging a PR that references them. Even placeholder values are acceptable. NEVER merge a PR that adds new secret references without confirming the SSM parameters exist -- deploys will fail.

**Confidence:** High
**Frequency:** High -- enforced in multiple review threads

### Code Examples

**Example 1 -- Reviewer enforcement (PR #8392):**
Review comment from `chouinar`:
> "Have you added values for all of these into parameter store for every env? Even if we don't have actual values yet, if they don't exist, deploys will fail as it tries to fetch them."

Author responded with a screenshot confirming parameters were created in dev, staging, training, and prod.

**Example 2 -- Enforcement during API key creation (PR #6465):**
Review thread between `chouinar` and `Nava-JoshLong`:
> chouinar: "Wouldn't we need to generate and store the key manually before we merge this either way?"
> chouinar: "our usual process assumes you setup the env var in parameter store before merging the change. That's how they've all behaved"
> Nava-JoshLong: "Got it, params have been made, and terraform creating it has been removed. Plan is working as expected now"

### Rationale
The deployment pipeline fetches all SSM parameters during `terraform apply`. Missing parameters cause immediate deploy failure across all environments. Creating parameters before merge is a safety gate.

### Open Questions
- Is there tooling or automation that could validate SSM parameter existence in CI before merge, rather than relying solely on reviewer diligence?

---

## Pattern 6: Feature Flags as Secrets with `manage_method = "manual"`

**Rule Statement:** ALWAYS define feature flags in `environment_variables.tf` using the naming convention `FEATURE_<NAME>_ON` or `FEATURE_<NAME>_OFF` with `manage_method = "manual"` and SSM path `/<app_name>/<environment>/feature-<kebab-name>`. Feature flag values MUST be set in SSM Parameter Store (not in `.env` files) for deployed environments.

**Confidence:** High
**Frequency:** High (~10+ PRs)

### Code Examples

**Example 1 -- Adding a feature flag (PR #6419):**
```hcl
# infra/frontend/app-config/env-config/environment_variables.tf
FEATURE_USER_ADMIN_OFF = {
  manage_method     = "manual"
  secret_store_name = "/${var.app_name}/${var.environment}/feature-user-admin-off"
},
```

**Example 2 -- Feature flag for opportunities list (PR #8359):**
```hcl
FEATURE_OPPORTUNITIES_LIST_OFF = {
  manage_method     = "manual"
  secret_store_name = "/${var.app_name}/${var.environment}/feature-opportunities-list-off"
},
```

**Example 3 -- New structured feature flags module (PR #8456):**
```hcl
# infra/frontend/app-config/env-config/feature_flags.tf
locals {
  feature_flag_defaults = {
    # FOO = false
    # BAR = false
  }
  feature_flags_config = merge(
    local.feature_flag_defaults,
    var.feature_flag_overrides
  )
}

# infra/frontend/service/feature_flags.tf
module "feature_flags" {
  source        = "../../modules/feature_flags"
  service_name  = local.service_name
  feature_flags = local.feature_flags_config
}
```

### Rationale
Treating feature flags as SSM-backed secrets enables runtime toggling without redeployment. The `manual` manage_method prevents Terraform from overwriting values that operators set in the console or via CLI.

### Open Questions
- PR #8456 introduces a dedicated `feature_flags` module with validation and SSM parameters. Should all applications migrate existing `FEATURE_*` entries from the secrets map to this new module? This would be a significant migration.

---

## Pattern 7: Shared Reusable Modules under `infra/modules/`

**Rule Statement:** ALWAYS place reusable infrastructure components in `infra/modules/<module_name>/`. ALWAYS consume these modules from the application `service/` layer (not `app-config/`). When creating a new module, ALWAYS include: `main.tf` (resources), `variables.tf` (with type and description on every variable), and `outputs.tf` (exposing values consumers need, including IAM access policy ARNs).

**Confidence:** High
**Frequency:** High (~30+ PRs)

### Code Examples

**Example 1 -- SQS module structure (PR #8445):**
```hcl
# infra/modules/sqs-queue/main.tf
resource "aws_sqs_queue" "dead_letter" {
  name                      = "${var.name}_dlq"
  message_retention_seconds = var.message_retention_seconds
  sqs_managed_sse_enabled   = true
}

resource "aws_sqs_queue" "main" {
  name                       = var.name
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dead_letter.arn
    maxReceiveCount     = var.max_receive_count
  })
}

# Bundled IAM access policy as output
resource "aws_iam_policy" "access_policy" {
  name   = "${var.name}-access"
  policy = data.aws_iam_policy_document.access_policy.json
}
```

**Example 2 -- Module consumption from service layer (PR #8445):**
```hcl
# infra/api/service/sqs.tf
module "sqs_queue" {
  source = "../../modules/sqs-queue"

  name                       = "${local.prefix}${local.sqs_config.queue_name}"
  visibility_timeout_seconds = local.sqs_config.visibility_timeout_seconds
  message_retention_seconds  = local.sqs_config.message_retention_seconds
  max_receive_count          = local.sqs_config.max_receive_count
}
```

**Example 3 -- Module outputs including access policy ARN (PR #8445):**
```hcl
# infra/modules/sqs-queue/outputs.tf
output "queue_url" {
  description = "The URL for the created Amazon SQS queue"
  value       = aws_sqs_queue.main.url
}

output "access_policy_arn" {
  description = "The ARN of the IAM policy for accessing the queue"
  value       = aws_iam_policy.access_policy.arn
}
```

### Rationale
Shared modules enforce consistency across applications, reduce duplication, and provide a single place to apply security standards (e.g., encryption settings, DLQ policies). Bundling IAM access policies as outputs simplifies consumer wiring.

### Open Questions
- PR #8456 introduces data/resources splits for modules (e.g., `modules/domain/data/` and `modules/domain/resources/`). Should all modules adopt this pattern? What is the criterion for when to split?

---

## Pattern 8: Checkov Skip Annotations with Issue References

**Rule Statement:** When a Checkov security rule cannot be immediately satisfied, ALWAYS add a `checkov:skip` comment with the rule ID and either a GitHub issue link or a brief explanation. NEVER skip a Checkov rule without documenting why. Resolve Checkov skips as soon as practical.

**Confidence:** High
**Frequency:** Medium (~5+ PRs)

### Code Examples

**Example 1 -- Skip with issue reference (PR #5228):**
```hcl
resource "aws_api_gateway_rest_api" "api" {
  count = var.enable_api_gateway ? 1 : 0
  name  = var.service_name

  # checkov:skip=CKV_AWS_237: Address in future work
}
```

**Example 2 -- Skip resolved by actual fix (PR #6504 resolved skip from earlier PRs):**

Before (with skip):
```hcl
resource "aws_security_group" "app" {
  # checkov:skip=CKV_AWS_382:Work on restricting outgoing traffic once integrations are more finalized
  egress {
    description = "Allow all outgoing traffic from application"
    protocol    = "-1"
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

After (skip removed, rule satisfied):
```hcl
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

### Rationale
Checkov enforces security baselines. Annotated skips create traceability -- reviewers can verify that the skip is intentional and track when it should be resolved. Unannotated skips become invisible tech debt.

### Open Questions
- Should there be a standard format for skip annotations (e.g., always including an issue URL)?

---

## Pattern 9: Variable Declarations with Type, Description, and Default

**Rule Statement:** ALWAYS declare variables with `type`, `description`, and (for optional variables) a `default` value. ALWAYS use `snake_case` naming. ALWAYS prefer variables over locals for configuration that may need per-environment overrides.

**Confidence:** High
**Frequency:** Universal

### Code Examples

**Example 1 -- Standard variable declaration (PR #8445):**
```hcl
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

**Example 2 -- Reviewer enforcing variables over locals (PR #8445):**
Reviewer `sean-navapbc`:
> "the config is only defined in the shared locals -- there's no per-environment override mechanism. If different environments need different visibility timeouts or retention periods, there's no way to vary them. I prefer variables versus locals always"

**Example 3 -- Boolean variable with default false (PR #5375):**
```hcl
variable "enable_mtls_load_balancer" {
  type        = bool
  description = "Stand up a second twin LB that will support mTLS client certificate auth passthrough"
  default     = false
}
```

### Rationale
Consistent variable declarations enable tooling (documentation generation, validation), improve readability, and make per-environment customization possible. The `variables over locals` preference was explicitly stated by the platform team.

### Open Questions
- None. This is universally applied.

---

## Pattern 10: No AWS Data Sources in `app-config`

**Rule Statement:** NEVER use AWS API-dependent data sources (e.g., `data.aws_caller_identity`, `data.aws_vpc`) in the `app-config/` layer. The `app-config` layer runs during `terraform plan` in CI without AWS credentials. ALWAYS place AWS data source lookups in the `service/` layer.

**Confidence:** High
**Frequency:** Medium (learned from PR #4386 / #4411)

### Code Examples

**Example 1 -- Reverting data source from app-config (PR #4411):**
```hcl
# infra/frontend/app-config/env-config/main.tf
# REMOVED: data "aws_caller_identity" "current" {}

# infra/frontend/app-config/env-config/environment_variables.tf
# BEFORE (broken):
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = data.aws_caller_identity.current.account_id

# AFTER (hardcoded workaround):
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = "315341936575"
```

### Rationale
PR #4386 added `data.aws_caller_identity` to `app-config/env-config/main.tf`. PR #4411 had to immediately revert it because CI runs `terraform plan` on `app-config` without AWS credentials, causing failures. This is an architectural constraint of the three-layer structure.

### Open Questions
- The hardcoded account ID is acknowledged as not ideal. Is there a plan to surface the account ID through `project-config` (which does not require AWS API calls) instead?

---

## Pattern 11: Decomposed Config Outputs Mirror Module Interfaces

**Rule Statement:** ALWAYS structure `app-config` outputs to match what consuming layers need. ALWAYS use separate outputs per domain concern (database_config, domain_config, service_config, monitoring_config, feature_flags_config). NEVER combine unrelated concerns into a single monolithic output.

**Confidence:** High
**Frequency:** Universal (refined in PR #8456)

### Code Examples

**Example 1 -- Decomposed outputs (PR #8456):**
```hcl
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

**Example 2 -- Domain-specific config locals (PR #8456):**
```hcl
# infra/frontend/app-config/env-config/domain.tf
locals {
  domain_config = {
    hosted_zone  = local.network_config.domain_config.hosted_zone
    domain_name  = var.domain_name
    enable_https = var.enable_https
  }
}
```

### Rationale
Decomposed outputs enable modules to evolve independently. When `service_config` was monolithic, any change to monitoring or domain config required modifying the same output block. Separation reduces merge conflicts and improves clarity.

### Open Questions
- The api application may still use the older monolithic output style. Should there be a tracked migration effort?

---

## Pattern 12: Lock Files Committed to Repository

**Rule Statement:** ALWAYS commit `.terraform.lock.hcl` files for each deployable layer (service/, database/). Provider upgrades MUST appear as lock file diffs in PRs.

**Confidence:** High
**Frequency:** High

### Code Examples

**Example 1 -- Lock file diff from new provider addition (PR #5228):**
```
# infra/api/service/.terraform.lock.hcl
+provider "registry.terraform.io/hashicorp/local" {
+  version = "2.5.3"
+  hashes = [
+    "h1:MCzg+hs1/ZQ32u56VzJMWP9ONRQPAAqAjuHuzbyshvI=",
+    ...
+  ]
+}
```

### Rationale
Committed lock files ensure reproducible builds across developer machines and CI. They also make provider version changes explicitly visible in code review.

### Open Questions
- None.

---

## Pattern 13: Avoid Duplicate Resource Definitions

**Rule Statement:** NEVER define the same data source or resource under multiple names. When consolidating duplicates, ALWAYS update all references to use the surviving name consistently.

**Confidence:** High
**Frequency:** Low (corrective -- 1 key PR)

### Code Examples

**Example 1 -- Duplicate certificate lookup consolidated (PR #4320):**

Before (two data sources fetching the same cert):
```hcl
data "aws_acm_certificate" "cert" {
  count  = local.service_config.domain_name != null ? 1 : 0
  domain = local.service_config.domain_name
}

data "aws_acm_certificate" "certificate" {
  count  = local.service_config.enable_https ? 1 : 0
  domain = local.service_config.domain_name
}
```

After (single data source):
```hcl
data "aws_acm_certificate" "cert" {
  count       = local.service_config.enable_https ? 1 : 0
  domain      = local.service_config.domain_name
  most_recent = true
}
```

The module also had duplicate variables (`cert_arn` and `certificate_arn`) which were consolidated to just `certificate_arn`.

### Rationale
Duplicate resources cause confusion (which one is canonical?), waste API calls, and create opportunities for drift where one is updated but the other is not.

### Open Questions
- None. This was a one-time cleanup that established the precedent.

---

## Pattern 14: Restrict Security Group Egress to Specific Ports

**Rule Statement:** NEVER allow unrestricted outbound traffic (`protocol = "-1"`, `from_port = 0`, `to_port = 0`) on application security groups. ALWAYS restrict egress to the specific ports the application needs (typically 443 for HTTPS, 80 for HTTP, 5432 for PostgreSQL). For ALB security groups, scope egress to the application security group.

**Confidence:** High
**Frequency:** Medium (established in PR #6504, applies to all services)

### Code Examples

**Example 1 -- Restricted app egress (PR #6504):**
```hcl
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

**Example 2 -- ALB egress scoped to app security group (PR #6504):**
```hcl
resource "aws_security_group_rule" "alb_app_local_health_check" {
  depends_on               = [aws_security_group.app]
  from_port                = 0
  to_port                  = 0
  protocol                 = "-1"
  security_group_id        = aws_security_group.alb.id
  source_security_group_id = aws_security_group.app.id
  type                     = "egress"
}
```

### Rationale
This resolved Checkov rule CKV_AWS_382. Restricting outbound traffic is a defense-in-depth measure that limits lateral movement in case of compromise.

### Open Questions
- The egress CIDR is currently `0.0.0.0/0` for all allowed ports. Should this be further restricted to VPC CIDRs or specific endpoints for port 5432?

---

## Pattern 15: SQS Queue Module Pattern (Main + DLQ + Access Policy)

**Rule Statement:** When creating SQS queues, ALWAYS use the `infra/modules/sqs-queue` module. ALWAYS include a dead letter queue with a redrive policy. ALWAYS enable `sqs_managed_sse_enabled = true`. ALWAYS expose `access_policy_arn` as a module output. ALWAYS define resource-based queue policies at the consumer level (not in the module).

**Confidence:** Medium-High
**Frequency:** Low (1 module, but establishing the pattern for future queues)

### Code Examples

**Example 1 -- Module with DLQ and encryption (PR #8445):**
```hcl
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

**Example 2 -- Resource-based policy at consumer level (PR #8445):**
```hcl
# infra/api/service/sqs.tf
data "aws_iam_policy_document" "sqs_queue_policy" {
  statement {
    sid    = "AllowAPIServiceAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = [module.service.app_service_arn]
    }
    actions = [
      "sqs:SendMessage",
      "sqs:ReceiveMessage",
      "sqs:DeleteMessage",
      "sqs:GetQueueAttributes",
      "sqs:GetQueueUrl",
    ]
    resources = [module.sqs_queue.queue_arn]
  }
}
```

### Rationale
Bundling the DLQ and encryption into the module ensures every queue gets these critical features by default. Keeping resource-based policies at the consumer level allows different services to have different access patterns for the same module.

### Open Questions
- The module includes both an IAM-based access policy (output) and the consumer adds a resource-based policy. Is the resource-based policy redundant, or is the intent to layer both for defense-in-depth?

---

## Anti-Pattern A: Fragile String Matching for Conditional Logic

**Rule Statement:** NEVER use `startswith()` or other string matching on `var.service_name` to conditionally apply configuration. ALWAYS use explicit boolean variables for feature gating.

**Confidence:** Medium
**Frequency:** Low (1 PR)

### Code Example

**Anti-pattern (PR #5339):**
```hcl
# infra/modules/service/waf.tf
dynamic "rule_action_override" {
  for_each = startswith(var.service_name, "api-") ? [1] : []
  content {
    action_to_use {
      count {}
    }
    name = "CrossSiteScripting_BODY"
  }
}
```

This should use a variable like `enable_waf_xss_body_override` instead of inferring behavior from the service name string.

### Rationale
String-based conditionals are brittle -- they break if naming conventions change, and they obscure the intent. Boolean variables are self-documenting and can be set independently.

### Open Questions
- Is there a plan to refactor this to a boolean variable? PR #8456 added `enable_waf` as a boolean, suggesting the team is moving in this direction.

---

## Anti-Pattern B: Hardcoding AWS Account IDs

**Rule Statement:** AVOID hardcoding AWS account IDs in Terraform configuration. When `data.aws_caller_identity` is unavailable (as in `app-config`), surface the account ID through `project-config` or accept it as a variable. This is a known trade-off, not a strict rule.

**Confidence:** Medium
**Frequency:** Low (1 PR)

### Code Example

**Workaround (PR #4411):**
```hcl
# infra/frontend/app-config/env-config/environment_variables.tf
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = "315341936575"
```

### Rationale
This was necessary because `data.aws_caller_identity` cannot be used in `app-config` (no AWS credentials in CI). The hardcoded value works but is fragile if the project ever moves to a different AWS account.

### Open Questions
- Could `project-config` expose the account ID as an output, sourced from the backend configuration file naming convention (`<account_name>.<account_id>.s3.tfbackend`)?
