# API Validation -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a note are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The API validation layer enforces business rules, input constraints, and precondition checks for the Simpler Grants application API. Validation logic is centralized in the service layer -- primarily in `api/src/services/applications/application_validation.py` -- and uses a standardized error structure (`ValidationErrorDetail` with `ValidationErrorType` enum values) that serves as the contractual interface between the API and the frontend. The frontend maps these error type strings to localized user messages, making the `type` field the primary machine-readable contract.

The validation architecture distinguishes between two error-reporting patterns: a "raise" pattern for binary precondition checks (wrong status, competition closed) that halt execution immediately, and a "return" pattern for form validation where multiple errors can coexist and must be aggregated for the user. Both patterns feed into the same `raise_flask_error` mechanism with `ValidationErrorDetail` lists, ensuring consistent error structure regardless of the validation strategy.

Logging within the validation layer follows the project-wide structured logging standard: static messages at `info` level for expected client errors (4xx), with all dynamic values placed in the `extra={}` dict using flat snake_case keys. This convention is enforced to prevent unnecessary alerting in New Relic and to enable consistent log querying. See also: [api-error-handling](./api-error-handling.md) for the broader error handling architecture.

## Rules

### Error Type Definitions

#### Rule: Centralized Validation Error Types in `ValidationErrorType` StrEnum
**Confidence:** High
**Observed in:** 7 of 10 PRs | PR refs: #4936, #5073, #5146

ALWAYS define new validation error types as members of the `ValidationErrorType(StrEnum)` class in `api/src/validation/validation_constants.py`. NEVER define error type strings inline.

**DO:**
```python
# From PR #4936 -- Adding status validation error type
class ValidationErrorType(StrEnum):
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    MIN_OR_MAX_VALUE = "min_or_max_value"

    NOT_IN_PROGRESS = "not_in_progress"
```

**DON'T:**
```python
# Anti-pattern -- inline string literals bypass the centralized registry
raise_flask_error(
    403,
    message,
    validation_issues=[
        ValidationErrorDetail(
            type="not_in_progress",  # raw string instead of enum
            message="Application cannot be submitted",
        )
    ],
)
```

> **Rationale:** Single source of truth for all error type strings. These values serve as the API-frontend contract -- the frontend maps them to localized user messages. Centralizing them prevents typos and makes the full set of error scenarios discoverable.

---

#### Rule: Validation Error Types as Frontend-Facing Contracts
**Confidence:** High
**Observed in:** 2 of 10 PRs (explicitly enforced), conceptually present in all | PR refs: #5000, #5073

ALWAYS use specific, descriptive error type strings that the frontend can map to localized messages. NEVER use generic error types when a more specific one would be useful.

**DO:**
```python
# From PR #5073 -- Distinct types for different form validation scenarios
MISSING_REQUIRED_FORM = "missing_required_form"
APPLICATION_FORM_VALIDATION = "application_form_validation"
```

**DON'T:**
```python
# Anti-pattern -- generic type forces frontend to parse message strings
FORM_ERROR = "form_error"  # too generic; frontend cannot distinguish scenarios
```

> **Rationale:** The frontend uses `ValidationErrorType` values to determine which localized message to show users. Generic types force the frontend to parse message strings, which is fragile and not localizable. Reviewer (chouinar) in PR #5000: "For the type, could we put something more specific? The type is effectively what the frontend will use to map error scenarios to messages."

---

### Error Raising Patterns

#### Rule: `raise_flask_error` with `ValidationErrorDetail` List
**Confidence:** High
**Observed in:** 6 of 10 PRs | PR refs: #4936, #5000, #5073

ALWAYS use `raise_flask_error(status_code, message, validation_issues=[ValidationErrorDetail(...)])` to raise validation errors. Each `ValidationErrorDetail` MUST include a `type` from `ValidationErrorType` and a human-readable `message`.

**DO:**
```python
# From PR #5000 -- Competition window validation with field parameter
raise_flask_error(
    422,
    "Cannot start application - competition is not yet open for applications",
    validation_issues=[
        ValidationErrorDetail(
            type=ValidationErrorType.COMPETITION_NOT_YET_OPEN,
            message="Competition is not yet open for applications",
            field="opening_date",
        )
    ],
)
```

**DON'T:**
```python
# Anti-pattern -- raising without structured validation details
raise_flask_error(422, "Competition is not open")
# Frontend cannot programmatically determine the error type
```

> **Rationale:** Standardized error structure that the frontend can reliably parse. The `type` field is the primary contract for frontend message mapping; the `message` is a fallback for API consumers.

---

#### Rule: Validation Functions -- Raise vs. Return
**Confidence:** High
**Observed in:** 6 of 10 PRs | PR refs: #5146, #5073

ALWAYS use the raise pattern (`raise_flask_error`) for precondition checks that should halt execution. ALWAYS use the return pattern (returning `list[ValidationErrorDetail]`) for form validation where multiple errors can coexist and should be aggregated.

**DO:**
```python
# From PR #5146 -- Raise pattern for precondition check
def validate_competition_open(competition: Competition, action: ApplicationAction) -> None:
    if not competition.is_open:
        message = f"Cannot {action} application - competition is not open"
        raise_flask_error(422, message, validation_issues=[
            ValidationErrorDetail(
                type=ValidationErrorType.COMPETITION_NOT_OPEN,
                message="Competition is not open for application",
            )
        ])
```

```python
# From PR #5073 -- Return pattern for aggregated form errors
def get_required_form_errors(application: Application) -> list[ValidationErrorDetail]:
    required_forms = get_required_forms_for_application(application)
    existing_application_form_ids = [app_form.form_id for app_form in application.application_forms]
    required_form_errors: list[ValidationErrorDetail] = []
    for required_form in required_forms:
        if required_form.form_id not in existing_application_form_ids:
            required_form_errors.append(
                ValidationErrorDetail(
                    message=f"Form {required_form.form_name} is required",
                    type=ValidationErrorType.MISSING_REQUIRED_FORM,
                    field="form_id",
                    value=required_form.form_id,
                )
            )
    return required_form_errors
```

**DON'T:**
```python
# Anti-pattern -- using raise for form validation that should aggregate errors
def validate_forms(application: Application) -> None:
    for form in application.application_forms:
        if not form.is_valid:
            raise_flask_error(422, f"Form {form.form_name} is invalid", ...)
            # Stops at first error; user never sees remaining issues
```

> **Rationale:** Preconditions (wrong status, competition closed) are binary -- either the action can proceed or it cannot. Form validation, however, can have multiple simultaneous issues that the user should see at once.

---

### Validation Architecture

#### Rule: Validation Logic in Service Layer, Not Route Layer
**Confidence:** High
**Observed in:** 10 of 10 PRs | PR refs: #4936, #5073

ALWAYS place validation functions in `api/src/services/applications/` (e.g., `application_validation.py`). NEVER put validation logic directly in route handler functions.

**DO:**
```python
# From PR #5073 -- Dedicated validation module application_validation.py
def validate_forms(application: Application) -> None:
    """Validate the forms for an application."""
    form_errors, form_error_map = get_application_form_errors(application)
    if len(form_errors) > 0:
        detail = {}
        if form_error_map:
            detail["form_validation_errors"] = form_error_map
        raise_flask_error(422, "The application has issues in its form responses.",
            detail=detail, validation_issues=form_errors)
```

**DON'T:**
```python
# Anti-pattern -- validation logic embedded in route handler
@app.post("/applications/submit")
def submit_application_route():
    application = get_application(db_session, application_id)
    if application.application_status != ApplicationStatus.IN_PROGRESS:
        raise_flask_error(403, "Cannot submit", ...)  # validation in route
```

> **Rationale:** Keeps route handlers thin and focused on request/response handling. Validation logic can be unit-tested independently of HTTP concerns. Multiple routes can share the same validation functions.

---

#### Rule: Consolidate Duplicate Validation into `application_validation.py`
**Confidence:** High
**Observed in:** 1 of 10 PRs (explicit refactoring), reflects ongoing trend | PR refs: #5146

ALWAYS consolidate validation logic used by multiple services into `api/src/services/applications/application_validation.py`. NEVER duplicate the same validation check in separate service files.

**DO:**
```python
# From PR #5146 -- After consolidation: single function, imported everywhere
# In create_application.py:
from src.services.applications.application_validation import (
    ApplicationAction,
    validate_competition_open,
)
validate_competition_open(competition, ApplicationAction.START)

# In submit_application.py:
validate_competition_open(application.competition, ApplicationAction.SUBMIT)
```

**DON'T:**
```python
# Anti-pattern -- same date-comparison logic duplicated in two files
# create_application.py:
if current_date < competition.opening_date:
    raise_flask_error(422, "Competition not yet open", ...)

# submit_application.py:
if current_date < competition.opening_date:
    raise_flask_error(422, "Competition not yet open", ...)
```

> **Rationale:** DRY principle. Ensures consistent validation behavior across all code paths. A single change to the validation rule propagates everywhere automatically.

---

#### Rule: `ApplicationAction` Enum for Context-Aware Validation Messages
**Confidence:** High
**Observed in:** 1 of 10 PRs (introduced), used across multiple validation functions | PR refs: #5146

ALWAYS use the `ApplicationAction(StrEnum)` enum (START, SUBMIT, MODIFY) to parameterize validation error messages. NEVER hardcode action-specific text in validation functions.

**DO:**
```python
# From PR #5146 -- Enum definition and usage
class ApplicationAction(StrEnum):
    START = "start"
    SUBMIT = "submit"
    MODIFY = "modify"

def validate_application_in_progress(application: Application, action: ApplicationAction):
    if application.application_status != ApplicationStatus.IN_PROGRESS:
        message = f"Cannot {action} application. It is currently in status: {application.application_status}"
        raise_flask_error(403, message, validation_issues=[...])
```

**DON'T:**
```python
# Anti-pattern -- hardcoded action text in each caller
def validate_for_submit(application):
    if application.application_status != ApplicationStatus.IN_PROGRESS:
        raise_flask_error(403, "Cannot submit application...", ...)

def validate_for_start(application):
    if application.application_status != ApplicationStatus.IN_PROGRESS:
        raise_flask_error(403, "Cannot start application...", ...)
```

> **Rationale:** Allows the same validation function to produce contextually appropriate messages for different operations without code duplication.

---

### Model-Level Business Rules

#### Rule: Model-Level Computed Properties for Business Rules (timesaver)
**Confidence:** Medium
**Observed in:** 1 of 10 PRs (emerging pattern) | PR refs: #5146

ALWAYS define reusable business rule computations (e.g., "is this competition open?") as `@property` methods on the DB model when the logic depends only on the model's own fields. NEVER duplicate date-comparison logic across service functions.

**DO:**
```python
# From PR #5146 -- Competition.is_open property on the DB model
@property
def is_open(self) -> bool:
    """The competition is open if the following are both true:
    * It is on/after the competition opening date OR the opening date is null
    * It is on/before the competition close date + grace period OR the close date is null
    """
    current_date = get_now_us_eastern_date()
    if self.opening_date is not None and current_date < self.opening_date:
        return False
    if self.closing_date is not None:
        grace_period = self.grace_period
        if grace_period is None or grace_period < 0:
            grace_period = 0
        actual_closing_date = self.closing_date + timedelta(days=grace_period)
        if current_date > actual_closing_date:
            return False
    return True
```

**DON'T:**
```python
# Anti-pattern -- date logic duplicated in service functions
def check_competition_open_for_create(competition):
    current_date = get_now_us_eastern_date()
    if competition.opening_date and current_date < competition.opening_date:
        ...

def check_competition_open_for_submit(competition):
    current_date = get_now_us_eastern_date()
    if competition.opening_date and current_date < competition.opening_date:
        ...
```

> **Rationale:** Centralizes the logic so it can be used by both validation (`validate_competition_open`) and the API response (`is_open` field in competition schema). Eliminates prior duplication where `create_application.py` and `submit_application.py` each computed this independently. Note: properties that depend on `get_now_us_eastern_date()` make the model impure -- this may affect testing or caching.

---

### Shared Schemas

#### Rule: Shared Schemas Extracted to `shared_schema.py` (timesaver)
**Confidence:** Medium
**Observed in:** 1 of 10 PRs (emerging pattern) | PR refs: #5146

ALWAYS extract API schemas that are used across multiple domains into `api/src/api/schemas/shared_schema.py`. NEVER duplicate schema definitions.

**DO:**
```python
# From PR #5146 -- shared_schema.py
class OpportunityAssistanceListingV1Schema(Schema):
    program_title = fields.String(allow_none=True, metadata={...})
    assistance_listing_number = fields.String(allow_none=True, metadata={...})
```

**DON'T:**
```python
# Anti-pattern -- same schema defined in both opportunity_schemas.py and competition_schemas.py
# opportunity_schemas.py:
class OpportunityAssistanceListingV1Schema(Schema):
    program_title = fields.String(allow_none=True)
# competition_schemas.py:
class OpportunityAssistanceListingSchema(Schema):  # slightly different name, same fields
    program_title = fields.String(allow_none=True)
```

> **Rationale:** The competition schema needed `OpportunityAssistanceListingV1Schema`, which was previously defined in the opportunity module. Extracting it avoids cross-domain imports and makes the shared nature explicit.

---

### Form Validation

#### Rule: JSON Schema Validation for Form Responses
**Confidence:** High
**Observed in:** 1 of 10 PRs (foundational for the form system) | PR refs: #5073

ALWAYS validate application form responses against JSON Schema definitions stored on the `Form` model. ALWAYS map JSON Schema validation errors to `ValidationErrorDetail` objects for consistent error reporting.

**DO:**
```python
# From PR #5073 -- JSON Schema validation integrated into form submission
def get_application_form_errors(application: Application) -> tuple[list[ValidationErrorDetail], dict[str, list[ValidationErrorDetail]]]:
    form_error_map: dict[str, list[ValidationErrorDetail]] = {}
    form_errors: list[ValidationErrorDetail] = []
    form_errors.extend(get_required_form_errors(application))
    for application_form in application.application_forms:
        form_validation_errors = validate_json_schema_for_form(
            application_form.application_response, application_form.form
        )
        if form_validation_errors:
            form_error_map[str(application_form.application_form_id)] = form_validation_errors
            form_errors.append(
                ValidationErrorDetail(
                    type=ValidationErrorType.APPLICATION_FORM_VALIDATION,
                    message="The application form has outstanding errors.",
                    field="application_form_id",
                    value=application_form.application_form_id,
                )
            )
    return form_errors, form_error_map
```

**DON'T:**
```python
# Anti-pattern -- custom validation logic instead of JSON Schema
def validate_form_response(response, form):
    errors = []
    if "name" not in response:
        errors.append("name is required")  # reinventing JSON Schema required checks
    if len(response.get("name", "")) > 100:
        errors.append("name too long")  # reinventing maxLength
```

> **Rationale:** Two-level error reporting: top-level errors identify which forms have issues (using `APPLICATION_FORM_VALIDATION` type with the form ID in `value`), while the `form_error_map` in the response `data` field contains the specific field-level errors. This lets the frontend navigate users to the correct form and field. See also: [api-form-schema](./api-form-schema.md) for the full form validation architecture.

---

#### Rule: Rule Processing for Custom Validation Beyond JSON Schema (timesaver)
**Confidence:** Medium
**Observed in:** 1 of 10 PRs (foundational new capability) | PR refs: #5264

ALWAYS use the rule processing system (`api/src/form_schema/rule_processing/`) for validation and field population logic that cannot be expressed in standard JSON Schema. Rules MUST be defined as JSON in the same shape as form responses, with rule groups (`gg_pre_population`, `gg_post_population`, `gg_validation`) at the value level.

**DO:**
```python
# From PR #5264 -- Recursive rule processor
handlers: dict[str, Callable[[JsonRuleContext, dict, list[str]], None]] = {
    "gg_pre_population": handle_pre_population,
    "gg_post_population": handle_post_population,
    "gg_validation": handle_validation,
}

def _process_rule_schema(context: JsonRuleContext, rule_schema: dict, path: list[str]) -> None:
    for k, v in rule_schema.items():
        if k in handlers:
            handlers[k](context, v, path)
        elif isinstance(v, dict):
            _process_rule_schema(context=context, rule_schema=v, path=path + [k])
```

**DON'T:**
```python
# Anti-pattern -- hardcoded field population in service functions
def populate_form_fields(application_form):
    response = application_form.application_response
    response["info"]["opportunity_number"] = application_form.application.competition.opportunity.opportunity_number
    # Hardcoded field paths, no extensibility
```

> **Rationale:** JSON Schema cannot express cross-field validation, date ordering, or field auto-population. The rule processing system handles these using a mapper pattern that is extensible -- adding new rules only requires a new function in the mapper. Note: list fields are not yet supported; cross-field validation is a planned future addition. See also: [api-form-schema](./api-form-schema.md) for the full rule processing architecture.

---

### Logging in Validation

#### Rule: Use `logger.info()` for Expected Client Errors (4xx)
**Confidence:** High
**Observed in:** 2 of 10 PRs (corrective), universally applicable | PR refs: #4936, #5146

NEVER use `logger.warning()` for expected client validation errors (4xx). ALWAYS use `logger.info()` with structured `extra={}` parameters.

**DO:**
```python
# From PR #5146 -- Correct usage in validation function
logger.info(
    message,
    extra={
        "opening_date": competition.opening_date,
        "closing_date": competition.closing_date,
        "grace_period": competition.grace_period,
        "application_action": action,
    },
)
```

**DON'T:**
```python
# Anti-pattern -- warning level triggers New Relic alerts
logger.warning(
    f"Application {application_id} cannot be submitted, competition is closed",
)
# Two problems: warning level AND dynamic values in message
```

> **Rationale:** Warning-level logs trigger alerts in New Relic. Client validation failures are expected operational events, not system problems requiring immediate attention. Reviewer (chouinar) in PR #4936: "Warning logs will alert us, we don't want to be alerted for 4xx errors."

---

#### Rule: Static Log Messages with `extra={}` for Dynamic Values
**Confidence:** High
**Observed in:** 2 of 10 PRs (corrective), universally applicable | PR refs: #4936, #5076

NEVER embed dynamic values (IDs, statuses, dates) in log message strings. ALWAYS put dynamic values in the `extra={}` parameter.

**DO:**
```python
# From PR #5076 -- Correct pattern for access denial logging
logger.info(
    "User attempted to access an application they are not associated with",
    extra={
        "user_id": user.user_id,
        "application_id": application.application_id,
    },
)
```

**DON'T:**
```python
# Anti-pattern -- dynamic values in message string
logger.info(
    f"User {user.user_id} attempted to access application {application.application_id}",
)
```

> **Rationale:** Static log messages enable consistent querying and count aggregation in New Relic. Dynamic values in `extra={}` appear as searchable attributes. Reviewer (chouinar) in PR #4936: "To make it easier to look things up, we should try to avoid putting any variable text in the message as well, just make it an extra param which has the benefit of being able to easily make count charts in New Relic."

---

### Testing Validation

#### Rule: `freeze_time` for Date-Dependent Validation Tests
**Confidence:** High
**Observed in:** 3 of 10 PRs | PR refs: #5000, #5146

ALWAYS use `@freeze_time(TEST_DATE)` from the `freezegun` library when testing date-based validation logic. ALWAYS define `TEST_DATE` as a module-level constant. ALWAYS use parametrized test cases to cover boundary conditions (before open, on open, within window, on close, after close, with grace period).

**DO:**
```python
# From PR #5146 -- Parametrized is_open property tests
@pytest.mark.parametrize("opening_date,closing_date,grace_period,expected_is_open", [
    (None, None, None, True),
    (date(2025, 1, 1), date(2025, 12, 31), 10, True),
    (date(2025, 1, 16), date(2025, 1, 31), 0, False),  # Day before opening
    (date(2025, 1, 1), date(2025, 1, 14), 0, False),    # Day after closing
    (date(2025, 1, 1), date(2025, 1, 10), 4, False),    # After grace period
])
@freeze_time("2025-01-15 12:00:00", tz_offset=0)
def test_competition_get_200_is_open(client, api_auth_token, enable_factory_create, ...):
    ...
```

**DON'T:**
```python
# Anti-pattern -- using real dates that will cause test to break over time
def test_competition_open():
    competition = CompetitionFactory.create(
        opening_date=date(2025, 1, 1),   # hardcoded past dates
        closing_date=date(2099, 12, 31),  # far-future dates as workaround
    )
```

> **Rationale:** Makes time-dependent tests deterministic and reproducible. Parametrized boundary testing catches off-by-one errors in date comparisons.

---

#### Rule: Factory `.build()` for Unit Tests, `.create()` for Integration Tests
**Confidence:** High
**Observed in:** Consistent across all test PRs | PR refs: #5073, #5000

ALWAYS use `Factory.build()` in unit tests that do not need database persistence. ALWAYS use `Factory.create()` in integration/route tests that require DB-backed objects.

**DO:**
```python
# From PR #5000 -- Route tests use .create() with DB
def test_application_start_success(client, api_auth_token, enable_factory_create, db_session):
    today = get_now_us_eastern_date()
    future_date = today + timedelta(days=10)
    competition = CompetitionFactory.create(opening_date=today, closing_date=future_date)
    response = client.post("/alpha/applications/start", json=request_data, headers={"X-Auth": api_auth_token})
    assert response.status_code == 200
```

**DON'T:**
```python
# Anti-pattern -- using .create() when .build() would suffice
def test_validation_logic():
    # This test only checks in-memory logic, no DB needed
    application = ApplicationFactory.create()  # unnecessary DB write
    errors = get_required_form_errors(application)
```

> **Rationale:** `.build()` is faster and avoids test database overhead. Integration tests need `.create()` because the route handler queries the database.

---

## Anti-Patterns

### AP-1: Duplicating Validation Logic Across Services
**Confidence:** High (PR #5146)

NEVER copy the same validation check into multiple service files. ALWAYS extract it into `application_validation.py`. The competition-open check was duplicated in `create_application.py` and `submit_application.py` before being consolidated.

### AP-2: Overly Specific Error Types That Fragment Unnecessarily
**Confidence:** High (PR #5146)

NEVER create separate error types for closely related scenarios when the frontend does not need to distinguish them. `COMPETITION_NOT_YET_OPEN` and `COMPETITION_ALREADY_CLOSED` were consolidated into `COMPETITION_NOT_OPEN` because the distinction was not useful to the frontend.

### AP-3: Dynamic IDs in Error Messages
**Confidence:** Medium (PR #5000)

NEVER include dynamic IDs in error message strings (e.g., `f"Competition with ID {competition_id} not found"`). Use static messages (e.g., `"Competition not found"`) since the ID is already in request context logs.

### AP-4: Parametrized Tests Including Happy Path in Failure Cases
**Confidence:** Medium (PR #4936)

NEVER include the expected-success case in a parametrized test for failure scenarios. Separate happy-path tests from error-case parametrizations. In PR #4936, `IN_PROGRESS` was included in the parametrized forbidden-status test, requiring special-case handling inside the test body.

---

## Known Inconsistencies

- **Validation Framework Dual Stack (INC-3 from cross-domain synthesis):** The API uses Marshmallow schemas at the route level, Pydantic models at the service level, and JSON Schema Draft 2020-12 for form validation. These three validation libraries coexist with different purposes but no formal boundary documentation.
- **Auth-related validation types** (e.g., `UNAUTHORIZED_APPLICATION_ACCESS`) blur the line between the validation and auth domains. The `auth_utils.py` service uses validation infrastructure (`raise_flask_error` with `validation_issues`), creating tight coupling between these two domains.

---

## Related Documents

- [api-form-schema](./api-form-schema.md) -- Form validation architecture, JSON Schema validator, rule processing
- [api-tests](./api-tests.md) -- Testing patterns for validation (freeze_time, factories, parametrize)
- Cross-domain synthesis: CCP-1 (Structured Logging), CCP-2 (Log Level Discipline), CCP-4 (`raise_flask_error` pattern), CCP-5 (Service Layer Separation)
