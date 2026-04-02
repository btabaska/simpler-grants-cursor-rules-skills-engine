# API Routes -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a
> pending indicator are awaiting team confirmation. All other patterns reflect
> high-confidence conventions observed consistently across the codebase.

## Overview

The API layer in `api/src/api/` follows a blueprint-per-domain architecture where each functional area (agencies, opportunities, users, applications, competitions, organizations, etc.) lives in its own directory with a consistent set of files: a blueprint definition, route handlers, and Marshmallow schemas. Route handlers are intentionally kept thin -- they exist to define the HTTP contract (method, path, input/output schemas, auth requirements) and delegate all business logic to the service layer under `src/services/`.

Every route handler follows a rigid decorator stack order, wraps database operations in explicit transaction blocks, and returns a standardized `ApiResponse` wrapper. Authentication defaults to multi-auth (JWT + API key) for all new user-facing endpoints, and structured logging with flat field names is enforced throughout. Error handling is centralized through `raise_flask_error()`, with a strict discipline around log levels to prevent alert fatigue in New Relic.

For the big-picture view of how routes fit into the overall API architecture (routes -> services -> models -> migrations), see `documentation/architecture-guide.md`.

## Rules

### Route Definition

#### Rule: Blueprint-per-Domain File Structure

**Confidence:** High
**Observed in:** 15+ of 15+ PRs analyzed | PR refs: #4493, #9114

ALWAYS organize each API domain under `api/src/api/<domain>/` containing: (1) `<domain>_blueprint.py` for the Flask/APIFlask blueprint definition, (2) `<domain>_routes.py` or `<domain>_route.py` for route handlers, (3) `<domain>_schemas.py` or `<domain>_schema.py` for Marshmallow schemas.

**DO:**
```
# From PR #4493 -- agency search domain structure
api/src/api/agencies_v1/agency_blueprint.py
api/src/api/agencies_v1/agency_routes.py
api/src/api/agencies_v1/agency_schema.py

# From PR #9114 -- user notifications domain structure
api/src/api/users/user_blueprint.py
api/src/api/users/user_routes.py
api/src/api/users/user_schemas.py
```

**DON'T:**
```
# Anti-pattern -- mixing schemas into route files
api/src/api/users/user_routes.py  # contains both route handlers AND schema classes
```

> **Rationale:** Consistent directory structure makes it easy to locate code for any domain. Separating schemas from routes keeps both files focused and readable.

**Known inconsistency:** File naming varies between singular (`agency_schema.py`, `competition_route.py`) and plural (`user_routes.py`, `user_schemas.py`). This has not been actively corrected. See Known Inconsistencies section below.

---

### Decorator Stack

#### Rule: Route Handler Decorator Stack Order

**Confidence:** High
**Observed in:** 15+ of 15+ PRs analyzed | PR refs: #9114, #9155, #4936, #5015

ALWAYS apply decorators to route handlers in this exact top-to-bottom order: (1) `@blueprint.METHOD("/path")`, (2) `@blueprint.input(...)` if applicable, (3) `@blueprint.output(...)`, (4) `@blueprint.doc(...)`, (5) auth decorator (`@multi_auth.login_required` or `@blueprint.auth_required(...)`), (6) `@flask_db.with_db_session()`.

**DO:**
```python
# From PR #9155 -- POST endpoint with input schema
@user_blueprint.post("/<uuid:user_id>/saved-opportunities/notifications")
@user_blueprint.input(SetUserSavedOpportunityNotificationRequestSchema)
@user_blueprint.output(SetUserSavedOpportunityNotificationResponseSchema)
@user_blueprint.doc(
    responses=[200, 401, 403, 404, 422], security=jwt_or_api_user_key_security_schemes
)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def user_saved_opportunities_notifications(
    db_session: db.Session, user_id: UUID, json_data: dict
) -> response.ApiResponse:
```

**DON'T:**
```python
# Anti-pattern -- auth decorator above doc, db_session not innermost
@user_blueprint.post("/<uuid:user_id>/saved-opportunities/notifications")
@jwt_or_api_user_key_multi_auth.login_required  # WRONG position
@user_blueprint.output(SetUserSavedOpportunityNotificationResponseSchema)
@user_blueprint.doc(responses=[200, 401, 403])
@flask_db.with_db_session()
def handler(db_session: db.Session, user_id: UUID) -> response.ApiResponse:
```

> **Rationale:** APIFlask/Flask processes decorators bottom-up. `with_db_session()` must be innermost to inject `db_session` into the handler. Auth must come before DB session so unauthenticated requests are rejected before opening a database connection. The `doc`/`output`/`input` decorators configure OpenAPI metadata and must wrap the authenticated handler.

---

#### Rule: Thin Route Handlers with Service Layer Delegation

**Confidence:** High
**Observed in:** 15+ of 15+ PRs analyzed | PR refs: #9114, #4513, #5611, #4989

ALWAYS keep route handlers thin. Business logic, validation logic, and database query construction MUST live in service functions under `src/services/<domain>/`. Route handlers should contain only: (1) structured logging setup, (2) auth/identity verification, (3) a `db_session.begin()` block calling the service, (4) returning `response.ApiResponse`.

**DO:**
```python
# From PR #9114 -- correct thin route
def user_get_saved_opportunity_notifications(
    db_session: db.Session, user_id: UUID
) -> response.ApiResponse:
    logger.info("GET /v1/users/:user_id/saved-opportunities/notifications")
    user = jwt_or_api_user_key_multi_auth.get_user()

    if user.user_id != user_id:
        raise_flask_error(403, "Forbidden")

    with db_session.begin():
        db_session.add(user)
        result = get_saved_opportunity_notification_preferences(db_session, user)

    logger.info("Successfully fetched saved opportunity notification preferences")
    return response.ApiResponse(message="Success", data=result)
```

**DON'T:**
```python
# Anti-pattern -- business logic in route (from PR #4989 before review)
def handler(db_session: db.Session, user_id: UUID, json_data: dict):
    saved_opportunity = UserSavedOpportunity(
        user_id=user_id, opportunity_id=json_data["opportunity_id"]
    )
    with db_session.begin():
        db_session.add(saved_opportunity)  # Model construction belongs in service
    return response.ApiResponse(message="Success")
```

> **Rationale:** Thin routes improve testability (services can be tested independently), reusability (services can be called from background tasks), and readability (route files show the HTTP contract, not implementation details). See `api-services.md` for the full service layer conventions.

---

### Authentication

#### Rule: JWT + User API Key Multi-Auth Default

**Confidence:** High
**Observed in:** 5+ of 15+ PRs analyzed | PR refs: #9114, #9155, #5015

ALWAYS use `jwt_or_api_user_key_multi_auth` for authentication on new user-facing endpoints unless there is a documented reason not to. Use `@blueprint.doc(security=jwt_or_api_user_key_security_schemes)` paired with `@jwt_or_api_user_key_multi_auth.login_required`. NEVER combine `@blueprint.auth_required(...)` with `@multi_auth.login_required` on the same handler.

**DO:**
```python
# From PR #9114 -- correct multi-auth import and usage
from src.auth.multi_auth import jwt_or_api_user_key_multi_auth, jwt_or_api_user_key_security_schemes

@user_blueprint.get("/<uuid:user_id>/saved-opportunities/notifications")
@user_blueprint.output(UserSavedOpportunityNotificationsResponseSchema)
@user_blueprint.doc(responses=[200, 401, 403], security=jwt_or_api_user_key_security_schemes)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def user_get_saved_opportunity_notifications(
    db_session: db.Session, user_id: UUID
) -> response.ApiResponse:
```

**DON'T:**
```python
# Anti-pattern -- using both auth_required and login_required
@user_blueprint.auth_required(api_key_auth)  # WRONG -- conflicts with multi-auth
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def handler(db_session: db.Session) -> response.ApiResponse:
```

> **Rationale:** Supporting both JWT and API key auth reduces friction for testing in staging environments. API keys are simpler to obtain and use than JWT tokens for manual testing and demos. Reviewer chouinar (PR #9155): "If there isn't a reason to not have a particular auth, can we default to having JWT + user api key auth on all our endpoints from now on?" For the complete auth architecture, see `api-auth.md`.

**Known inconsistency:** The multi-auth object names evolved over time (`jwt_or_key_multi_auth` vs. `jwt_or_api_user_key_multi_auth`). Confirm which is the current canonical name. See `api-auth.md` for details.

---

#### Rule: Authenticated User Retrieval via Multi-Auth

**Confidence:** High
**Observed in:** 4+ of 15+ PRs analyzed | PR refs: #9155, #5015, #9114, #5611

ALWAYS call `.get_user()` on the multi-auth object that matches the auth decorator on the endpoint. For multi-auth endpoints, use `jwt_or_api_user_key_multi_auth.get_user()`. NEVER use `api_jwt_auth.current_user` or `api_jwt_auth.get_user_token_session()` on an endpoint decorated with `@multi_auth.login_required` -- it only works for JWT, not API key auth.

**DO:**
```python
# From PR #9114 -- correct user retrieval for multi-auth
user = jwt_or_api_user_key_multi_auth.get_user()
```

**DON'T:**
```python
# Anti-pattern -- using JWT-only retrieval on multi-auth endpoint (from PR #9155 review)
# This only works for JWT auth, silently fails for API key auth
token_session = api_jwt_auth.get_user_token_session()
user = token_session.user
```

> **Rationale:** Using the wrong auth object to retrieve the user will silently fail when a request arrives via API key auth instead of JWT, causing runtime errors that are difficult to diagnose. Reviewer mikehgrantsgov (PR #9155): "As it's implemented this only works for JWT."

---

#### Rule: User Identity Verification for User-Scoped Endpoints

**Confidence:** High
**Observed in:** 5+ of 15+ PRs analyzed | PR refs: #9114, #9155, #4989

ALWAYS verify the authenticated user matches the URL `user_id` parameter on user-scoped endpoints. Use `raise_flask_error(403, "Forbidden")` when they do not match.

**DO:**
```python
# From PR #9114 -- current pattern
user = jwt_or_api_user_key_multi_auth.get_user()
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")
```

**DON'T:**
```python
# Anti-pattern -- using 401 instead of 403 (from PR #4989, older pattern)
user_token_session = api_jwt_auth.get_user_token_session()
if user_token_session.user_id != user_id:
    raise_flask_error(401, "Unauthorized user")  # WRONG -- user IS authenticated, just not authorized
```

> **Rationale:** Prevents users from accessing or modifying other users' data. The shift from 401 to 403 reflects that the user IS authenticated (not a 401 case) but is not authorized for the specific resource.

---

### Transaction Management

#### Rule: db_session.begin() Transaction Block

**Confidence:** High
**Observed in:** 15+ of 15+ PRs analyzed | PR refs: #9155, #4936, #7034

ALWAYS wrap database operations inside `with db_session.begin():` in route handlers. Call service functions inside this block. The `response.ApiResponse` return MUST be outside the `with` block. When using multi-auth, ALWAYS call `db_session.add(user)` inside the transaction block after retrieving the user from the auth system.

**DO:**
```python
# From PR #9155 -- standard pattern with multi-auth
user = jwt_or_api_user_key_multi_auth.get_user()

if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")

with db_session.begin():
    db_session.add(user)
    set_saved_opportunity_notification_settings(db_session, user, json_data)

return response.ApiResponse(message="Success")
```

**DON'T:**
```python
# Anti-pattern -- return inside transaction block, missing db_session.add(user)
user = jwt_or_api_user_key_multi_auth.get_user()
with db_session.begin():
    result = some_service(db_session, user)  # May cause DetachedInstanceError
    return response.ApiResponse(message="Success", data=result)  # WRONG -- return outside begin block
```

> **Rationale:** The `with db_session.begin()` block ensures the transaction is committed on success and rolled back on exception. The user object from auth was loaded in a different session context, so `db_session.add(user)` re-attaches it to the current session. For the complete database transaction conventions, see `api-database.md`.

---

### Response Handling

#### Rule: Standard ApiResponse Return

**Confidence:** High
**Observed in:** 15+ of 15+ PRs analyzed | PR refs: #4936, #4493, #4513

ALWAYS return `response.ApiResponse(message="Success", data=..., pagination_info=..., warnings=...)` from route handlers. The `data` field SHOULD be a DB model object or dataclass that Marshmallow serializes automatically. NEVER manually build response dicts in route handlers when the schema can dump the model directly.

**DO:**
```python
# From PR #4493 -- response with data and pagination
return response.ApiResponse(
    message="Success",
    data=agencies,
    pagination_info=pagination_info,
)

# From PR #4513 -- response with warnings
return response.ApiResponse(
    message="Success",
    data=application_form,
    warnings=warnings,
)
```

**DON'T:**
```python
# Anti-pattern -- manually building response dict
return response.ApiResponse(
    message="Success",
    data={"agency_id": str(agency.agency_id), "name": agency.agency_name},  # Let Marshmallow do this
)
```

> **Rationale:** Using a consistent response wrapper ensures all API responses have the same structure (`message`, `data`, `status_code`, optionally `pagination_info` and `warnings`). Passing model objects directly to `data` leverages Marshmallow for serialization, reducing boilerplate and ensuring schema consistency.

---

### Error Handling

#### Rule: Error Responses via raise_flask_error

**Confidence:** High
**Observed in:** 10+ of 15+ PRs analyzed | PR refs: #4936, #9114, #9256

ALWAYS use `raise_flask_error(status_code, message, validation_issues=[...])` for error responses. For validation errors, include `ValidationErrorDetail` objects. ALWAYS log 4xx errors at `logger.info()` level, NEVER at `logger.warning()`. Warning-level logs trigger New Relic alerts and should be reserved for operational concerns, not client errors.

For the complete error handling treatment, see `api-error-handling.md`.

**DO:**
```python
# From PR #4936 -- correct error handling with info-level logging
logger.info(
    "Application cannot be submitted, not currently in progress",
    extra={"application_status": application.application_status},
)
raise_flask_error(
    403,
    message,
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.NOT_IN_PROGRESS,
            message="Application cannot be submitted, not currently in progress",
        )
    ],
)
```

**DON'T:**
```python
# Anti-pattern -- warning-level logging for client errors
logger.warning("Application not found")  # WRONG -- triggers New Relic alerts
raise_flask_error(404, "Application not found")
```

> **Rationale:** Centralized error handling ensures consistent error response structure. Using info-level logging for client errors prevents alert fatigue from expected 4xx responses. Reviewer chouinar (PR #4936): "Warning logs will alert us, we don't want to be alerted for 4xx errors."

---

### Logging

#### Rule: Request-Scoped Structured Logging with Flat Field Names

**Confidence:** High
**Observed in:** 15+ of 15+ PRs analyzed | PR refs: #4965, #4936, #9155

ALWAYS call `add_extra_data_to_current_request_logs({"entity_id": value})` at the start of route handlers with flat field names (e.g., `application_id`, `user_id`). NEVER use nested field names (e.g., `application.application_id`). NEVER call `str()` on UUIDs in log extra data. NEVER put variable data in log message strings -- use the `extra={}` parameter instead.

**DO:**
```python
# From PR #4965 -- correct flat field names
add_extra_data_to_current_request_logs({"application_id": application_id, "form_id": form_id})

# From PR #9155 -- correct service-layer logging
logger.info(
    "Modified saved opportunity notification setting",
    extra={
        "organization_id": org_id,
        "email_enabled": requested_setting.email_enabled,
    },
)
```

**DON'T:**
```python
# Anti-pattern -- nested names and str() on UUIDs (from PR #4965 before fix)
add_extra_data_to_current_request_logs(
    {"application.application_id": application_id, "form.form_id": form_id}
)

# Anti-pattern -- variable data in log message (from PR #4936 review)
logger.info(f"Processing application {application_id}")  # WRONG
```

> **Rationale:** Flat, consistent field names enable cross-system log querying in New Relic (e.g., finding all activity for a given `opportunity_id` across API routes, background tasks, etc.). Variable text in messages defeats log aggregation and prevents count charts. Reviewer chouinar (PR #4936): "To make it easier to look things up, we should try to avoid putting any variable text in the message."

---

### Schema Conventions

#### Rule: Marshmallow Schema Conventions

**Confidence:** High
**Observed in:** 10+ of 15+ PRs analyzed | PR refs: #9155, #4589, #4553

ALWAYS define schemas in a separate `*_schemas.py` or `*_schema.py` file, never inline in route files. Response schemas MUST extend `AbstractResponseSchema`. ALWAYS mark mandatory fields as `required=True` explicitly (the default is `required=False`). For required but nullable fields, use `required=True, allow_none=True`. Schema names passed to `generate_pagination_schema()` and schema builders MUST be globally unique. NEVER use string representations of booleans (e.g., `"False"`) as example values in metadata.

**DO:**
```python
# From PR #9155 -- required and nullable fields
class SetUserSavedOpportunityNotificationRequestSchema(Schema):
    organization_id = fields.UUID(
        required=True,
        allow_none=True,
        metadata={
            "description": "The ID of the organization for which to set notification."
        },
    )
    email_enabled = fields.Boolean(
        required=True, metadata={"description": "Whether email notifications are enabled"}
    )
```

**DON'T:**
```python
# Anti-pattern -- missing required=True causes silent 500 errors downstream
class BadSchema(Schema):
    email_enabled = fields.Boolean()  # Defaults to required=False; missing field won't error

# Anti-pattern -- string boolean in metadata (from PR #4589 review)
    is_test = fields.Boolean(metadata={"example": "False"})  # WRONG -- use False not "False"
```

> **Rationale:** Not marking fields as required causes Marshmallow to silently accept requests missing those fields, which then causes 500 errors downstream when the service layer expects them. Reviewer chouinar (PR #9155): "Default is `required=False` so if you did this, it would cause the endpoint to 500 I think."

---

#### Rule: Cross-Field Schema Validation with @validates_schema

**Confidence:** High
**Observed in:** 3+ of 15+ PRs analyzed | PR refs: #9256

ALWAYS use `@validates_schema` for validation rules that depend on multiple fields. Raise `ValidationError` with `MarshmallowErrorContainer` instances for structured error responses.

**DO:**
```python
# From PR #9256 -- category explanation required when category is "other"
@validates_schema
def validate_category_explanation(self, data: dict, **kwargs: dict) -> None:
    """Validate that category_explanation is required when category is Other"""
    if data.get("category") == OpportunityCategory.OTHER:
        explanation = data.get("category_explanation", "")
        if explanation.strip() == "":
            raise ValidationError(
                [
                    MarshmallowErrorContainer(
                        ValidationErrorType.REQUIRED,
                        "Explanation of the category is required when category is 'other'.",
                    )
                ]
            )
```

**DON'T:**
```python
# Anti-pattern -- cross-field validation in individual field validators
# Individual validators only see one field and cannot access sibling fields
```

> **Rationale:** Cross-field validations cannot be expressed as single-field validators. The `@validates_schema` decorator runs after all individual field validations, ensuring all fields are available for comparison.

---

#### Rule: Boolean Field Naming as Questions

**Confidence:** High
**Observed in:** 5+ of 15+ PRs analyzed | PR refs: #4493, #4589, #5611

ALWAYS name boolean fields using question-like prefixes: `is_`, `has_`, `can_`, `was_`. Examples: `has_active_opportunity`, `is_test_agency`, `is_deleted`, `is_included_in_submission`.

**DO:**
```python
# From PR #4493
has_active_opportunity = fields.Boolean(...)

# From PR #4589
is_test_agency = fields.Boolean(...)
```

**DON'T:**
```python
# Anti-pattern -- boolean without question-form prefix
active = fields.Boolean(...)  # Should be has_active_opportunity or is_active
```

> **Rationale:** Boolean fields named as questions are self-documenting and read naturally in conditional expressions (e.g., `if agency.has_active_opportunity`). Enforced by reviewer chouinar in PR #4493.

---

### Search & Pagination

#### Rule: Search Filter Schema Builder Pattern

**Confidence:** High
**Observed in:** 5+ of 15+ PRs analyzed | PR refs: #4493, #4589, #7323

ALWAYS use `StrSearchSchemaBuilder`, `BoolSearchSchemaBuilder`, or `IntegerSearchSchemaBuilder` from `src.api.schemas.search_schema` when building filter schemas for search endpoints. Follow the established pattern from opportunity search.

**DO:**
```python
# From PR #4493 -- agency search filter with boolean builder
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Nested(
        BoolSearchSchemaBuilder("HasActiveOpportunityFilterV1Schema")
        .with_one_of(example=True)
        .build()
    )

# From PR #7323 -- string enum filter for audit events
class ApplicationAuditFilterSchema(Schema):
    application_audit_event = fields.Nested(
        StrSearchSchemaBuilder("ApplicationAuditEventFieldFilterSchema")
        .with_one_of(
            allowed_values=ApplicationAuditEvent, example=ApplicationAuditEvent.APPLICATION_CREATED
        )
        .build()
    )
```

**DON'T:**
```python
# Anti-pattern -- building custom filter schemas instead of using builders
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Boolean()  # WRONG -- should use BoolSearchSchemaBuilder
```

> **Rationale:** Builder classes produce consistent filter structures across all search endpoints, ensuring uniform API behavior and OpenAPI documentation. The builder names must be globally unique (same as pagination schemas).

---

#### Rule: Pagination via generate_pagination_schema

**Confidence:** High
**Observed in:** 5+ of 15+ PRs analyzed | PR refs: #4493, #7326, #7323

ALWAYS use `generate_pagination_schema()` from `src.pagination.pagination_schema` for list/search endpoints. The schema name (first argument) MUST be globally unique. Response schemas for paginated endpoints MUST mix in `PaginationMixinSchema`.

**DO:**
```python
# From PR #4493 -- pagination schema generation
pagination = fields.Nested(
    generate_pagination_schema(
        "AgencySearchPaginationV1Schema",
        ["agency_code", "agency_name"],
        default_sort_order=[{"order_by": "agency_code", "sort_direction": "ascending"}],
    ),
    required=True,
)

# From PR #7326 -- response schema with pagination mixin
class OrganizationUsersResponseSchema(AbstractResponseSchema, PaginationMixinSchema):
    data = fields.List(
        fields.Nested(OrganizationUserSchema),
        metadata={"description": "List of organization members"},
    )
```

**DON'T:**
```python
# Anti-pattern -- non-unique schema name causes OpenAPI collision (from PR #4553)
generate_pagination_schema("AgencyPaginationV1Schema", ...)  # Collides with another schema
```

> **Rationale:** Centralized pagination schema generation ensures consistent pagination behavior (sort fields, page size limits, default sort orders) across all endpoints.

---

### Data Management

#### Rule: Pydantic BaseModel for Service Inputs

**Confidence:** High
**Observed in:** 10+ of 15+ PRs analyzed | PR refs: #9256, #9155, #4493, #7326, #7323

ALWAYS define a Pydantic `BaseModel` in service functions to validate and type input data received from route handlers. Use `model_validate()` to parse the incoming dict.

**DO:**
```python
# From PR #9256 -- Pydantic model for opportunity creation
class OpportunityCreateRequest(BaseModel):
    opportunity_title: str
    category: OpportunityCategory
    category_explanation: str | None = None
    assistance_listing_number: str

def create_opportunity(db_session: db.Session, user: User, opportunity_data: dict) -> Opportunity:
    request = OpportunityCreateRequest.model_validate(opportunity_data)
```

**DON'T:**
```python
# Anti-pattern -- accessing dict keys directly without validation
def create_opportunity(db_session: db.Session, user: User, opportunity_data: dict) -> Opportunity:
    title = opportunity_data["opportunity_title"]  # No type validation, no clear contract
```

> **Rationale:** Pydantic models provide type-safe input parsing with clear validation errors, serving as both documentation and runtime validation for service function contracts. See `api-services.md` for the full service layer input validation conventions.

---

#### Rule: Soft Delete for User-Facing Deletions

**Confidence:** High
**Observed in:** 3+ of 15+ PRs analyzed | PR refs: #4989

ALWAYS implement user-facing deletions as soft deletes by setting `is_deleted = True`. NEVER use `db_session.delete()` for user-facing operations. Queries MUST filter with `.where(Model.is_deleted.isnot(True))` to exclude soft-deleted records. Prefer the "fetch then update" pattern over `UPDATE ... WHERE` queries for deletes.

**DO:**
```python
# From PR #4989 -- soft delete with fetch-then-update
saved_opp = db_session.execute(
    select(UserSavedOpportunity).where(
        UserSavedOpportunity.user_id == user_id,
        UserSavedOpportunity.opportunity_id == opportunity_id,
    )
).scalar_one_or_none()

if not saved_opp:
    raise_flask_error(404, "Saved opportunity not found")

saved_opp.is_deleted = True
```

**DON'T:**
```python
# Anti-pattern -- physical delete (from PR #4989 before review)
result = db_session.execute(
    delete(UserSavedOpportunity).where(
        UserSavedOpportunity.user_id == user_id,
        UserSavedOpportunity.opportunity_id == opportunity_id,
    )
)
if result.rowcount == 0:
    raise_flask_error(404, "Saved opportunity not found")
```

> **Rationale:** Soft deletes preserve data for audit trails and allow "un-delete" workflows (e.g., re-saving a previously deleted saved opportunity). The fetch-then-update pattern validates exactly 0 or 1 records were affected, preventing accidental bulk operations.

---

#### Rule: Audit Event Recording for Write Operations

**Confidence:** High
**Observed in:** 3+ of 15+ PRs analyzed | PR refs: #7034

ALWAYS add an audit event via `add_audit_event()` from `src.services.applications.application_audit` for all non-GET application endpoints. Call this in the service layer, not the route, except for error cases that require a separate transaction (like failed submissions).

**DO:**
```python
# From PR #7034 -- audit event in service layer
add_audit_event(
    db_session=db_session,
    application=application,
    user=user,
    audit_event=ApplicationAuditEvent.ORGANIZATION_ADDED,
)

# From PR #7034 -- special error-case handling in route (separate transaction)
def _handle_submit_error(
    db_session: db.Session, error: HTTPError, application_id: UUID, user_id: UUID
) -> Never:
    if error.status_code != 422:
        raise error
    try:
        if db_session.is_active:
            db_session.rollback()
        with db_session.begin():
            add_audit_event_by_id(
                db_session,
                application_id=application_id,
                user_id=user_id,
                audit_event=ApplicationAuditEvent.APPLICATION_SUBMIT_REJECTED,
            )
    except Exception:
        logger.exception("Failed to add audit event for failed submission")
    raise error
```

**DON'T:**
```python
# Anti-pattern -- audit event in route handler (should be in service layer)
def application_submit(db_session, application_id):
    with db_session.begin():
        submit_application(db_session, application_id)
        add_audit_event(...)  # This belongs inside the service function
```

> **Rationale:** Audit events create a complete activity history for applications, enabling users to review what actions were taken and by whom. Failed submission audits require a separate transaction because the main transaction was rolled back.

---

### Testing

#### Rule: Test File Per Feature with Factory Data

**Confidence:** High
**Observed in:** 10+ of 15+ PRs analyzed | PR refs: #4989

ALWAYS create test files in `api/tests/src/api/<domain>/` with one file per feature or route group. ALWAYS use factories from `tests/src/db/models/factories.py` to create test data. NEVER rely on deleting all existing data and then counting results -- instead query for specific records by their IDs.

**DO:**
```python
# From PR #4989 -- robust test querying specific record
result = (
    db_session.query(UserSavedOpportunity)
    .filter(
        UserSavedOpportunity.user_id == saved_opp.user_id,
        UserSavedOpportunity.opportunity_id == saved_opp.opportunity_id,
    )
    .first()
)
assert result is not None
assert result.is_deleted
```

**DON'T:**
```python
# Anti-pattern -- fragile test counting all records (from PR #4989 before review)
saved_count = db_session.query(UserSavedOpportunity).count()
assert saved_count == 0

# Anti-pattern -- autouse fixture that deletes all data
@pytest.fixture(autouse=True, scope="function")
def clear_saved_opportunities(db_session):
    db_session.query(UserSavedOpportunity).delete()
    db_session.commit()
    yield
```

> **Rationale:** Tests that delete all data and count results are fragile when tests run in parallel or when other tests create data in the same tables. Querying by specific IDs makes tests independent and reliable.

---

## Anti-Patterns

### AP-1: Combining auth_required and login_required on the same endpoint
NEVER have both `@blueprint.auth_required()` and `@multi_auth.login_required` on the same endpoint. Only the latter should be used with multi-auth. (PR #5015)

### AP-2: Using JWT-only auth retrieval on multi-auth endpoints
NEVER use `api_jwt_auth.current_user` or `api_jwt_auth.get_user_token_session()` on an endpoint decorated with `@multi_auth.login_required`. This silently fails for API key auth. (PR #9155)

### AP-3: Nested or dotted log field names
NEVER use dotted keys like `"application.application_id"` in log extra data. ALWAYS use flat snake_case keys like `"application_id"`. (PR #4965)

### AP-4: Warning-level logging for client errors
NEVER use `logger.warning()` for 4xx errors. These trigger New Relic alerts. Use `logger.info()` instead. (PR #4936)

### AP-5: String booleans in schema metadata
NEVER use `"False"` or `"True"` as example values in Marshmallow schema metadata. Use Python booleans `False` and `True`. (PR #4589)

## Known Inconsistencies

1. **File naming singular vs. plural:** `agency_schema.py` (singular) vs. `user_schemas.py` (plural); `competition_route.py` vs. `user_routes.py`. No enforcement mechanism exists. Tech lead should standardize.

2. **Multi-auth object naming evolution:** `jwt_or_key_multi_auth` vs. `jwt_or_api_user_key_multi_auth`. Older endpoints have not been migrated. Needs tech lead resolution.

3. **401 vs. 403 for user identity mismatch:** Older endpoints use `raise_flask_error(401, "Unauthorized user")` while newer endpoints correctly use `raise_flask_error(403, "Forbidden")`. Older endpoints should be migrated.

## Related Documents

- **Architecture Guide:** `documentation/architecture-guide.md`
- **Cursor Rules:** `.cursor/rules/api-routes.md`
- **Related Domains:** `api-services.md`, `api-database.md`, `api-auth.md`, `api-error-handling.md`
