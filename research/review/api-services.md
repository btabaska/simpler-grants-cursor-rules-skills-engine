# API Services — Pattern Review

**Reviewer(s):** chouinar
**PRs analyzed:** 231
**Rules proposed:** 25
**Open questions:** 5

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

### 1. One Service Function Per File, Organized by Domain

**Confidence:** High
**Frequency:** ~80% of service PRs
**Source PRs:** #8620, #6651

**Proposed Rule:**
> ALWAYS create a new file for each primary service function, placed in the appropriate domain subdirectory under `api/src/services/{domain}/`.

**Rationale:**
One-function-per-file keeps service modules small and focused. It simplifies imports, reduces merge conflicts, and makes it obvious where to find each service operation.

**Code Examples:**
```python
# From PR #8620 — new file opportunity_update.py for the update service
# api/src/services/opportunities_grantor_v1/opportunity_update.py
import logging
import uuid

import src.adapters.db as db
from src.auth.endpoint_access_util import verify_access
from src.constants.lookup_constants import Privilege
from src.db.models.opportunity_models import Opportunity
from src.db.models.user_models import User

logger = logging.getLogger(__name__)


def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
    ...
```

```python
# From PR #6651 — new file remove_user_from_organization.py
# api/src/services/organizations_v1/remove_user_from_organization.py
def remove_user_from_organization(
    db_session: db.Session, user: User, target_user_id: UUID, organization_id: UUID
) -> None:
    ...
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

### 2. db_session as First Parameter

**Confidence:** High
**Frequency:** ~90% of service functions
**Source PRs:** #8620, #6651, #4314

**Proposed Rule:**
> ALWAYS pass `db_session: db.Session` as the first parameter to service functions that interact with the database.

**Rationale:**
The session is obtained at the route layer and passed down explicitly. This makes the database dependency visible and avoids hidden global state.

**Code Examples:**
```python
# From PR #8620
def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:

# From PR #6651
def remove_user_from_organization(
    db_session: db.Session, user: User, target_user_id: UUID, organization_id: UUID
) -> None:
```

**Conflicting Examples:**
Search service functions take `search_client: search.SearchClient` instead (see PR #4493). The rule is: use `db_session` for database operations, `search_client` for OpenSearch operations.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 3. Route Layer Manages Transaction Boundaries

**Confidence:** High
**Frequency:** ~70% of route handlers, increasing in later PRs
**Source PRs:** #8620, #6651, #4550

**Proposed Rule:**
> ALWAYS wrap service calls in `with db_session.begin():` at the route layer. NEVER commit or call `begin()` inside service functions.

**Rationale:**
Centralizing transaction management at the route/task layer ensures atomicity and makes rollback behavior predictable.

**Code Examples:**
```python
# From PR #8620 — route handler wrapping service call
@flask_db.with_db_session()
def opportunity_update(
    db_session: db.Session, opportunity_id: UUID, json_data: dict
) -> response.ApiResponse:
    ...
    with db_session.begin():
        user = jwt_or_api_user_key_multi_auth.get_user()
        db_session.add(user)
        opportunity = update_opportunity(db_session, user, opportunity_id, json_data)

    return response.ApiResponse(message="Success", data=opportunity)
```

```python
# From PR #4550 — reviewer explicitly requested begin() for Task classes:
# "I'd recommend adjusting run_task like so:
# with self.db_session.begin(): self.process_opportunity_versions()
# ...As it's implemented right now, there isn't a point where it
# obviously commits to the DB which is a bit of an issue." — chouinar
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

### 4. Extract Shared Logic to Utility Files

**Confidence:** High
**Frequency:** ~15 PRs with explicit extraction; reviewer consistently enforces
**Source PRs:** #6651, #4493, #8620

**Proposed Rule:**
> ALWAYS extract shared helper functions to `_utils.py` or `service_utils.py` files when two or more service modules need the same logic. NEVER duplicate service logic across files.

**Rationale:**
Avoids code drift between duplicated implementations. Shared utilities become the single source of truth for common validations and query patterns.

**Code Examples:**
```python
# From PR #6651 — reviewer requested extracting shared validation
# api/src/services/organizations_v1/organization_user_utils.py
def validate_organization_user_exists(
    db_session: db.Session, user_id: UUID, organization: Organization
) -> OrganizationUser:
    org_user = db_session.execute(
        select(OrganizationUser)
        .where(OrganizationUser.organization_id == organization.organization_id)
        .where(OrganizationUser.user_id == user_id)
    ).scalar_one_or_none()

    if not org_user:
        raise_flask_error(404, message=f"Could not find User with ID {user_id}")

    return org_user
```

```python
# From PR #8620 — reviewer requested extracting validate_opportunity_is_draft
# api/src/services/opportunities_grantor_v1/opportunity_utils.py
def validate_opportunity_is_draft(opportunity: Opportunity) -> None:
    if not opportunity.is_draft:
        raise_flask_error(422, message="Only draft opportunities can be updated")
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

### 5. Standard Logger Setup Per Module

**Confidence:** High
**Frequency:** Every service file observed
**Source PRs:** #8620, #6651, #5385

**Proposed Rule:**
> ALWAYS begin every service module with `import logging` followed by `logger = logging.getLogger(__name__)` at module scope.

**Rationale:**
Consistent logging setup using `__name__` provides automatic module-level log namespacing.

**Code Examples:**
```python
# From PR #8620
import logging
...
logger = logging.getLogger(__name__)
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

### 6. Structured Logging -- Variable Data in `extra`, Not Message Strings

**Confidence:** High
**Frequency:** ~10+ explicit corrections across PRs
**Source PRs:** #8632, #8620, #5385

**Proposed Rule:**
> NEVER interpolate variable data (IDs, counts, user info) into log message strings. ALWAYS put variable data in the `extra` dict parameter.

**Rationale:**
Static log messages are searchable and aggregatable in log management systems. When variable data is interpolated into the message, every log entry produces a unique string that is harder to grep, group, and alert on.

**Code Examples:**
```python
# From PR #8620 — correct pattern
logger.info(
    "Updated opportunity",
    extra={"opportunity_id": opportunity_id},
)

# Incorrect pattern (corrected in PR #8632):
# WRONG — variable data in message string
logger.info(f"Getting saved opportunities for user {user_id}")

# CORRECT — static message, data in extra
logger.info("Getting saved opportunities for user")
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

### 7. Never Log Sensitive Data (PII)

**Confidence:** High
**Frequency:** ~5 explicit corrections
**Source PRs:** #5385

**Proposed Rule:**
> NEVER log user emails, personally identifiable information, or other sensitive data in log messages or `extra` dicts.

**Rationale:**
Log data is often stored in centralized logging systems with broad access. PII in logs creates compliance risks and data exposure surface.

**Code Examples:**
```python
# From PR #5385 — reviewer explicitly caught PII logging:
# "Also - don't log the users email." — chouinar
# The contributor had logged the user's email for debugging; this was removed.
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

### 8. Use `raise_flask_error()` for HTTP Errors

**Confidence:** High
**Frequency:** ~85% of service functions with error cases
**Source PRs:** #6651, #8620, #6645

**Proposed Rule:**
> ALWAYS use `raise_flask_error(status_code, message)` from `src.api.route_utils` for all error conditions in service functions. NEVER raise raw exceptions or return error tuples from services.

**Rationale:**
`raise_flask_error` provides a consistent mechanism for service functions to signal HTTP-level errors.

**Code Examples:**
```python
# From PR #6651
if not org_user:
    raise_flask_error(404, message=f"Could not find User with ID {user_id}")

# From PR #8620
if not opportunity.is_draft:
    raise_flask_error(422, message="Only draft opportunities can be updated")

# From PR #6645
if not can_access(user, {Privilege.START_APPLICATION}, organization):
    raise_flask_error(403, "Forbidden")
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

### 9. Use `select()` + `scalar_one_or_none()` for Single Record Lookups

**Confidence:** High
**Frequency:** Very high -- standard pattern in every service that fetches records
**Source PRs:** #6651, #4314

**Proposed Rule:**
> ALWAYS use the `select(Model).where(...)` pattern with `.scalar_one_or_none()` for fetching a single record. ALWAYS follow with a `raise_flask_error(404, ...)` guard if the record is required.

**Rationale:**
`scalar_one_or_none()` returns either the record or `None`, making the null-check pattern clean and predictable.

**Code Examples:**
```python
# From PR #6651
org_user = db_session.execute(
    select(OrganizationUser)
    .where(OrganizationUser.organization_id == organization.organization_id)
    .where(OrganizationUser.user_id == user_id)
).scalar_one_or_none()

if not org_user:
    raise_flask_error(404, message=f"Could not find User with ID {user_id}")
```

```python
# From PR #4314
form = db_session.execute(
    select(Form)
    .join(CompetitionForm, Form.form_id == CompetitionForm.form_id)
    .where(CompetitionForm.competition_id == application.competition_id)
    .where(Form.form_id == form_id)
).scalar_one_or_none()

if not form:
    raise_flask_error(
        404,
        f"Form with ID {form_id} not found or not attached to this application's competition",
    )
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

### 10. Use Explicit `selectinload()` -- Never `selectinload("*")`

**Confidence:** High
**Frequency:** ~25+ PRs; explicit reviewer correction in PR #8620
**Source PRs:** #8620, #5385

**Proposed Rule:**
> ALWAYS specify individual relationships in `selectinload()` calls. NEVER use `selectinload("*")`.

**Rationale:**
`selectinload("*")` eagerly loads every relationship on a model, which for complex models can cascade into loading a large portion of the database.

**Code Examples:**
```python
# From PR #8620 — reviewer explicitly rejected selectinload("*"):
# "don't do selectinload('*') - that fetches every relationship from an
# opportunity which ends up being about half the DB." — chouinar

# Correct pattern (from PR #4314):
select(Application)
    .options(selectinload(Application.application_forms))
    .options(selectinload(Application.application_users))
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

### 11. Use `can_access()` / `verify_access()` for Authorization

**Confidence:** High
**Frequency:** ~15+ PRs, all recent organization/grantor work
**Source PRs:** #6645, #8620, #6651

**Proposed Rule:**
> ALWAYS use `can_access()` or `verify_access()` from `src.auth.endpoint_access_util` for authorization checks. NEVER write custom membership validation queries.

**Rationale:**
Centralized auth functions enforce the RBAC model consistently. Manual membership queries are error-prone and don't account for the full privilege hierarchy.

**Code Examples:**
```python
# From PR #6645 — replacing manual membership check with can_access
if not can_access(user, {Privilege.START_APPLICATION}, organization):
    raise_flask_error(403, "Forbidden")

# From PR #8620
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
```

**Conflicting Examples:**
There is acknowledged duplication between `verify_access()` and `check_user_access()` (raised in PR #8632). The reviewer noted: "why do we have `verify_access` and `check_user_access`? We seem to have made a duplicate of this same functionality." This needs tech lead resolution.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 12. Check Authorization After 404 Checks, Before Business Logic

**Confidence:** High
**Frequency:** ~5 explicit corrections; consistently enforced in later PRs
**Source PRs:** #6645, #8620

**Proposed Rule:**
> ALWAYS follow this validation order in service functions: (1) Request validation, (2) 404 checks (does the entity exist?), (3) Authorization (does the user have permission?), (4) Business logic validation.

**Rationale:**
Checking auth before business rules prevents information leakage. If a user does not have permission, they should get a 403 -- not a 422 that reveals details about the state of the resource.

**Code Examples:**
```python
# From PR #6645 — reviewer explicitly requested reordering:
# "Could we move the validate_competition_open, _validate_organization_expiration
# and _validate_applicant_type to all happen _after_ the can_access check?"

# Result in create_application.py:
# 1. Fetch entity (404 if missing)
organization = db_session.execute(...).scalar_one_or_none()
if not organization:
    raise_flask_error(404, "Organization not found")

# 2. Check authorization
if not can_access(user, {Privilege.START_APPLICATION}, organization):
    raise_flask_error(403, "Forbidden")

# 3. Business logic validation
_validate_organization_expiration(organization)
validate_competition_open(competition, ApplicationAction.START)
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

### 13. Service Functions Return Domain Objects, Not Dicts

**Confidence:** High
**Frequency:** High -- consistent across all observed service functions
**Source PRs:** #8620, #4314

**Proposed Rule:**
> ALWAYS return SQLAlchemy model instances (or tuples of model + warnings) from service functions. NEVER return raw dicts. The route layer handles serialization via Marshmallow schemas.

**Rationale:**
Returning domain objects keeps services focused on business logic. Serialization is a presentation concern handled by the route layer.

**Code Examples:**
```python
# From PR #8620
def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
    ...
    return opportunity

# From PR #4314
def update_application_form(
    db_session: db.Session, application_id: UUID, form_id: UUID, application_response: dict
) -> tuple[ApplicationForm, list[ValidationErrorDetail]]:
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

### 14. PUT Means Full Replacement

**Confidence:** High
**Frequency:** Low (2 corrections), but explicitly stated rule
**Source PRs:** #8620

**Proposed Rule:**
> ALWAYS update all fields on a PUT endpoint. For nullable optional fields, use `load_default=None` in the Marshmallow schema so omitted fields explicitly clear existing values.

**Rationale:**
Full replacement semantics simplify both server and client code. The frontend always sends the complete state, and the server always writes it.

**Code Examples:**
```python
# From PR #8620 — reviewer explanation:
# "Since this is a PUT endpoint, we should always update every field." — chouinar

# PUT endpoint — always update all fields
for field, value in opportunity_data.items():
    setattr(opportunity, field, value)

# Schema for nullable field:
category_explanation = fields.String(
    allow_none=True,
    load_default=None,  # Omitted field defaults to None, clearing existing value
    validate=validators.Length(max=255),
)
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

### 15. Do Not Import Private (`_`-prefixed) Functions

**Confidence:** High
**Frequency:** Low (~3 corrections), but clearly stated principle
**Source PRs:** #8620

**Proposed Rule:**
> NEVER import functions that start with `_` from other modules. Use the module's public API instead.

**Rationale:**
The `_` prefix is the Python convention for "internal implementation detail." Importing it creates coupling to implementation that may change without notice.

**Code Examples:**
```python
# From PR #8620 — reviewer caught import of a private function
# WRONG — importing private function
from src.services.opportunities_grantor_v1.get_opportunity import _get_opportunity_for_grantors

# CORRECT — use public function
from src.services.opportunities_grantor_v1.get_opportunity import get_opportunity_for_grantors
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

### 16. Do Not Flush or Re-query Within Transactions Unnecessarily

**Confidence:** High
**Frequency:** Explicit correction in PR #8620
**Source PRs:** #8620

**Proposed Rule:**
> NEVER call `db_session.flush()` followed by a re-query to reload an object within a transaction. Objects fetched from the session are already tracked and available.

**Rationale:**
SQLAlchemy's identity map ensures that objects fetched in a session are tracked. Flushing and re-querying adds unnecessary database round-trips.

**Code Examples:**
```python
# From PR #8620 — reviewer removed unnecessary flush + re-query:
# "None of this should be needed. Anything fetched from the DB will be in the DB session."

# WRONG — unnecessary flush and re-query
db_session.flush()
opportunity = db_session.execute(
    select(Opportunity).where(Opportunity.opportunity_id == opportunity_id)
    .options(selectinload("*"))
).scalar_one_or_none()

# CORRECT — simply return the already-tracked object
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

### 17. Use Factory `.build()` for Unit Tests, `.create()` for Integration Tests

**Confidence:** High
**Frequency:** Very high; reviewer explicitly recommends `.build()` over custom helpers
**Source PRs:** #8614, #6651, #4314

**Proposed Rule:**
> ALWAYS use factory `.build()` when no database persistence is needed (pure unit tests). Use `.create()` only when records must exist in the database (integration tests).

**Rationale:**
`.build()` avoids database overhead, making unit tests faster and more isolated.

**Code Examples:**
```python
# From PR #8614 — reviewer questioned custom test helper:
# "I am curious why we would use this instead of a factory? If we don't want
# anything in the DB / want to keep it simple, use .build()." — chouinar

# Unit test with .build() (PR #8614, after reviewer correction):
att = ApplicationAttachmentFactory.build()
form = ApplicationFormFactory.build(application_response={"att1": uid})
app = ApplicationFactory.build()
app.application_attachments = [att]
app.application_forms = [form]
```

```python
# From PR #4314 — .build() used for schema validation tests
SIMPLE_FORM = FormFactory.build(
    form_json_schema={
        "type": "object",
        "properties": {
            "StrField": {"type": "string", "maxLength": 20, "format": "email"},
        },
        "required": ["StrField"],
    }
)
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

### 18. Boolean Fields Should Be Named as Questions

**Confidence:** High
**Frequency:** Low (~2 corrections), but clearly stated preference
**Source PRs:** #4493

**Proposed Rule:**
> ALWAYS name boolean fields and parameters using `is_`, `has_`, `can_`, `was_`, or similar question-form prefixes.

**Rationale:**
Question-form boolean names make conditional code read like natural language.

**Code Examples:**
```python
# From PR #4493 — reviewer requested renaming:
# "we should really make booleans be named as sorta-questions" — chouinar

# Result: `active` was renamed to `has_active_opportunity`.
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Nested(
        BoolSearchSchemaBuilder("HasActiveOpportunityFilterV1Schema")
        .with_one_of(example=True)
        .build()
    )
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

### 19. Avoid the Walrus Operator (`:=`) Unless It Clearly Improves Readability

**Confidence:** Medium
**Frequency:** Low (~2 mentions), stated preference
**Source PRs:** #5443

**Proposed Rule:**
> AVOID using the walrus operator (`:=`) in service code. Prefer explicit variable assignment in a preceding statement.

**Rationale:**
Team preference for readability. The walrus operator can obscure control flow for developers unfamiliar with it.

**Code Examples:**
```python
# From PR #5443 — reviewer rejected walrus operator suggestion:
# "I try to avoid := except when it really really makes things cleaner
# because it's not a super well known feature of Python." — chouinar

# Suggested (rejected):
if config := ACTION_RULE_CONFIG_MAP.get(action, None):
    return config

# Preferred:
config = ACTION_RULE_CONFIG_MAP.get(action, None)
if config is None:
    raise Exception(...)
return config
```

**Conflicting Examples:**
Some team members (freddieyebra) do suggest it. This is a style preference, not a hard rule.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 20. Do Not Expose Internal URLs or Sensitive Fields in API Responses

**Confidence:** High
**Frequency:** Explicit correction in PR #4230
**Source PRs:** #4230

**Proposed Rule:**
> NEVER expose internal infrastructure details (S3 URLs, internal service endpoints, etc.) in API response schemas.

**Rationale:**
Internal URLs reveal infrastructure details that could be used for reconnaissance. API responses should only contain data intended for external consumers.

**Code Examples:**
```python
# From PR #4230 — reviewer caught an internal S3 URL being exposed:
# "Why did this get added? We don't want to expose our internal s3 urls to users." — chouinar
# The offending field was removed from the schema.
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

### 21. Do Not Change Behavior of Shared Utility Functions for One Endpoint

**Confidence:** High
**Frequency:** Explicit, forceful correction in PR #8632
**Source PRs:** #8632

**Proposed Rule:**
> NEVER modify a shared utility function's behavior (especially privilege requirements) to serve a single endpoint's needs. If an endpoint has different requirements, add checks after calling the shared function, or create a separate function.

**Rationale:**
Shared utilities form a contract that multiple endpoints depend on. Changing their behavior for one endpoint introduces unintended side effects.

**Code Examples:**
```python
# From PR #8632 — reviewer caught a privilege change to a shared function:
# "Don't change this - this 100% needs to be left alone, changing this changes
# the functionality of every endpoint that uses this utility." — chouinar
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

### 22. Schema Field Names Must Match DB Model Field Names

**Confidence:** Medium
**Frequency:** Low (~1 correction in PR #5424)
**Source PRs:** #5424

**Proposed Rule:**
> NEVER rename schema fields to differ from the corresponding database model field names.

**Rationale:**
Matching names between API schema and database model reduces cognitive overhead.

**Code Examples:**
```python
# From PR #5424 — reviewer rejected a field rename:
# "I don't think we want to rename things, otherwise the JSON doesn't match
# the DB model which can be confusing to look at later." — chouinar

# WRONG — renamed from DB model field
attachments = fields.List(...)

# CORRECT — matches DB model attribute
opportunity_attachments = fields.List(
    fields.Nested(OpportunityVersionAttachmentSchema),
)
```

**Conflicting Examples:**
There may be valid cases for renaming (e.g., legacy compatibility). Tech lead should clarify when exceptions are acceptable.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 23. Pydantic BaseModel for Search/Filter Parameters

**Confidence:** High
**Frequency:** ~15+ search/filter service files
**Source PRs:** #4493

**Proposed Rule:**
> ALWAYS define search and filter parameters as Pydantic `BaseModel` classes within service files. Parse raw dict input via `model_validate()`.

**Rationale:**
Pydantic models provide validation, type coercion, and clear documentation of the parameter contract.

**Code Examples:**
```python
# From PR #4493
class AgencySearchFilters(BaseModel):
    has_active_opportunity: BoolSearchFilter | None = None

class AgencySearchParams(BaseModel):
    pagination: PaginationParams
    filters: AgencySearchFilters | None = Field(default=None)
    query: str | None = None
    query_operator: str = Field(default=SearchQueryOperator.OR)

def search_agencies(
    search_client: search.SearchClient, raw_search_params: dict
) -> Tuple[Sequence[dict], PaginationInfo]:
    params = AgencySearchParams.model_validate(raw_search_params)
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

### 24. Validation Warnings (Not Blocking) for Form Data

**Confidence:** High
**Frequency:** ~10 PRs, consistent for the application form domain
**Source PRs:** #4314, #5443

**Proposed Rule:**
> ALWAYS return form validation issues as warnings (list of `ValidationErrorDetail`) during save/update operations. ONLY block (raise errors) during submission.

**Rationale:**
Users should be able to save partial form progress without being blocked. Validation warnings guide them toward completion. Only at submission time is completeness enforced.

**Code Examples:**
```python
# From PR #4314 — During save/update: return warnings, don't block
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
return application_form, warnings

# During submission — block if errors exist
validate_forms(application, ApplicationAction.SUBMIT)  # raises 422 if issues
```

```python
# From PR #5443 — action-based configuration
ACTION_RULE_CONFIG_MAP = {
    ApplicationAction.START: START_JSON_RULE_CONFIG,
    ApplicationAction.GET: GET_JSON_RULE_CONFIG,
    ApplicationAction.MODIFY: UPDATE_JSON_RULE_CONFIG,
    ApplicationAction.SUBMIT: SUBMISSION_JSON_RULE_CONFIG,
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

### 25. Route Handlers Must Add Token Session to DB Session

**Confidence:** Medium
**Frequency:** Inconsistent in earlier PRs; consistently present in later PRs
**Source PRs:** #6645, #8620, #6651

**Proposed Rule:**
> ALWAYS call `db_session.add(user_token_session)` or `db_session.add(user)` inside the `with db_session.begin():` block before passing the user to service functions.

**Rationale:**
The user/token session object is created by the auth middleware outside the current DB session. If not explicitly added, SQLAlchemy will raise a `DetachedInstanceError` when the service function tries to navigate relationships from the user object.

**Code Examples:**
```python
# From PR #8620
with db_session.begin():
    user = jwt_or_api_user_key_multi_auth.get_user()
    db_session.add(user)
    opportunity = update_opportunity(db_session, user, opportunity_id, json_data)

# From PR #6651
with db_session.begin():
    db_session.add(user_token_session)
    remove_user_from_organization(db_session, user_token_session.user, user_id, organization_id)
```

**Conflicting Examples:**
Positioning varies -- sometimes `db_session.add()` is before `begin()`, sometimes inside. Tech lead should clarify whether it must always be inside `begin()`.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

## Coverage Gaps

1. **No database query performance guidelines (Cross-domain GAP-4).** While `selectinload("*")` is banned, there are no guidelines for when to use `selectinload` vs. `joinedload` vs. `subqueryload`.

2. **No error monitoring / alert level documentation (Cross-domain GAP-5).** The "info for 4xx, warning for ops concerns" rule is clear, but there is no guidance on when to use `logger.error()` vs `logger.exception()`.

3. **No formal API versioning strategy (Cross-domain GAP-3).** Path-based versioning (`/v1/`, `/alpha/`) exists but no strategy for promotions or breaking changes.

## Inconsistencies Requiring Resolution

1. **`verify_access()` vs `check_user_access()` duplication** -- Which is the canonical function? Should one be deprecated? (Raised in PR #8632)

2. **Auth in routes vs services** -- Some PRs check auth type in routes (e.g., checking `UserTokenSession` type in PR #5434), while others push auth into services via `can_access`. What is the preferred boundary?

3. **`db_session.add(token_session)` positioning** -- Must this always be inside `with db_session.begin():`? Some PRs place it before.

4. **Walrus operator threshold** -- Is there a specific case where `:=` is acceptable, or is it a blanket "avoid"?

5. **Schema field rename exceptions** -- Are there valid cases for API schema fields to differ from DB model field names (e.g., legacy API compatibility)?
