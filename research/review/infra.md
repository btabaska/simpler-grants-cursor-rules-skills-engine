# Infrastructure/Terraform — Pattern Review

**Reviewer(s):** chouinar, doug-s-nava
**PRs analyzed:** 172
**Rules proposed:** 17 (15 patterns + 2 anti-patterns)
**Open questions:** 12

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

### 1. Three-Layer Application Structure

**Confidence:** High
**Frequency:** Universal -- every application (api, frontend, analytics, nofos, fluentbit) follows this structure across all 172 PRs.
**Source PRs:** #4362, #5228, #8456

**Proposed Rule:**
> ALWAYS organize each application under `infra/<app_name>/` into three standard layers: `app-config/` (configuration and environment variables), `service/` (ECS service, ALB, networking), and `database/` (Aurora cluster). NEVER place service-level resource definitions in `app-config/` or configuration logic in `service/`.

**Rationale:**
Separating configuration from resource creation enables safe `terraform plan` without AWS credentials (app-config), isolated blast radius per layer, and consistent onboarding of new applications.

**Code Examples:**
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
```

```hcl
# From PR #5228 — service layer consuming app-config outputs
# infra/api/service/main.tf
module "service" {
  source       = "../../modules/service"
  service_name = local.service_config.service_name
  # ...
  enable_api_gateway = true
```

```hcl
# From PR #8456 — decomposed service/ into sub-files
# New files in infra/frontend/service/: database.tf, domain.tf, feature_flags.tf,
# monitoring.tf, secrets.tf — each wiring a specific concern from app-config to a shared module.
```

**Conflicting Examples:**
PR #8456 introduced significant sub-file decomposition within `service/`. Older applications may retain a monolithic `main.tf` approach.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: PR #8456 introduced significant sub-file decomposition within `service/`. Should all applications converge to the new granular file layout (domain.tf, monitoring.tf, etc.), or can they retain the monolithic `main.tf` approach?_

---

### 2. Feature-Gated Resources via `count` and Boolean Variables

**Confidence:** High
**Frequency:** Very High (~25+ PRs)
**Source PRs:** #5228, #5340, #5326, #5375

**Proposed Rule:**
> ALWAYS use `count = var.enable_<feature> ? 1 : 0` to conditionally create resources. ALWAYS define the gating variable with `type = bool` and `default = false`. When a resource is conditionally created, ALWAYS use indexed access (`[0]`) on all references, and ALWAYS make related resources (policies, attachments) conditional with the same guard.

**Rationale:**
Boolean-gated resources allow features to be safely added to shared modules without affecting applications that do not opt in. The `default = false` convention ensures new features are explicitly enabled, preventing accidental resource creation.

**Code Examples:**
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
  # ...
}
```

```hcl
# From PR #5340 (fixing PR #5326) — consistent indexing for conditional resources
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

```hcl
# From PR #5375 — mTLS load balancer gated by boolean
variable "enable_mtls_load_balancer" {
  type        = bool
  description = "Stand up a second twin LB that will support mTLS client certificate auth passthrough"
  default     = false
}
```

**Conflicting Examples:**
Some guards use `length(var.pinpoint_app_id) > 0` rather than a dedicated boolean. This is a known deviation from the `enable_*` boolean convention.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should string-length guards (e.g., `length(var.pinpoint_app_id) > 0`) be refactored to use explicit `enable_*` booleans for consistency?_

---

### 3. Separate IAM Policy Documents Per Concern

**Confidence:** High
**Frequency:** High (~15+ PRs)
**Source PRs:** #5326, #5328, #5340, #6416

**Proposed Rule:**
> ALWAYS create a separate `aws_iam_policy_document`, `aws_iam_policy`, and `aws_iam_role_policy_attachment` for each distinct IAM concern (task execution, runtime logs, email access, API Gateway access). ALWAYS attach runtime permissions to the `app_service` role (not `task_executor`). NEVER combine unrelated permissions into a single policy document.

**Rationale:**
PR #5326 demonstrated the real-world consequence of wrong-role attachment: Pinpoint permissions placed on `task_executor` (startup-only) rather than `app_service` (runtime) caused email sending to fail silently. Separating concerns by policy document makes auditing straightforward and reduces blast radius of IAM changes.

**Code Examples:**
```hcl
# From PR #5326 — separate policy documents per concern
# infra/modules/service/access_control.tf

# Task startup permissions
data "aws_iam_policy_document" "task_executor" { ... }

# Runtime log permissions (Fluentbit)
data "aws_iam_policy_document" "runtime_logs" { ... }

# Email permissions — attached to app_service, NOT task_executor
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

```hcl
# From PR #6416 — API Gateway access as its own policy
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

### 4. Two-Tier Environment Variables (Plain + Secrets via SSM)

**Confidence:** High
**Frequency:** Very High (~30+ PRs)
**Source PRs:** #5278, #8392, #6465

**Proposed Rule:**
> ALWAYS manage environment variables through the two-tier system in `app-config/env-config/environment_variables.tf`. Plain values go in `default_extra_environment_variables` (overridable via `service_override_extra_environment_variables`). Sensitive values go in the `secrets` map with `manage_method = "manual"` and an SSM path following `/<app_name>/<environment>/<secret-name>`. NEVER create custom SSM parameter resources outside this pattern -- use the existing secrets mechanism instead.

**Rationale:**
Centralizing all environment variable definitions in one file per app provides a single source of truth, makes auditing straightforward, and ensures the deployment pipeline can consistently resolve all secrets. The SSM path convention (`/<app>/<env>/<name>`) enables cross-environment management.

**Code Examples:**
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

```hcl
# From PR #8392 — adding new secrets for SOAP Gateway
SOAP_PARTNER_GATEWAY_URI = {
  manage_method     = "manual"
  secret_store_name = "/api/${var.environment}/soap-partner-gateway-uri"
}

SOAP_PARTNER_GATEWAY_AUTH_KEY = {
  manage_method     = "manual"
  secret_store_name = "/api/${var.environment}/soap-partner-gateway-auth-key"
}
```

```
# From PR #6465 — reviewer enforcing the pattern
# Reviewer chouinar pushed back on creating a custom SSM parameter resource:
# "Are we not able to define this secret / env var like our other secrets?
#  [...] If this is manually set, I think we just need to add it to that list
#  unless there's something more complex I'm missing here"
```

**Conflicting Examples:**
PR #8392 reviewer noted `SOAP_PARTNER_GATEWAY_URI` should have been a plain environment variable, not a secret. The boundary between "should be secret" vs. "should be plain" is not formally defined.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Where is the line between "should be secret" vs. "should be plain"? PR #8392 flagged this ambiguity._

---

### 5. SSM Parameters Must Exist Before Merge

**Confidence:** High
**Frequency:** High -- enforced in multiple review threads
**Source PRs:** #8392, #6465, #5278

**Proposed Rule:**
> ALWAYS create SSM parameters in all environments (dev, staging, training, prod) before merging a PR that references them. Even placeholder values are acceptable. NEVER merge a PR that adds new secret references without confirming the SSM parameters exist -- deploys will fail.

**Rationale:**
The deployment pipeline fetches all SSM parameters during `terraform apply`. Missing parameters cause immediate deploy failure across all environments. Creating parameters before merge is a safety gate.

**Code Examples:**
```
# From PR #8392 — reviewer enforcement
# Review comment from chouinar:
# "Have you added values for all of these into parameter store for every env?
#  Even if we don't have actual values yet, if they don't exist, deploys will
#  fail as it tries to fetch them."
#
# Author responded with a screenshot confirming parameters were created in
# dev, staging, training, and prod.
```

```
# From PR #6465 — enforcement during API key creation
# Review thread between chouinar and Nava-JoshLong:
# chouinar: "Wouldn't we need to generate and store the key manually before
#   we merge this either way?"
# chouinar: "our usual process assumes you setup the env var in parameter store
#   before merging the change. That's how they've all behaved"
# Nava-JoshLong: "Got it, params have been made, and terraform creating it has
#   been removed. Plan is working as expected now"
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Is there tooling or automation that could validate SSM parameter existence in CI before merge, rather than relying solely on reviewer diligence? (See also cross-domain pattern CCP-10.)_

---

### 6. Feature Flags as Secrets with `manage_method = "manual"`

**Confidence:** High
**Frequency:** High (~10+ PRs)
**Source PRs:** #6419, #8359, #8456

**Proposed Rule:**
> ALWAYS define feature flags in `environment_variables.tf` using the naming convention `FEATURE_<NAME>_ON` or `FEATURE_<NAME>_OFF` with `manage_method = "manual"` and SSM path `/<app_name>/<environment>/feature-<kebab-name>`. Feature flag values MUST be set in SSM Parameter Store (not in `.env` files) for deployed environments.

**Rationale:**
Treating feature flags as SSM-backed secrets enables runtime toggling without redeployment. The `manual` manage_method prevents Terraform from overwriting values that operators set in the console or via CLI.

**Code Examples:**
```hcl
# From PR #6419 — adding a feature flag
# infra/frontend/app-config/env-config/environment_variables.tf
FEATURE_USER_ADMIN_OFF = {
  manage_method     = "manual"
  secret_store_name = "/${var.app_name}/${var.environment}/feature-user-admin-off"
},
```

```hcl
# From PR #8359 — feature flag for opportunities list
FEATURE_OPPORTUNITIES_LIST_OFF = {
  manage_method     = "manual"
  secret_store_name = "/${var.app_name}/${var.environment}/feature-opportunities-list-off"
},
```

```hcl
# From PR #8456 — new structured feature flags module
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

**Conflicting Examples:**
Cross-domain inconsistency (INC-1 from Pass 3): API feature flags use `ENABLE_{FEATURE}_ENDPOINTS = 1` as plain environment variables, while frontend flags use `FEATURE_{NAME}_OFF` backed by SSM. Local dev uses `ENABLE_{FEATURE}=TRUE`. Three different naming patterns and truthy values coexist.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: PR #8456 introduces a dedicated `feature_flags` module with validation and SSM parameters. Should all applications migrate existing `FEATURE_*` entries from the secrets map to this new module? See also cross-domain inconsistency INC-1 regarding the three different naming conventions for feature flags._

---

### 7. Shared Reusable Modules under `infra/modules/`

**Confidence:** High
**Frequency:** High (~30+ PRs)
**Source PRs:** #8445, #8456

**Proposed Rule:**
> ALWAYS place reusable infrastructure components in `infra/modules/<module_name>/`. ALWAYS consume these modules from the application `service/` layer (not `app-config/`). When creating a new module, ALWAYS include: `main.tf` (resources), `variables.tf` (with type and description on every variable), and `outputs.tf` (exposing values consumers need, including IAM access policy ARNs).

**Rationale:**
Shared modules enforce consistency across applications, reduce duplication, and provide a single place to apply security standards (e.g., encryption settings, DLQ policies). Bundling IAM access policies as outputs simplifies consumer wiring.

**Code Examples:**
```hcl
# From PR #8445 — SQS module structure
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

```hcl
# From PR #8445 — module outputs including access policy ARN
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

**Conflicting Examples:**
PR #8456 introduces data/resources splits for modules (e.g., `modules/domain/data/` and `modules/domain/resources/`). Not all modules follow this split.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: PR #8456 introduces data/resources splits for modules. Should all modules adopt this pattern? What is the criterion for when to split?_

---

### 8. Checkov Skip Annotations with Issue References

**Confidence:** High
**Frequency:** Medium (~5+ PRs)
**Source PRs:** #5228, #6504, #8456

**Proposed Rule:**
> When a Checkov security rule cannot be immediately satisfied, ALWAYS add a `checkov:skip` comment with the rule ID and either a GitHub issue link or a brief explanation. NEVER skip a Checkov rule without documenting why. Resolve Checkov skips as soon as practical.

**Rationale:**
Checkov enforces security baselines. Annotated skips create traceability -- reviewers can verify that the skip is intentional and track when it should be resolved. Unannotated skips become invisible tech debt.

**Code Examples:**
```hcl
# From PR #5228 — skip with issue reference
resource "aws_api_gateway_rest_api" "api" {
  count = var.enable_api_gateway ? 1 : 0
  name  = var.service_name

  # checkov:skip=CKV_AWS_237: Address in future work
}
```

```hcl
# From PR #6504 — skip resolved by actual fix
# Before (with skip):
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

# After (skip removed, rule satisfied):
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

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should there be a standard format for skip annotations (e.g., always including an issue URL)?_

---

### 9. Variable Declarations with Type, Description, and Default

**Confidence:** High
**Frequency:** Universal
**Source PRs:** #8445, #5375

**Proposed Rule:**
> ALWAYS declare variables with `type`, `description`, and (for optional variables) a `default` value. ALWAYS use `snake_case` naming. ALWAYS prefer variables over locals for configuration that may need per-environment overrides.

**Rationale:**
Consistent variable declarations enable tooling (documentation generation, validation), improve readability, and make per-environment customization possible. The `variables over locals` preference was explicitly stated by the platform team.

**Code Examples:**
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

```hcl
# From PR #8445 — reviewer enforcing variables over locals
# Reviewer sean-navapbc:
# "the config is only defined in the shared locals -- there's no per-environment
#  override mechanism. If different environments need different visibility timeouts
#  or retention periods, there's no way to vary them. I prefer variables versus
#  locals always"
```

```hcl
# From PR #5375 — boolean variable with default false
variable "enable_mtls_load_balancer" {
  type        = bool
  description = "Stand up a second twin LB that will support mTLS client certificate auth passthrough"
  default     = false
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

### 10. No AWS Data Sources in `app-config`

**Confidence:** High
**Frequency:** Medium (learned from PR #4386 / #4411)
**Source PRs:** #4386, #4411

**Proposed Rule:**
> NEVER use AWS API-dependent data sources (e.g., `data.aws_caller_identity`, `data.aws_vpc`) in the `app-config/` layer. The `app-config` layer runs during `terraform plan` in CI without AWS credentials. ALWAYS place AWS data source lookups in the `service/` layer.

**Rationale:**
PR #4386 added `data.aws_caller_identity` to `app-config/env-config/main.tf`. PR #4411 had to immediately revert it because CI runs `terraform plan` on `app-config` without AWS credentials, causing failures. This is an architectural constraint of the three-layer structure.

**Code Examples:**
```hcl
# From PR #4411 — reverting data source from app-config
# infra/frontend/app-config/env-config/main.tf
# REMOVED: data "aws_caller_identity" "current" {}

# infra/frontend/app-config/env-config/environment_variables.tf
# BEFORE (broken):
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = data.aws_caller_identity.current.account_id

# AFTER (hardcoded workaround):
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = "315341936575"
```

**Conflicting Examples:**
The hardcoded account ID is a known workaround, not the ideal solution.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: The hardcoded account ID is acknowledged as not ideal. Is there a plan to surface the account ID through `project-config` (which does not require AWS API calls) instead?_

---

### 11. Decomposed Config Outputs Mirror Module Interfaces

**Confidence:** High
**Frequency:** Universal (refined in PR #8456)
**Source PRs:** #8456

**Proposed Rule:**
> ALWAYS structure `app-config` outputs to match what consuming layers need. ALWAYS use separate outputs per domain concern (database_config, domain_config, service_config, monitoring_config, feature_flags_config). NEVER combine unrelated concerns into a single monolithic output.

**Rationale:**
Decomposed outputs enable modules to evolve independently. When `service_config` was monolithic, any change to monitoring or domain config required modifying the same output block. Separation reduces merge conflicts and improves clarity.

**Code Examples:**
```hcl
# From PR #8456 — decomposed outputs
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

```hcl
# From PR #8456 — domain-specific config locals
# infra/frontend/app-config/env-config/domain.tf
locals {
  domain_config = {
    hosted_zone  = local.network_config.domain_config.hosted_zone
    domain_name  = var.domain_name
    enable_https = var.enable_https
  }
}
```

**Conflicting Examples:**
The api application may still use the older monolithic output style.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Should there be a tracked migration effort to move the api application from monolithic outputs to the decomposed style?_

---

### 12. Lock Files Committed to Repository

**Confidence:** High
**Frequency:** High
**Source PRs:** #5228, #5258, #6423

**Proposed Rule:**
> ALWAYS commit `.terraform.lock.hcl` files for each deployable layer (service/, database/). Provider upgrades MUST appear as lock file diffs in PRs.

**Rationale:**
Committed lock files ensure reproducible builds across developer machines and CI. They also make provider version changes explicitly visible in code review.

**Code Examples:**
```
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

### 13. Avoid Duplicate Resource Definitions

**Confidence:** High
**Frequency:** Low (corrective -- 1 key PR)
**Source PRs:** #4320, #4363

**Proposed Rule:**
> NEVER define the same data source or resource under multiple names. When consolidating duplicates, ALWAYS update all references to use the surviving name consistently.

**Rationale:**
Duplicate resources cause confusion (which one is canonical?), waste API calls, and create opportunities for drift where one is updated but the other is not.

**Code Examples:**
```hcl
# From PR #4320 — duplicate certificate lookup consolidated
# Before (two data sources fetching the same cert):
data "aws_acm_certificate" "cert" {
  count  = local.service_config.domain_name != null ? 1 : 0
  domain = local.service_config.domain_name
}

data "aws_acm_certificate" "certificate" {
  count  = local.service_config.enable_https ? 1 : 0
  domain = local.service_config.domain_name
}

# After (single data source):
data "aws_acm_certificate" "cert" {
  count       = local.service_config.enable_https ? 1 : 0
  domain      = local.service_config.domain_name
  most_recent = true
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

### 14. Restrict Security Group Egress to Specific Ports

**Confidence:** High
**Frequency:** Medium (established in PR #6504, applies to all services)
**Source PRs:** #6504

**Proposed Rule:**
> NEVER allow unrestricted outbound traffic (`protocol = "-1"`, `from_port = 0`, `to_port = 0`) on application security groups. ALWAYS restrict egress to the specific ports the application needs (typically 443 for HTTPS, 80 for HTTP, 5432 for PostgreSQL). For ALB security groups, scope egress to the application security group.

**Rationale:**
This resolved Checkov rule CKV_AWS_382. Restricting outbound traffic is a defense-in-depth measure that limits lateral movement in case of compromise.

**Code Examples:**
```hcl
# From PR #6504 — restricted app egress
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

```hcl
# From PR #6504 — ALB egress scoped to app security group
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

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: The egress CIDR is currently `0.0.0.0/0` for all allowed ports. Should this be further restricted to VPC CIDRs or specific endpoints for port 5432?_

---

### 15. SQS Queue Module Pattern (Main + DLQ + Access Policy)

**Confidence:** Medium-High
**Frequency:** Low (1 module, but establishing the pattern for future queues)
**Source PRs:** #8445

**Proposed Rule:**
> When creating SQS queues, ALWAYS use the `infra/modules/sqs-queue` module. ALWAYS include a dead letter queue with a redrive policy. ALWAYS enable `sqs_managed_sse_enabled = true`. ALWAYS expose `access_policy_arn` as a module output. ALWAYS define resource-based queue policies at the consumer level (not in the module).

**Rationale:**
Bundling the DLQ and encryption into the module ensures every queue gets these critical features by default. Keeping resource-based policies at the consumer level allows different services to have different access patterns for the same module.

**Code Examples:**
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

```hcl
# From PR #8445 — resource-based policy at consumer level
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

**Conflicting Examples:**
The module includes both an IAM-based access policy (output) and the consumer adds a resource-based policy. It is unclear whether this is intentional defense-in-depth or redundant.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Is the resource-based policy redundant given the IAM-based access policy, or is the intent to layer both for defense-in-depth?_

---

### 16. Anti-Pattern: Fragile String Matching for Conditional Logic

**Confidence:** Medium
**Frequency:** Low (1 PR)
**Source PRs:** #5339, #8456

**Proposed Rule:**
> NEVER use `startswith()` or other string matching on `var.service_name` to conditionally apply configuration. ALWAYS use explicit boolean variables for feature gating.

**Rationale:**
String-based conditionals are brittle -- they break if naming conventions change, and they obscure the intent. Boolean variables are self-documenting and can be set independently.

**Code Examples:**
```hcl
# From PR #5339 — anti-pattern
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

**Conflicting Examples:**
PR #8456 added `enable_waf` as a boolean, suggesting the team is moving toward explicit boolean variables for this type of gating.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Is there a plan to refactor the `startswith()` usage to a boolean variable?_

---

### 17. Anti-Pattern: Hardcoding AWS Account IDs

**Confidence:** Medium
**Frequency:** Low (1 PR)
**Source PRs:** #4411

**Proposed Rule:**
> AVOID hardcoding AWS account IDs in Terraform configuration. When `data.aws_caller_identity` is unavailable (as in `app-config`), surface the account ID through `project-config` or accept it as a variable. This is a known trade-off, not a strict rule.

**Rationale:**
This was necessary because `data.aws_caller_identity` cannot be used in `app-config` (no AWS credentials in CI). The hardcoded value works but is fragile if the project ever moves to a different AWS account.

**Code Examples:**
```hcl
# From PR #4411 — workaround
# infra/frontend/app-config/env-config/environment_variables.tf
NEW_RELIC_CLOUD_AWS_ACCOUNT_ID = "315341936575"
```

**Conflicting Examples:**
None found -- this is the only known instance.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** _Open question: Could `project-config` expose the account ID as an output, sourced from the backend configuration file naming convention (`<account_name>.<account_id>.s3.tfbackend`)?_

---

## Coverage Gaps

1. **No automated SSM parameter existence check in CI.** Pattern 5 relies entirely on reviewer diligence to confirm SSM parameters exist before merge. There is no CI validation step.

2. **No formal guidance on secret vs. plain variable classification.** The boundary between what should be a secret (SSM-backed) versus a plain environment variable is not formally documented. PR #8392 surfaced this ambiguity.

3. **No centralized feature flag registry.** Feature flags are scattered across Terraform configs, SSM parameters, and code references. There is no single registry showing all active flags, their current state per environment, or their cleanup status (cross-domain GAP-2).

4. **No module data/resources split criteria.** PR #8456 introduced the `data/` and `resources/` subdirectory pattern for modules, but there is no documented criterion for when a module should adopt this split.

5. **No dependency update policy for Terraform providers.** AWS provider versions have been upgraded from ~5.68.0 to ~6.13.0, but lock file updates happen opportunistically in feature PRs rather than through a deliberate upgrade process (cross-domain GAP-7).

## Inconsistencies Requiring Resolution

1. **Monolithic vs. decomposed `service/` file layout.** PR #8456 decomposed `service/` into granular sub-files (domain.tf, monitoring.tf, etc.) for the frontend app. Older applications like api still use a monolithic `main.tf`. Should all apps converge? (Pattern 1 open question)

2. **String-length guards vs. explicit booleans.** Some conditional resource creation uses `length(var.pinpoint_app_id) > 0` while the canonical pattern is `var.enable_<feature>`. Should string-length guards be migrated? (Pattern 2 open question)

3. **Feature flag naming conventions across API and frontend.** The API uses `ENABLE_{FEATURE}_ENDPOINTS = 1` as plain env vars; the frontend uses `FEATURE_{NAME}_OFF` backed by SSM; local dev uses `ENABLE_{FEATURE}=TRUE`. These three patterns should be unified (cross-domain INC-1).

4. **Old vs. new feature flag mechanism.** Existing feature flags live in the `secrets` map in `environment_variables.tf`, while PR #8456 introduced a dedicated `feature_flags` module. The migration path is unclear. (Pattern 6 open question)

5. **Monolithic vs. decomposed app-config outputs.** The frontend app uses decomposed outputs (database_config, domain_config, etc.) per PR #8456, while the api app may still use monolithic outputs. (Pattern 11 open question)

6. **Hardcoded AWS account ID.** The `NEW_RELIC_CLOUD_AWS_ACCOUNT_ID` is hardcoded as `"315341936575"` in frontend app-config because `data.aws_caller_identity` is unavailable. A `project-config` approach has been suggested but not implemented. (Pattern 17 open question)

7. **Checkov skip annotation format.** Some skips include issue URLs, some include only a brief explanation. Should a standard format be required? (Pattern 8 open question)

8. **SQS dual-policy layering.** The SQS module outputs an IAM access policy ARN, and the consumer also defines a resource-based queue policy. Whether this is intentional defense-in-depth or redundant needs clarification. (Pattern 15 open question)
