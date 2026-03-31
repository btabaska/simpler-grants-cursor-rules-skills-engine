# API Testing Patterns -- Pattern Discovery Document

**Source:** 519 merged PRs from HHS/simpler-grants-gov touching `api/tests/`
**Date range:** ~2025-03-28 to 2026-03-18
**Analysis date:** 2026-03-27

---

## 1. Test Structure Patterns

### 1.1 Prefer pytest Functions Over Test Classes
**Frequency:** ~80% of new test files use standalone functions; classes used for specific scenarios
**Confidence:** High
**Trend:** Stable throughout the period

Most endpoint tests and service tests are written as standalone `def test_*()` functions. Test classes (inheriting from `BaseTestClass` or using plain classes) are used primarily when:
- Tests share expensive setup data (e.g., search index fixtures) that benefit from `scope="class"`
- Tests need shared cleanup via `BaseTestClass.truncate_tables`

Standalone function examples: PRs #5064, #6479, #8584
Class-based examples: PRs #4230 (`TestOpportunityRouteSearch`), #4383 (`TestLoadOracleData`), #4406

**Key convention:** When a class is used, fixtures are scoped to `scope="class"` and attached via `autouse=True`.

### 1.2 Test File Organization Mirrors Source Structure
**Frequency:** Universal
**Confidence:** High

Test files follow the source tree: `api/tests/src/api/opportunities_v1/test_opportunity_route_get.py` tests code in `api/src/api/opportunities_v1/`. Service-layer tests go in `api/tests/src/services/`, task tests in `api/tests/src/task/`, etc.

### 1.3 Descriptive Test Names with Scenario and Status Code
**Frequency:** ~90% of route tests
**Confidence:** High

Route/endpoint tests encode the HTTP status code and scenario:
- `test_get_opportunity_200`
- `test_get_opportunity_with_attachment_200`
- `test_application_start_with_custom_name`
- `test_workflow_event_put_unauthorized`
- `test_user_update_profile_new`

PRs #5063, #6479, #7775

### 1.4 Section Headers in Test Files
**Frequency:** Common in larger test files
**Confidence:** Medium

Files use comment banners to group tests:
```python
#####################################
# GET opportunity tests
#####################################
```
or
```python
# ========================================
# Start Workflow Validation Tests
# ========================================
```
PRs #7775, #8584

---

## 2. Fixture Patterns

### 2.1 `enable_factory_create` Fixture is Required for DB Writes
**Frequency:** Nearly every test that creates DB records
**Confidence:** High
**Trend:** Stable, universal convention

Any test that calls `Factory.create()` must request the `enable_factory_create` fixture. This fixture sets the internal `_db_session` on the factories module so factory-boy can persist records. Without it, factories cannot write to the database.

PRs #4314, #4361, #5064, #6505 -- virtually every PR with DB-touching tests.

### 2.2 Session-Scoped Fixtures for Expensive Resources
**Frequency:** All search/OpenSearch tests, shared auth setup
**Confidence:** High

Expensive resources (OpenSearch clients, search indexes, RSA keys for JWT) use `scope="session"`:
```python
@pytest.fixture(scope="session")
def search_client() -> search.SearchClient:
    client = search.SearchClient()
    try:
        yield client
    finally:
        client.delete_index("test-*")
```

Index aliases also use session scope with `monkeypatch_session`:
```python
@pytest.fixture(scope="session")
def opportunity_index_alias(search_client, monkeypatch_session):
    alias = f"test-opportunity-index-alias-{uuid.uuid4().int}"
    monkeypatch_session.setenv("OPPORTUNITY_SEARCH_INDEX_ALIAS", alias)
    return alias
```

PRs #4230, #4406

### 2.3 Top-Level conftest.py Provides Common Fixtures
**Frequency:** Universal
**Confidence:** High

`api/tests/conftest.py` provides foundational fixtures used across all test files:
- `db_session` -- database session
- `client` -- Flask test client
- `api_auth_token` -- legacy API authentication token
- `user_auth_token` / `user` -- JWT-authenticated user
- `user_api_key` / `user_api_key_id` -- new API key auth
- `internal_admin_user` / `internal_admin_user_api_key` -- internal admin with elevated privileges
- `enable_factory_create` -- enables factory persistence
- `search_client` -- OpenSearch client
- `s3_config` -- S3/localstack configuration
- `fixture_from_file` -- reads fixture files from `api/tests/fixtures/`

PRs #4346, #6820, #5952

### 2.4 Module-Scoped conftest.py for Domain-Specific Fixtures
**Frequency:** Common in larger test domains
**Confidence:** Medium

Subdirectories like `api/tests/src/task/forms/conftest.py` define domain-specific autouse fixtures:
```python
@pytest.fixture(autouse=True)
def non_local_api_auth_token(monkeypatch_module):
    monkeypatch_module.setenv("NON_LOCAL_API_AUTH_TOKEN", "fake-auth-token")
```

PRs #6820

---

## 3. Factory Patterns (factory_boy)

### 3.1 Extensive Use of factory_boy Factories
**Frequency:** Universal for DB model creation
**Confidence:** High

All DB models have corresponding factories in `api/tests/src/db/models/factories.py`. This is a single, large file containing all factories. New models always get a factory added in the same PR.

Conventions:
- Factories extend `BaseFactory`
- Abstract base factories for shared models (e.g., `TsynopsisAttachmentFactory` with `abstract = True`)
- `factory.SubFactory` for relationships
- `factory.LazyAttribute` for derived fields
- `factory.Sequence` for unique counters
- `factory.Faker` for realistic data
- Custom providers (e.g., `CustomProvider`) for domain-specific fakes

PRs #4361, #5368, #5949

### 3.2 `.build()` vs `.create()` Distinction
**Frequency:** Common, increasingly enforced
**Confidence:** High
**Trend:** Growing awareness over time

- `.create()` persists to DB (requires `enable_factory_create`)
- `.build()` creates in-memory only (no DB needed)

Reviewer feedback explicitly recommends `.build()` when DB persistence is unnecessary:
> "If we don't want anything in the DB / want to keep it simple, use `.build()`" (PR #8614, chouinar)

Test data constants also use `.build()`:
```python
SIMPLE_FORM = FormFactory.build(form_json_schema={...})
```

PRs #4314, #8614

### 3.3 `_setup_next_sequence` for ID Conflict Avoidance
**Frequency:** Occasional, specific to staging factories
**Confidence:** Medium

Some factories override `_setup_next_sequence` to start IDs at high numbers to avoid conflicts:
```python
@classmethod
def _setup_next_sequence(cls):
    return 100000
```

PR #4361

### 3.4 Factory `create()` Calls Commit Automatically
**Frequency:** Universal understanding
**Confidence:** High

Reviewers consistently remind contributors that `Factory.create()` already commits:
> "Factory create calls commit, don't need to add it." (PR #6479, chouinar)
> "`create` already has a commit built in." (PR #5063, chouinar)

---

## 4. Assertion Patterns

### 4.1 Direct Response JSON Assertions
**Frequency:** Universal for route tests
**Confidence:** High

Standard pattern for endpoint tests:
```python
resp = client.get(f"/v1/opportunities/{opp.opportunity_id}", headers={"X-API-Key": key_id})
assert resp.status_code == 200
response_data = resp.get_json()["data"]
assert response_data["opportunity_id"] == str(opp.opportunity_id)
```

Key conventions:
- Always check `status_code` first
- Access data via `resp.get_json()["data"]`
- UUIDs require `str()` conversion when comparing to response strings
- Message assertions: `assert response.json["message"] == "Success"`

PRs #5063, #6461, #7775

### 4.2 Validation Helper Functions
**Frequency:** Common in complex domains
**Confidence:** Medium

Shared validation functions live in conftest or utility modules:
```python
def validate_opportunity(db_opportunity: Opportunity, resp_opportunity: dict):
    assert str(db_opportunity.opportunity_id) == resp_opportunity["opportunity_id"]
    assert db_opportunity.opportunity_number == resp_opportunity["opportunity_number"]
```

PRs #5063 (conftest.py `validate_opportunity`), #4361 (`validate_copied_value`)

### 4.3 pytest.raises for Error Cases
**Frequency:** Common for service-layer error tests
**Confidence:** High

```python
with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
    ingest_workflow_event(db_session, payload)
assert exc_info.value.status_code == 404
assert exc_info.value.message == "The specified resource was not found"
```

Note: `match` parameter in `pytest.raises` does NOT work with APIFlask's HTTPError (it checks `str(exception)` which is empty). Use `exc_info.value.message` instead.

PRs #8584, #7818

### 4.4 Task Metrics Assertions
**Frequency:** Common for background task tests
**Confidence:** High

Tasks track metrics via `task.metrics` dict, and tests validate counts:
```python
assert task.metrics[task.Metrics.OPPORTUNITY_CREATED_COUNT] == 20
assert task.metrics[task.Metrics.OPPORTUNITY_ALREADY_EXIST_COUNT] == 0
```

PRs #4383, #9082, #8587

---

## 5. Test Database Patterns

### 5.1 `cascade_delete_from_db_table` for Table Cleanup
**Frequency:** Common in tests that need a clean slate
**Confidence:** High

Used to truncate tables before or after tests, respecting foreign key relationships:
```python
cascade_delete_from_db_table(db_session, Competition)
cascade_delete_from_db_table(db_session, Opportunity)
```

PRs #4406, #5649

### 5.2 Avoid Unnecessary Table Truncation
**Frequency:** Reviewer feedback pattern
**Confidence:** High
**Trend:** Increasingly enforced

Reviewers push back on unnecessary cleanup:
> "I don't think we would need this, presumably any users we need in the tests would be created during the test? These deletes are slow and unless our tests absolutely need them (like jobs that process data across an entire table), we should avoid them." (PR #6479, chouinar)

### 5.3 `db_session.begin()` / Transaction Context
**Frequency:** Implicit in most tests via fixtures
**Confidence:** Medium

Tests that directly manipulate the DB often use `db_session.commit()` to end transactions before calling code that starts its own:
```python
db_session.commit()  # commit to end any existing transactions as run_subtask starts a new one
transform_agency.run_subtask()
```

### 5.4 Use `select()` Over `query()` (SQLAlchemy 2.0 Style)
**Frequency:** Reviewer feedback
**Confidence:** High
**Trend:** Actively enforced

Reviewers correct usage of `db_session.query()` in favor of the newer `select()` API:
> "Could we do `one_or_none` + use select? First implies we expect more than 1 to be possible... Using select is the newer way, and while `query` isn't deprecated, SQLAlchemy refers to it as the old way." (PR #6479, chouinar)

---

## 6. Mock Patterns

### 6.1 Minimal Mocking -- Test Against Real DB and Services
**Frequency:** ~90% of tests
**Confidence:** High

The project overwhelmingly tests against real infrastructure (Postgres via Docker, OpenSearch via Docker, LocalStack for S3). Mocking is rare and limited to:
- External services (login.gov OAuth via `MockLoginGovOauthClient`)
- AWS Pinpoint email sending (mock responses)
- S3 pre-signed URLs (via `mock.patch`)
- Environment variables (via `monkeypatch`)

PRs #4346, #6820

### 6.2 `monkeypatch` for Environment Variables
**Frequency:** Very common
**Confidence:** High

Environment variable configuration is controlled via `monkeypatch.setenv()`:
```python
monkeypatch_session.setenv("OPPORTUNITY_SEARCH_INDEX_ALIAS", alias)
monkeypatch.setenv("SOAP_ENABLE_VERBOSE_LOGGING", "0")
```

Session-scoped monkeypatching uses `monkeypatch_session` fixture.

PRs #5941, #6820

### 6.3 `freezegun.freeze_time` for Time-Dependent Tests
**Frequency:** Moderate, for date-sensitive logic
**Confidence:** Medium

```python
@freeze_time(TEST_DATE)
def test_application_start_with_custom_name(client, enable_factory_create, db_session):
```

PR #5073

---

## 7. API Test / Route Test Patterns

### 7.1 Standard Route Test Structure
**Frequency:** Universal for endpoint tests
**Confidence:** High

Every route test follows this pattern:
1. Create test data via factories
2. Make HTTP request via `client.get/post/put()`
3. Assert status code
4. Assert response body

```python
def test_form_get_200(client, user_api_key_id, enable_factory_create):
    form = FormFactory.create()
    resp = client.get(f"/alpha/forms/{form.form_id}", headers={"X-API-Key": user_api_key_id})
    assert resp.status_code == 200
    response_form = resp.get_json()["data"]
    assert response_form["form_id"] == str(form.form_id)
```

PRs #6820, #5063, #6479

### 7.2 Authentication Header Conventions
**Frequency:** Universal
**Confidence:** High
**Trend:** Migrating from legacy to new auth

Three auth mechanisms, used in different test contexts:
- **Legacy env key**: `headers={"X-Auth": api_auth_token}` -- being deprecated
- **JWT (login.gov)**: `headers={"X-SGG-Token": user_auth_token}` -- for user-authenticated endpoints
- **API User Key**: `headers={"X-API-Key": user_api_key_id}` -- the newer approach

The migration from `X-Auth` to `X-API-Key` is ongoing. Tests for endpoints that support both auth types test each separately (PRs #7775, #6820).

### 7.3 Test Both Success and Error Paths
**Frequency:** Common
**Confidence:** High

Good tests include both happy path and error cases:
- 200/201 success
- 401 unauthorized
- 403 forbidden
- 404 not found
- 422 validation error

PR #8584 is an exemplary pattern with separate test functions for each validation error type.

### 7.4 `pytest.mark.parametrize` for Scenario Variations
**Frequency:** Moderate
**Confidence:** High

Used for testing multiple input combinations:
```python
@pytest.mark.parametrize(
    "application_response,expected_warnings",
    [
        ({}, [{"field": "$", "message": "'name' is a required property", "type": "required"}]),
        ({"name": "bob", "age": 500}, [...]),
    ],
)
```

PRs #5073, #7775

---

## 8. Corrective Patterns (Reviewer Enforcement)

### 8.1 "Use pytest, Not unittest"
**Frequency:** Explicitly corrected at least once
**Confidence:** High

> "I'd caution against using unittest, we use pytest for everything, and I don't know what behavior we would expect by mixing them." (PR #4346, chouinar)

Despite this, `unittest.TestCase` appears occasionally in SOAP-related tests (PR #5941), suggesting incomplete enforcement in that domain.

### 8.2 "Don't Add Unnecessary db_session.commit()"
**Frequency:** Multiple occurrences
**Confidence:** High

Reviewers catch redundant commits after factory creates:
> "Factory create calls commit, don't need to add it." (PR #6479)
> "`create` already has a commit built in." (PR #5063)

### 8.3 "Use .build() When You Don't Need the DB"
**Frequency:** Explicitly enforced
**Confidence:** High

> "If we don't want anything in the DB / want to keep it simple, use `.build()`." (PR #8614)

### 8.4 "Add Tests for Edge Cases Reviewers Identify"
**Frequency:** Common
**Confidence:** High

Reviewers frequently request additional test coverage:
> "Can we do a test where the json_schema is invalid? Im curious to know what happens in that case" (PR #4314)

### 8.5 "Static Log Messages with Extra Dict"
**Frequency:** Enforced in test-adjacent code
**Confidence:** Medium

Reviewers enforce structured logging patterns that affect how tests validate logs:
> "The user ID will be in the extra, can have a static log message." (PR #6479)

### 8.6 "Move Helpers/Constants to Top of File"
**Frequency:** Occasional
**Confidence:** Medium

> "Could we move this to the top of the file, not between other tests?" (PR #8614)

---

## 9. Anti-Patterns (Things Reviewers Flag)

### 9.1 Hardcoding Values That Should Come from the Factory
**Frequency:** Multiple instances
**Confidence:** High

Tests that hardcode values like `uei="TEST123456789"` when the factory generates them are corrected. After PR #5368, tests were updated to use `sam_gov_entity.uei` instead of hardcoded strings.

### 9.2 Using `db_session.query()` Instead of `select()`
**Frequency:** Caught in reviews
**Confidence:** High

The old SQLAlchemy query API is flagged for replacement with the 2.0-style `select()` + `execute()` pattern.

### 9.3 Mixing unittest and pytest
**Frequency:** Rare but flagged
**Confidence:** High

Using `unittest.TestCase` with `setUp()` instead of pytest fixtures/classes is explicitly discouraged.

### 9.4 Over-Cleaning Test Data
**Frequency:** Caught in reviews
**Confidence:** High

Table truncation fixtures that aren't needed (because test isolation is already handled by transaction rollback or because each test creates its own data) are flagged as unnecessary performance costs.

### 9.5 Missing Return in Factory `_build` Override
**Frequency:** Specific bug found
**Confidence:** Medium

PR #8614 found and fixed a missing `return` in `ApplicationAttachmentFactory._build()` that caused `.build()` to return `None`. This is a subtle factory_boy anti-pattern to watch for.

---

## 10. Emerging Patterns (Late in Timeline)

### 10.1 Service-Layer Tests Separate from Route Tests
**Frequency:** Growing, especially 2026+
**Confidence:** High
**Trend:** Increasing

Later PRs consistently create dedicated service-layer test files alongside route tests:
- `test_application_validation.py` alongside `test_application_routes.py` (PR #5073)
- `test_ingest_workflow_event.py` alongside `test_workflow_routes.py` (PR #8584)
- `test_create_application.py` alongside `test_application_routes.py` (PR #7818)

### 10.2 Shared Test Utility Modules
**Frequency:** Growing
**Confidence:** Medium

Reusable test helpers are extracted to shared modules:
- `tests/lib/organization_test_utils.py` (PR #6505)
- `tests/lib/db_testing.py` (cascade_delete_from_db_table)
- `tests/lib/auth_test_utils.py`
- `tests/util/minifiers.py` (PR #5941)

### 10.3 Workflow/Event Tests Use Inline Payload Dicts
**Frequency:** New pattern in workflow domain
**Confidence:** Medium

Workflow tests construct payload dicts inline rather than using fixtures:
```python
payload = {
    "event_type": WorkflowEventType.START_WORKFLOW,
    "start_workflow_context": {
        "workflow_type": WorkflowType.INITIAL_PROTOTYPE,
        "entities": [
            {"entity_type": WorkflowEntityType.OPPORTUNITY, "entity_id": str(uuid.uuid4())}
        ],
    },
}
```

PR #8584

---

## Summary: Quick Reference for New Developers

1. **Always request `enable_factory_create`** if your test calls any `Factory.create()`
2. **Use `Factory.build()`** when you only need in-memory objects
3. **Don't call `db_session.commit()`** after `Factory.create()` -- it already commits
4. **Use standalone test functions** unless you need shared class-scoped setup
5. **Auth headers**: Use `X-API-Key` for general endpoints, `X-SGG-Token` for user-authenticated endpoints
6. **Assert status code first**, then response body via `resp.get_json()["data"]`
7. **Convert UUIDs to strings** when comparing with JSON response values: `str(model.id) == response["id"]`
8. **Use pytest throughout** -- never unittest.TestCase
9. **Use SQLAlchemy 2.0 style** `select()` queries, not `db_session.query()`
10. **Add factories to `factories.py`** for any new DB model
11. **Real services over mocks** -- test against Postgres/OpenSearch/LocalStack containers
12. **Separate service tests from route tests** in dedicated files
