# API Testing -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a note are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The API test suite for Simpler Grants uses pytest exclusively, with factory-boy for test data creation and real infrastructure (Postgres, OpenSearch, LocalStack) instead of mocks. The test architecture follows a clear separation between route-level integration tests (exercising the HTTP layer via the Flask test client) and service-level unit tests (calling Python functions directly). Both layers share a common foundation of factory classes, fixture conventions, and assertion patterns.

A key architectural decision is the `enable_factory_create` fixture gate: any test that needs to persist records to the database must explicitly request this fixture, which sets the internal `_db_session` on the factories module. Tests that only need in-memory objects use `Factory.build()` instead, which is faster and avoids database coupling. This build-vs-create distinction is one of the most frequently enforced conventions in code review.

The test suite follows the project-wide convention of structured logging (static messages, `extra={}` for dynamic values) and uses SQLAlchemy 2.0-style `select()` queries rather than the legacy `query()` API. Test files mirror the source directory structure, with shared utilities extracted to `tests/lib/` modules for complex domain setup (organizations, auth, database cleanup). See also: [api-validation](./api-validation.md) for validation-specific test patterns and [api-form-schema](./api-form-schema.md) for form validation test triads.

## Rules

### Factory Conventions

#### Rule: Require `enable_factory_create` Fixture for Database Writes
**Confidence:** High
**Observed in:** ~90% of all PRs with DB-touching tests | PR refs: #5064, #8584, #4406

ALWAYS request the `enable_factory_create` fixture in any test that calls `Factory.create()`. Without it, factory-boy cannot persist records to the database.

**DO:**
```python
# From PR #5064 -- correct usage with enable_factory_create in the signature
@freeze_time(TEST_DATE)
def test_application_start_with_custom_name(client, enable_factory_create, db_session):
    """Test application creation succeeds with custom application name"""
    today = get_now_us_eastern_date()
    past_opening_date = today - timedelta(days=5)
    competition = CompetitionFactory.create(opening_date=past_opening_date, closing_date=None)
```

**DON'T:**
```python
# Anti-pattern -- missing enable_factory_create fixture
def test_application_start(client, db_session):
    competition = CompetitionFactory.create(...)  # silently fails or errors
```

> **Rationale:** The `enable_factory_create` fixture sets the internal `_db_session` on the factories module so factory-boy can persist records. Without it, `Factory.create()` silently fails or errors. This is a safety gate to prevent accidental database writes in tests that should remain in-memory.

---

#### Rule: Use `Factory.build()` for In-Memory Objects
**Confidence:** High
**Observed in:** Explicitly enforced in reviewer feedback | PR refs: #8614, #4314

ALWAYS use `Factory.build()` instead of `Factory.create()` when the test does not require persisted database records. Reserve `.create()` for tests that need data queryable from the database.

**DO:**
```python
# From PR #8614 -- using .build() for in-memory-only tests
def make_application(attachments=None, forms=None):
    """Build an Application with explicit attachment and form lists.
    We set the lists directly after building because the factory's RelatedFactory
    traits hit the DB; here we just want in-memory objects.
    """
    app = ApplicationFactory.build()
    app.application_attachments = attachments or []
    app.application_forms = forms or []
    return app
```

```python
# From PR #4314 -- module-level constants using .build()
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

**DON'T:**
```python
# Anti-pattern -- using .create() when .build() would suffice
def test_validation_logic(enable_factory_create):
    form = FormFactory.create(form_json_schema={...})  # unnecessary DB write
    issues = validate_json_schema_for_form({}, form)
```

> **Rationale:** `.build()` is faster (no DB round-trip), does not require `enable_factory_create`, and keeps tests isolated from database state. Reviewer (chouinar) in PR #8614: "If we don't want anything in the DB / want to keep it simple, use `.build()`."

---

#### Rule: Never Add Redundant `db_session.commit()` After `Factory.create()`
**Confidence:** High
**Observed in:** Corrected in at least 3 PRs | PR refs: #5063, #6479

NEVER call `db_session.commit()` immediately after `Factory.create()`. The factory's `create()` method already calls `commit()` internally.

**DO:**
```python
# From PR #6479 -- correct: no commit after create
user_profile = UserProfileFactory.create(user=user, first_name="Everett", last_name="Child")
```

**DON'T:**
```python
# Anti-pattern -- redundant commit (from PR #6479, reviewer correction)
user_profile = UserProfileFactory.create(user=user, first_name="Everett", last_name="Child")
db_session.commit()  # redundant: Factory.create() already commits
```

> **Rationale:** Redundant commits are a no-op at best and can cause subtle transaction issues at worst. They also obscure the actual transaction boundaries, making the test harder to reason about. Reviewer (chouinar) in PR #6479: "Factory create calls commit, don't need to add it."

---

### Test Structure

#### Rule: Use Standalone Test Functions by Default
**Confidence:** High
**Observed in:** ~80% of new test files | PR refs: #6479, #4406

ALWAYS write tests as standalone `def test_*()` functions unless the tests require shared expensive setup (e.g., search indexes, class-scoped fixtures). Use test classes only when inheriting from `BaseTestClass` or when multiple tests share `scope="class"` fixtures.

**DO:**
```python
# From PR #6479 -- standalone functions (the predominant pattern)
def test_user_update_profile_new(client, db_session, user_auth_token, user):
    response = client.put(
        f"/v1/users/{user.user_id}/profile",
        headers={"X-SGG-Token": user_auth_token},
        json={"first_name": "Henry", "last_name": "Ford"},
    )
    assert response.status_code == 200

def test_user_update_profile_unauthorized(client, db_session, user_auth_token, user):
    user_id = uuid4()
    response = client.put(
        f"/v1/users/{user_id}/profile",
        headers={"X-SGG-Token": user_auth_token},
        json={"first_name": "Henry"},
    )
    assert response.status_code == 403
```

**DON'T:**
```python
# Anti-pattern -- using a class when standalone functions suffice
class TestUserProfile:
    def test_update_new(self, client, user_auth_token, user):
        ...
    def test_update_unauthorized(self, client, user_auth_token, user):
        ...
# Unnecessary class wrapper; no shared setup to justify it
```

> **Rationale:** Standalone functions are simpler, more explicit about their dependencies (via fixture arguments), and integrate better with pytest's fixture injection. Classes add indirection without benefit unless expensive setup needs to be shared.

---

#### Rule: Standard Route Test Structure (Arrange-Act-Assert with Status Code First)
**Confidence:** High
**Observed in:** Universal across all route test files | PR refs: #7775, #5063, #4346

ALWAYS structure route/endpoint tests as: (1) create test data via factories, (2) make HTTP request via `client.get/post/put()`, (3) assert status code first, (4) assert response body via `resp.get_json()["data"]`. ALWAYS convert UUIDs to strings when comparing with JSON response values.

**DO:**
```python
# From PR #7775 -- standard pattern with UUID conversion
def test_opportunity_get_success_with_jwt_auth(client, user_auth_token):
    opportunity = OpportunityFactory.create()
    response = client.get(
        f"/v1/opportunities/{opportunity.opportunity_id}",
        headers={"X-SGG-Token": user_auth_token},
    )
    assert response.status_code == 200
    assert response.get_json()["message"] == "Success"
    assert response.get_json()["data"]["opportunity_id"] == str(opportunity.opportunity_id)
```

**DON'T:**
```python
# Anti-pattern -- checking body before status code
def test_opportunity_get(client, api_auth_token):
    opportunity = OpportunityFactory.create()
    response = client.get(f"/v1/opportunities/{opportunity.opportunity_id}", ...)
    assert response.get_json()["data"]["opportunity_id"] == str(opportunity.opportunity_id)
    assert response.status_code == 200  # status code check after body -- harder to debug
```

> **Rationale:** Consistent structure makes tests scannable. Checking the status code first provides immediate signal on what kind of failure occurred. UUID-to-string conversion is necessary because JSON serialization converts all UUIDs to strings.

---

#### Rule: Separate Service-Layer Tests from Route Tests
**Confidence:** High
**Observed in:** Growing pattern, consistently applied in 2025-2026 PRs | PR refs: #8584, #7818, #5073

ALWAYS create dedicated test files for service-layer logic separate from route/endpoint tests. Service tests call the Python function directly and use `pytest.raises` for errors. Route tests exercise the HTTP layer via `client` and check status codes.

**DO:**
```python
# From PR #8584 -- two separate test files for the same feature

# api/tests/src/api/workflows/test_workflow_routes.py (route-level):
def test_start_workflow_integration(client, user_auth_token, enable_factory_create):
    opportunity = OpportunityFactory.create()
    payload = {"event_type": WorkflowEventType.START_WORKFLOW, ...}
    response = client.put(
        "/v1/workflows/events", json=payload, headers={"X-SGG-Token": user_auth_token}
    )
    assert response.status_code == 200

# api/tests/src/services/workflows/test_ingest_workflow_event.py (service-level):
def test_start_workflow_entity_not_found(db_session: db.Session):
    payload = {"event_type": WorkflowEventType.START_WORKFLOW, ...}
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 404
```

**DON'T:**
```python
# Anti-pattern -- testing service logic only through the HTTP layer
def test_workflow_entity_not_found(client, user_auth_token):
    response = client.put("/v1/workflows/events", json=payload, headers=...)
    assert response.status_code == 404
# Loses granularity: cannot easily distinguish between routing errors and service errors
```

> **Rationale:** Service tests are faster (no HTTP overhead), provide more granular error testing, and test business logic in isolation. Route tests verify the HTTP contract, auth, serialization, and end-to-end integration.

---

### Authentication in Tests

#### Rule: Authentication Header Conventions
**Confidence:** High
**Observed in:** Universal | PR refs: #7775, #6479

For new endpoint tests, ALWAYS use `headers={"X-API-Key": user_api_key_id}` for general access or `headers={"X-SGG-Token": user_auth_token}` for user-authenticated endpoints. NEVER use the legacy `headers={"X-Auth": api_auth_token}` in new tests. When updating existing endpoints to support multiple auth types, test each auth mechanism separately.

**DO:**
```python
# From PR #7775 -- new pattern: X-API-Key for general access
resp = client.get(
    f"/v1/opportunities/{db_opportunity.opportunity_id}",
    headers={"X-API-Key": user_api_key_id}
)

# From PR #6479 -- JWT for user-authenticated endpoints
response = client.put(
    f"/v1/users/{user.user_id}/profile",
    headers={"X-SGG-Token": user_auth_token},
    json={"first_name": "Henry", "last_name": "Ford"},
)
```

**DON'T:**
```python
# Anti-pattern -- using legacy auth in new tests (from PR #7775, before migration)
resp = client.get(
    f"/v1/opportunities/{db_opportunity.opportunity_id}",
    headers={"X-Auth": api_auth_token}  # deprecated; creates technical debt
)
```

> **Rationale:** The project is migrating from a single shared environment API key (`X-Auth`) to per-user API keys (`X-API-Key`) and JWT tokens (`X-SGG-Token`). New tests should use the current auth mechanisms to avoid creating technical debt.

---

### Framework and Query Style

#### Rule: Use pytest, Not unittest
**Confidence:** High
**Observed in:** Explicitly corrected | PR refs: #4346

ALWAYS use pytest conventions (fixtures, `pytest.raises`, standalone functions or plain classes). NEVER use `unittest.TestCase` or `setUp()`/`tearDown()` methods.

**DO:**
```python
# From PR #4346 -- corrected to pytest style
class TestSOAPClient:
    @pytest.fixture(scope="class")
    def legacy_soap_client(self):
        return LegacySOAPClient()

    def test_can_instantiate(self, legacy_soap_client) -> None:
        assert isinstance(legacy_soap_client, LegacySOAPClient)
```

**DON'T:**
```python
# Anti-pattern -- unittest style (from PR #4346, before correction)
class TestSOAPClient(unittest.TestCase):
    def setUp(self):
        self.client = LegacySOAPClient()

    def test_can_instantiate(self):
        self.assertIsInstance(self.client, LegacySOAPClient)
```

> **Rationale:** Mixing test frameworks creates unpredictable behavior. pytest fixtures and markers provide superior dependency injection and parametrization compared to unittest's inheritance-based setup. Reviewer (chouinar) in PR #4346: "I'd caution against using unittest, we use pytest for everything, and I don't know what behavior we would expect by mixing them."

---

#### Rule: Use SQLAlchemy 2.0 `select()` Style, Not `query()`
**Confidence:** High
**Observed in:** Explicitly corrected | PR refs: #6479

ALWAYS use `db_session.execute(select(Model).where(...)).scalar_one_or_none()` instead of `db_session.query(Model).filter(...).first()`. This applies to both production code and test assertions.

**DO:**
```python
# From PR #6479 -- correct 2.0 pattern
user_profile = db_session.execute(
    select(UserProfile).where(UserProfile.user_id == user_id)
).scalar_one_or_none()
```

**DON'T:**
```python
# Anti-pattern -- old SQLAlchemy query API (from PR #6479, reviewer correction)
res = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()
```

> **Rationale:** SQLAlchemy's `query()` API is the legacy ("1.x") approach. The `select()` API is the officially recommended modern approach. Using `scalar_one_or_none()` is also more precise than `.first()` when you expect exactly zero or one result. Reviewer (chouinar) in PR #6479: "Using select is the newer way, and while `query` isn't deprecated, SQLAlchemy refers to it as the old way."

---

### Error Testing

#### Rule: Test Both Success and Error Paths
**Confidence:** High
**Observed in:** Common across all route test files | PR refs: #8584, #7818

ALWAYS include tests for both happy path (200/201) and error paths (401, 403, 404, 422) when testing API endpoints. Each distinct error scenario SHOULD have its own test function.

**DO:**
```python
# From PR #8584 -- separate functions for each error type
def test_start_workflow_entity_not_found(db_session: db.Session):
    """Test that a 404 error is raised when opportunity doesn't exist."""
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "The specified resource was not found"

def test_start_workflow_invalid_workflow_type(db_session: db.Session):
    """Test that a 422 error is raised when workflow type is not configured."""
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 422
    assert exc_info.value.message == "Invalid workflow type specified"

def test_start_workflow_valid_entity(db_session: db.Session, enable_factory_create):
    """Test that validation passes when entity exists."""
    opportunity = OpportunityFactory.create()
    event_id = ingest_workflow_event(db_session, payload)
    assert event_id is not None
```

**DON'T:**
```python
# Anti-pattern -- only testing the happy path
def test_start_workflow(db_session, enable_factory_create):
    opportunity = OpportunityFactory.create()
    event_id = ingest_workflow_event(db_session, payload)
    assert event_id is not None
# Missing: 404, 422, 403 error path tests
```

> **Rationale:** Tests that only cover the happy path miss regressions in error handling, validation, and authorization logic. Each error type warrants its own test for clarity and debuggability.

---

#### Rule: Use `pytest.raises` with `exc_info.value.message` for APIFlask Errors
**Confidence:** High
**Observed in:** Discovered and documented in PR #8584 | PR refs: #8584

When testing for APIFlask `HTTPError` exceptions, ALWAYS check the error via `exc_info.value.status_code` and `exc_info.value.message`. NEVER rely on the `match` parameter of `pytest.raises` for APIFlask errors, because `str(HTTPError)` returns an empty string.

**DO:**
```python
# From PR #8584 -- correct pattern
with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
    ingest_workflow_event(db_session, payload)
assert exc_info.value.status_code == 404
assert exc_info.value.message == "The specified resource was not found"
```

**DON'T:**
```python
# Anti-pattern -- match parameter does not work with APIFlask HTTPError
with pytest.raises(apiflask.exceptions.HTTPError, match="do not match") as exc_info:
    ingest_workflow_event(db_session, payload)
# match checks str(exception), but str(HTTPError) returns an empty string
```

> **Rationale:** APIFlask's `HTTPError` does not implement `__str__()` in a way compatible with `pytest.raises(match=...)`. The `match` parameter checks against the exception's string representation, but APIFlask stores the message in a `.message` attribute instead. Author (kkrug) in PR #8584 documented this framework quirk.

---

### Test Data and Cleanup

#### Rule: Avoid Unnecessary Table Truncation
**Confidence:** High
**Observed in:** Explicitly enforced | PR refs: #6479, #4406

NEVER add `cascade_delete_from_db_table` or table truncation fixtures unless the test specifically requires a clean-slate table (e.g., batch processing tasks that scan entire tables). Each test SHOULD create its own data and rely on transaction isolation.

**DO:**
```python
# From PR #4406 -- legitimate use: task that processes ALL agencies in table
def test_load_agencies_to_index(self, db_session, search_client, ...):
    cascade_delete_from_db_table(db_session, Agency)
    agencies = [AgencyFactory.create(agency_code="DOD")]
    agencies.extend(AgencyFactory.create_batch(size=5, top_level_agency=agencies[0]))
    load_agencies_to_index.run()
```

**DON'T:**
```python
# Anti-pattern -- unnecessary cleanup (from PR #6479, reviewer correction)
@pytest.fixture(autouse=True)
def clean_users(db_session):
    cascade_delete_from_db_table(db_session, User)  # slow and unnecessary
    yield
```

> **Rationale:** Table truncation is slow and can hide test isolation problems. Most tests create their own data and should not depend on or be affected by data from other tests. Reviewer (chouinar) in PR #6479: "I don't think we would need this, presumably any users we need in the tests would be created during the test? These deletes are slow."

---

#### Rule: Use `pytest.mark.parametrize` for Input Variations
**Confidence:** High
**Observed in:** Moderate but consistently applied | PR refs: #4314, #8584

ALWAYS use `@pytest.mark.parametrize` when testing the same logic with multiple input combinations rather than duplicating test functions. Include descriptive comments for each parameter set.

**DO:**
```python
# From PR #4314 -- parametrized validation warning tests
@pytest.mark.parametrize(
    "application_response,expected_warnings",
    [
        # Missing required field
        ({}, [{"field": "$", "message": "'name' is a required property", "type": "required"}]),
        # Validation on age field
        (
            {"name": "bob", "age": 500},
            [{"field": "$.age", "message": "500 is greater than the maximum of 200", "type": "maximum"}],
        ),
        # Extra fields are fine with our setup
        ({"name": "bob", "age": 50, "something_else": ""}, []),
    ],
)
def test_application_form_update_with_validation_warnings(
    client, enable_factory_create, db_session, api_auth_token,
    application_response, expected_warnings,
):
```

**DON'T:**
```python
# Anti-pattern -- duplicating the same test for each input
def test_form_update_missing_required():
    ...
def test_form_update_age_too_high():
    ...
def test_form_update_extra_fields():
    ...
# Same assertion structure repeated three times
```

> **Rationale:** Parametrize reduces code duplication and makes it easy to add new test cases. The test framework runs each parameter set as a distinct test, so failures are individually identifiable.

---

### Naming and Organization

#### Rule: Descriptive Test Names Encoding Scenario and Status Code
**Confidence:** High
**Observed in:** ~90% of route tests | PR refs: #7775, #8584

ALWAYS name route tests with the format `test_<resource>_<action>_<scenario>_<status_code>` (e.g., `test_get_opportunity_404_not_found_is_draft`). For service-layer tests, use `test_<action>_<scenario>` with the scenario describing the expected outcome.

**DO:**
```python
# From PR #7775 -- route test naming with status codes
test_get_opportunity_200
test_get_opportunity_with_attachment_200
test_get_opportunity_404_not_found
test_get_opportunity_404_not_found_is_draft

# From PR #8584 -- service test naming with scenarios
test_start_workflow_entity_not_found
test_start_workflow_invalid_workflow_type
test_start_workflow_valid_entity
test_process_workflow_workflow_not_found
```

**DON'T:**
```python
# Anti-pattern -- vague test names
test_opportunity_1
test_opportunity_2
test_workflow_error
```

> **Rationale:** Descriptive names make test failures self-documenting. Including the status code in route test names immediately tells you what HTTP response was expected.

---

#### Rule: Move Helpers and Constants to Top of File (timesaver)
**Confidence:** Medium
**Observed in:** Explicitly corrected | PR refs: #8614, #4314

ALWAYS define test helper functions, constants, and module-level factory builds at the top of the test file, before any test functions or classes. NEVER interleave helper definitions between tests.

**DO:**
```python
# From PR #8614 -- helper functions at top
def make_form(application_response, attachment_fields=None):
    """Build an ApplicationForm with controlled response and attachment_fields."""
    ...

def make_application(attachments=None, forms=None):
    """Build an Application with explicit attachment and form lists."""
    ...

FAKE_HASH = "ZmFrZWhhc2g="

# Tests follow below...
class TestCollectReferencedAttachmentIds:
    ...
```

**DON'T:**
```python
# Anti-pattern -- helpers interleaved between tests
def test_first_thing():
    ...

def helper_for_second_thing():  # helper buried between tests
    ...

def test_second_thing():
    ...
```

> **Rationale:** Placing helpers at the top makes them easy to find, avoids confusion about where definitions live, and keeps the test function section clean and sequential. Reviewer (chouinar) in PR #8614: "Could we move this to the top of the file, not between other tests?"

---

#### Rule: Section Headers in Large Test Files (timesaver)
**Confidence:** Medium
**Observed in:** Common in larger test files | PR refs: #7775, #8584

In test files with many tests covering different aspects of a feature, use comment banners to group related tests into visual sections.

**DO:**
```python
# From PR #8584 -- section headers grouping related tests
# ========================================
# Start Workflow Validation Tests
# ========================================

def test_start_workflow_entity_not_found(...):
    ...

# ========================================
# Process Workflow Validation Tests
# ========================================

def test_process_workflow_workflow_not_found(...):
    ...
```

**DON'T:**
```python
# Anti-pattern -- 20+ test functions with no visual grouping
def test_start_workflow_entity_not_found(...):
def test_start_workflow_invalid_type(...):
def test_process_workflow_not_found(...):
def test_process_workflow_inactive(...):
# Hard to scan and find the test you're looking for
```

> **Rationale:** In files with 10+ test functions, section headers improve navigability and make it clear which tests are conceptually grouped.

---

### Fixtures and Resources

#### Rule: Session-Scoped Fixtures for Expensive Resources
**Confidence:** High
**Observed in:** Universal in search/OpenSearch tests and auth setup | PR refs: #4406

ALWAYS use `scope="session"` for fixtures that create expensive or shared resources (OpenSearch clients, search index aliases, RSA key pairs for JWT). Use `monkeypatch_session` (not `monkeypatch`) for environment variables needed across the session.

**DO:**
```python
# From PR #4406 -- session-scoped search index alias
@pytest.fixture(scope="session")
def agency_index_alias(search_client, monkeypatch_session):
    alias = f"test-agency-index-alias-{uuid.uuid4().int}"
    monkeypatch_session.setenv("AGENCY_SEARCH_INDEX_ALIAS", alias)
    return alias
```

```python
# From conftest.py -- session-scoped search client with cleanup
@pytest.fixture(scope="session")
def search_client() -> search.SearchClient:
    client = search.SearchClient()
    try:
        yield client
    finally:
        client.delete_index("test-*")
```

**DON'T:**
```python
# Anti-pattern -- creating expensive resources per test
@pytest.fixture
def search_client():
    client = search.SearchClient()  # slow: created for every single test
    yield client
    client.delete_index("test-*")
```

> **Rationale:** Creating search clients, generating RSA keys, and setting up index aliases are slow operations. Session scoping ensures they happen once per test run rather than once per test or once per module.

---

### Infrastructure and Mocking

#### Rule: Real Infrastructure Over Mocks
**Confidence:** High
**Observed in:** ~90% of tests | PR refs: #4346, #8614

ALWAYS test against real infrastructure (Postgres via Docker, OpenSearch via Docker, LocalStack for S3) rather than mocking database or search operations. ONLY mock external third-party services (login.gov OAuth, AWS Pinpoint, external HTTP APIs) and use `monkeypatch` for environment variable configuration.

**DO:**
```python
# From PR #4346 -- testing against real mock SOAP service
def test_successful_request(client, fixture_from_file) -> None:
    full_path = "/grantsws-applicant/services/v2/ApplicantWebServicesSoapPort"
    mock_data = fixture_from_file(fixture_path)
    response = client.post(full_path, data=mock_data)
    assert response.status_code == 200
```

**DON'T:**
```python
# Anti-pattern -- mocking the database layer
@patch("src.db.session.execute")
def test_get_opportunity(mock_execute):
    mock_execute.return_value = MockResult(...)
    # Misses real SQL/ORM behavior, false sense of coverage
```

> **Rationale:** Tests against real infrastructure catch integration bugs that mocks would miss. The Docker-based test environment (Postgres, OpenSearch, LocalStack) provides production-faithful behavior. Mocking is reserved for services that are impractical to run locally.

---

### Task Testing

#### Rule: Task Metrics Assertions
**Confidence:** High
**Observed in:** Common for all task tests | PR refs: #9082, #4406

When testing background tasks that inherit from the `Task` base class, ALWAYS assert expected values from `task.metrics[task.Metrics.METRIC_NAME]` to verify the task processed the expected number of records.

**DO:**
```python
# From PR #9082 -- asserting task metrics after run
assert task.metrics[task.Metrics.OPPORTUNITY_CREATED_COUNT] == 20
assert task.metrics[task.Metrics.OPPORTUNITY_ALREADY_EXIST_COUNT] == 0

# If we rerun the task, all opportunities should be skipped
task = BuildAutomaticOpportunities(db_session, form_ids)
task.run()
assert task.metrics[task.Metrics.OPPORTUNITY_CREATED_COUNT] == 0
assert task.metrics[task.Metrics.OPPORTUNITY_ALREADY_EXIST_COUNT] == 20
```

**DON'T:**
```python
# Anti-pattern -- verifying task behavior only by querying the DB
task.run()
count = db_session.execute(select(func.count()).select_from(Opportunity)).scalar()
assert count == 20
# Misses the task's own accounting; doesn't verify skip/duplicate handling
```

> **Rationale:** Metrics provide a structured, declarative way to verify that tasks processed the expected volume of data. They also serve as documentation of what the task is supposed to accomplish.

---

### Shared Utilities

#### Rule: Shared Test Utility Modules for Complex Domains (timesaver)
**Confidence:** Medium
**Observed in:** Growing pattern | PR refs: #6505

When multiple test files need the same setup logic (especially complex factory orchestration like creating users with roles/privileges in organizations), extract that logic into a shared utility module under `tests/lib/`. ALWAYS add a docstring explaining the utility's purpose.

**DO:**
```python
# From PR #6505 -- tests/lib/organization_test_utils.py
def create_user_in_org(
    privileges: list[Privilege], db_session,
    is_organization_owner: bool = True, organization=None, sam_gov_entity=None, **kwargs
) -> tuple:
    """Create a user in an organization with specified privileges.
    This utility function reduces the boilerplate of creating a user, organization,
    role, and all the necessary relationships for testing organization endpoints.
    Returns:
        tuple: (user, organization, token)
    """
    user = UserFactory.create()
    LinkExternalUserFactory.create(user=user)
    if organization is None:
        organization = OrganizationFactory.create(...)
    if privileges:
        role = RoleFactory.create(privileges=privileges, is_org_role=True)
        org_user = OrganizationUserFactory.create(user=user, organization=organization, ...)
        OrganizationUserRoleFactory.create(organization_user=org_user, role=role)
    token, _ = create_jwt_for_user(user, db_session)
    db_session.commit()
    return user, organization, token
```

**DON'T:**
```python
# Anti-pattern -- copy-pasting the same 15-line setup in every test file
def test_org_endpoint_1(db_session, enable_factory_create):
    user = UserFactory.create()
    LinkExternalUserFactory.create(user=user)
    organization = OrganizationFactory.create(...)
    role = RoleFactory.create(...)
    # ... 10 more lines duplicated across 5 test files
```

> **Rationale:** Complex setup logic (especially involving roles, privileges, and organization membership) is error-prone when duplicated. Shared utilities ensure consistency and reduce the cognitive load of writing tests in complex domains.

---

## Anti-Patterns

### AP-1: Hardcoding Values That Should Come from the Factory
**Confidence:** High (PR #5368)

Tests that hardcode values like `uei="TEST123456789"` when the factory generates them are corrected. After PR #5368, tests were updated to use `sam_gov_entity.uei` instead of hardcoded strings.

### AP-2: Using `db_session.query()` Instead of `select()`
**Confidence:** High (PR #6479)

The old SQLAlchemy query API is flagged for replacement with the 2.0-style `select()` + `execute()` pattern. Existing tests using `query()` have not all been migrated.

### AP-3: Mixing unittest and pytest
**Confidence:** High (PR #4346)

Using `unittest.TestCase` with `setUp()` instead of pytest fixtures/classes is explicitly discouraged. Some SOAP-related tests (PR #5941) may still use unittest patterns.

### AP-4: Over-Cleaning Test Data
**Confidence:** High (PR #6479)

Table truncation fixtures that aren't needed (because test isolation is already handled by transaction rollback or because each test creates its own data) are flagged as unnecessary performance costs.

### AP-5: Missing Return in Factory `_build` Override
**Confidence:** Medium (PR #8614)

PR #8614 found and fixed a missing `return` in `ApplicationAttachmentFactory._build()` that caused `.build()` to return `None`. This is a subtle factory_boy anti-pattern to watch for when overriding `_build` or `_create`.

---

## Known Inconsistencies

- **Auth header migration incomplete:** The migration from `X-Auth` to `X-API-Key`/`X-SGG-Token` is ongoing. Older test files still use the legacy header. No lint rule or deprecation warning exists for `api_auth_token`.
- **Section header style:** Two banner styles (`####` and `====`) are both used in test files. No standard has been chosen.
- **unittest remnants:** Some SOAP-related tests may still use unittest patterns despite the pytest-only convention.
- **`query()` vs `select()` migration:** Not all existing tests have been migrated to the SQLAlchemy 2.0 query style. No codemod or linting rule enforces this yet.

---

## Related Documents

- [api-validation](./api-validation.md) -- Validation error types, `freeze_time` patterns, `raise_flask_error` usage in tests
- [api-form-schema](./api-form-schema.md) -- Form validation test triad (minimal/full/empty), factory-based form test data setup
- Cross-domain synthesis: CCP-3 (Factory Pattern), CCP-1 (Structured Logging in test-adjacent code), CCP-5 (Service Layer Separation reflected in test organization)
