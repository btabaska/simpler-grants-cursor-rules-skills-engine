# API Testing Patterns -- Pass 2: Pattern Codification

**Domain:** api-tests
**Source:** 519 merged PRs from HHS/simpler-grants-gov touching `api/tests/`
**Date range:** ~2025-03-28 to 2026-03-18
**Pass 1 document:** `analysis/pass1/api-tests.md`
**Pass 2 analysis date:** 2026-03-30
**PRs sampled for code examples:** #4314, #4346, #4361, #4383, #4406, #5063, #5064, #5073, #5368, #5941, #6479, #6505, #6820, #7775, #7818, #8584, #8614, #9082

---

## Rule 1: Require `enable_factory_create` Fixture for Database Writes

**Pattern Name:** Factory Create Gate

**Rule Statement:** ALWAYS request the `enable_factory_create` fixture in any test that calls `Factory.create()`. Without it, factory-boy cannot persist records to the database.

**Confidence:** High

**Frequency:** Virtually every PR with DB-touching tests (estimated 90%+ of all PRs in this domain).

**Code Examples:**

From PR #5064 (`test_application_routes.py`) -- correct usage with `enable_factory_create` in the signature:
```python
@freeze_time(TEST_DATE)
def test_application_start_with_custom_name(client, enable_factory_create, db_session):
    """Test application creation succeeds with custom application name"""
    today = get_now_us_eastern_date()
    past_opening_date = today - timedelta(days=5)
    competition = CompetitionFactory.create(opening_date=past_opening_date, closing_date=None)
```

From PR #8584 (`test_ingest_workflow_event.py`) -- service-layer test with `enable_factory_create`:
```python
def test_start_workflow_valid_entity(db_session: db.Session, enable_factory_create):
    """Test that validation passes when entity exists and matches workflow configuration."""
    opportunity = OpportunityFactory.create()
    payload = {
        "event_type": WorkflowEventType.START_WORKFLOW,
        "start_workflow_context": {
            "workflow_type": WorkflowType.INITIAL_PROTOTYPE,
            "entities": [
                {"entity_type": WorkflowEntityType.OPPORTUNITY,
                 "entity_id": str(opportunity.opportunity_id)},
            ],
        },
    }
    event_id = ingest_workflow_event(db_session, payload)
    assert event_id is not None
```

From PR #4406 (`test_load_agencies_to_index.py`) -- class-based test with `enable_factory_create`:
```python
def test_load_agencies_to_index(
    self, db_session, search_client, load_agencies_to_index,
    agency_index_alias, enable_factory_create,
):
    cascade_delete_from_db_table(db_session, Agency)
    agencies = [AgencyFactory.create(agency_code="DOD")]
    agencies.extend(AgencyFactory.create_batch(size=5, top_level_agency=agencies[0]))
    load_agencies_to_index.run()
```

**Rationale:** The `enable_factory_create` fixture sets the internal `_db_session` on the factories module so factory-boy can persist records. Without it, `Factory.create()` silently fails or errors. This is a safety gate to prevent accidental database writes in tests that should remain in-memory.

**Open Questions:** None. This is universally enforced and well-understood.

---

## Rule 2: Use `Factory.build()` for In-Memory Objects

**Pattern Name:** Build Over Create When No DB Needed

**Rule Statement:** ALWAYS use `Factory.build()` instead of `Factory.create()` when the test does not require persisted database records. Reserve `.create()` for tests that need data queryable from the database.

**Confidence:** High

**Frequency:** Explicitly enforced in reviewer feedback (PRs #8614, #4314). Increasingly observed in later PRs.

**Code Examples:**

From PR #8614 (`test_attachment_mapping.py`) -- using `.build()` for in-memory-only tests:
```python
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

From PR #4314 (`test_jsonschema_validator.py`) -- module-level constants using `.build()`:
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

Reviewer comment from PR #8614 (chouinar):
> "I am curious why we would use this instead of a factory? If we don't want anything in the DB / want to keep it simple, use `.build()`."

**Rationale:** `.build()` is faster (no DB round-trip), does not require `enable_factory_create`, and keeps tests isolated from database state. Using `.create()` unnecessarily couples tests to database infrastructure and slows down the test suite.

**Open Questions:** None.

---

## Rule 3: Never Add Redundant `db_session.commit()` After `Factory.create()`

**Pattern Name:** No Redundant Commits After Factory Create

**Rule Statement:** NEVER call `db_session.commit()` immediately after `Factory.create()`. The factory's `create()` method already calls `commit()` internally.

**Confidence:** High

**Frequency:** Corrected in at least 3 PRs explicitly (#5063, #6479, #5064). Reviewer (chouinar) consistently catches this.

**Code Examples:**

Reviewer correction in PR #5063 (`test_opportunity_route_get.py`):
> "`create` already has a commit built it." (chouinar, suggesting removal of `db_session.commit()`)

Reviewer correction in PR #6479 (`test_user_profile_put.py`):
> "Factory create calls commit, don't need to add it."
```python
# WRONG - redundant commit
user_profile = UserProfileFactory.create(user=user, first_name="Everett", last_name="Child")
db_session.commit()  # <-- remove this

# CORRECT
user_profile = UserProfileFactory.create(user=user, first_name="Everett", last_name="Child")
```

**Rationale:** Redundant commits are a no-op at best and can cause subtle transaction issues at worst. They also obscure the actual transaction boundaries, making the test harder to reason about.

**Open Questions:** None.

---

## Rule 4: Use Standalone Test Functions by Default

**Pattern Name:** Prefer Functions Over Classes

**Rule Statement:** ALWAYS write tests as standalone `def test_*()` functions unless the tests require shared expensive setup (e.g., search indexes, class-scoped fixtures). Use test classes only when inheriting from `BaseTestClass` or when multiple tests share `scope="class"` fixtures.

**Confidence:** High

**Frequency:** ~80% of new test files use standalone functions.

**Code Examples:**

From PR #6479 (`test_user_profile_put.py`) -- standalone functions (the predominant pattern):
```python
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

From PR #4406 (`test_load_agencies_to_index.py`) -- class-based (the exception, for shared expensive resources):
```python
class TestLoadAgenciesToIndex(BaseTestClass):
    @pytest.fixture(scope="class")
    def load_agencies_to_index(self, db_session, search_client, agency_index_alias):
        config = LoadAgenciesToIndexConfig(
            alias_name=agency_index_alias,
            index_prefix="test-load-agencies",
        )
        return LoadAgenciesToIndex(db_session, search_client, config)
```

**Rationale:** Standalone functions are simpler, more explicit about their dependencies (via fixture arguments), and integrate better with pytest's fixture injection. Classes add indirection without benefit unless expensive setup needs to be shared.

**Open Questions:** None.

---

## Rule 5: Standard Route Test Structure (Arrange-Act-Assert with Status Code First)

**Pattern Name:** Route Test Pattern

**Rule Statement:** ALWAYS structure route/endpoint tests as: (1) create test data via factories, (2) make HTTP request via `client.get/post/put()`, (3) assert status code first, (4) assert response body via `resp.get_json()["data"]`. ALWAYS convert UUIDs to strings when comparing with JSON response values.

**Confidence:** High

**Frequency:** Universal across all route test files.

**Code Examples:**

From PR #7775 (`test_opportunity_route_get.py`) -- standard pattern with UUID conversion:
```python
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

From PR #5063 (conftest.py) -- shared validation helper following the same pattern:
```python
def validate_opportunity(db_opportunity: Opportunity, resp_opportunity: dict):
    assert str(db_opportunity.opportunity_id) == resp_opportunity["opportunity_id"]
    assert db_opportunity.opportunity_number == resp_opportunity["opportunity_number"]
    assert db_opportunity.opportunity_title == resp_opportunity["opportunity_title"]
    assert db_opportunity.agency_code == resp_opportunity["agency_code"]
```

From PR #4346 (`test_legacy_soap_api_routes.py`) -- even non-REST endpoints follow status code first:
```python
def test_successful_request(client, fixture_from_file) -> None:
    full_path = "/grantsws-applicant/services/v2/ApplicantWebServicesSoapPort"
    mock_data = fixture_from_file(fixture_path)
    response = client.post(full_path, data=mock_data)
    assert response.status_code == 200
```

**Rationale:** Consistent structure makes tests scannable. Checking the status code first provides immediate signal on what kind of failure occurred. UUID-to-string conversion is necessary because JSON serialization converts all UUIDs to strings.

**Open Questions:** None.

---

## Rule 6: Authentication Header Conventions

**Pattern Name:** Auth Header Migration Path

**Rule Statement:** For new endpoint tests, ALWAYS use `headers={"X-API-Key": user_api_key_id}` for general access or `headers={"X-SGG-Token": user_auth_token}` for user-authenticated endpoints. NEVER use the legacy `headers={"X-Auth": api_auth_token}` in new tests. When updating existing endpoints to support multiple auth types, test each auth mechanism separately.

**Confidence:** High

**Frequency:** Universal. The migration from `X-Auth` to `X-API-Key`/`X-SGG-Token` is well-documented in PR #7775.

**Code Examples:**

From PR #7775 (`test_opportunity_route_get.py`) -- migrated from `X-Auth` to `X-API-Key`:
```python
# BEFORE (old pattern):
resp = client.get(
    f"/v1/opportunities/{db_opportunity.opportunity_id}",
    headers={"X-Auth": api_auth_token}
)

# AFTER (new pattern):
resp = client.get(
    f"/v1/opportunities/{db_opportunity.opportunity_id}",
    headers={"X-API-Key": user_api_key_id}
)
```

From PR #7775 -- JWT auth for user-specific endpoints:
```python
def test_get_opportunity_200_JWT(client, opportunity_params, opportunity_summary_params, user_auth_token):
    db_opportunity = OpportunityFactory.create(**opportunity_params, current_opportunity_summary=None)
    resp = client.get(
        f"/v1/opportunities/{db_opportunity.opportunity_id}",
        headers={"X-SGG-Token": user_auth_token},
    )
    assert resp.status_code == 200
```

From PR #6479 (`test_user_profile_put.py`) -- JWT for user-authenticated endpoint:
```python
def test_user_update_profile_new(client, db_session, user_auth_token, user):
    response = client.put(
        f"/v1/users/{user.user_id}/profile",
        headers={"X-SGG-Token": user_auth_token},
        json={"first_name": "Henry", "last_name": "Ford"},
    )
```

**Rationale:** The project is migrating from a single shared environment API key (`X-Auth`) to per-user API keys (`X-API-Key`) and JWT tokens (`X-SGG-Token`). New tests should use the current auth mechanisms to avoid creating technical debt.

**Open Questions:**
- When will `X-Auth` be fully deprecated and removed from test infrastructure?
- Should there be a lint rule or fixture deprecation warning for `api_auth_token`?

---

## Rule 7: Use pytest, Not unittest

**Pattern Name:** pytest-Only Framework

**Rule Statement:** ALWAYS use pytest conventions (fixtures, `pytest.raises`, standalone functions or plain classes). NEVER use `unittest.TestCase` or `setUp()`/`tearDown()` methods.

**Confidence:** High

**Frequency:** Explicitly corrected in PR #4346. Observed as a hard rule throughout the codebase.

**Code Examples:**

Reviewer correction in PR #4346 (chouinar):
> "I'd caution against using unittest, we use pytest for everything, and I don't know what behavior we would expect by mixing them. Instead of setup, you can do something like:"
```python
class MyTestClass:
    @pytest.fixture(scope="class")
    def legacy_soap_client(self):
        return LegacySOAPClient()

    def test_thing(self, legacy_soap_client):
        ...
```

The corrected code in PR #4346:
```python
class TestSOAPClient:
    @pytest.fixture(scope="class")
    def legacy_soap_client(self):
        return LegacySOAPClient()

    def test_can_instantiate(self, legacy_soap_client) -> None:
        assert isinstance(legacy_soap_client, LegacySOAPClient)
```

**Rationale:** Mixing test frameworks creates unpredictable behavior. pytest fixtures and markers provide superior dependency injection and parametrization compared to unittest's inheritance-based setup.

**Open Questions:** Some SOAP-related tests (PR #5941) may still use unittest patterns -- needs verification and cleanup.

---

## Rule 8: Use SQLAlchemy 2.0 `select()` Style, Not `query()`

**Pattern Name:** SQLAlchemy 2.0 Query Style

**Rule Statement:** ALWAYS use `db_session.execute(select(Model).where(...)).scalar_one_or_none()` instead of `db_session.query(Model).filter(...).first()`. This applies to both production code and test assertions.

**Confidence:** High

**Frequency:** Explicitly corrected in PR #6479. Actively enforced as of mid-2025.

**Code Examples:**

Reviewer correction in PR #6479 (chouinar):
> "Could we do `one_or_none` + use select? First implies we expect more than 1 to be possible. Using select is the newer way."
```python
# WRONG (old pattern):
res = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()

# CORRECT (2.0 pattern):
user_profile = db_session.execute(
    select(UserProfile).where(UserProfile.user_id == user_id)
).scalar_one_or_none()
```

From PR #7818 (`test_create_application.py`) -- correct pattern in test assertions:
```python
application = create_application(db_session=db_session, user=user, json_data={...})
db_session.flush()
db_session.refresh(application)
assert application.intends_to_add_organization is True
```

**Rationale:** SQLAlchemy's `query()` API is the legacy ("1.x") approach. The `select()` API is the officially recommended modern approach and will eventually be the only supported one. Using `scalar_one_or_none()` is also more precise than `.first()` when you expect exactly zero or one result.

**Open Questions:** Existing tests using `query()` have not all been migrated. Should there be a codemod or linting rule?

---

## Rule 9: Test Both Success and Error Paths

**Pattern Name:** Complete Error Path Coverage

**Rule Statement:** ALWAYS include tests for both happy path (200/201) and error paths (401, 403, 404, 422) when testing API endpoints. Each distinct error scenario SHOULD have its own test function.

**Confidence:** High

**Frequency:** Common across all route test files. PR #8584 is the exemplary model.

**Code Examples:**

From PR #8584 (`test_ingest_workflow_event.py`) -- separate functions for each error type:
```python
def test_start_workflow_entity_not_found(db_session: db.Session):
    """Test that a 404 error is raised when opportunity doesn't exist."""
    # ...
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "The specified resource was not found"

def test_start_workflow_invalid_workflow_type(db_session: db.Session):
    """Test that a 422 error is raised when workflow type is not configured."""
    # ...
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 422
    assert exc_info.value.message == "Invalid workflow type specified"

def test_start_workflow_valid_entity(db_session: db.Session, enable_factory_create):
    """Test that validation passes when entity exists and matches workflow configuration."""
    # ...
    event_id = ingest_workflow_event(db_session, payload)
    assert event_id is not None
```

From PR #7818 (`test_create_application.py`) -- error path for business logic validation:
```python
def test_create_application_rejects_both_organization_and_intends_to_add(
    db_session, enable_factory_create
):
    with pytest.raises(apiflask.exceptions.HTTPError) as excinfo:
        create_application(db_session=db_session, user=user, json_data={
            "competition_id": competition.competition_id,
            "organization_id": organization.organization_id,
            "intends_to_add_organization": True,
        })
    assert excinfo.value.status_code == 422
    assert "Cannot set both organization_id and intends_to_add_organization" in excinfo.value.message
```

**Rationale:** Tests that only cover the happy path miss regressions in error handling, validation, and authorization logic. Each error type warrants its own test for clarity and debuggability.

**Open Questions:** None.

---

## Rule 10: Use `pytest.raises` with `exc_info.value.message` for APIFlask Errors

**Pattern Name:** APIFlask Error Assertion Pattern

**Rule Statement:** When testing for APIFlask `HTTPError` exceptions, ALWAYS check the error via `exc_info.value.status_code` and `exc_info.value.message`. NEVER rely on the `match` parameter of `pytest.raises` for APIFlask errors, because `str(HTTPError)` returns an empty string.

**Confidence:** High

**Frequency:** Discovered and documented in PR #8584. Applies to all service-layer error tests.

**Code Examples:**

From PR #8584 -- discovery of the `match` limitation:
Reviewer (chouinar) suggested:
```python
# This does NOT work with APIFlask's HTTPError:
with pytest.raises(apiflask.exceptions.HTTPError, match="do not match") as exc_info:
    ingest_workflow_event(db_session, payload)
```

Author (kkrug) response:
> "I couldn't get this to work - the match parameter in pytest.raises checks against the exception's string representation (str(exception)), but APIFlask's HTTPError stores the message in a .message attribute instead. The 'Input' is empty because str(HTTPError) returns an empty string."

The correct pattern used throughout PR #8584:
```python
with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
    ingest_workflow_event(db_session, payload)
assert exc_info.value.status_code == 404
assert exc_info.value.message == "The specified resource was not found"
```

**Rationale:** APIFlask's `HTTPError` does not implement `__str__()` in a way compatible with `pytest.raises(match=...)`. Checking `.message` directly is the only reliable approach.

**Open Questions:** None. This is a framework quirk that is now well-understood.

---

## Rule 11: Avoid Unnecessary Table Truncation

**Pattern Name:** Minimal Test Cleanup

**Rule Statement:** NEVER add `cascade_delete_from_db_table` or table truncation fixtures unless the test specifically requires a clean-slate table (e.g., batch processing tasks that scan entire tables). Each test SHOULD create its own data and rely on transaction isolation.

**Confidence:** High

**Frequency:** Explicitly enforced in PR #6479. Increasingly reinforced over time.

**Code Examples:**

Reviewer correction in PR #6479 (chouinar):
> "I don't think we would need this, presumably any users we need in the tests would be created during the test? These deletes are slow and unless our tests absolutely need them (like jobs that process data across an entire table), we should avoid them."

The legitimate exception -- PR #4406 (`test_load_agencies_to_index.py`), where the task processes an entire table:
```python
def test_load_agencies_to_index(self, db_session, search_client, ...):
    # Delete any agencies in db -- NECESSARY because the task loads ALL agencies
    cascade_delete_from_db_table(db_session, Agency)
    agencies = [AgencyFactory.create(agency_code="DOD")]
    agencies.extend(AgencyFactory.create_batch(size=5, top_level_agency=agencies[0]))
    load_agencies_to_index.run()
```

**Rationale:** Table truncation is slow and can hide test isolation problems. Most tests create their own data and should not depend on or be affected by data from other tests. Truncation is only justified when testing logic that operates on "all rows" in a table.

**Open Questions:** None.

---

## Rule 12: Descriptive Test Names Encoding Scenario and Status Code

**Pattern Name:** Scenario-Status Test Naming

**Rule Statement:** ALWAYS name route tests with the format `test_<resource>_<action>_<scenario>_<status_code>` (e.g., `test_get_opportunity_404_not_found_is_draft`). For service-layer tests, use `test_<action>_<scenario>` with the scenario describing the expected outcome (e.g., `test_start_workflow_entity_not_found`).

**Confidence:** High

**Frequency:** ~90% of route tests follow this convention.

**Code Examples:**

From PR #7775 (`test_opportunity_route_get.py`):
```
test_get_opportunity_200
test_get_opportunity_with_attachment_200
test_get_opportunity_with_attachment_200_legacy
test_get_opportunity_404_not_found
test_get_opportunity_404_not_found_is_draft
test_get_opportunity_404_not_found_is_draft_legacy
test_get_opportunity_returns_cdn_urls
```

From PR #8584 (`test_ingest_workflow_event.py`):
```
test_start_workflow_entity_not_found
test_start_workflow_invalid_workflow_type
test_start_workflow_entity_type_mismatch
test_start_workflow_valid_entity
test_process_workflow_workflow_not_found
test_process_workflow_workflow_inactive
test_process_workflow_invalid_event
test_process_workflow_valid_event
```

From PR #8584 (`test_workflow_routes.py`):
```
test_workflow_event_put_unauthorized
test_workflow_event_put_schema_validation
test_start_workflow_integration
test_process_workflow_integration
```

**Rationale:** Descriptive names make test failures self-documenting. Including the status code in route test names immediately tells you what HTTP response was expected.

**Open Questions:** The `_JWT` and `_legacy` suffixes (e.g., `test_get_opportunity_200_JWT`) are a newer convention from PR #7775. Should there be a standard convention for auth-variant naming?

---

## Rule 13: Session-Scoped Fixtures for Expensive Resources

**Pattern Name:** Session-Scoped Expensive Resources

**Rule Statement:** ALWAYS use `scope="session"` for fixtures that create expensive or shared resources (OpenSearch clients, search index aliases, RSA key pairs for JWT). Use `monkeypatch_session` (not `monkeypatch`) for environment variables needed across the session.

**Confidence:** High

**Frequency:** Universal in search/OpenSearch tests and auth setup.

**Code Examples:**

From PR #4406 (conftest.py) -- session-scoped search index alias:
```python
@pytest.fixture(scope="session")
def agency_index_alias(search_client, monkeypatch_session):
    alias = f"test-agency-index-alias-{uuid.uuid4().int}"
    monkeypatch_session.setenv("AGENCY_SEARCH_INDEX_ALIAS", alias)
    return alias
```

From conftest.py (referenced across multiple PRs) -- session-scoped search client:
```python
@pytest.fixture(scope="session")
def search_client() -> search.SearchClient:
    client = search.SearchClient()
    try:
        yield client
    finally:
        client.delete_index("test-*")
```

**Rationale:** Creating search clients, generating RSA keys, and setting up index aliases are slow operations. Session scoping ensures they happen once per test run rather than once per test or once per module.

**Open Questions:** None.

---

## Rule 14: Separate Service-Layer Tests from Route Tests

**Pattern Name:** Service-Route Test Separation

**Rule Statement:** ALWAYS create dedicated test files for service-layer logic separate from route/endpoint tests. Service tests call the Python function directly and use `pytest.raises` for errors. Route tests exercise the HTTP layer via `client` and check status codes.

**Confidence:** High

**Frequency:** Growing pattern, consistently applied in 2025-2026 PRs.

**Code Examples:**

From PR #8584 -- two separate test files for the same feature:
- `api/tests/src/api/workflows/test_workflow_routes.py` -- route-level integration tests:
```python
def test_start_workflow_integration(client, user_auth_token, enable_factory_create):
    opportunity = OpportunityFactory.create()
    payload = {"event_type": WorkflowEventType.START_WORKFLOW, ...}
    response = client.put(
        "/v1/workflows/events", json=payload, headers={"X-SGG-Token": user_auth_token}
    )
    assert response.status_code == 200
```
- `api/tests/src/services/workflows/test_ingest_workflow_event.py` -- service-level unit tests:
```python
def test_start_workflow_entity_not_found(db_session: db.Session):
    payload = {"event_type": WorkflowEventType.START_WORKFLOW, ...}
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 404
```

From PR #7818 -- `test_create_application.py` (service) alongside `test_application_routes.py` (route).

**Rationale:** Service tests are faster (no HTTP overhead), provide more granular error testing, and test business logic in isolation. Route tests verify the HTTP contract, auth, serialization, and end-to-end integration.

**Open Questions:** None.

---

## Rule 15: Use `pytest.mark.parametrize` for Input Variations

**Pattern Name:** Parametrize Scenario Variations

**Rule Statement:** ALWAYS use `@pytest.mark.parametrize` when testing the same logic with multiple input combinations rather than duplicating test functions. Include descriptive comments for each parameter set.

**Confidence:** High

**Frequency:** Moderate but consistently applied across all domains.

**Code Examples:**

From PR #4314 (`test_application_routes.py`) -- parametrized validation warning tests:
```python
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

From PR #8584 (`test_workflow_routes.py`) -- parametrized schema validation:
```python
@pytest.mark.parametrize("payload, expected_msg", [
    ({"event_type": WorkflowEventType.START_WORKFLOW, ...}, "process_workflow_context should not be provided"),
    ({}, "Missing required fields"),
])
def test_workflow_event_put_schema_validation(client, user_auth_token, payload, expected_msg):
    response = client.put("/v1/workflows/events", json=payload, headers={"X-SGG-Token": user_auth_token})
    assert response.status_code == 422
```

**Rationale:** Parametrize reduces code duplication and makes it easy to add new test cases. The test framework runs each parameter set as a distinct test, so failures are individually identifiable.

**Open Questions:** None.

---

## Rule 16: Real Infrastructure Over Mocks

**Pattern Name:** Real Services Over Mocks

**Rule Statement:** ALWAYS test against real infrastructure (Postgres via Docker, OpenSearch via Docker, LocalStack for S3) rather than mocking database or search operations. ONLY mock external third-party services (login.gov OAuth, AWS Pinpoint, external HTTP APIs) and use `monkeypatch` for environment variable configuration.

**Confidence:** High

**Frequency:** ~90% of tests use real infrastructure. Mocking is rare and targeted.

**Code Examples:**

From PR #4346 (conftest.py) -- `fixture_from_file` fixture reads from real fixture files, tests run against real mock SOAP service:
```python
def test_successful_request(client, fixture_from_file) -> None:
    full_path = "/grantsws-applicant/services/v2/ApplicantWebServicesSoapPort"
    mock_data = fixture_from_file(fixture_path)
    response = client.post(full_path, data=mock_data)
    assert response.status_code == 200
```

From PR #8614 (`test_attachment_mapping.py`) -- one of the few cases where mocking is appropriate (S3 hash computation):
```python
@pytest.fixture
def patch_hash():
    """Patch AttachmentFile.compute_base64_sha1 to return a stable fake hash."""
    with patch(
        "src.services.xml_generation.utils.attachment_mapping.AttachmentFile.compute_base64_sha1",
        return_value=FAKE_HASH,
    ) as mock_hash:
        yield mock_hash
```

**Rationale:** Tests against real infrastructure catch integration bugs that mocks would miss. The Docker-based test environment (Postgres, OpenSearch, LocalStack) provides production-faithful behavior. Mocking is reserved for services that are impractical to run locally or whose behavior needs to be controlled precisely.

**Open Questions:** None.

---

## Rule 17: Move Helpers and Constants to Top of File

**Pattern Name:** Top-of-File Helpers and Constants

**Rule Statement:** ALWAYS define test helper functions, constants, and module-level factory builds at the top of the test file, before any test functions or classes. NEVER interleave helper definitions between tests.

**Confidence:** Medium

**Frequency:** Explicitly corrected in PR #8614. Observed as a convention in well-structured test files.

**Code Examples:**

Reviewer correction in PR #8614 (chouinar):
> "Could we move this to the top of the file, not between other tests?"

From PR #4314 (`test_jsonschema_validator.py`) -- correct placement at module top:
```python
# Form with a fairly simple JsonSchema
SIMPLE_FORM = FormFactory.build(form_json_schema={...})

IF_THEN_FORM = FormFactory.build(form_json_schema={...})

# Tests follow below...
@pytest.mark.parametrize(...)
def test_validate_json_schema_for_form_simple(data, expected_issues):
    ...
```

From PR #8614 (`test_attachment_mapping.py`) -- helper functions at top:
```python
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

**Rationale:** Placing helpers at the top makes them easy to find, avoids confusion about where definitions live, and keeps the test function section clean and sequential.

**Open Questions:** None.

---

## Rule 18: Section Headers in Large Test Files

**Pattern Name:** Comment Section Headers

**Rule Statement:** In test files with many tests covering different aspects of a feature, use comment banners to group related tests into visual sections.

**Confidence:** Medium

**Frequency:** Common in larger test files. Two styles observed.

**Code Examples:**

From PR #7775 (`test_opportunity_route_get.py`):
```python
##################################################################################
# GET opportunity tests
# As of the 1/6/2026 update for SGG-7621, these tests have been modified
# to cover both API User Key and JWT authentication.
##################################################################################
```

From PR #8584 (`test_ingest_workflow_event.py`):
```python
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

**Rationale:** In files with 10+ test functions, section headers improve navigability and make it clear which tests are conceptually grouped.

**Open Questions:** The two banner styles (`####` vs `====`) are both used. Should one be standardized?

---

## Rule 19: Task Metrics Assertions

**Pattern Name:** Task Metrics Validation

**Rule Statement:** When testing background tasks that inherit from the `Task` base class, ALWAYS assert expected values from `task.metrics[task.Metrics.METRIC_NAME]` to verify the task processed the expected number of records.

**Confidence:** High

**Frequency:** Common for all task tests.

**Code Examples:**

From PR #9082 (`test_build_automatic_opportunities.py`):
```python
assert task.metrics[task.Metrics.OPPORTUNITY_CREATED_COUNT] == 20
assert task.metrics[task.Metrics.OPPORTUNITY_ALREADY_EXIST_COUNT] == 0

# If we rerun the task, all opportunities should be skipped
task = BuildAutomaticOpportunities(db_session, form_ids)
task.run()
assert task.metrics[task.Metrics.OPPORTUNITY_CREATED_COUNT] == 0
assert task.metrics[task.Metrics.OPPORTUNITY_ALREADY_EXIST_COUNT] == 20
```

From PR #4406 (`test_load_agencies_to_index.py`):
```python
assert load_agencies_to_index.metrics[load_agencies_to_index.Metrics.RECORDS_LOADED] == len(agencies)
```

**Rationale:** Metrics provide a structured, declarative way to verify that tasks processed the expected volume of data. They also serve as documentation of what the task is supposed to accomplish.

**Open Questions:** None.

---

## Rule 20: Shared Test Utility Modules for Complex Domains

**Pattern Name:** Extracted Test Utilities

**Rule Statement:** When multiple test files need the same setup logic (especially complex factory orchestration like creating users with roles/privileges in organizations), extract that logic into a shared utility module under `tests/lib/`. ALWAYS add a docstring explaining the utility's purpose.

**Confidence:** Medium

**Frequency:** Growing pattern. Key examples: `tests/lib/organization_test_utils.py`, `tests/lib/db_testing.py`, `tests/lib/auth_test_utils.py`.

**Code Examples:**

From PR #6505 (`tests/lib/organization_test_utils.py`):
```python
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

**Rationale:** Complex setup logic (especially involving roles, privileges, and organization membership) is error-prone when duplicated. Shared utilities ensure consistency and reduce the cognitive load of writing tests in complex domains.

**Open Questions:** Is there a naming convention for utility modules (`*_test_utils.py` vs other names)?

---

## Summary: Rule Quick Reference

| # | Rule | Confidence | Key Phrase |
|---|------|-----------|------------|
| 1 | Factory Create Gate | High | ALWAYS request `enable_factory_create` for `Factory.create()` |
| 2 | Build Over Create | High | ALWAYS use `.build()` when no DB persistence needed |
| 3 | No Redundant Commits | High | NEVER `db_session.commit()` after `Factory.create()` |
| 4 | Functions Over Classes | High | ALWAYS use standalone functions unless shared setup needed |
| 5 | Route Test Pattern | High | ALWAYS: arrange, act, assert status code first, then body |
| 6 | Auth Header Migration | High | ALWAYS use `X-API-Key` or `X-SGG-Token`, NEVER new `X-Auth` |
| 7 | pytest Only | High | NEVER use `unittest.TestCase` |
| 8 | SQLAlchemy 2.0 Style | High | ALWAYS use `select()`, NEVER `db_session.query()` |
| 9 | Error Path Coverage | High | ALWAYS test success and error paths |
| 10 | APIFlask Error Pattern | High | ALWAYS use `exc_info.value.message`, NEVER `match=` |
| 11 | Minimal Cleanup | High | NEVER truncate tables unless processing entire table |
| 12 | Scenario-Status Naming | High | ALWAYS encode scenario and status code in test name |
| 13 | Session-Scoped Resources | High | ALWAYS use `scope="session"` for expensive resources |
| 14 | Service-Route Separation | High | ALWAYS separate service tests from route tests |
| 15 | Parametrize Variations | High | ALWAYS parametrize instead of duplicating tests |
| 16 | Real Infrastructure | High | ALWAYS test against real DB/search, ONLY mock externals |
| 17 | Top-of-File Helpers | Medium | ALWAYS place helpers/constants before test functions |
| 18 | Section Headers | Medium | Use comment banners to group tests in large files |
| 19 | Task Metrics | High | ALWAYS assert `task.metrics` for background task tests |
| 20 | Shared Test Utilities | Medium | Extract complex setup into `tests/lib/` utilities |
