# API Routes — Pattern Review

**Reviewer(s):** chouinar
**PRs analyzed:** 153
**Rules proposed:** 19
**Open questions:** 3

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

### 1. Decorator Stack Order

**Confidence:** High
**Frequency:** 100% of route handlers across all examined PRs (15+ PRs)
**Source PRs:** #9114, #9155, #4936

**Proposed Rule:**
> ALWAYS apply decorators to route handlers in this exact top-to-bottom order: (1) `@blueprint.METHOD("/path")`, (2) `@blueprint.input(...)` if applicable, (3) `@blueprint.output(...)`, (4) `@blueprint.doc(...)`, (5) auth decorator (`@multi_auth.login_required` or `@blueprint.auth_required(...)`), (6) `@flask_db.with_db_session()`.

**Rationale:**
APIFlask/Flask processes decorators bottom-up. The `with_db_session()` must be innermost to inject `db_session` into the handler. Auth must come before DB session so unauthenticated requests are rejected before opening a database connection.

**Code Examples:**
```python
# From PR #9114 — GET saved opportunity notifications
@user_blueprint.get("/<uuid:user_id>/saved-opportunities/notifications")
@user_blueprint.output(UserSavedOpportunityNotificationsResponseSchema)
@user_blueprint.doc(responses=[200, 401, 403], security=jwt_or_api_user_key_security_schemes)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def user_get_saved_opportunity_notifications(
    db_session: db.Session, user_id: UUID
) -> response.ApiResponse:
```

```python
# From PR #9155 — POST saved opportunity notifications (with input)
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

### 2. Multi-Auth Default for New Endpoints

**Confidence:** High
**Frequency:** Enforced in 3+ explicit reviewer comments (PRs #9114, #9155, #5015)
**Source PRs:** #9114, #9155, #5015

**Proposed Rule:**
> ALWAYS use `jwt_or_api_user_key_multi_auth` for authentication on new user-facing endpoints unless there is a documented reason not to. NEVER combine `@blueprint.auth_required(...)` with `@multi_auth.login_required` on the same handler.

**Rationale:**
Supporting both JWT and API key auth reduces friction for testing in staging environments. API keys are simpler to obtain and use than JWT tokens for manual testing and demos.

**Code Examples:**
```python
# From PR #9114 — reviewer chouinar's comment:
# "I'd suggest for any new endpoints, we make them support JWT + User API Key auth
# unless we have a strong reason not to."

# Correct import pattern (from PR #9114):
from src.auth.multi_auth import jwt_or_api_user_key_multi_auth, jwt_or_api_user_key_security_schemes
```

```python
# From PR #5015 — competition endpoint correctly using multi-auth
@competition_blueprint.get("/competitions/<uuid:competition_id>")
@competition_blueprint.output(competition_schema.CompetitionResponseAlphaSchema())
@competition_blueprint.doc(security=jwt_or_key_security_schemes)
@jwt_or_key_multi_auth.login_required
@flask_db.with_db_session()
def competition_get(db_session: db.Session, competition_id: uuid.UUID) -> response.ApiResponse:
```

**Conflicting Examples:**
The multi-auth object names evolved over time (`jwt_or_key_multi_auth` vs. `jwt_or_api_user_key_multi_auth`). Older endpoints have not been migrated. (Cross-domain INC-4)

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 3. Get Authenticated User from Multi-Auth Object

**Confidence:** High
**Frequency:** Enforced in 2 explicit reviewer comments (PRs #9155, #5015)
**Source PRs:** #9155, #9114, #5611

**Proposed Rule:**
> ALWAYS call `.get_user()` on the multi-auth object that matches the auth decorator on the endpoint. NEVER use `api_jwt_auth.current_user` or `api_jwt_auth.get_user_token_session()` on an endpoint decorated with `@multi_auth.login_required`.

**Rationale:**
Using the wrong auth object to retrieve the user will silently fail when a request arrives via API key auth instead of JWT, causing runtime errors.

**Code Examples:**
```python
# From PR #9155 — reviewer mikehgrantsgov's correction:
# "I think this needs to be: user = jwt_or_api_user_key_multi_auth.get_user()
# The GET and POST endpoints are both decorated with
# @jwt_or_api_user_key_multi_auth.login_required... But as it's implemented
# this only works for JWT."

# Correct pattern (from PR #9114):
user = jwt_or_api_user_key_multi_auth.get_user()
```

```python
# JWT-only endpoint pattern (from PR #5611):
token_session = api_jwt_auth.get_user_token_session()
user = token_session.user
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

### 4. Thin Route Handlers with Service Layer Delegation

**Confidence:** High
**Frequency:** 100% of handlers, enforced in 3+ reviews (PRs #4513, #5611, #4989)
**Source PRs:** #9114, #4989, #4513

**Proposed Rule:**
> ALWAYS keep route handlers thin. Business logic, validation logic, and database query construction MUST live in service functions under `src/services/<domain>/`. Route handlers should contain only: (1) structured logging setup, (2) auth/identity verification, (3) a `db_session.begin()` block calling the service, (4) returning `response.ApiResponse`.

**Rationale:**
Thin routes improve testability (services can be tested independently), reusability (services can be called from background tasks), and readability.

**Code Examples:**
```python
# From PR #9114 — correct thin route
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

```python
# From PR #4989 — business logic moved from route to service
# Before (in route):
saved_opportunity = UserSavedOpportunity(
    user_id=user_id, opportunity_id=json_data["opportunity_id"]
)
with db_session.begin():
    db_session.add(saved_opportunity)

# After (route delegates to service):
with db_session.begin():
    create_saved_opportunity(db_session, user_id, json_data)
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

### 5. Transaction Block Pattern

**Confidence:** High
**Frequency:** 100% of route handlers that perform database operations (15+ PRs)
**Source PRs:** #9155, #4936, #7034

**Proposed Rule:**
> ALWAYS wrap database operations inside `with db_session.begin():` in route handlers. The `response.ApiResponse` return MUST be outside the `with` block. When using multi-auth, ALWAYS call `db_session.add(user)` inside the transaction block.

**Rationale:**
The `with db_session.begin()` block ensures the transaction is committed on success and rolled back on exception. The user object from auth was loaded in a different session context, so `db_session.add(user)` re-attaches it to the current session.

**Code Examples:**
```python
# From PR #9155 — standard pattern with multi-auth
user = jwt_or_api_user_key_multi_auth.get_user()

if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")

with db_session.begin():
    db_session.add(user)
    set_saved_opportunity_notification_settings(db_session, user, json_data)

return response.ApiResponse(message="Success")
```

```python
# From PR #7034 — exception handling around transaction (special case for audit events)
try:
    with db_session.begin():
        db_session.add(token_session)
        submit_application(db_session, application_id, user)
except HTTPError as e:
    _handle_submit_error(db_session, e, application_id, user.user_id)
```

**Conflicting Examples:**
The `db_session.add(user)` positioning varies -- sometimes before `begin()`, sometimes inside. Tech lead should clarify.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 6. Structured Logging with Flat Field Names

**Confidence:** High
**Frequency:** Dedicated cleanup PR (#4965). Corrected in PR #4936 review. 100% of non-trivial route handlers.
**Source PRs:** #4965, #4936, #9155

**Proposed Rule:**
> ALWAYS call `add_extra_data_to_current_request_logs({"entity_id": value})` at the start of route handlers with flat field names. NEVER use nested field names. NEVER call `str()` on UUIDs in log extra data. NEVER put variable data in log message strings.

**Rationale:**
Flat, consistent field names enable cross-system log querying in New Relic. Variable text in messages defeats log aggregation and prevents count charts.

**Code Examples:**
```python
# From PR #4965 — the cleanup PR correcting nested names to flat names
# Before (wrong):
add_extra_data_to_current_request_logs(
    {"application.application_id": application_id, "form.form_id": form_id}
)

# After (correct):
add_extra_data_to_current_request_logs({"application_id": application_id, "form_id": form_id})
```

```python
# From PR #9155 — correct logging in service layer
logger.info(
    "Modified saved opportunity notification setting",
    extra={
        "organization_id": org_id,
        "email_enabled": requested_setting.email_enabled,
    },
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

### 7. ApiResponse Return Type

**Confidence:** High
**Frequency:** 100% of route handlers (15+ PRs)
**Source PRs:** #4936, #4493, #4513

**Proposed Rule:**
> ALWAYS return `response.ApiResponse(message="Success", data=..., pagination_info=..., warnings=...)` from route handlers. The `data` field SHOULD be a DB model object or dataclass that Marshmallow serializes automatically. NEVER manually build response dicts in route handlers.

**Rationale:**
Using a consistent response wrapper ensures all API responses have the same structure. Passing model objects directly to `data` leverages Marshmallow for serialization.

**Code Examples:**
```python
# From PR #4936 — simple response
return response.ApiResponse(message="Success")

# From PR #4493 — response with data and pagination
return response.ApiResponse(
    message="Success",
    data=agencies,
    pagination_info=pagination_info,
)

# From PR #4513 — response with warnings
return response.ApiResponse(
    message="Success",
    data=application_form,
    warnings=warnings,
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

### 8. Error Handling with raise_flask_error

**Confidence:** High
**Frequency:** All error-handling code across examined PRs
**Source PRs:** #4936, #9114, #9256

**Proposed Rule:**
> ALWAYS use `raise_flask_error(status_code, message, validation_issues=[...])` for error responses. For validation errors, include `ValidationErrorDetail` objects. ALWAYS log 4xx errors at `logger.info()` level, NEVER at `logger.warning()`.

**Rationale:**
Centralized error handling ensures consistent error response structure. Using info-level logging for client errors prevents alert fatigue from expected 4xx responses.

**Code Examples:**
```python
# From PR #4936 — correct error handling after review
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

```python
# From PR #9114 — simple 403
if user.user_id != user_id:
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

### 9. User Identity Verification for User-Scoped Endpoints

**Confidence:** High
**Frequency:** All user-scoped endpoints (PRs #9114, #9155, #4989)
**Source PRs:** #9114, #4989

**Proposed Rule:**
> ALWAYS verify the authenticated user matches the URL user_id parameter on user-scoped endpoints. Use `raise_flask_error(403, "Forbidden")` when they do not match.

**Rationale:**
Prevents users from accessing or modifying other users' data. The shift from 401 to 403 reflects that the user IS authenticated but not authorized for the specific resource.

**Code Examples:**
```python
# From PR #9114 — current pattern
user = jwt_or_api_user_key_multi_auth.get_user()
if user.user_id != user_id:
    raise_flask_error(403, "Forbidden")
```

```python
# From PR #4989 — older pattern (using JWT-only, 401 instead of 403)
user_token_session = api_jwt_auth.get_user_token_session()
if user_token_session.user_id != user_id:
    raise_flask_error(401, "Unauthorized user")
```

**Conflicting Examples:**
Older endpoints use 401 instead of 403. Should older endpoints be migrated to 403?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 10. Schema Conventions

**Confidence:** High
**Frequency:** All schema files (15+ PRs), 3+ review enforcements
**Source PRs:** #9155, #4589, #4553

**Proposed Rule:**
> ALWAYS define schemas in a separate `*_schemas.py` or `*_schema.py` file. Response schemas MUST extend `AbstractResponseSchema`. ALWAYS mark mandatory fields as `required=True` explicitly. For required but nullable fields, use `required=True, allow_none=True`. Schema names MUST be globally unique. NEVER use string representations of booleans as example values.

**Rationale:**
Not marking fields as required causes Marshmallow to silently accept requests missing those fields, causing 500 errors downstream. Globally unique schema names prevent OpenAPI spec collisions.

**Code Examples:**
```python
# From PR #9155 — required=True, allow_none=True pattern
class SetUserSavedOpportunityNotificationRequestSchema(Schema):
    organization_id = fields.UUID(
        required=True,
        allow_none=True,
        metadata={
            "description": "The ID of the organization for which to set notification."
        },
    )
    email_enabled = fields.Boolean(
        required=True, metadata={"description": "Whether the email notifications is enabled"}
    )
```

```python
# From PR #4553 — renaming schemas to avoid collisions
# Before (collision):
generate_pagination_schema("AgencyPaginationV1Schema", ...)

# After (unique name):
generate_pagination_schema("AgencySearchPaginationV1Schema", ...)
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

### 11. Search/Filter Schema Builders

**Confidence:** High
**Frequency:** All search endpoints (PRs #4493, #4589, #7323)
**Source PRs:** #4493, #4589, #7323

**Proposed Rule:**
> ALWAYS use `StrSearchSchemaBuilder`, `BoolSearchSchemaBuilder`, or `IntegerSearchSchemaBuilder` from `src.api.schemas.search_schema` when building filter schemas for search endpoints.

**Rationale:**
Builder classes produce consistent filter structures across all search endpoints, ensuring uniform API behavior and OpenAPI documentation.

**Code Examples:**
```python
# From PR #4493 — agency search filter
class AgencySearchFilterV1Schema(Schema):
    has_active_opportunity = fields.Nested(
        BoolSearchSchemaBuilder("HasActiveOpportunityFilterV1Schema")
        .with_one_of(example=True)
        .build()
    )
```

```python
# From PR #7323 — string enum filter for audit events
class ApplicationAuditFilterSchema(Schema):
    application_audit_event = fields.Nested(
        StrSearchSchemaBuilder("ApplicationAuditEventFieldFilterSchema")
        .with_one_of(
            allowed_values=ApplicationAuditEvent, example=ApplicationAuditEvent.APPLICATION_CREATED
        )
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

### 12. Pagination Schema Pattern

**Confidence:** High
**Frequency:** All list/search endpoints (PRs #4493, #7326, #7323)
**Source PRs:** #4493, #7326

**Proposed Rule:**
> ALWAYS use `generate_pagination_schema()` from `src.pagination.pagination_schema` for list/search endpoints. The schema name (first argument) MUST be globally unique. Response schemas for paginated endpoints MUST mix in `PaginationMixinSchema`.

**Rationale:**
Centralized pagination schema generation ensures consistent pagination behavior across all endpoints.

**Code Examples:**
```python
# From PR #4493 — agency search
pagination = fields.Nested(
    generate_pagination_schema(
        "AgencySearchPaginationV1Schema",
        ["agency_code", "agency_name"],
        default_sort_order=[{"order_by": "agency_code", "sort_direction": "ascending"}],
    ),
    required=True,
)
```

```python
# From PR #7326 — response schema with pagination mixin
class OrganizationUsersResponseSchema(AbstractResponseSchema, PaginationMixinSchema):
    data = fields.List(
        fields.Nested(OrganizationUserSchema),
        metadata={"description": "List of organization members"},
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

### 13. Pydantic Models for Service Input Validation

**Confidence:** High
**Frequency:** 80%+ of service functions across examined PRs
**Source PRs:** #9256, #9155, #7326

**Proposed Rule:**
> ALWAYS define a Pydantic `BaseModel` in service functions to validate and type input data received from route handlers. Use `model_validate()` to parse the incoming dict.

**Rationale:**
Pydantic models provide type-safe input parsing with clear validation errors, serving as both documentation and runtime validation for service function contracts.

**Code Examples:**
```python
# From PR #9256 — opportunity creation
class OpportunityCreateRequest(BaseModel):
    opportunity_title: str
    category: OpportunityCategory
    category_explanation: str | None = None
    assistance_listing_number: str

def create_opportunity(db_session: db.Session, user: User, opportunity_data: dict) -> Opportunity:
    request = OpportunityCreateRequest.model_validate(opportunity_data)
```

```python
# From PR #9155 — notification settings
class UpdateOpportunityNotificationSettingInput(BaseModel):
    organization_id: UUID | None = None
    email_enabled: bool

def set_saved_opportunity_notification_settings(
    db_session: db.Session, user: User, json_data: dict
) -> None:
    requested_setting = UpdateOpportunityNotificationSettingInput.model_validate(json_data)
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

### 14. Soft Delete Pattern

**Confidence:** High
**Frequency:** All user-facing delete operations since May 2025. Established in PR #4989.
**Source PRs:** #4989

**Proposed Rule:**
> ALWAYS implement user-facing deletions as soft deletes by setting `is_deleted = True`. NEVER use `db_session.delete()` for user-facing operations. Queries MUST filter with `.where(Model.is_deleted.isnot(True))`. Prefer the "fetch then update" pattern over `UPDATE ... WHERE` queries.

**Rationale:**
Soft deletes preserve data for audit trails and allow "un-delete" workflows.

**Code Examples:**
```python
# From PR #4989 — soft delete with fetch-then-update
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

```python
# From PR #4989 — query filtering for soft deletes
UserSavedOpportunity.is_deleted.isnot(True)
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

### 15. Cross-Field Validation with @validates_schema

**Confidence:** High
**Frequency:** All cross-field validation cases (PR #9256)
**Source PRs:** #9256

**Proposed Rule:**
> ALWAYS use `@validates_schema` for validation rules that depend on multiple fields. Raise `ValidationError` with `MarshmallowErrorContainer` instances for structured error responses.

**Rationale:**
Cross-field validations cannot be expressed as single-field validators. The `@validates_schema` decorator runs after all individual field validations.

**Code Examples:**
```python
# From PR #9256 — category explanation required when category is "other"
@validates_schema
def validate_category_explanation(self, data: dict, **kwargs: dict) -> None:
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

### 16. Boolean Field Naming Convention

**Confidence:** High
**Frequency:** All boolean fields. Enforced by reviewer chouinar in PR #4493.
**Source PRs:** #4493, #4589, #5611

**Proposed Rule:**
> ALWAYS name boolean fields using question-like prefixes: `is_`, `has_`, `can_`, `was_`.

**Rationale:**
Boolean fields named as questions are self-documenting and read naturally in conditional expressions.

**Code Examples:**
```python
# From PR #4493
has_active_opportunity = fields.Boolean(...)

# From PR #4589
is_test_agency = fields.Boolean(...)

# From PR #5611
is_included_in_submission = fields.Boolean(...)
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

### 17. Test Structure and Data Setup

**Confidence:** High
**Frequency:** All examined test files. Enforced in PR #4989 reviews.
**Source PRs:** #4989

**Proposed Rule:**
> ALWAYS create test files in `api/tests/src/api/<domain>/` with one file per feature or route group. ALWAYS use factories to create test data. NEVER rely on deleting all existing data and then counting results -- instead query for specific records by their IDs.

**Rationale:**
Tests that delete all data and count results are fragile when tests run in parallel. Querying by specific IDs makes tests independent and reliable.

**Code Examples:**
```python
# From PR #4989 — replacing blanket deletes with specific queries
# Before (fragile):
saved_count = db_session.query(UserSavedOpportunity).count()
assert saved_count == 0

# After (robust):
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

### 18. Blueprint-per-Domain Organization

**Confidence:** High
**Frequency:** 100% of domains
**Source PRs:** #4493, #9114

**Proposed Rule:**
> ALWAYS organize each API domain under `api/src/api/<domain>/` containing: (1) `<domain>_blueprint.py` for blueprint definition, (2) `<domain>_routes.py` or `<domain>_route.py` for route handlers, (3) `<domain>_schemas.py` or `<domain>_schema.py` for Marshmallow schemas.

**Rationale:**
Consistent directory structure makes it easy to locate code for any domain.

**Code Examples:**
```
# From PR #4493 — agency search files
api/src/api/agencies_v1/agency_blueprint.py
api/src/api/agencies_v1/agency_routes.py
api/src/api/agencies_v1/agency_schema.py

# From PR #9114 — user notifications files
api/src/api/users/user_blueprint.py
api/src/api/users/user_routes.py
api/src/api/users/user_schemas.py
```

**Conflicting Examples:**
File naming inconsistency exists between singular (`agency_schema.py`, `competition_route.py`) and plural (`user_routes.py`, `user_schemas.py`). (Cross-domain INC-2)

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 19. Audit Event Recording for Write Operations

**Confidence:** High
**Frequency:** All application write endpoints since November 2025. Established in PR #7034.
**Source PRs:** #7034

**Proposed Rule:**
> ALWAYS add an audit event via `add_audit_event()` from `src.services.applications.application_audit` for all non-GET application endpoints. Call this in the service layer, not the route, except for error cases that require a separate transaction.

**Rationale:**
Audit events create a complete activity history for applications. Failed submission audits require a separate transaction because the main transaction was rolled back.

**Code Examples:**
```python
# From PR #7034 — audit event in service layer
add_audit_event(
    db_session=db_session,
    application=application,
    user=user,
    audit_event=ApplicationAuditEvent.ORGANIZATION_ADDED,
)
```

```python
# From PR #7034 — special error-case handling in route (separate transaction)
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

**Conflicting Examples:**
None found. Open question: Should audit events be extended beyond applications to other domains (e.g., opportunities, organizations)?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

## Coverage Gaps

1. **No formal API versioning strategy (Cross-domain GAP-3).** The API uses path-based versioning (`/v1/`, `/alpha/`) but there is no documented strategy for when to promote alpha to v1 or how breaking changes are managed.

2. **No automated enforcement of file naming conventions.** Singular vs. plural file naming (`agency_schema.py` vs `user_schemas.py`) is not enforced.

3. **No documentation of the `db_session.add(user)` pattern.** The requirement to re-attach the auth user object to the current DB session is an implicit convention that could be formalized.

## Inconsistencies Requiring Resolution

1. **Auth object name evolution (Cross-domain INC-4):** `jwt_or_key_multi_auth` vs. `jwt_or_api_user_key_multi_auth`. Which is canonical? Should older endpoints be migrated?

2. **File naming: singular vs. plural (Cross-domain INC-2):** `agency_schema.py` vs. `user_schemas.py`, `competition_route.py` vs. `user_routes.py`. No enforcement mechanism exists. Tech lead should decide whether to standardize.

3. **User identity verification status code:** Older endpoints use 401, newer endpoints use 403. Should older endpoints be migrated to 403?
