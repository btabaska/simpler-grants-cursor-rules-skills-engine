# API Services Layer — Conventions & Rules

> **Status:** Draft — pending tech lead validation. Items marked (⏳) are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The API services layer (`api/src/services/`) implements business logic for the Simpler Grants platform. Service functions are organized by domain subdirectory (e.g., `opportunities_grantor_v1/`, `organizations_v1/`, `users/`), with each file containing a single primary public function. Services receive a database session from the route layer, operate within an externally managed transaction, and return SQLAlchemy domain objects. Reference architecture guide Section 4.

The service layer enforces a strict separation of concerns: routes handle HTTP contract details and transaction boundaries, services handle business logic and authorization, and models handle data representation. This separation is actively enforced in code review by the primary API reviewer (chouinar). Services never commit transactions, never serialize responses, and never manage HTTP-level concerns beyond raising `raise_flask_error()` for error conditions.

Authorization follows a centralized RBAC model using `can_access()` / `verify_access()` utilities. Logging uses structured messages with variable data in `extra` dicts. Shared logic is extracted to utility files when two or more services need the same helper. The entire layer is tested using factory-based fixtures with `.build()` for unit tests and `.create()` for integration tests.

## Rules

### File Organization

#### Rule: One Service Function Per File, Organized by Domain

**Confidence:** High
**Observed in:** ~80% of service PRs | PR refs: #8620, #6651, #4528

Each primary service function lives in its own file within the appropriate domain subdirectory under `api/src/services/{domain}/`.

**DO:**
```python
# From PR #8620 — new file for opportunity update service
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

**DON'T:**
```python
# Anti-pattern — cramming multiple service functions into one file
# api/src/services/opportunities_grantor_v1/opportunity_service.py
def create_opportunity(...): ...
def update_opportunity(...): ...
def delete_opportunity(...): ...
def get_opportunity(...): ...
```

> **Rationale:** One-function-per-file keeps service modules small and focused. It simplifies imports, reduces merge conflicts, and makes it obvious where to find each service operation. Domain subdirectories provide natural grouping.

---

#### Rule: Extract Shared Logic to Utility Files

**Confidence:** High
**Observed in:** ~15 PRs with explicit extraction | PR refs: #6651, #4493, #8620

When two or more service modules need the same logic, extract it to a `_utils.py` or `service_utils.py` file. Never duplicate service logic across files.

**DO:**
```python
# From PR #6651 — shared validation extracted to organization_user_utils.py
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

**DON'T:**
```python
# Anti-pattern — duplicating the same validation in two service files
# api/src/services/organizations_v1/remove_user.py
def _check_user_exists(db_session, user_id, org):
    ...  # duplicate of code in update_user.py

# api/src/services/organizations_v1/update_user.py
def _check_user_exists(db_session, user_id, org):
    ...  # duplicate of code in remove_user.py
```

> **Rationale:** Avoids code drift between duplicated implementations. Shared utilities become the single source of truth for common validations and query patterns. Reviewer actively requests extraction when duplication is spotted.

---

### Function Signatures

#### Rule: db_session as First Parameter

**Confidence:** High
**Observed in:** ~90% of service functions | PR refs: #8620, #6651, #4314

Always pass `db_session: db.Session` as the first parameter to service functions that interact with the database.

**DO:**
```python
# From PR #8620 — db_session is first parameter
def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
```

**DON'T:**
```python
# Anti-pattern — db_session buried in the middle or missing
def update_opportunity(
    user: User, opportunity_id: uuid.UUID, opportunity_data: dict, db_session: db.Session
) -> Opportunity:
```

> **Rationale:** The session is obtained at the route layer via `@flask_db.with_db_session()` and passed down explicitly. This makes the database dependency visible, avoids hidden global state, and allows the route layer to control transaction boundaries. Search services use `search_client: search.SearchClient` instead for OpenSearch operations.

---

#### Rule: Service Functions Return Domain Objects, Not Dicts

**Confidence:** High
**Observed in:** High frequency | PR refs: #8620, #4314, #4513

Always return SQLAlchemy model instances (or tuples of model + warnings) from service functions. Never return raw dicts.

**DO:**
```python
# From PR #8620 — returns Opportunity model instance
def update_opportunity(
    db_session: db.Session, user: User, opportunity_id: uuid.UUID, opportunity_data: dict
) -> Opportunity:
    ...
    return opportunity
```

```python
# From PR #4314 — returns tuple of model + warnings
def update_application_form(
    db_session: db.Session, application_id: UUID, form_id: UUID, application_response: dict
) -> tuple[ApplicationForm, list[ValidationErrorDetail]]:
```

**DON'T:**
```python
# Anti-pattern — returning a dict from a service function
def update_opportunity(...) -> dict:
    return {"id": str(opportunity.opportunity_id), "title": opportunity.title}
```

> **Rationale:** Returning domain objects keeps services focused on business logic. Serialization is a presentation concern handled by the route layer using `response.ApiResponse` and Marshmallow schemas.

---

### Transaction Management

#### Rule: Route Layer Manages Transaction Boundaries

**Confidence:** High
**Observed in:** ~70% of route handlers, increasing | PR refs: #8620, #6651, #4550

Always wrap service calls in `with db_session.begin():` at the route layer. Never commit or call `begin()` inside service functions.

**DO:**
```python
# From PR #8620 — route handler wrapping service call in begin()
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

**DON'T:**
```python
# Anti-pattern — committing inside a service function
def update_opportunity(db_session, user, opportunity_id, data):
    opportunity = ...
    db_session.commit()  # WRONG — route should manage this
    return opportunity
```

> **Rationale:** Centralizing transaction management at the route/task layer ensures atomicity of the entire request, avoids nested transaction issues, and makes rollback behavior predictable. Services remain stateless with respect to transaction lifecycle. Reviewer (chouinar) specifically enforces this in PR #4550.

---

#### Rule: Route Handlers Must Add Token Session to DB Session (⏳)

**Confidence:** Medium
**Observed in:** Inconsistent in earlier PRs; consistently present in later PRs | PR refs: #6645, #8620, #6651

Always call `db_session.add(user_token_session)` or `db_session.add(user)` inside the `with db_session.begin():` block before passing the user to service functions.

**DO:**
```python
# From PR #8620 — adding user to db_session inside begin()
with db_session.begin():
    user = jwt_or_api_user_key_multi_auth.get_user()
    db_session.add(user)
    opportunity = update_opportunity(db_session, user, opportunity_id, json_data)
```

**DON'T:**
```python
# Anti-pattern — forgetting to add user to db_session
with db_session.begin():
    user = jwt_or_api_user_key_multi_auth.get_user()
    # Missing db_session.add(user) — will cause DetachedInstanceError
    opportunity = update_opportunity(db_session, user, opportunity_id, json_data)
```

> **Rationale:** The user/token session object is created by the auth middleware outside the current DB session. If not explicitly added, SQLAlchemy will raise a `DetachedInstanceError` when the service function tries to navigate relationships from the user object. Positioning of `db_session.add()` (before vs. inside `begin()`) needs tech lead clarification.

---

#### Rule: Do Not Flush or Re-query Within Transactions Unnecessarily

**Confidence:** High
**Observed in:** Explicit correction in 1 PR | PR refs: #8620

Never call `db_session.flush()` followed by a re-query to reload an object within a transaction. Objects fetched from the session are already tracked and available.

**DO:**
```python
# From PR #8620 — simply return the already-tracked object
def update_opportunity(db_session, user, opportunity_id, data):
    opportunity = get_opportunity_for_grantors(db_session, user, opportunity_id)
    for field, value in data.items():
        setattr(opportunity, field, value)
    return opportunity  # already tracked by the session
```

**DON'T:**
```python
# Anti-pattern — unnecessary flush and re-query (removed in PR #8620)
db_session.flush()
opportunity = db_session.execute(
    select(Opportunity).where(Opportunity.opportunity_id == opportunity_id)
    .options(selectinload("*"))
).scalar_one_or_none()
```

> **Rationale:** SQLAlchemy's identity map ensures that objects fetched in a session are tracked. Flushing and re-querying adds unnecessary database round-trips and can introduce subtle bugs if the re-query uses different `selectinload` options.

---

### Logging

#### Rule: Standard Logger Setup Per Module

**Confidence:** High
**Observed in:** Every service file observed | PR refs: #8620, #6651, #5385

Always begin every service module with `import logging` followed by `logger = logging.getLogger(__name__)` at module scope.

**DO:**
```python
# From PR #8620 — standard logger setup
import logging
...
logger = logging.getLogger(__name__)
```

**DON'T:**
```python
# Anti-pattern — custom logger name or missing logger
import logging
logger = logging.getLogger("opportunity_service")  # WRONG — use __name__
```

> **Rationale:** Consistent logging setup using `__name__` provides automatic module-level log namespacing, making it easy to filter and trace logs by origin module. See also cross-cutting pattern CCP-1 in the cross-domain synthesis.

---

#### Rule: Variable Data in `extra`, Not Message Strings

**Confidence:** High
**Observed in:** 10+ explicit corrections | PR refs: #8632, #8620, #5385

Never interpolate variable data (IDs, counts, user info) into log message strings. Always put variable data in the `extra` dict parameter.

**DO:**
```python
# From PR #8620 — static message with data in extra
logger.info(
    "Updated opportunity",
    extra={"opportunity_id": opportunity_id},
)
```

**DON'T:**
```python
# Anti-pattern — variable data in message string (corrected in PR #8632)
logger.info(f"Getting saved opportunities for user {user_id}")
```

> **Rationale:** Static log messages are searchable and aggregatable in log management systems. When variable data is interpolated into the message, every log entry produces a unique string that is harder to grep, group, and alert on. See also cross-cutting pattern CCP-1.

---

#### Rule: Never Log Sensitive Data (PII)

**Confidence:** High
**Observed in:** ~5 explicit corrections | PR refs: #5385, #8632

Never log user emails, personally identifiable information, or other sensitive data in log messages or `extra` dicts.

**DO:**
```python
# From PR #5385 — log without PII, use user_id instead
logger.info("Processing sam.gov entity record connection to user", extra=log_extra)
```

**DON'T:**
```python
# Anti-pattern — logging PII (caught and removed in PR #5385)
logger.info(f"Processing entity for user email: {user.email}")
```

> **Rationale:** Log data is often stored in centralized logging systems with broad access. PII in logs creates compliance risks (GDPR, etc.) and data exposure surface. Reviewer chouinar explicitly stated: "don't log the users email."

---

### Error Handling

#### Rule: Use `raise_flask_error()` for HTTP Errors

**Confidence:** High
**Observed in:** ~85% of service functions with error cases | PR refs: #6651, #8620, #6645

Always use `raise_flask_error(status_code, message)` from `src.api.route_utils` for all error conditions in service functions. Never raise raw exceptions or return error tuples from services.

**DO:**
```python
# From PR #6651 — raise_flask_error for 404
if not org_user:
    raise_flask_error(404, message=f"Could not find User with ID {user_id}")
```

```python
# From PR #8620 — raise_flask_error for 422
if not opportunity.is_draft:
    raise_flask_error(422, message="Only draft opportunities can be updated")
```

**DON'T:**
```python
# Anti-pattern — raising raw exception from a service
if not org_user:
    raise ValueError(f"User {user_id} not found")  # WRONG — use raise_flask_error
```

> **Rationale:** `raise_flask_error` provides a consistent mechanism for service functions to signal HTTP-level errors. The framework catches these and serializes them into standard error responses. See also cross-cutting pattern CCP-4.

---

### Database Query Patterns

#### Rule: Use `select()` + `scalar_one_or_none()` for Single Record Lookups

**Confidence:** High
**Observed in:** Very high frequency | PR refs: #6651, #4314, #5385

Always use the `select(Model).where(...)` pattern with `.scalar_one_or_none()` for fetching a single record. Always follow with a `raise_flask_error(404, ...)` guard if the record is required.

**DO:**
```python
# From PR #6651 — standard lookup pattern
org_user = db_session.execute(
    select(OrganizationUser)
    .where(OrganizationUser.organization_id == organization.organization_id)
    .where(OrganizationUser.user_id == user_id)
).scalar_one_or_none()

if not org_user:
    raise_flask_error(404, message=f"Could not find User with ID {user_id}")
```

**DON'T:**
```python
# Anti-pattern — using .first() which silently ignores duplicates
org_user = db_session.execute(
    select(OrganizationUser).where(...)
).scalars().first()
```

> **Rationale:** `scalar_one_or_none()` returns either the record or `None`, making the null-check pattern clean and predictable. This avoids exceptions from `.one()` when records are missing, and avoids silent bugs from `.first()` when duplicates exist.

---

#### Rule: Use Explicit `selectinload()` — Never `selectinload("*")`

**Confidence:** High
**Observed in:** 25+ PRs | PR refs: #8620, #6714, #4314

Always specify individual relationships in `selectinload()` calls. Never use `selectinload("*")`.

**DO:**
```python
# From PR #6714 / #4314 — explicit relationship loading
select(Application)
    .options(selectinload(Application.application_forms))
    .options(selectinload(Application.application_users))
```

**DON'T:**
```python
# Anti-pattern — wildcard loading (rejected in PR #8620)
select(Opportunity)
    .options(selectinload("*"))  # Loads half the database
```

> **Rationale:** `selectinload("*")` eagerly loads every relationship on a model, which for complex models like `Opportunity` can cascade into loading a large portion of the database. Reviewer chouinar stated: "don't do selectinload('*') - that fetches every relationship from an opportunity which ends up being about half the DB." See also cross-cutting pattern CCP-9.

---

### Authorization

#### Rule: Use `can_access()` / `verify_access()` for Authorization

**Confidence:** High
**Observed in:** 15+ PRs | PR refs: #6645, #8620, #6651

Always use `can_access()` or `verify_access()` from `src.auth.endpoint_access_util` for authorization checks. Never write custom membership validation queries.

**DO:**
```python
# From PR #8620 — verify_access for grantor operations
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
```

```python
# From PR #6651 — can_access for org member management
if not can_access(user, {Privilege.MANAGE_ORG_MEMBERS}, organization):
    raise_flask_error(403, "Forbidden")
```

**DON'T:**
```python
# Anti-pattern — manual membership query (removed in PR #6645)
def _validate_organization_membership(db_session, organization, user):
    is_member = db_session.execute(
        select(OrganizationUser)
        .where(OrganizationUser.organization_id == organization.organization_id)
        .where(OrganizationUser.user_id == user.user_id)
    ).scalar_one_or_none()
    if not is_member:
        raise_flask_error(403, "User is not a member of the organization")
```

> **Rationale:** Centralized auth functions enforce the RBAC model consistently. Manual membership queries are error-prone, don't account for the full privilege hierarchy, and diverge over time. Note: there is acknowledged duplication between `verify_access()` and `check_user_access()` (PR #8632) awaiting tech lead resolution. See also cross-cutting pattern INC-7.

---

#### Rule: Check Authorization After 404 Checks, Before Business Logic

**Confidence:** High
**Observed in:** ~5 explicit corrections | PR refs: #6645, #8620

Always follow this validation order in service functions: (1) Request validation, (2) 404 checks (does the entity exist?), (3) Authorization (does the user have permission?), (4) Business logic validation.

**DO:**
```python
# From PR #8620 — correct order: fetch, auth, business logic
# 1. Fetch + 404
opportunity = get_opportunity_for_grantors(db_session, user, opportunity_id)
# 2. Auth
verify_access(user, {Privilege.UPDATE_OPPORTUNITY}, opportunity.agency_record)
# 3. Business logic
validate_opportunity_is_draft(opportunity)
```

**DON'T:**
```python
# Anti-pattern — business logic before auth (corrected in PR #6645)
validate_competition_open(competition)       # reveals state info
_validate_organization_expiration(org)        # reveals state info
if not can_access(user, privileges, org):     # too late — info already leaked
    raise_flask_error(403, "Forbidden")
```

> **Rationale:** Checking auth before business rules prevents information leakage. If a user does not have permission, they should get a 403 — not a 422 that reveals details about the state of the resource.

---

### API Design

#### Rule: PUT Means Full Replacement

**Confidence:** High
**Observed in:** 2 explicit corrections | PR refs: #8620

Always update all fields on a PUT endpoint. For nullable optional fields, use `load_default=None` in the Marshmallow schema so omitted fields explicitly clear existing values.

**DO:**
```python
# From PR #8620 — PUT endpoint updates all fields
for field, value in opportunity_data.items():
    setattr(opportunity, field, value)
```

```python
# From PR #8620 — schema for nullable field with load_default
category_explanation = fields.String(
    allow_none=True,
    load_default=None,  # Omitted field defaults to None, clearing existing value
    validate=validators.Length(max=255),
)
```

**DON'T:**
```python
# Anti-pattern — partial update on a PUT endpoint
for field, value in opportunity_data.items():
    if value is not None:  # WRONG — this skips clearing nullable fields
        setattr(opportunity, field, value)
```

> **Rationale:** Full replacement semantics simplify both server and client code. The frontend always sends the complete state, and the server always writes it. There is no ambiguity about whether omitting a field means "keep current value" vs "clear it."

---

#### Rule: Do Not Expose Internal URLs or Sensitive Fields in API Responses

**Confidence:** High
**Observed in:** 1 explicit correction | PR refs: #4230

Never expose internal infrastructure details (S3 URLs, internal service endpoints, etc.) in API response schemas.

**DO:**
```python
# From PR #4230 — field removed from schema after review
# Only include fields intended for external consumers
class OpportunityAttachmentSchema(Schema):
    file_name = fields.String()
    file_size = fields.Integer()
    # s3_url deliberately excluded
```

**DON'T:**
```python
# Anti-pattern — exposing internal S3 URL (caught in PR #4230)
class OpportunityAttachmentSchema(Schema):
    file_name = fields.String()
    s3_url = fields.String()  # WRONG — exposes internal infrastructure
```

> **Rationale:** Internal URLs reveal infrastructure details that could be used for reconnaissance. API responses should only contain data intended for external consumers. See also architectural principle AP-6 in the cross-domain synthesis.

---

#### Rule: Do Not Change Behavior of Shared Utility Functions for One Endpoint

**Confidence:** High
**Observed in:** 1 forceful correction | PR refs: #8632

Never modify a shared utility function's behavior (especially privilege requirements) to serve a single endpoint's needs. Add checks after calling the shared function, or create a separate function.

**DO:**
```python
# From PR #8632 guidance — add additional checks after the shared function
result = shared_utility_function(db_session, user, entity_id)
# Additional endpoint-specific check
if not some_extra_condition:
    raise_flask_error(403, "Forbidden")
```

**DON'T:**
```python
# Anti-pattern — changing shared function privileges for one endpoint (PR #8632)
# "Don't change this - this 100% needs to be left alone, changing this
#  changes the functionality of every endpoint that uses this utility." — chouinar
def verify_access(user, privileges, entity):
    privileges.add(Privilege.SOME_NEW_THING)  # WRONG — affects all callers
```

> **Rationale:** Shared utilities form a contract that multiple endpoints depend on. Changing their behavior for one endpoint's needs introduces unintended side effects across the codebase.

---

### Naming Conventions

#### Rule: Boolean Fields Should Be Named as Questions

**Confidence:** High
**Observed in:** 2 explicit corrections | PR refs: #4493

Always name boolean fields and parameters using `is_`, `has_`, `can_`, `was_`, or similar question-form prefixes.

**DO:**
```python
# From PR #4493 — renamed from "active" to question-form
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Nested(
        BoolSearchSchemaBuilder("HasActiveOpportunityFilterV1Schema")
        .with_one_of(example=True)
        .build()
    )
```

**DON'T:**
```python
# Anti-pattern — boolean without question-form prefix (corrected in PR #4493)
class AgencySearchFilterV1Schema(Schema):
    active = fields.Nested(...)  # WRONG — should be has_active_opportunity
```

> **Rationale:** Question-form boolean names make conditional code read like natural language: `if agency.has_active_opportunity:` is clearer than `if agency.active:`. See also cross-cutting pattern CCP-6.

---

#### Rule: Schema Field Names Must Match DB Model Field Names (⏳)

**Confidence:** Medium
**Observed in:** 1 correction | PR refs: #5424

Never rename schema fields to differ from the corresponding database model field names.

**DO:**
```python
# From PR #5424 — field name matches DB model attribute
opportunity_attachments = fields.List(
    fields.Nested(OpportunityVersionAttachmentSchema),
)
```

**DON'T:**
```python
# Anti-pattern — renamed from DB model field (corrected in PR #5424)
attachments = fields.List(...)  # WRONG — DB model uses "opportunity_attachments"
```

> **Rationale:** Matching names between API schema and database model reduces cognitive overhead. Developers can find the schema field in the model without consulting a mapping. Tech lead should clarify when exceptions are acceptable (e.g., legacy API compatibility).

---

#### Rule: Do Not Import Private (`_`-prefixed) Functions

**Confidence:** High
**Observed in:** 3 explicit corrections | PR refs: #8620

Never import functions that start with `_` from other modules. Use the module's public API instead.

**DO:**
```python
# From PR #8620 — use public function
from src.services.opportunities_grantor_v1.get_opportunity import get_opportunity_for_grantors
```

**DON'T:**
```python
# Anti-pattern — importing private function (corrected in PR #8620)
from src.services.opportunities_grantor_v1.get_opportunity import _get_opportunity_for_grantors
```

> **Rationale:** The `_` prefix is the Python convention for "internal implementation detail." Importing it creates coupling to implementation that may change without notice. Public functions are the stable contract.

---

### Style Preferences

#### Rule: Avoid the Walrus Operator (`:=`) Unless It Clearly Improves Readability (⏳)

**Confidence:** Medium
**Observed in:** 2 mentions | PR refs: #5443

Avoid using the walrus operator (`:=`) in service code. Prefer explicit variable assignment in a preceding statement.

**DO:**
```python
# From PR #5443 — explicit assignment preferred by reviewer
config = ACTION_RULE_CONFIG_MAP.get(action, None)
if config is None:
    raise Exception(...)
return config
```

**DON'T:**
```python
# Anti-pattern — walrus operator rejected in PR #5443
if config := ACTION_RULE_CONFIG_MAP.get(action, None):
    return config
```

> **Rationale:** Team preference for readability. The walrus operator can obscure control flow for developers unfamiliar with it. Reviewer chouinar: "I try to avoid `:=` except when it really really makes things cleaner because it's not a super well known feature of Python." Tech lead should clarify the acceptable threshold.

---

### Search Services

#### Rule: Pydantic BaseModel for Search/Filter Parameters

**Confidence:** High
**Observed in:** 15+ search/filter service files | PR refs: #4493, #4553, #5420

Always define search and filter parameters as Pydantic `BaseModel` classes within service files. Parse raw dict input via `model_validate()`.

**DO:**
```python
# From PR #4493 — Pydantic models for search parameters
class AgencySearchFilters(BaseModel):
    has_active_opportunity: BoolSearchFilter | None = None


class AgencySearchParams(BaseModel):
    pagination: PaginationParams
    filters: AgencySearchFilters | None = Field(default=None)
    query: str | None = None
    query_operator: str = Field(default=SearchQueryOperator.OR)
```

```python
# From PR #4493 — parsing with model_validate
def search_agencies(
    search_client: search.SearchClient, raw_search_params: dict
) -> Tuple[Sequence[dict], PaginationInfo]:
    params = AgencySearchParams.model_validate(raw_search_params)
    ...
```

**DON'T:**
```python
# Anti-pattern — accessing raw dict keys without validation
def search_agencies(search_client, raw_params: dict):
    page = raw_params.get("page", 1)  # No validation, no type coercion
    filters = raw_params.get("filters", {})
```

> **Rationale:** Pydantic models provide validation, type coercion, and clear documentation of the parameter contract. `model_validate()` gives clean error messages for invalid input. See also cross-cutting pattern INC-3 regarding the Marshmallow/Pydantic dual stack.

---

### Validation

#### Rule: Validation Warnings (Not Blocking) for Form Data

**Confidence:** High
**Observed in:** ~10 PRs | PR refs: #4314, #5443, #4513

Always return form validation issues as warnings (list of `ValidationErrorDetail`) during save/update operations. Only block (raise errors) during submission.

**DO:**
```python
# From PR #4314 — return warnings during save, don't block
warnings: list[ValidationErrorDetail] = validate_json_schema_for_form(
    application_response, form
)
return application_form, warnings
```

```python
# From PR #5443 — block only at submission time
validate_forms(application, ApplicationAction.SUBMIT)  # raises 422 if issues
```

**DON'T:**
```python
# Anti-pattern — blocking on save with validation errors
errors = validate_form(application_response, form)
if errors:
    raise_flask_error(422, "Validation failed", validation_issues=errors)
# WRONG during save — should return warnings, not block
```

> **Rationale:** Users should be able to save partial form progress without being blocked. Validation warnings guide them toward completion. Only at submission time is completeness enforced as a hard gate. See also architectural principle AP-5 in the cross-domain synthesis.

---

### Testing

#### Rule: Use Factory `.build()` for Unit Tests, `.create()` for Integration Tests

**Confidence:** High
**Observed in:** Very high frequency | PR refs: #8614, #6651, #4314

Always use factory `.build()` when no database persistence is needed (pure unit tests). Use `.create()` only when records must exist in the database (integration tests).

**DO:**
```python
# From PR #8614 — .build() for unit tests (no DB needed)
att = ApplicationAttachmentFactory.build()
form = ApplicationFormFactory.build(application_response={"att1": uid})
app = ApplicationFactory.build()
app.application_attachments = [att]
app.application_forms = [form]
```

**DON'T:**
```python
# Anti-pattern — custom helper instead of factory (caught in PR #8614)
def make_test_application():
    return {"id": "123", "forms": []}  # WRONG — use factory .build()
```

> **Rationale:** `.build()` avoids database overhead, making unit tests faster and more isolated. It also makes clear that the test is verifying logic, not database behavior. `.create()` is for tests that exercise the full persistence layer. See also cross-cutting pattern CCP-3.

---

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Caught In |
|---|---|---|
| `selectinload("*")` | Loads every relationship, potentially half the database | PR #8620 |
| Importing `_`-prefixed functions | Couples to private implementation details | PR #8620 |
| Variable data in log message strings | Makes logs unsearchable and ungroupable | PR #8632 |
| Logging PII (emails, names) | Compliance risk; broad access to log systems | PR #5385 |
| Manual membership queries for auth | Doesn't account for full privilege hierarchy | PR #6645 |
| `db_session.flush()` + re-query in transaction | Unnecessary round-trips; identity map already tracks objects | PR #8620 |
| Modifying shared utility behavior for one endpoint | Breaks all other callers | PR #8632 |
| Exposing internal S3 URLs in API responses | Infrastructure reconnaissance risk | PR #4230 |
| Custom test helpers instead of factories | Inconsistent test data; reviewer prefers `.build()` | PR #8614 |

## Known Inconsistencies

1. **`verify_access()` vs `check_user_access()` duplication** — Both perform overlapping authorization work. Reviewer flagged in PR #8632: "why do we have `verify_access` and `check_user_access`?" Needs tech lead resolution. (See INC-7)

2. **Auth checking boundary (routes vs services)** — Some PRs check auth type in routes (PR #5434), while others push auth into services via `can_access`. The trend is toward service-level auth, but no formal decision exists.

3. **`db_session.add(token_session)` positioning** — Sometimes placed before `begin()`, sometimes inside. Needs tech lead clarification on whether it must always be inside `begin()`.

4. **Walrus operator acceptability** — Stated preference to avoid, but some team members suggest it. No formal threshold defined.

5. **Schema field rename exceptions** — General rule is to match DB model names, but no guidance on when exceptions (e.g., legacy API compatibility) are acceptable.

6. **Validation framework dual stack** — Marshmallow for route-level schema validation and Pydantic for service-level input parsing coexist without formal guidance on boundaries. (See INC-3)

## Related Documents

- [API Routes — Conventions & Rules](api-routes.md) — Route handler patterns, response formatting, HTTP verb semantics
- [API Database — Conventions & Rules](api-database.md) — Model definitions, migration patterns, query conventions
- [API Auth — Conventions & Rules](api-auth.md) — Authentication schemes, multi-auth composition, user retrieval
- [API Tests — Conventions & Rules](api-tests.md) — Factory patterns, test organization, fixture management
- [API Validation — Conventions & Rules](api-validation.md) — ValidationErrorDetail, form validation lifecycle
- [Cross-Domain Synthesis](../analysis/pass3/cross-domain-synthesis.md) — CCP-1 (logging), CCP-3 (factories), CCP-4 (raise_flask_error), CCP-5 (thin handlers), CCP-6 (boolean naming), CCP-9 (no wildcard loading)
