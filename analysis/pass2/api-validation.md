# Pass 2: Pattern Codification -- API Validation (`api/src/validation/`)

**Source:** 10 merged PRs, 8 sampled in detail
**Date range:** 2025-05-06 to 2025-06-23
**Primary authors:** chouinar, mikehgrantsgov

---

## Pattern 1: Centralized Validation Error Types in `ValidationErrorType` StrEnum

**Rule Statement:** ALWAYS define new validation error types as members of the `ValidationErrorType(StrEnum)` class in `api/src/validation/validation_constants.py`. NEVER define error type strings inline.

**Confidence:** High
**Frequency:** 7/10 PRs modify this file

**Code Examples:**

1. PR #4936 -- Adding status validation error type:
```python
class ValidationErrorType(StrEnum):
    MIN_VALUE = "min_value"
    MAX_VALUE = "max_value"
    MIN_OR_MAX_VALUE = "min_or_max_value"

    NOT_IN_PROGRESS = "not_in_progress"
```

2. PR #5073 -- Adding form validation error types:
```python
    MISSING_REQUIRED_FORM = "missing_required_form"
    APPLICATION_FORM_VALIDATION = "application_form_validation"
```

3. PR #5146 -- Consolidating competition window types:
```python
    # Competition window validation error types
    COMPETITION_NOT_OPEN = "competition_not_open"
```

**Rationale:** Single source of truth for all error type strings. These values serve as the API-frontend contract -- the frontend maps them to localized user messages. Centralizing them prevents typos and makes the full set of error scenarios discoverable.

**Open Questions:** None.

---

## Pattern 2: Validation Logic in Service Layer, Not Route Layer

**Rule Statement:** ALWAYS place validation functions in `api/src/services/applications/` (e.g., `application_validation.py`). NEVER put validation logic directly in route handler functions.

**Confidence:** High
**Frequency:** 10/10 PRs follow this structure

**Code Examples:**

1. PR #4936 -- Validation in `submit_application.py` (service layer):
```python
def submit_application(db_session: db.Session, application_id: UUID) -> Application:
    logger.info("Processing application submit")
    application = get_application(db_session, application_id)

    if application.application_status != ApplicationStatus.IN_PROGRESS:
        logger.info(
            "Application cannot be submitted, not currently in progress",
            extra={"application_status": application.application_status},
        )
        raise_flask_error(403, message, validation_issues=[...])
```

2. PR #5073 -- Dedicated validation module `application_validation.py`:
```python
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

**Rationale:** Keeps route handlers thin and focused on request/response handling. Validation logic can be unit-tested independently of HTTP concerns. Multiple routes can share the same validation functions.

**Open Questions:** None.

---

## Pattern 3: `raise_flask_error` with `ValidationErrorDetail` List

**Rule Statement:** ALWAYS use `raise_flask_error(status_code, message, validation_issues=[ValidationErrorDetail(...)])` to raise validation errors. Each `ValidationErrorDetail` MUST include a `type` from `ValidationErrorType` and a human-readable `message`.

**Confidence:** High
**Frequency:** 6/10 PRs use this pattern

**Code Examples:**

1. PR #4936 -- Status validation:
```python
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

2. PR #5000 -- Competition window validation with `field` parameter:
```python
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

3. PR #5073 -- Form validation with `value` parameter:
```python
ValidationErrorDetail(
    message=f"Form {required_form.form_name} is required",
    type=ValidationErrorType.MISSING_REQUIRED_FORM,
    field="form_id",
    value=required_form.form_id,
)
```

**Rationale:** Standardized error structure that the frontend can reliably parse. The `type` field is the primary contract for frontend message mapping; the `message` is a fallback for API consumers.

**Open Questions:** None.

---

## Pattern 4: Validation Error Types as Frontend-Facing Contracts

**Rule Statement:** ALWAYS use specific, descriptive error type strings that the frontend can map to localized messages. NEVER use generic error types when a more specific one would be useful.

**Confidence:** High
**Frequency:** Conceptually present in all validation PRs; explicitly enforced in 2/10

**Code Examples:**

1. PR #5000 -- Reviewer (chouinar) requesting specific types:
> "For the type, could we put something more specific? The type is effectively what the frontend will use to map error scenarios to messages (our message should only be a fallback/for API users). Maybe something like `competition_not_yet_open` and `competition_closed`?"

2. PR #5073 -- Distinct types for different form validation scenarios:
```python
MISSING_REQUIRED_FORM = "missing_required_form"
APPLICATION_FORM_VALIDATION = "application_form_validation"
```

**Rationale:** The frontend uses `ValidationErrorType` values to determine which localized message to show users. Generic types force the frontend to parse message strings, which is fragile and not localizable.

**Open Questions:** None.

---

## Pattern 5: Validation Functions -- Raise vs. Return

**Rule Statement:** ALWAYS use the raise pattern (`raise_flask_error`) for precondition checks that should halt execution. ALWAYS use the return pattern (returning `list[ValidationErrorDetail]`) for form validation where multiple errors can coexist and should be aggregated.

**Confidence:** High
**Frequency:** Both patterns present across 6/10 PRs

**Code Examples:**

1. PR #5146 -- Raise pattern for precondition check:
```python
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

2. PR #5073 -- Return pattern for aggregated form errors:
```python
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

**Rationale:** Preconditions (wrong status, competition closed) are binary -- either the action can proceed or it cannot. Form validation, however, can have multiple simultaneous issues that the user should see at once.

**Open Questions:** None.

---

## Pattern 6: Consolidate Duplicate Validation into `application_validation.py`

**Rule Statement:** ALWAYS consolidate validation logic used by multiple services into `api/src/services/applications/application_validation.py`. NEVER duplicate the same validation check in separate service files.

**Confidence:** High
**Frequency:** 1 explicit refactoring PR (#5146), but reflects ongoing consolidation trend

**Code Examples:**

1. PR #5146 -- Before: duplicate competition-open checks in both `create_application.py` and `submit_application.py`. After: single `validate_competition_open` in `application_validation.py`:
```python
# In create_application.py (after consolidation):
from src.services.applications.application_validation import (
    ApplicationAction,
    validate_competition_open,
)
# ...
validate_competition_open(competition, ApplicationAction.START)
```

```python
# In submit_application.py (after consolidation):
validate_competition_open(application.competition, ApplicationAction.SUBMIT)
```

2. PR #5146 -- The consolidated function in `application_validation.py`:
```python
def validate_competition_open(competition: Competition, action: ApplicationAction) -> None:
    if not competition.is_open:
        message = f"Cannot {action} application - competition is not open"
        logger.info(message, extra={
            "opening_date": competition.opening_date,
            "closing_date": competition.closing_date,
            "grace_period": competition.grace_period,
            "application_action": action,
        })
        raise_flask_error(422, message, validation_issues=[...])
```

**Rationale:** DRY principle. Ensures consistent validation behavior across all code paths. A single change to the validation rule propagates everywhere automatically.

**Open Questions:** None.

---

## Pattern 7: `ApplicationAction` Enum for Context-Aware Validation Messages

**Rule Statement:** ALWAYS use the `ApplicationAction(StrEnum)` enum (START, SUBMIT, MODIFY) to parameterize validation error messages. NEVER hardcode action-specific text in validation functions.

**Confidence:** High
**Frequency:** 1/10 PRs introduced it; used across multiple validation functions

**Code Examples:**

1. PR #5146 -- Enum definition and usage:
```python
class ApplicationAction(StrEnum):
    START = "start"
    SUBMIT = "submit"
    MODIFY = "modify"

def validate_application_in_progress(application: Application, action: ApplicationAction):
    if application.application_status != ApplicationStatus.IN_PROGRESS:
        message = f"Cannot {action} application. It is currently in status: {application.application_status}"
        raise_flask_error(403, message, validation_issues=[...])
```

**Rationale:** Allows the same validation function to produce contextually appropriate messages for different operations without code duplication.

**Open Questions:** None.

---

## Pattern 8: Model-Level Computed Properties for Business Rules

**Rule Statement:** ALWAYS define reusable business rule computations (e.g., "is this competition open?") as `@property` methods on the DB model when the logic depends only on the model's own fields. NEVER duplicate date-comparison logic across service functions.

**Confidence:** Medium
**Frequency:** 1/10 PRs (emerging pattern)

**Code Examples:**

1. PR #5146 -- `Competition.is_open` property on the DB model:
```python
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

**Rationale:** Centralizes the logic so it can be used by both validation (`validate_competition_open`) and the API response (`is_open` field in competition schema). Eliminates the prior duplication where `create_application.py` and `submit_application.py` each computed this independently.

**Open Questions:** Properties that depend on `get_now_us_eastern_date()` make the model impure. Could this cause issues in testing or caching?

---

## Pattern 9: `freeze_time` for Date-Dependent Validation Tests

**Rule Statement:** ALWAYS use `@freeze_time(TEST_DATE)` from the `freezegun` library when testing date-based validation logic. ALWAYS define `TEST_DATE` as a module-level constant. ALWAYS use parametrized test cases to cover boundary conditions (before open, on open, within window, on close, after close, with grace period).

**Confidence:** High
**Frequency:** 3/10 PRs

**Code Examples:**

1. PR #5000 -- Parametrized date tests:
```python
TEST_DATE = "2023-06-15 12:00:00"

@freeze_time(TEST_DATE)
def test_application_start_before_opening_date(client, api_auth_token, enable_factory_create, db_session):
    today = get_now_us_eastern_date()
    future_opening_date = today + timedelta(days=5)
    competition = CompetitionFactory.create(opening_date=future_opening_date, closing_date=future_closing_date)
    response = client.post("/alpha/applications/start", json=request_data, headers={"X-Auth": api_auth_token})
    assert response.status_code == 422
    assert response.json["errors"][0]["type"] == ValidationErrorType.COMPETITION_NOT_YET_OPEN
```

2. PR #5146 -- Parametrized `is_open` property tests:
```python
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

**Rationale:** Makes time-dependent tests deterministic and reproducible. Parametrized boundary testing catches off-by-one errors in date comparisons.

**Open Questions:** None.

---

## Pattern 10: Factory `.build()` for Unit Tests, `.create()` for Integration Tests

**Rule Statement:** ALWAYS use `Factory.build()` in unit tests that do not need database persistence. ALWAYS use `Factory.create()` in integration/route tests that require DB-backed objects.

**Confidence:** High
**Frequency:** Consistent across all test PRs

**Code Examples:**

1. PR #5073 -- `test_application_validation.py` uses `.build()` for unit tests (no DB needed for validation logic testing).

2. PR #5000 -- Route tests use `.create()` with DB:
```python
def test_application_start_success(client, api_auth_token, enable_factory_create, db_session):
    today = get_now_us_eastern_date()
    future_date = today + timedelta(days=10)
    competition = CompetitionFactory.create(opening_date=today, closing_date=future_date)
    response = client.post("/alpha/applications/start", json=request_data, headers={"X-Auth": api_auth_token})
    assert response.status_code == 200
```

**Rationale:** `.build()` is faster and avoids test database overhead. Integration tests need `.create()` because the route handler queries the database.

**Open Questions:** None.

---

## Pattern 11: Shared Schemas Extracted to `shared_schema.py`

**Rule Statement:** ALWAYS extract API schemas that are used across multiple domains into `api/src/api/schemas/shared_schema.py`. NEVER duplicate schema definitions.

**Confidence:** Medium
**Frequency:** 1/10 PRs (emerging pattern)

**Code Examples:**

1. PR #5146 -- `OpportunityAssistanceListingV1Schema` moved from `opportunity_schemas.py` to `shared_schema.py` because both the competition and opportunity domains use it:
```python
# api/src/api/schemas/shared_schema.py
class OpportunityAssistanceListingV1Schema(Schema):
    program_title = fields.String(allow_none=True, metadata={...})
    assistance_listing_number = fields.String(allow_none=True, metadata={...})
```

**Rationale:** The competition schema needed `OpportunityAssistanceListingV1Schema`, which was previously defined in the opportunity module. Extracting it avoids cross-domain imports and makes the shared nature explicit.

**Open Questions:** None.

---

## Pattern 12: JSON Schema Validation for Form Responses

**Rule Statement:** ALWAYS validate application form responses against JSON Schema definitions stored on the `Form` model. ALWAYS map JSON Schema validation errors to `ValidationErrorDetail` objects for consistent error reporting.

**Confidence:** High
**Frequency:** 1/10 PRs but foundational for the form system

**Code Examples:**

1. PR #5073 -- JSON Schema validation integrated into form submission:
```python
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

**Rationale:** Two-level error reporting: top-level errors identify which forms have issues (using `APPLICATION_FORM_VALIDATION` type with the form ID in `value`), while the `form_error_map` in the response `data` field contains the specific field-level errors. This lets the frontend navigate users to the correct form and field.

**Open Questions:** None.

---

## Pattern 13: Rule Processing for Custom Validation Beyond JSON Schema

**Rule Statement:** ALWAYS use the rule processing system (`api/src/form_schema/rule_processing/`) for validation and field population logic that cannot be expressed in standard JSON Schema. Rules MUST be defined as JSON in the same shape as form responses, with rule groups (`gg_pre_population`, `gg_post_population`, `gg_validation`) at the value level.

**Confidence:** Medium
**Frequency:** 1/10 PRs (foundational new capability)

**Code Examples:**

1. PR #5264 -- Recursive rule processor:
```python
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

2. PR #5264 -- Rule schema shape documented in README:
```json
{
  "info": {
    "opportunity_number": {
      "gg_pre_population": {
        "rule": "opportunity_number"
      }
    }
  }
}
```

**Rationale:** JSON Schema cannot express cross-field validation, date ordering, or field auto-population. The rule processing system handles these using a mapper pattern that is extensible -- adding new rules only requires a new function in the mapper.

**Open Questions:** List fields are not yet supported. Cross-field validation is a planned future addition.

---

## Pattern 14: Use `logger.info()` for Expected Client Errors (4xx)

**Rule Statement:** NEVER use `logger.warning()` for expected client validation errors (4xx). ALWAYS use `logger.info()` with structured `extra={}` parameters.

**Confidence:** High
**Frequency:** 2/10 PRs (corrective); universally applicable

**Code Examples:**

1. PR #4936 -- Reviewer (chouinar) enforcing this:
> "Warning logs will alert us, we don't want to be alerted for 4xx errors."

2. PR #5146 -- Correct usage in validation function:
```python
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

**Rationale:** Warning-level logs trigger alerts in New Relic. Client validation failures are expected operational events, not system problems requiring immediate attention.

**Open Questions:** None.

---

## Pattern 15: Static Log Messages with `extra={}` for Dynamic Values

**Rule Statement:** NEVER embed dynamic values (IDs, statuses, dates) in log message strings. ALWAYS put dynamic values in the `extra={}` parameter.

**Confidence:** High
**Frequency:** 2/10 PRs (corrective); universally applicable

**Code Examples:**

1. PR #4936 -- Reviewer (chouinar) enforcing flat log keys:
> "To make it easier to look things up, we should try to avoid putting any variable text in the message as well, just make it an extra param which has the benefit of being able to easily make count charts in New Relic."

2. PR #5076 -- Correct pattern for access denial logging:
```python
logger.info(
    "User attempted to access an application they are not associated with",
    extra={
        "user_id": user.user_id,
        "application_id": application.application_id,
    },
)
```

**Rationale:** Static log messages enable consistent querying and count aggregation in New Relic. Dynamic values in `extra={}` appear as searchable attributes.

**Open Questions:** None.

---

## Anti-Patterns

### AP-1: Duplicating Validation Logic Across Services
**Rule Statement:** NEVER copy the same validation check into multiple service files. ALWAYS extract it into `application_validation.py`.
**Confidence:** High (PR #5146 -- competition-open check was duplicated in `create_application.py` and `submit_application.py`)

### AP-2: Overly Specific Error Types That Fragment Unnecessarily
**Rule Statement:** NEVER create separate error types for closely related scenarios when the frontend does not need to distinguish them. Consolidate when appropriate.
**Confidence:** High (PR #5146 -- `COMPETITION_NOT_YET_OPEN` and `COMPETITION_ALREADY_CLOSED` consolidated into `COMPETITION_NOT_OPEN`)

### AP-3: Dynamic IDs in Error Messages
**Rule Statement:** NEVER include dynamic IDs in error message strings (e.g., `f"Competition with ID {competition_id} not found"`). Use static messages (e.g., `"Competition not found"`) since the ID is already in request context logs.
**Confidence:** Medium (PR #5000 -- simplified 404 message)

### AP-4: Parametrized Tests Including Happy Path in Failure Cases
**Rule Statement:** NEVER include the expected-success case in a parametrized test for failure scenarios. Separate happy-path tests from error-case parametrizations.
**Confidence:** Medium (PR #4936 -- `IN_PROGRESS` was included in the parametrized forbidden-status test, requiring special-case handling inside the test body)
