# Pass 2: Pattern Codification -- API Routes

**Domain:** API route definitions, request/response handling, endpoint configuration (`api/src/api/`)
**Source:** 153 merged PRs from HHS/simpler-grants-gov (April 2025 -- March 2026)
**Pass 1 Reference:** `analysis/pass1/api-routes.md`
**Analysis date:** 2026-03-30

---

## Rule 1: Decorator Stack Order

**Pattern Name:** Route Handler Decorator Stack Order

**Rule Statement:** ALWAYS apply decorators to route handlers in this exact top-to-bottom order: (1) `@blueprint.METHOD("/path")`, (2) `@blueprint.input(...)` if applicable, (3) `@blueprint.output(...)`, (4) `@blueprint.doc(...)`, (5) auth decorator (`@multi_auth.login_required` or `@blueprint.auth_required(...)`), (6) `@flask_db.with_db_session()`.

**Confidence:** High

**Frequency:** Found in 100% of route handlers across all examined PRs (15+ PRs).

**Code Examples:**

From PR #9114 (GET saved opportunity notifications):
```python
@user_blueprint.get("/<uuid:user_id>/saved-opportunities/notifications")
@user_blueprint.output(UserSavedOpportunityNotificationsResponseSchema)
@user_blueprint.doc(responses=[200, 401, 403], security=jwt_or_api_user_key_security_schemes)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def user_get_saved_opportunity_notifications(
    db_session: db.Session, user_id: UUID
) -> response.ApiResponse:
```

From PR #9155 (POST saved opportunity notifications):
```python
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

From PR #4936 (submit application):
```python
@application_blueprint.post("/applications/<uuid:application_id>/submit")
@application_blueprint.output(AbstractResponseSchema)
@application_blueprint.doc(responses=[200, 401, 404])
@application_blueprint.auth_required(api_key_auth)
@flask_db.with_db_session()
def application_submit(db_session: db.Session, application_id: UUID) -> response.ApiResponse:
```

**Rationale:** APIFlask/Flask processes decorators bottom-up. The `with_db_session()` must be innermost to inject `db_session` into the handler. Auth must come before DB session so unauthenticated requests are rejected before opening a database connection. The `doc`/`output`/`input` decorators configure OpenAPI metadata and must wrap the authenticated handler.

**Open Questions:** None. This pattern is completely consistent.

---

## Rule 2: Multi-Auth Default for New Endpoints

**Pattern Name:** JWT + User API Key Multi-Auth Default

**Rule Statement:** ALWAYS use `jwt_or_api_user_key_multi_auth` for authentication on new user-facing endpoints unless there is a documented reason not to. Use `@blueprint.doc(security=jwt_or_api_user_key_security_schemes)` paired with `@jwt_or_api_user_key_multi_auth.login_required`. NEVER combine `@blueprint.auth_required(...)` with `@multi_auth.login_required` on the same handler.

**Confidence:** High

**Frequency:** Enforced in 3+ explicit reviewer comments (PRs #9114, #9155, #5015). Applied in all new user-scoped endpoints from January 2026 onward.

**Code Examples:**

From PR #9114 -- reviewer chouinar's comment:
> "I'd suggest for any new endpoints, we make them support JWT + User API Key auth unless we have a strong reason not to. One major benefit of API key auth - getting an API key is a lot easier than figuring out a JWT in staging if you want to call it directly for testing/demos."

From PR #9155 -- reviewer chouinar's comment:
> "If there isn't a reason to not have a particular auth, can we default to having JWT + user api key auth on all our endpoints from now on?"

Correct import pattern (from PR #9114):
```python
from src.auth.multi_auth import jwt_or_api_user_key_multi_auth, jwt_or_api_user_key_security_schemes
```

From PR #5015 -- the competition endpoint correctly using multi-auth:
```python
@competition_blueprint.get("/competitions/<uuid:competition_id>")
@competition_blueprint.output(competition_schema.CompetitionResponseAlphaSchema())
@competition_blueprint.doc(security=jwt_or_key_security_schemes)
@jwt_or_key_multi_auth.login_required
@flask_db.with_db_session()
def competition_get(db_session: db.Session, competition_id: uuid.UUID) -> response.ApiResponse:
```

**Rationale:** Supporting both JWT and API key auth reduces friction for testing in staging environments. API keys are simpler to obtain and use than JWT tokens for manual testing and demos.

**Open Questions:** The multi-auth object names evolved over time (`jwt_or_key_multi_auth` vs. `jwt_or_api_user_key_multi_auth`). Confirm which is the current canonical name and whether older endpoints should be migrated.

---

## Rule 3: Get Authenticated User from Multi-Auth Object

**Pattern Name:** Authenticated User Retrieval via Multi-Auth

**Rule Statement:** ALWAYS call `.get_user()` on the multi-auth object that matches the auth decorator on the endpoint. For multi-auth endpoints, use `jwt_or_api_user_key_multi_auth.get_user()`. NEVER use `api_jwt_auth.current_user` or `api_jwt_auth.get_user_token_session()` on an endpoint decorated with `@multi_auth.login_required` -- it only works for JWT, not API key auth.

**Confidence:** High

**Frequency:** Enforced in 2 explicit reviewer comments (PRs #9155, #5015). Bug source when violated.

**Code Examples:**

From PR #9155 -- reviewer mikehgrantsgov's correction:
> "I think this needs to be: `user = jwt_or_api_user_key_multi_auth.get_user()` The GET and POST endpoints are both decorated with @jwt_or_api_user_key_multi_auth.login_required and use jwt_or_api_user_key_security_schemes, meaning both should support JWT and API key auth. But as it's implemented this only works for JWT."

Correct pattern (from PR #9114):
```python
user = jwt_or_api_user_key_multi_auth.get_user()
```

JWT-only endpoint pattern (from PR #5611):
```python
token_session = api_jwt_auth.get_user_token_session()
user = token_session.user
```

**Rationale:** Using the wrong auth object to retrieve the user will silently fail when a request arrives via API key auth instead of JWT, causing runtime errors that are difficult to diagnose.

**Open Questions:** None.

---

## Rule 4: Thin Route Handlers with Service Layer Delegation

**Pattern Name:** Thin Routes / Service Layer Separation

**Rule Statement:** ALWAYS keep route handlers thin. Business logic, validation logic, and database query construction MUST live in service functions under `src/services/<domain>/`. Route handlers should contain only: (1) structured logging setup, (2) auth/identity verification, (3) a `db_session.begin()` block calling the service, (4) returning `response.ApiResponse`.

**Confidence:** High

**Frequency:** Found in 100% of examined route handlers. Enforced by reviewer chouinar in PRs #4513, #5611, #4989.

**Code Examples:**

From PR #9114 -- correct thin route:
```python
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

From PR #4989 -- business logic moved from route to service (before/after):

Before (in route):
```python
saved_opportunity = UserSavedOpportunity(
    user_id=user_id, opportunity_id=json_data["opportunity_id"]
)
with db_session.begin():
    db_session.add(saved_opportunity)
```

After (route delegates to service):
```python
with db_session.begin():
    create_saved_opportunity(db_session, user_id, json_data)
```

From PR #4513 -- reviewer chouinar:
> "Can we put the validation warnings in the `get_application_form` function like we have for the PUT endpoint?"

**Rationale:** Thin routes improve testability (services can be tested independently), reusability (services can be called from background tasks), and readability (route files show the HTTP contract, not implementation details).

**Open Questions:** None.

---

## Rule 5: Transaction Block Pattern

**Pattern Name:** db_session.begin() Transaction Block

**Rule Statement:** ALWAYS wrap database operations inside `with db_session.begin():` in route handlers. Call service functions inside this block. The `response.ApiResponse` return MUST be outside the `with` block. When using multi-auth, ALWAYS call `db_session.add(user)` inside the transaction block after retrieving the user from the auth system.

**Confidence:** High

**Frequency:** Found in 100% of route handlers that perform database operations (15+ PRs examined).

**Code Examples:**

From PR #9155 (standard pattern with multi-auth):
```python
user = jwt_or_api_user_key_multi_auth.get_user()

if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")

with db_session.begin():
    db_session.add(user)
    set_saved_opportunity_notification_settings(db_session, user, json_data)

return response.ApiResponse(message="Success")
```

From PR #4936 (standard pattern without multi-auth):
```python
with db_session.begin():
    submit_application(db_session, application_id)

return response.ApiResponse(message="Success")
```

From PR #7034 (exception handling around transaction -- special case for audit events):
```python
try:
    with db_session.begin():
        db_session.add(token_session)
        submit_application(db_session, application_id, user)
except HTTPError as e:
    _handle_submit_error(db_session, e, application_id, user.user_id)
```

**Rationale:** The `with db_session.begin()` block ensures the transaction is committed on success and rolled back on exception. The user object from auth was loaded in a different session context, so `db_session.add(user)` re-attaches it to the current session.

**Open Questions:** The `db_session.add(user)` pattern for multi-auth is emerging but may need formal documentation. Some older endpoints using `api_jwt_auth.get_user_token_session()` add `token_session` instead.

---

## Rule 6: Structured Logging with Flat Field Names

**Pattern Name:** Request-Scoped Structured Logging

**Rule Statement:** ALWAYS call `add_extra_data_to_current_request_logs({"entity_id": value})` at the start of route handlers with flat field names (e.g., `application_id`, `user_id`). NEVER use nested field names (e.g., `application.application_id`). NEVER call `str()` on UUIDs in log extra data. NEVER put variable data in log message strings -- use the `extra={}` parameter instead.

**Confidence:** High

**Frequency:** Enforced via a dedicated cleanup PR (#4965). Corrected in PR #4936 review. Found in 100% of non-trivial route handlers.

**Code Examples:**

From PR #4965 -- the cleanup PR correcting nested names to flat names:
```python
# Before (wrong):
add_extra_data_to_current_request_logs(
    {"application.application_id": application_id, "form.form_id": form_id}
)

# After (correct):
add_extra_data_to_current_request_logs({"application_id": application_id, "form_id": form_id})
```

From PR #4965 -- removing unnecessary `str()` calls on UUIDs:
```python
# Before (wrong):
extra={"user.id": str(user_id), "opportunity.id": json_data["opportunity_id"]}

# After (correct):
extra={"user_id": user_id, "opportunity_id": json_data["opportunity_id"]}
```

From PR #4936 -- reviewer chouinar's comment on variable text in messages:
> "To make it easier to look things up, we should try to avoid putting any variable text in the message as well, just make it an extra param which has the benefit of being able to easily make count charts in New Relic."

Correct logging in service layer (from PR #9155):
```python
logger.info(
    "Modified saved opportunity notification setting",
    extra={
        "organization_id": org_id,
        "email_enabled": requested_setting.email_enabled,
    },
)
```

**Rationale:** Flat, consistent field names enable cross-system log querying in New Relic (e.g., finding all activity for a given `opportunity_id` across API routes, background tasks, etc.). Variable text in messages defeats log aggregation and prevents count charts.

**Open Questions:** None.

---

## Rule 7: ApiResponse Return Type

**Pattern Name:** Standard ApiResponse Return

**Rule Statement:** ALWAYS return `response.ApiResponse(message="Success", data=..., pagination_info=..., warnings=...)` from route handlers. The `data` field SHOULD be a DB model object or dataclass that Marshmallow serializes automatically. NEVER manually build response dicts in route handlers when the schema can dump the model directly.

**Confidence:** High

**Frequency:** Found in 100% of route handlers (15+ PRs examined). Anti-pattern flagged in PR #5611.

**Code Examples:**

From PR #4936 (simple response):
```python
return response.ApiResponse(message="Success")
```

From PR #4493 (response with data and pagination):
```python
return response.ApiResponse(
    message="Success",
    data=agencies,
    pagination_info=pagination_info,
)
```

From PR #4513 (response with warnings):
```python
return response.ApiResponse(
    message="Success",
    data=application_form,
    warnings=warnings,
)
```

**Rationale:** Using a consistent response wrapper ensures all API responses have the same structure (`message`, `data`, `status_code`, optionally `pagination_info` and `warnings`). Passing model objects directly to `data` leverages Marshmallow for serialization, reducing boilerplate and ensuring schema consistency.

**Open Questions:** None.

---

## Rule 8: Error Handling with raise_flask_error

**Pattern Name:** Error Responses via raise_flask_error

**Rule Statement:** ALWAYS use `raise_flask_error(status_code, message, validation_issues=[...])` for error responses. For validation errors, include `ValidationErrorDetail` objects. ALWAYS log 4xx errors at `logger.info()` level, NEVER at `logger.warning()`. Warning-level logs trigger New Relic alerts and should be reserved for operational concerns, not client errors.

**Confidence:** High

**Frequency:** Enforced in PR #4936 review. Found in all error-handling code across examined PRs.

**Code Examples:**

From PR #4936 -- reviewer chouinar:
> "Warning logs will alert us, we don't want to be alerted for 4xx errors."

Correct error handling (from PR #4936 after review):
```python
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

Simple 403 (from PR #9114):
```python
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")
```

Simple 404 (from PR #9256):
```python
if record is None:
    raise_flask_error(
        404, message=f"Could not find Assistance Listing Number {assist_list_nbr}"
    )
```

**Rationale:** Centralized error handling ensures consistent error response structure. Using info-level logging for client errors prevents alert fatigue from expected 4xx responses.

**Open Questions:** None.

---

## Rule 9: User Identity Verification for User-Scoped Endpoints

**Pattern Name:** User Identity Verification

**Rule Statement:** ALWAYS verify the authenticated user matches the URL user_id parameter on user-scoped endpoints. Use `raise_flask_error(403, "Forbidden")` when they do not match.

**Confidence:** High

**Frequency:** Found in all user-scoped endpoints (PRs #9114, #9155, #4989). Pattern evolved from 401 to 403 over time.

**Code Examples:**

Current pattern (from PR #9114):
```python
user = jwt_or_api_user_key_multi_auth.get_user()
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")
```

Older pattern (from PR #4989, using JWT-only):
```python
user_token_session = api_jwt_auth.get_user_token_session()
if user_token_session.user_id != user_id:
    raise_flask_error(401, "Unauthorized user")
```

**Rationale:** Prevents users from accessing or modifying other users' data. The shift from 401 to 403 reflects that the user IS authenticated (not a 401 case) but is not authorized for the specific resource.

**Open Questions:** Should older endpoints using the 401 pattern be migrated to 403? This is a semantic correctness issue rather than a functional one.

---

## Rule 10: Schema Conventions

**Pattern Name:** Marshmallow Schema Conventions

**Rule Statement:** ALWAYS define schemas in a separate `*_schemas.py` or `*_schema.py` file, never inline in route files. Response schemas MUST extend `AbstractResponseSchema`. ALWAYS mark mandatory fields as `required=True` explicitly (the default is `required=False`). For required but nullable fields, use `required=True, allow_none=True`. Schema names passed to `generate_pagination_schema()` and schema builders MUST be globally unique. NEVER use string representations of booleans (e.g., `"False"`) as example values in metadata.

**Confidence:** High

**Frequency:** Enforced in PRs #9155, #4589, #4553. Found in all schema files (15+ PRs).

**Code Examples:**

From PR #9155 -- `required=True, allow_none=True` pattern:
```python
class SetUserSavedOpportunityNotificationRequestSchema(Schema):
    organization_id = fields.UUID(
        required=True,
        allow_none=True,
        metadata={
            "description": "The ID of the organization for which to set notification. If not provided, the setting applies to the user's own saved opportunities."
        },
    )
    email_enabled = fields.Boolean(
        required=True, metadata={"description": "Whether the email notifications is enabled"}
    )
```

From PR #9155 -- reviewer chouinar on required fields:
> "Default is `required=False` so if you did this, it would cause the endpoint to 500 I think. Make it required. Another issue - Required != nullability - I think both of these fields should be required, but organization_id should be nullable."

From PR #4589 -- reviewer chouinar on boolean examples:
> "While it works because of the JSON parsing library we have, this means the examples we end up putting in openapi has a value of `"False"` which isn't actually valid JSON. just pass in a boolean like `False` instead of `"False"`"

From PR #4553 -- renaming schemas to avoid collisions:
```python
# Before (collision):
generate_pagination_schema("AgencyPaginationV1Schema", ...)

# After (unique name):
generate_pagination_schema("AgencySearchPaginationV1Schema", ...)
```

**Rationale:** Not marking fields as required causes Marshmallow to silently accept requests missing those fields, which then causes 500 errors downstream when the service layer expects them. Globally unique schema names prevent OpenAPI spec collisions.

**Open Questions:** None.

---

## Rule 11: Search/Filter Schema Builders

**Pattern Name:** Search Filter Schema Builder Pattern

**Rule Statement:** ALWAYS use `StrSearchSchemaBuilder`, `BoolSearchSchemaBuilder`, or `IntegerSearchSchemaBuilder` from `src.api.schemas.search_schema` when building filter schemas for search endpoints. Follow the established pattern from opportunity search.

**Confidence:** High

**Frequency:** Found in all search endpoints (PRs #4493, #4589, #7323). Enforced by reviewer chouinar in PR #4493.

**Code Examples:**

From PR #4493 (agency search filter):
```python
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Nested(
        BoolSearchSchemaBuilder("HasActiveOpportunityFilterV1Schema")
        .with_one_of(example=True)
        .build()
    )
```

From PR #4589 (adding a new boolean filter):
```python
is_test_agency = fields.Nested(
    BoolSearchSchemaBuilder("IsTestAgencyFilterV1Schema").with_one_of(example=True).build()
)
```

From PR #7323 (string enum filter for audit events):
```python
class ApplicationAuditFilterSchema(Schema):
    application_audit_event = fields.Nested(
        StrSearchSchemaBuilder("ApplicationAuditEventFieldFilterSchema")
        .with_one_of(
            allowed_values=ApplicationAuditEvent, example=ApplicationAuditEvent.APPLICATION_CREATED
        )
        .build()
    )
```

**Rationale:** Builder classes produce consistent filter structures across all search endpoints, ensuring uniform API behavior and OpenAPI documentation. The builder names must be globally unique (same as pagination schemas).

**Open Questions:** None.

---

## Rule 12: Pagination Schema Pattern

**Pattern Name:** Pagination via generate_pagination_schema

**Rule Statement:** ALWAYS use `generate_pagination_schema()` from `src.pagination.pagination_schema` for list/search endpoints. The schema name (first argument) MUST be globally unique. Response schemas for paginated endpoints MUST mix in `PaginationMixinSchema`.

**Confidence:** High

**Frequency:** Found in all list/search endpoints (PRs #4493, #7326, #7323).

**Code Examples:**

From PR #4493 (agency search):
```python
pagination = fields.Nested(
    generate_pagination_schema(
        "AgencySearchPaginationV1Schema",
        ["agency_code", "agency_name"],
        default_sort_order=[{"order_by": "agency_code", "sort_direction": "ascending"}],
    ),
    required=True,
)
```

From PR #7326 (organization users list):
```python
pagination = fields.Nested(
    generate_pagination_schema(
        "OrganizationUsersPaginationSchema",
        ["email", "first_name", "last_name", "created_at"],
        default_sort_order=[{"order_by": "email", "sort_direction": "ascending"}],
    ),
    required=True,
)
```

Response schema with pagination mixin (from PR #7326):
```python
class OrganizationUsersResponseSchema(AbstractResponseSchema, PaginationMixinSchema):
    data = fields.List(
        fields.Nested(OrganizationUserSchema),
        metadata={"description": "List of organization members"},
    )
```

**Rationale:** Centralized pagination schema generation ensures consistent pagination behavior (sort fields, page size limits, default sort orders) across all endpoints.

**Open Questions:** None.

---

## Rule 13: Pydantic Models for Service Input Validation

**Pattern Name:** Pydantic BaseModel for Service Inputs

**Rule Statement:** ALWAYS define a Pydantic `BaseModel` in service functions to validate and type input data received from route handlers. Use `model_validate()` to parse the incoming dict.

**Confidence:** High

**Frequency:** Found in 80%+ of service functions across examined PRs (#9256, #9155, #4493, #7326, #7323).

**Code Examples:**

From PR #9256 (opportunity creation):
```python
class OpportunityCreateRequest(BaseModel):
    opportunity_title: str
    category: OpportunityCategory
    category_explanation: str | None = None
    assistance_listing_number: str

def create_opportunity(db_session: db.Session, user: User, opportunity_data: dict) -> Opportunity:
    request = OpportunityCreateRequest.model_validate(opportunity_data)
```

From PR #9155 (notification settings):
```python
class UpdateOpportunityNotificationSettingInput(BaseModel):
    organization_id: UUID | None = None
    email_enabled: bool

def set_saved_opportunity_notification_settings(
    db_session: db.Session, user: User, json_data: dict
) -> None:
    requested_setting = UpdateOpportunityNotificationSettingInput.model_validate(json_data)
```

From PR #7326 (organization users list):
```python
class OrganizationUsersListParams(BaseModel):
    pagination: PaginationParams

def get_organization_users_and_verify_access(...):
    params = OrganizationUsersListParams.model_validate(request_data)
```

**Rationale:** Pydantic models provide type-safe input parsing with clear validation errors, serving as both documentation and runtime validation for service function contracts.

**Open Questions:** None.

---

## Rule 14: Soft Delete Pattern

**Pattern Name:** Soft Delete for User-Facing Deletions

**Rule Statement:** ALWAYS implement user-facing deletions as soft deletes by setting `is_deleted = True`. NEVER use `db_session.delete()` for user-facing operations. Queries MUST filter with `.where(Model.is_deleted.isnot(True))` to exclude soft-deleted records. Prefer the "fetch then update" pattern over `UPDATE ... WHERE` queries for deletes.

**Confidence:** High

**Frequency:** Established in PR #4989. Applied to all user-facing delete operations since May 2025.

**Code Examples:**

From PR #4989 (soft delete implementation):
```python
# Before (physical delete):
result = db_session.execute(
    delete(UserSavedOpportunity).where(
        UserSavedOpportunity.user_id == user_id,
        UserSavedOpportunity.opportunity_id == opportunity_id,
    )
)
if result.rowcount == 0:
    raise_flask_error(404, "Saved opportunity not found")

# After (soft delete with fetch-then-update):
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

Query filtering for soft deletes (from PR #4989):
```python
UserSavedOpportunity.is_deleted.isnot(True)
```

**Rationale:** Soft deletes preserve data for audit trails and allow "un-delete" workflows (e.g., re-saving a previously deleted saved opportunity). The fetch-then-update pattern validates exactly 0 or 1 records were affected, preventing accidental bulk operations.

**Open Questions:** None.

---

## Rule 15: Cross-Field Validation with @validates_schema

**Pattern Name:** Cross-Field Schema Validation

**Rule Statement:** ALWAYS use `@validates_schema` for validation rules that depend on multiple fields. Raise `ValidationError` with `MarshmallowErrorContainer` instances for structured error responses.

**Confidence:** High

**Frequency:** Found in PRs with cross-field validation needs (#9256). Pattern is well-established.

**Code Examples:**

From PR #9256 (category explanation required when category is "other"):
```python
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

**Rationale:** Cross-field validations cannot be expressed as single-field validators. The `@validates_schema` decorator runs after all individual field validations, ensuring all fields are available for comparison.

**Open Questions:** None.

---

## Rule 16: Boolean Field Naming Convention

**Pattern Name:** Boolean Field Naming as Questions

**Rule Statement:** ALWAYS name boolean fields using question-like prefixes: `is_`, `has_`, `can_`, `was_`. Examples: `has_active_opportunity`, `is_test_agency`, `is_deleted`, `is_included_in_submission`.

**Confidence:** High

**Frequency:** Enforced by reviewer chouinar in PR #4493. Consistently followed in all examined PRs.

**Code Examples:**

From PR #4493:
```python
has_active_opportunity = fields.Boolean(...)
```

From PR #4589:
```python
is_test_agency = fields.Boolean(...)
```

From PR #5611:
```python
is_included_in_submission = fields.Boolean(...)
```

**Rationale:** Boolean fields named as questions are self-documenting and read naturally in conditional expressions (e.g., `if agency.has_active_opportunity`).

**Open Questions:** None.

---

## Rule 17: Test Structure and Data Setup

**Pattern Name:** Test File Per Feature with Factory Data

**Rule Statement:** ALWAYS create test files in `api/tests/src/api/<domain>/` with one file per feature or route group. ALWAYS use factories from `tests/src/db/models/factories.py` to create test data. NEVER rely on deleting all existing data and then counting results -- instead query for specific records by their IDs. Use `cascade_delete_from_db_table` if cleanup is needed.

**Confidence:** High

**Frequency:** Enforced in PR #4989 reviews. Pattern found in all examined test files.

**Code Examples:**

From PR #4989 -- replacing blanket deletes with specific queries:
```python
# Before (fragile -- counts all records):
saved_count = db_session.query(UserSavedOpportunity).count()
assert saved_count == 0

# After (robust -- queries specific record):
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

From PR #4989 -- replacing autouse fixture that deletes all data:
```python
# Before (fragile):
@pytest.fixture(autouse=True, scope="function")
def clear_saved_opportunities(db_session):
    db_session.query(UserSavedOpportunity).delete()
    db_session.commit()
    yield

# After (removed entirely -- tests query by specific IDs instead)
```

**Rationale:** Tests that delete all data and count results are fragile when tests run in parallel or when other tests create data in the same tables. Querying by specific IDs makes tests independent and reliable.

**Open Questions:** None.

---

## Rule 18: Blueprint-per-Domain Organization

**Pattern Name:** Blueprint-per-Domain File Structure

**Rule Statement:** ALWAYS organize each API domain under `api/src/api/<domain>/` containing: (1) `<domain>_blueprint.py` for Flask/APIFlask blueprint definition, (2) `<domain>_routes.py` or `<domain>_route.py` for route handlers, (3) `<domain>_schemas.py` or `<domain>_schema.py` for Marshmallow schemas.

**Confidence:** High

**Frequency:** Found in 100% of domains: `agencies_v1`, `opportunities_v1`, `opportunities_grantor_v1`, `users`, `application_alpha`, `competition_alpha`, `form_alpha`, `organizations_v1`, `extracts_v1`.

**Code Examples:**

From PR #4493 -- agency search files:
- `api/src/api/agencies_v1/agency_blueprint.py`
- `api/src/api/agencies_v1/agency_routes.py` (route added here)
- `api/src/api/agencies_v1/agency_schema.py` (schema added here)

From PR #9114 -- user notifications files:
- `api/src/api/users/user_blueprint.py`
- `api/src/api/users/user_routes.py` (route added here)
- `api/src/api/users/user_schemas.py` (schema added here)

**Rationale:** Consistent directory structure makes it easy to locate code for any domain. Separating schemas from routes keeps both files focused and readable.

**Open Questions:** File naming inconsistency exists between singular (`agency_schema.py`, `competition_route.py`) and plural (`user_routes.py`, `user_schemas.py`). This has not been actively corrected. A tech lead should decide whether to standardize.

---

## Rule 19: Audit Event Recording for Write Operations

**Pattern Name:** Audit Events for Application Write Operations

**Rule Statement:** ALWAYS add an audit event via `add_audit_event()` from `src.services.applications.application_audit` for all non-GET application endpoints. Call this in the service layer, not the route, except for error cases that require a separate transaction (like failed submissions).

**Confidence:** High

**Frequency:** Established in PR #7034. Applied to all application write endpoints since November 2025.

**Code Examples:**

From PR #7034 -- audit event in service layer:
```python
add_audit_event(
    db_session=db_session,
    application=application,
    user=user,
    audit_event=ApplicationAuditEvent.ORGANIZATION_ADDED,
)
```

From PR #7034 -- special error-case handling in route (separate transaction):
```python
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

**Rationale:** Audit events create a complete activity history for applications, enabling users to review what actions were taken and by whom. Failed submission audits require a separate transaction because the main transaction was rolled back.

**Open Questions:** Should audit events be extended beyond applications to other domains (e.g., opportunities, organizations)?

---

## Summary of Confidence Levels

| Rule | Pattern | Confidence | Frequency |
|------|---------|------------|-----------|
| 1 | Decorator Stack Order | High | 100% of route handlers |
| 2 | Multi-Auth Default | High | Enforced in 3+ reviews, all new endpoints since Jan 2026 |
| 3 | Auth User Retrieval | High | Enforced in 2+ reviews, bug source when violated |
| 4 | Thin Routes | High | 100% of handlers, enforced in 3+ reviews |
| 5 | Transaction Block | High | 100% of DB-accessing handlers |
| 6 | Structured Logging | High | Dedicated cleanup PR + 2+ review enforcements |
| 7 | ApiResponse Return | High | 100% of handlers |
| 8 | raise_flask_error | High | All error-handling code |
| 9 | User Identity Verification | High | All user-scoped endpoints |
| 10 | Schema Conventions | High | All schema files, 3+ review enforcements |
| 11 | Search Filter Builders | High | All search endpoints |
| 12 | Pagination Schema | High | All list/search endpoints |
| 13 | Pydantic Service Inputs | High | 80%+ of service functions |
| 14 | Soft Delete | High | All user-facing deletes since May 2025 |
| 15 | @validates_schema | High | All cross-field validation cases |
| 16 | Boolean Naming | High | All boolean fields |
| 17 | Test Structure | High | All test files, enforced in reviews |
| 18 | Blueprint-per-Domain | High | All domains |
| 19 | Audit Events | High | All application write endpoints since Nov 2025 |
