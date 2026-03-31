# Pass 2: Pattern Codification -- API Services Layer

**Domain:** `api/src/services/` -- service layer code patterns
**Source:** 231 merged PRs from HHS/simpler-grants-gov (api-services group)
**Pass 1 Document:** `analysis/pass1/api-services.md`
**Analysis Date:** 2026-03-30

---

## Rule 1: One Service Function Per File, Organized by Domain

**Rule Statement:** ALWAYS create a new file for each primary service function, placed in the appropriate domain subdirectory under `api/src/services/{domain}/`.

**Confidence:** High
**Frequency:** ~80% of service PRs follow this pattern

**Code Examples:**

From PR #8620 -- new file `opportunity_update.py` for the update service:
```python
# api/src/services/opportunities_grantor_v1/opportunity_update.py
import logging
import uuid

import src.adapters.db as db
from src.auth.endpoint_access_util import verify_access
from src.constants.lookup_constants import Privilege
from src.db.models.opportunity_models import Opportunity
from src.db.models.user_models import User
from src.services.opportunities_grantor_v1.get_opportunity import get_opportunity_for_grantors
from src.services.opportunities_grantor_v1.opportunity_utils import validate_opportunity_is_draft

logger = logging.getLogger(__name__)


def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
    ...
```

From PR #6651 -- new file `remove_user_from_organization.py`:
```python
# api/src/services/organizations_v1/remove_user_from_organization.py
import logging
from uuid import UUID

from sqlalchemy import select

from src.adapters import db
from src.api.route_utils import raise_flask_error
from src.auth.endpoint_access_util import can_access
from src.constants.lookup_constants import Privilege
...

logger = logging.getLogger(__name__)


def remove_user_from_organization(
    db_session: db.Session, user: User, target_user_id: UUID, organization_id: UUID
) -> None:
    ...
```

**Rationale:** One-function-per-file keeps service modules small and focused. It simplifies imports, reduces merge conflicts, and makes it obvious where to find each service operation. Domain subdirectories (`opportunities_grantor_v1/`, `organizations_v1/`, `users/`, etc.) provide natural grouping.

**Open Questions:** None -- this pattern is consistently applied.

---

## Rule 2: db_session as First Parameter

**Rule Statement:** ALWAYS pass `db_session: db.Session` as the first parameter to service functions that interact with the database.

**Confidence:** High
**Frequency:** ~90% of service functions

**Code Examples:**

From PR #8620:
```python
def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
```

From PR #6651:
```python
def remove_user_from_organization(
    db_session: db.Session, user: User, target_user_id: UUID, organization_id: UUID
) -> None:
```

From PR #4314 (`update_application_form.py`):
```python
def update_application_form(
    db_session: db.Session, application_id: UUID, form_id: UUID, application_response: dict
) -> tuple[ApplicationForm, list[ValidationErrorDetail]]:
```

**Rationale:** The session is obtained at the route layer via `@flask_db.with_db_session()` and passed down explicitly. This makes the database dependency visible, avoids hidden global state, and allows the route layer to control transaction boundaries.

**Open Questions:** Search service functions take `search_client: search.SearchClient` instead (see PR #4493). The rule is: use `db_session` for database operations, `search_client` for OpenSearch operations.

---

## Rule 3: Route Layer Manages Transaction Boundaries

**Rule Statement:** ALWAYS wrap service calls in `with db_session.begin():` at the route layer. NEVER commit or call `begin()` inside service functions.

**Confidence:** High
**Frequency:** ~70% of route handlers, increasing in later PRs

**Code Examples:**

From PR #8620 -- route handler wrapping service call:
```python
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

From PR #6651 -- DELETE route with begin():
```python
def organization_remove_user(
    db_session: db.Session, organization_id: UUID, user_id: UUID
) -> response.ApiResponse:
    ...
    with db_session.begin():
        db_session.add(user_token_session)
        remove_user_from_organization(db_session, user_token_session.user, user_id, organization_id)

    return response.ApiResponse(message="Success", data=None)
```

From PR #4550 -- reviewer explicitly requested `begin()` for Task classes:
> "I'd recommend adjusting run_task like so: `with self.db_session.begin(): self.process_opportunity_versions()` ... As it's implemented right now, there isn't a point where it obviously commits to the DB which is a bit of an issue." -- chouinar

**Rationale:** Centralizing transaction management at the route/task layer ensures atomicity of the entire request, avoids nested transaction issues, and makes rollback behavior predictable. Services remain stateless with respect to transaction lifecycle.

**Open Questions:** None -- reviewer actively enforces this.

---

## Rule 4: Extract Shared Logic to Utility Files

**Rule Statement:** ALWAYS extract shared helper functions to `_utils.py` or `service_utils.py` files when two or more service modules need the same logic. NEVER duplicate service logic across files.

**Confidence:** High
**Frequency:** ~15 PRs with explicit extraction; reviewer consistently enforces

**Code Examples:**

From PR #6651 -- reviewer requested extracting shared validation to `organization_user_utils.py`:
> "I think the update user service also has this function, could we move it to a central location and both of them use it?" -- chouinar

The result was a new shared file:
```python
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

From PR #4493 -- shared search filters extracted to `service_utils.py`:
```python
# api/src/services/service_utils.py
def _add_search_filters(
    builder: search.SearchQueryBuilder,
    request_field_name_mapping: dict,
    filters: BaseModel | None = None,
) -> None:
    if filters is None:
        return
    for field in filters.model_fields_set:
        field_filters = getattr(filters, field)
        field_name = _adjust_field_name(field, request_field_name_mapping)
        if isinstance(field_filters, StrSearchFilter) and field_filters.one_of:
            builder.filter_terms(field_name, field_filters.one_of)
        ...
```

From PR #8620 -- reviewer requested extracting `validate_opportunity_is_draft` to a shared file:
```python
# api/src/services/opportunities_grantor_v1/opportunity_utils.py
def validate_opportunity_is_draft(opportunity: Opportunity) -> None:
    if not opportunity.is_draft:
        raise_flask_error(422, message="Only draft opportunities can be updated")
```

**Rationale:** Avoids code drift between duplicated implementations. Shared utilities become the single source of truth for common validations and query patterns.

**Open Questions:** None -- reviewer strongly enforces this.

---

## Rule 5: Standard Logger Setup Per Module

**Rule Statement:** ALWAYS begin every service module with `import logging` followed by `logger = logging.getLogger(__name__)` at module scope.

**Confidence:** High
**Frequency:** Every service file observed

**Code Examples:**

From PR #8620:
```python
import logging
...
logger = logging.getLogger(__name__)
```

From PR #6651:
```python
import logging
...
logger = logging.getLogger(__name__)
```

From PR #5385:
```python
import logging
...
logger = logging.getLogger(__name__)
```

**Rationale:** Consistent logging setup using `__name__` provides automatic module-level log namespacing, making it easy to filter and trace logs by origin module.

**Open Questions:** None.

---

## Rule 6: Structured Logging -- Variable Data in `extra`, Not Message Strings

**Rule Statement:** NEVER interpolate variable data (IDs, counts, user info) into log message strings. ALWAYS put variable data in the `extra` dict parameter.

**Confidence:** High
**Frequency:** ~10+ explicit corrections across PRs

**Code Examples:**

From PR #8632 -- reviewer correction:
> "Avoid putting variable data in log messages, makes it harder to find them. Always put any IDs in the extra - we can skip it here as the `auth.user_id` field is automatically attached by our auth." -- chouinar

Correct pattern (PR #8620):
```python
logger.info(
    "Updated opportunity",
    extra={"opportunity_id": opportunity_id},
)
```

Incorrect pattern (corrected in PR #8632):
```python
# WRONG -- variable data in message string
logger.info(f"Getting saved opportunities for user {user_id}")

# CORRECT -- static message, data in extra
logger.info("Getting saved opportunities for user")
```

From PR #5385 -- reviewer approved this pattern:
```python
logger.info("Processing sam.gov entity record connection to user", extra=log_extra)
```

**Rationale:** Static log messages are searchable and aggregatable in log management systems. When variable data is interpolated into the message, every log entry produces a unique string that is harder to grep, group, and alert on.

**Open Questions:** None -- consistently enforced.

---

## Rule 7: Never Log Sensitive Data (PII)

**Rule Statement:** NEVER log user emails, personally identifiable information, or other sensitive data in log messages or `extra` dicts.

**Confidence:** High
**Frequency:** ~5 explicit corrections

**Code Examples:**

From PR #5385 -- reviewer explicitly caught PII logging:
> "Also - don't log the users email." -- chouinar

The contributor had logged the user's email for debugging; this was removed.

**Rationale:** Log data is often stored in centralized logging systems with broad access. PII in logs creates compliance risks (GDPR, etc.) and data exposure surface.

**Open Questions:** None.

---

## Rule 8: Use `raise_flask_error()` for HTTP Errors

**Rule Statement:** ALWAYS use `raise_flask_error(status_code, message)` from `src.api.route_utils` for all error conditions in service functions. NEVER raise raw exceptions or return error tuples from services.

**Confidence:** High
**Frequency:** ~85% of service functions with error cases

**Code Examples:**

From PR #6651:
```python
if not org_user:
    raise_flask_error(404, message=f"Could not find User with ID {user_id}")
```

From PR #8620:
```python
# api/src/services/opportunities_grantor_v1/opportunity_utils.py
if not opportunity.is_draft:
    raise_flask_error(422, message="Only draft opportunities can be updated")
```

From PR #6645:
```python
if not can_access(user, {Privilege.START_APPLICATION}, organization):
    raise_flask_error(403, "Forbidden")
```

**Rationale:** `raise_flask_error` provides a consistent mechanism for service functions to signal HTTP-level errors. The framework catches these and serializes them into standard error responses. Using this single mechanism keeps error handling uniform.

**Open Questions:** None.

---

## Rule 9: Use `select()` + `scalar_one_or_none()` for Single Record Lookups

**Rule Statement:** ALWAYS use the `select(Model).where(...)` pattern with `.scalar_one_or_none()` for fetching a single record. ALWAYS follow with a `raise_flask_error(404, ...)` guard if the record is required.

**Confidence:** High
**Frequency:** Very high -- standard pattern in every service that fetches records

**Code Examples:**

From PR #6651 (`organization_user_utils.py`):
```python
org_user = db_session.execute(
    select(OrganizationUser)
    .where(OrganizationUser.organization_id == organization.organization_id)
    .where(OrganizationUser.user_id == user_id)
).scalar_one_or_none()

if not org_user:
    raise_flask_error(404, message=f"Could not find User with ID {user_id}")
```

From PR #4314 (`update_application_form.py`):
```python
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

**Rationale:** `scalar_one_or_none()` returns either the record or `None`, making the null-check pattern clean and predictable. This avoids exceptions from `.one()` when records are missing, and avoids silent bugs from `.first()` when duplicates exist.

**Open Questions:** None.

---

## Rule 10: Use Explicit `selectinload()` -- Never `selectinload("*")`

**Rule Statement:** ALWAYS specify individual relationships in `selectinload()` calls. NEVER use `selectinload("*")`.

**Confidence:** High
**Frequency:** ~25+ PRs; explicit reviewer correction in PR #8620

**Code Examples:**

From PR #8620 -- reviewer explicitly rejected `selectinload("*")`:
> "don't do `selectinload("*")` - that fetches every relationship from an opportunity which ends up being about half the DB. We should only have the selectinloads for relationships we want" -- chouinar

Correct pattern (from PR #6714 / #4314):
```python
select(Application)
    .options(selectinload(Application.application_forms))
    .options(selectinload(Application.application_users))
```

From PR #5385:
```python
select(SamGovEntity)
    .where(SamGovEntity.ebiz_poc_email == user_email)
    .options(selectinload(SamGovEntity.organization))
```

**Rationale:** `selectinload("*")` eagerly loads every relationship on a model, which for complex models like `Opportunity` can cascade into loading a large portion of the database. Explicitly naming relationships ensures only the data needed for the current operation is fetched.

**Open Questions:** None -- reviewer is emphatic about this.

---

## Rule 11: Use `can_access()` / `verify_access()` for Authorization

**Rule Statement:** ALWAYS use `can_access()` or `verify_access()` from `src.auth.endpoint_access_util` for authorization checks. NEVER write custom membership validation queries.

**Confidence:** High
**Frequency:** ~15+ PRs, all recent organization/grantor work

**Code Examples:**

From PR #6645 -- replacing manual membership check with `can_access`:
```python
# OLD (removed):
def _validate_organization_membership(db_session, organization, user):
    is_member = db_session.execute(
        select(OrganizationUser)
        .where(OrganizationUser.organization_id == organization.organization_id)
        .where(OrganizationUser.user_id == user.user_id)
    ).scalar_one_or_none()
    if not is_member:
        raise_flask_error(403, "User is not a member of the organization")

# NEW:
if not can_access(user, {Privilege.START_APPLICATION}, organization):
    raise_flask_error(403, "Forbidden")
```

From PR #8620:
```python
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
```

From PR #6651:
```python
if not can_access(user, {Privilege.MANAGE_ORG_MEMBERS}, organization):
    raise_flask_error(403, "Forbidden")
```

**Rationale:** Centralized auth functions enforce the RBAC model consistently. Manual membership queries are error-prone, don't account for the full privilege hierarchy, and diverge over time.

**Open Questions:** There is acknowledged duplication between `verify_access()` and `check_user_access()` (raised in PR #8632). The reviewer noted: "why do we have `verify_access` and `check_user_access`? We seem to have made a duplicate of this same functionality." This needs tech lead resolution.

---

## Rule 12: Check Authorization After 404 Checks, Before Business Logic

**Rule Statement:** ALWAYS follow this validation order in service functions: (1) Request validation, (2) 404 checks (does the entity exist?), (3) Authorization (does the user have permission?), (4) Business logic validation.

**Confidence:** High
**Frequency:** ~5 explicit corrections; consistently enforced in later PRs

**Code Examples:**

From PR #6645 -- reviewer explicitly requested reordering:
> "Could we move the `validate_competition_open`, `_validate_organization_expiration` and `_validate_applicant_type` to all happen _after_ the `can_access` check? The first meaningful check we should do (after request validation + 404s) is checking roles to avoid giving info to users that shouldn't have it." -- chouinar

Result in `create_application.py`:
```python
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
_validate_applicant_type(competition, organization_id)
```

From PR #8620:
```python
# 1. Fetch + 404
opportunity = get_opportunity_for_grantors(db_session, user, opportunity_id)
# 2. Auth
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
# 3. Business logic
validate_opportunity_is_draft(opportunity)
```

**Rationale:** Checking auth before business rules prevents information leakage. If a user does not have permission, they should get a 403 -- not a 422 that reveals details about the state of the resource.

**Open Questions:** None.

---

## Rule 13: Service Functions Return Domain Objects, Not Dicts

**Rule Statement:** ALWAYS return SQLAlchemy model instances (or tuples of model + warnings) from service functions. NEVER return raw dicts. The route layer handles serialization via Marshmallow schemas.

**Confidence:** High
**Frequency:** High -- consistent across all observed service functions

**Code Examples:**

From PR #8620:
```python
def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
    ...
    return opportunity
```

From PR #4314:
```python
def update_application_form(
    db_session: db.Session, application_id: UUID, form_id: UUID, application_response: dict
) -> tuple[ApplicationForm, list[ValidationErrorDetail]]:
```

**Rationale:** Returning domain objects keeps services focused on business logic. Serialization is a presentation concern handled by the route layer using `response.ApiResponse` and Marshmallow schemas.

**Open Questions:** None.

---

## Rule 14: PUT Means Full Replacement

**Rule Statement:** ALWAYS update all fields on a PUT endpoint. For nullable optional fields, use `load_default=None` in the Marshmallow schema so omitted fields explicitly clear existing values.

**Confidence:** High
**Frequency:** Low (2 corrections), but explicitly stated rule

**Code Examples:**

From PR #8620 -- reviewer explanation:
> "Since this is a PUT endpoint, we should always update every field. We do that intentionally since the [partial] update approach ends up more complex (for us and the frontend)." -- chouinar

Recommended implementation:
```python
# PUT endpoint -- always update all fields
for field, value in opportunity_data.items():
    setattr(opportunity, field, value)
```

Schema for nullable field:
```python
category_explanation = fields.String(
    allow_none=True,
    load_default=None,  # Omitted field defaults to None, clearing existing value
    validate=validators.Length(max=255),
)
```

From PR #8620 -- reviewer on `load_default`:
> "For any nullable field, the JSON schema needs to set a `load_default`... If [the field is] not in the request, it won't be in this dict so it'll not be nulled out as currently implemented."

**Rationale:** Full replacement semantics simplify both server and client code. The frontend always sends the complete state, and the server always writes it. There is no ambiguity about whether omitting a field means "keep current value" vs "clear it."

**Open Questions:** None.

---

## Rule 15: Do Not Import Private (`_`-prefixed) Functions

**Rule Statement:** NEVER import functions that start with `_` from other modules. Use the module's public API instead.

**Confidence:** High
**Frequency:** Low (~3 corrections), but clearly stated principle

**Code Examples:**

From PR #8620 -- reviewer caught import of a private function:
> "We should avoid importing things that start with `_` - python won't disallow it, but it's the pythonic way of saying something is private. [...] Reuse the function that does the check for opportunity being null and 404s for consistency." -- chouinar

Correction:
```python
# WRONG -- importing private function
from src.services.opportunities_grantor_v1.get_opportunity import _get_opportunity_for_grantors

# CORRECT -- use public function
from src.services.opportunities_grantor_v1.get_opportunity import get_opportunity_for_grantors
```

**Rationale:** The `_` prefix is the Python convention for "internal implementation detail." Importing it creates coupling to implementation that may change without notice. Public functions are the stable contract.

**Open Questions:** None.

---

## Rule 16: Do Not Flush or Re-query Within Transactions Unnecessarily

**Rule Statement:** NEVER call `db_session.flush()` followed by a re-query to reload an object within a transaction. Objects fetched from the session are already tracked and available.

**Confidence:** High
**Frequency:** Explicit correction in PR #8620

**Code Examples:**

From PR #8620 -- reviewer removed unnecessary flush + re-query:
> "None of this should be needed. Anything fetched from the DB will be in the DB session. There isn't anything we need to flush, and the select here would be duplicating what the GET function should have done." -- chouinar

The contributor had added:
```python
# WRONG -- unnecessary flush and re-query
db_session.flush()
opportunity = db_session.execute(
    select(Opportunity).where(Opportunity.opportunity_id == opportunity_id)
    .options(selectinload("*"))
).scalar_one_or_none()
```

This was replaced by simply returning the already-tracked object.

**Rationale:** SQLAlchemy's identity map ensures that objects fetched in a session are tracked. Flushing and re-querying adds unnecessary database round-trips and can introduce subtle bugs if the re-query uses different `selectinload` options.

**Open Questions:** None.

---

## Rule 17: Use Factory `.build()` for Unit Tests, `.create()` for Integration Tests

**Rule Statement:** ALWAYS use factory `.build()` when no database persistence is needed (pure unit tests). Use `.create()` only when records must exist in the database (integration tests).

**Confidence:** High
**Frequency:** Very high; reviewer explicitly recommends `.build()` over custom helpers

**Code Examples:**

From PR #8614 -- reviewer questioned custom test helper:
> "I am curious why we would use this (and below functions) instead of a factory? If we don't want anything in the DB / want to keep it simple, use `.build()`." -- chouinar

Unit test with `.build()` (PR #8614, after reviewer correction):
```python
att = ApplicationAttachmentFactory.build()
form = ApplicationFormFactory.build(application_response={"att1": uid})
app = ApplicationFactory.build()
app.application_attachments = [att]
app.application_forms = [form]
```

Integration test with `.create()` (PR #6651):
```python
admin_user, organization, admin_token = create_user_in_org(
    privileges=[Privilege.MANAGE_ORG_MEMBERS],
    db_session=db_session,
    is_organization_owner=True,
)
target_user, _, _ = create_user_in_org(
    privileges=[Privilege.VIEW_ORG_MEMBERSHIP],
    db_session=db_session,
    organization=organization,
)
```

From PR #4314 -- `.build()` used for schema validation tests that don't need DB:
```python
SIMPLE_FORM = FormFactory.build(
    form_json_schema={
        "type": "object",
        "properties": {
            "StrField": {"type": "string", "maxLength": 20, "format": "email"},
            "IntField": {"type": "integer", "maximum": 1000},
        },
        "required": ["StrField"],
    }
)
```

**Rationale:** `.build()` avoids database overhead, making unit tests faster and more isolated. It also makes clear that the test is verifying logic, not database behavior. `.create()` is for tests that exercise the full persistence layer.

**Open Questions:** None.

---

## Rule 18: Boolean Fields Should Be Named as Questions

**Rule Statement:** ALWAYS name boolean fields and parameters using `is_`, `has_`, `can_`, `was_`, or similar question-form prefixes.

**Confidence:** High
**Frequency:** Low (~2 corrections), but clearly stated preference

**Code Examples:**

From PR #4493 -- reviewer requested renaming:
> "we should really make booleans be named as sorta-questions (is/has/are/was/can, whatever makes sense in the context)." -- chouinar

Result: `active` was renamed to `has_active_opportunity`.

```python
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Nested(
        BoolSearchSchemaBuilder("HasActiveOpportunityFilterV1Schema")
        .with_one_of(example=True)
        .build()
    )
```

**Rationale:** Question-form boolean names make conditional code read like natural language: `if agency.has_active_opportunity:` is clearer than `if agency.active:`.

**Open Questions:** None.

---

## Rule 19: Avoid the Walrus Operator (`:=`) Unless It Clearly Improves Readability

**Rule Statement:** AVOID using the walrus operator (`:=`) in service code. Prefer explicit variable assignment in a preceding statement.

**Confidence:** Medium
**Frequency:** Low (~2 mentions), stated preference

**Code Examples:**

From PR #5443 -- reviewer rejected walrus operator suggestion:
> "I try to avoid `:=` except when it really really makes things cleaner because it's not a super well known feature of Python." -- chouinar

A contributor suggested:
```python
# Suggested (rejected):
if config := ACTION_RULE_CONFIG_MAP.get(action, None):
    return config
```

Preferred:
```python
config = ACTION_RULE_CONFIG_MAP.get(action, None)
if config is None:
    raise Exception(...)
return config
```

**Rationale:** Team preference for readability. The walrus operator can obscure control flow for developers unfamiliar with it.

**Open Questions:** This is a style preference, not a hard rule. Some team members (freddieyebra) do suggest it. Tech lead should clarify threshold for when it is acceptable.

---

## Rule 20: Do Not Expose Internal URLs or Sensitive Fields in API Responses

**Rule Statement:** NEVER expose internal infrastructure details (S3 URLs, internal service endpoints, etc.) in API response schemas.

**Confidence:** High
**Frequency:** Explicit correction in PR #4230

**Code Examples:**

From PR #4230 -- reviewer caught an internal S3 URL being exposed:
> "Why did this get added? We don't want to expose our internal s3 urls to users." -- chouinar

The offending field was removed from the schema.

**Rationale:** Internal URLs reveal infrastructure details that could be used for reconnaissance. API responses should only contain data intended for external consumers.

**Open Questions:** None.

---

## Rule 21: Do Not Change Behavior of Shared Utility Functions for One Endpoint

**Rule Statement:** NEVER modify a shared utility function's behavior (especially privilege requirements) to serve a single endpoint's needs. If an endpoint has different requirements, add checks after calling the shared function, or create a separate function.

**Confidence:** High
**Frequency:** Explicit, forceful correction in PR #8632

**Code Examples:**

From PR #8632 -- reviewer caught a privilege change to a shared function:
> "Don't change this - this 100% needs to be left alone, changing this changes the functionality of every endpoint that uses this utility. Don't do that." -- chouinar

> "This function verifies they have exactly this privilege, if the endpoint in question wants to check something else, either don't use this function or add additional checks after calling this function." -- chouinar

**Rationale:** Shared utilities form a contract that multiple endpoints depend on. Changing their behavior for one endpoint's needs introduces unintended side effects across the codebase.

**Open Questions:** None.

---

## Rule 22: Schema Field Names Must Match DB Model Field Names

**Rule Statement:** NEVER rename schema fields to differ from the corresponding database model field names.

**Confidence:** Medium
**Frequency:** Low (~1 correction in PR #5424)

**Code Examples:**

From PR #5424 -- reviewer rejected a field rename:
> "I don't think we want to rename things, otherwise the JSON doesn't match the DB model which can be confusing to look at later." -- chouinar

```python
# WRONG -- renamed from DB model field
attachments = fields.List(...)

# CORRECT -- matches DB model attribute
opportunity_attachments = fields.List(
    fields.Nested(OpportunityVersionAttachmentSchema),
)
```

**Rationale:** Matching names between API schema and database model reduces cognitive overhead. Developers can find the schema field in the model without consulting a mapping.

**Open Questions:** There may be valid cases for renaming (e.g., legacy compatibility). Tech lead should clarify when exceptions are acceptable.

---

## Rule 23: Pydantic BaseModel for Search/Filter Parameters

**Rule Statement:** ALWAYS define search and filter parameters as Pydantic `BaseModel` classes within service files. Parse raw dict input via `model_validate()`.

**Confidence:** High
**Frequency:** ~15+ search/filter service files

**Code Examples:**

From PR #4493 (`search_agencies.py`):
```python
class AgencySearchFilters(BaseModel):
    has_active_opportunity: BoolSearchFilter | None = None


class AgencySearchParams(BaseModel):
    pagination: PaginationParams
    filters: AgencySearchFilters | None = Field(default=None)
    query: str | None = None
    query_operator: str = Field(default=SearchQueryOperator.OR)
```

Usage:
```python
def search_agencies(
    search_client: search.SearchClient, raw_search_params: dict
) -> Tuple[Sequence[dict], PaginationInfo]:
    params = AgencySearchParams.model_validate(raw_search_params)
    ...
```

**Rationale:** Pydantic models provide validation, type coercion, and clear documentation of the parameter contract. `model_validate()` gives clean error messages for invalid input.

**Open Questions:** None.

---

## Rule 24: Validation Warnings (Not Blocking) for Form Data

**Rule Statement:** ALWAYS return form validation issues as warnings (list of `ValidationErrorDetail`) during save/update operations. ONLY block (raise errors) during submission.

**Confidence:** High
**Frequency:** ~10 PRs, consistent for the application form domain

**Code Examples:**

From PR #4314 -- the design principle:
> "Note that the validation doesn't prevent or in any way block a users answers from being filled out, it's just the current set of open issues. This is so if a user partially fills out a form, we'll note down what is still needed/incorrect, but not block them from saving their answers." -- chouinar

```python
# During save/update -- return warnings, don't block
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
return application_form, warnings

# During submission -- block if errors exist
validate_forms(application, ApplicationAction.SUBMIT)  # raises 422 if issues
```

From PR #5443 -- action-based configuration:
```python
ACTION_RULE_CONFIG_MAP = {
    ApplicationAction.START: START_JSON_RULE_CONFIG,
    ApplicationAction.GET: GET_JSON_RULE_CONFIG,
    ApplicationAction.MODIFY: UPDATE_JSON_RULE_CONFIG,
    ApplicationAction.SUBMIT: SUBMISSION_JSON_RULE_CONFIG,
}
```

**Rationale:** Users should be able to save partial form progress without being blocked. Validation warnings guide them toward completion. Only at submission time is completeness enforced as a hard gate.

**Open Questions:** None.

---

## Rule 25: Route Handlers Must Add Token Session to DB Session

**Rule Statement:** ALWAYS call `db_session.add(user_token_session)` or `db_session.add(user)` inside the `with db_session.begin():` block before passing the user to service functions.

**Confidence:** Medium
**Frequency:** Inconsistent in earlier PRs; consistently present in later PRs

**Code Examples:**

From PR #6645 -- this line was added to fix a missing session attachment:
```python
with db_session.begin():
    db_session.add(token_session)
    application = create_application(
        db_session, competition_id, user, application_name, organization_id
    )
```

From PR #8620:
```python
with db_session.begin():
    user = jwt_or_api_user_key_multi_auth.get_user()
    db_session.add(user)
    opportunity = update_opportunity(db_session, user, opportunity_id, json_data)
```

From PR #6651:
```python
with db_session.begin():
    db_session.add(user_token_session)
    remove_user_from_organization(db_session, user_token_session.user, user_id, organization_id)
```

**Rationale:** The user/token session object is created by the auth middleware outside the current DB session. If not explicitly added, SQLAlchemy will raise a `DetachedInstanceError` when the service function tries to navigate relationships from the user object.

**Open Questions:** Positioning varies -- sometimes `db_session.add()` is before `begin()`, sometimes inside. Tech lead should clarify whether it must always be inside `begin()`.

---

## Summary of Confidence Levels

| Rule | Confidence | Frequency |
|------|-----------|-----------|
| 1. One Service Function Per File | High | ~80% of PRs |
| 2. db_session as First Parameter | High | ~90% |
| 3. Route Layer Manages Transactions | High | ~70%, increasing |
| 4. Extract Shared Logic to Utils | High | ~15 PRs, actively enforced |
| 5. Standard Logger Setup | High | Every file |
| 6. Variable Data in `extra` | High | ~10+ corrections |
| 7. Never Log PII | High | ~5 corrections |
| 8. Use raise_flask_error() | High | ~85% |
| 9. select() + scalar_one_or_none() | High | Very high |
| 10. Explicit selectinload() | High | ~25+ PRs |
| 11. can_access() / verify_access() | High | ~15+ PRs |
| 12. Auth After 404, Before Business Logic | High | ~5 corrections |
| 13. Return Domain Objects | High | High |
| 14. PUT = Full Replacement | High | 2 corrections |
| 15. No Private Imports | High | 3 corrections |
| 16. No Unnecessary Flush/Re-query | High | 1 correction |
| 17. Factory .build() vs .create() | High | Very high |
| 18. Boolean Question-form Names | High | 2 corrections |
| 19. Avoid Walrus Operator | Medium | 2 mentions |
| 20. No Internal URLs in Responses | High | 1 correction |
| 21. Don't Mutate Shared Utils | High | 1 forceful correction |
| 22. Schema Names Match DB Names | Medium | 1 correction |
| 23. Pydantic for Search Params | High | ~15+ files |
| 24. Warnings Not Blocking for Forms | High | ~10 PRs |
| 25. Add Token Session to DB Session | Medium | Inconsistent early, consistent late |

## Open Questions for Tech Lead Review

1. **`verify_access()` vs `check_user_access()` duplication** -- Which is the canonical function? Should one be deprecated? (Raised in PR #8632)

2. **Auth in routes vs services** -- Some PRs check auth type in routes (e.g., checking `UserTokenSession` type in PR #5434), while others push auth into services via `can_access`. What is the preferred boundary?

3. **`db_session.add(token_session)` positioning** -- Must this always be inside `with db_session.begin():`? Some PRs place it before.

4. **Walrus operator threshold** -- Is there a specific case where `:=` is acceptable, or is it a blanket "avoid"?

5. **Schema field rename exceptions** -- Are there valid cases for API schema fields to differ from DB model field names (e.g., legacy API compatibility)?
