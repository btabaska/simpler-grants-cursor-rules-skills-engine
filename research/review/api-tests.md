# API Tests — Pattern Review

**Reviewer(s):** chouinar
**PRs analyzed:** 519
**Rules proposed:** 20
**Open questions:** 4

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

### 1. Require `enable_factory_create` Fixture for Database Writes

**Confidence:** High
**Frequency:** Virtually every PR with DB-touching tests (estimated 90%+)
**Source PRs:** #5064, #8584, #4406

**Proposed Rule:**
> ALWAYS request the `enable_factory_create` fixture in any test that calls `Factory.create()`. Without it, factory-boy cannot persist records to the database.

**Rationale:**
The `enable_factory_create` fixture sets the internal `_db_session` on the factories module so factory-boy can persist records. This is a safety gate to prevent accidental database writes in tests that should remain in-memory.

**Code Examples:**
```python
# From PR #5064 — correct usage with enable_factory_create in the signature
@freeze_time(TEST_DATE)
def test_application_start_with_custom_name(client, enable_factory_create, db_session):
    """Test application creation succeeds with custom application name"""
    today = get_now_us_eastern_date()
    past_opening_date = today - timedelta(days=5)
    competition = CompetitionFactory.create(opening_date=past_opening_date, closing_date=None)
```

```python
# From PR #8584 — service-layer test with enable_factory_create
def test_start_workflow_valid_entity(db_session: db.Session, enable_factory_create):
    """Test that validation passes when entity exists and matches workflow configuration."""
    opportunity = OpportunityFactory.create()
    payload = {
        "event_type": WorkflowEventType.START_WORKFLOW,
        ...
    }
    event_id = ingest_workflow_event(db_session, payload)
    assert event_id is not None
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

### 2. Use `Factory.build()` for In-Memory Objects

**Confidence:** High
**Frequency:** Explicitly enforced in reviewer feedback (PRs #8614, #4314)
**Source PRs:** #8614, #4314

**Proposed Rule:**
> ALWAYS use `Factory.build()` instead of `Factory.create()` when the test does not require persisted database records. Reserve `.create()` for tests that need data queryable from the database.

**Rationale:**
`.build()` is faster (no DB round-trip), does not require `enable_factory_create`, and keeps tests isolated from database state.

**Code Examples:**
```python
# From PR #8614 — using .build() for in-memory-only tests
def make_application(attachments=None, forms=None):
    """Build an Application with explicit attachment and form lists."""
    app = ApplicationFactory.build()
    app.application_attachments = attachments or []
    app.application_forms = forms or []
    return app
```

```python
# From PR #4314 — module-level constants using .build()
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

**Conflicting Examples:**
None found. Reviewer comment from PR #8614 (chouinar): "I am curious why we would use this instead of a factory? If we don't want anything in the DB / want to keep it simple, use `.build()`."

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 3. Never Add Redundant `db_session.commit()` After `Factory.create()`

**Confidence:** High
**Frequency:** Corrected in at least 3 PRs explicitly (#5063, #6479, #5064)
**Source PRs:** #5063, #6479

**Proposed Rule:**
> NEVER call `db_session.commit()` immediately after `Factory.create()`. The factory's `create()` method already calls `commit()` internally.

**Rationale:**
Redundant commits are a no-op at best and can cause subtle transaction issues at worst.

**Code Examples:**
```python
# From PR #6479 — reviewer correction
# "Factory create calls commit, don't need to add it."

# WRONG - redundant commit
user_profile = UserProfileFactory.create(user=user, first_name="Everett", last_name="Child")
db_session.commit()  # <-- remove this

# CORRECT
user_profile = UserProfileFactory.create(user=user, first_name="Everett", last_name="Child")
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

### 4. Use Standalone Test Functions by Default

**Confidence:** High
**Frequency:** ~80% of new test files use standalone functions
**Source PRs:** #6479, #4406

**Proposed Rule:**
> ALWAYS write tests as standalone `def test_*()` functions unless the tests require shared expensive setup. Use test classes only when inheriting from `BaseTestClass` or when multiple tests share `scope="class"` fixtures.

**Rationale:**
Standalone functions are simpler, more explicit about their dependencies, and integrate better with pytest's fixture injection.

**Code Examples:**
```python
# From PR #6479 — standalone functions (the predominant pattern)
def test_user_update_profile_new(client, db_session, user_auth_token, user):
    response = client.put(
        f"/v1/users/{user.user_id}/profile",
        headers={"X-SGG-Token": user_auth_token},
        json={"first_name": "Henry", "last_name": "Ford"},
    )
    assert response.status_code == 200
```

```python
# From PR #4406 — class-based (the exception, for shared expensive resources)
class TestLoadAgenciesToIndex(BaseTestClass):
    @pytest.fixture(scope="class")
    def load_agencies_to_index(self, db_session, search_client, agency_index_alias):
        config = LoadAgenciesToIndexConfig(
            alias_name=agency_index_alias,
            index_prefix="test-load-agencies",
        )
        return LoadAgenciesToIndex(db_session, search_client, config)
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

### 5. Standard Route Test Structure (Arrange-Act-Assert with Status Code First)

**Confidence:** High
**Frequency:** Universal across all route test files
**Source PRs:** #7775, #5063, #4346

**Proposed Rule:**
> ALWAYS structure route/endpoint tests as: (1) create test data via factories, (2) make HTTP request via `client.get/post/put()`, (3) assert status code first, (4) assert response body via `resp.get_json()["data"]`. ALWAYS convert UUIDs to strings when comparing with JSON response values.

**Rationale:**
Consistent structure makes tests scannable. Checking the status code first provides immediate signal on what kind of failure occurred.

**Code Examples:**
```python
# From PR #7775 — standard pattern with UUID conversion
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

```python
# From PR #5063 — shared validation helper following the same pattern
def validate_opportunity(db_opportunity: Opportunity, resp_opportunity: dict):
    assert str(db_opportunity.opportunity_id) == resp_opportunity["opportunity_id"]
    assert db_opportunity.opportunity_number == resp_opportunity["opportunity_number"]
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

### 6. Authentication Header Conventions

**Confidence:** High
**Frequency:** Universal. Migration from `X-Auth` to `X-API-Key`/`X-SGG-Token` documented in PR #7775.
**Source PRs:** #7775, #6479

**Proposed Rule:**
> For new endpoint tests, ALWAYS use `headers={"X-API-Key": user_api_key_id}` for general access or `headers={"X-SGG-Token": user_auth_token}` for user-authenticated endpoints. NEVER use the legacy `headers={"X-Auth": api_auth_token}` in new tests.

**Rationale:**
The project is migrating from a single shared environment API key (`X-Auth`) to per-user API keys (`X-API-Key`) and JWT tokens (`X-SGG-Token`). New tests should use the current auth mechanisms.

**Code Examples:**
```python
# From PR #7775 — migrated from X-Auth to X-API-Key
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

```python
# From PR #6479 — JWT for user-authenticated endpoint
def test_user_update_profile_new(client, db_session, user_auth_token, user):
    response = client.put(
        f"/v1/users/{user.user_id}/profile",
        headers={"X-SGG-Token": user_auth_token},
        json={"first_name": "Henry", "last_name": "Ford"},
    )
```

**Conflicting Examples:**
Many existing tests still use `X-Auth`. Open questions: When will `X-Auth` be fully deprecated? Should there be a lint rule or fixture deprecation warning for `api_auth_token`?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 7. Use pytest, Not unittest

**Confidence:** High
**Frequency:** Explicitly corrected in PR #4346. Hard rule throughout the codebase.
**Source PRs:** #4346

**Proposed Rule:**
> ALWAYS use pytest conventions (fixtures, `pytest.raises`, standalone functions or plain classes). NEVER use `unittest.TestCase` or `setUp()`/`tearDown()` methods.

**Rationale:**
Mixing test frameworks creates unpredictable behavior. pytest fixtures and markers provide superior dependency injection and parametrization.

**Code Examples:**
```python
# From PR #4346 — reviewer correction (chouinar):
# "I'd caution against using unittest, we use pytest for everything"

# Corrected code:
class TestSOAPClient:
    @pytest.fixture(scope="class")
    def legacy_soap_client(self):
        return LegacySOAPClient()

    def test_can_instantiate(self, legacy_soap_client) -> None:
        assert isinstance(legacy_soap_client, LegacySOAPClient)
```

**Conflicting Examples:**
Some SOAP-related tests (PR #5941) may still use unittest patterns -- needs verification and cleanup.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 8. Use SQLAlchemy 2.0 `select()` Style, Not `query()`

**Confidence:** High
**Frequency:** Explicitly corrected in PR #6479. Actively enforced as of mid-2025.
**Source PRs:** #6479, #7818

**Proposed Rule:**
> ALWAYS use `db_session.execute(select(Model).where(...)).scalar_one_or_none()` instead of `db_session.query(Model).filter(...).first()`. This applies to both production code and test assertions.

**Rationale:**
SQLAlchemy's `query()` API is the legacy ("1.x") approach. The `select()` API is the officially recommended modern approach.

**Code Examples:**
```python
# From PR #6479 — reviewer correction (chouinar):
# "Could we do one_or_none + use select? First implies we expect more than 1 to be possible."

# WRONG (old pattern):
res = db_session.query(UserProfile).filter(UserProfile.user_id == user_id).first()

# CORRECT (2.0 pattern):
user_profile = db_session.execute(
    select(UserProfile).where(UserProfile.user_id == user_id)
).scalar_one_or_none()
```

**Conflicting Examples:**
Existing tests using `query()` have not all been migrated. Open question: Should there be a codemod or linting rule?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 9. Test Both Success and Error Paths

**Confidence:** High
**Frequency:** Common across all route test files. PR #8584 is the exemplary model.
**Source PRs:** #8584, #7818

**Proposed Rule:**
> ALWAYS include tests for both happy path (200/201) and error paths (401, 403, 404, 422) when testing API endpoints. Each distinct error scenario SHOULD have its own test function.

**Rationale:**
Tests that only cover the happy path miss regressions in error handling, validation, and authorization logic.

**Code Examples:**
```python
# From PR #8584 — separate functions for each error type
def test_start_workflow_entity_not_found(db_session: db.Session):
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 404
    assert exc_info.value.message == "The specified resource was not found"

def test_start_workflow_invalid_workflow_type(db_session: db.Session):
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 422
    assert exc_info.value.message == "Invalid workflow type specified"

def test_start_workflow_valid_entity(db_session: db.Session, enable_factory_create):
    event_id = ingest_workflow_event(db_session, payload)
    assert event_id is not None
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

### 10. Use `pytest.raises` with `exc_info.value.message` for APIFlask Errors

**Confidence:** High
**Frequency:** Discovered and documented in PR #8584
**Source PRs:** #8584

**Proposed Rule:**
> When testing for APIFlask `HTTPError` exceptions, ALWAYS check the error via `exc_info.value.status_code` and `exc_info.value.message`. NEVER rely on the `match` parameter of `pytest.raises` for APIFlask errors, because `str(HTTPError)` returns an empty string.

**Rationale:**
APIFlask's `HTTPError` does not implement `__str__()` in a way compatible with `pytest.raises(match=...)`. Checking `.message` directly is the only reliable approach.

**Code Examples:**
```python
# From PR #8584 — the correct pattern
with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
    ingest_workflow_event(db_session, payload)
assert exc_info.value.status_code == 404
assert exc_info.value.message == "The specified resource was not found"

# This does NOT work with APIFlask's HTTPError:
# with pytest.raises(apiflask.exceptions.HTTPError, match="do not match") as exc_info:
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

### 11. Avoid Unnecessary Table Truncation

**Confidence:** High
**Frequency:** Explicitly enforced in PR #6479
**Source PRs:** #6479, #4406

**Proposed Rule:**
> NEVER add `cascade_delete_from_db_table` or table truncation fixtures unless the test specifically requires a clean-slate table (e.g., batch processing tasks that scan entire tables). Each test SHOULD create its own data and rely on transaction isolation.

**Rationale:**
Table truncation is slow and can hide test isolation problems. Truncation is only justified when testing logic that operates on "all rows" in a table.

**Code Examples:**
```python
# From PR #6479 — reviewer correction (chouinar):
# "I don't think we would need this, presumably any users we need in the tests would
# be created during the test? These deletes are slow and unless our tests absolutely
# need them (like jobs that process data across an entire table), we should avoid them."

# The legitimate exception — PR #4406, where the task loads ALL agencies:
def test_load_agencies_to_index(self, db_session, search_client, ...):
    cascade_delete_from_db_table(db_session, Agency)
    agencies = [AgencyFactory.create(agency_code="DOD")]
    agencies.extend(AgencyFactory.create_batch(size=5, top_level_agency=agencies[0]))
    load_agencies_to_index.run()
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

### 12. Descriptive Test Names Encoding Scenario and Status Code

**Confidence:** High
**Frequency:** ~90% of route tests follow this convention
**Source PRs:** #7775, #8584

**Proposed Rule:**
> ALWAYS name route tests with the format `test_<resource>_<action>_<scenario>_<status_code>`. For service-layer tests, use `test_<action>_<scenario>` with the scenario describing the expected outcome.

**Rationale:**
Descriptive names make test failures self-documenting. Including the status code in route test names immediately tells you what HTTP response was expected.

**Code Examples:**
```
# From PR #7775
test_get_opportunity_200
test_get_opportunity_with_attachment_200
test_get_opportunity_404_not_found
test_get_opportunity_404_not_found_is_draft

# From PR #8584
test_start_workflow_entity_not_found
test_start_workflow_invalid_workflow_type
test_start_workflow_valid_entity
test_process_workflow_workflow_not_found
```

**Conflicting Examples:**
The `_JWT` and `_legacy` suffixes (e.g., `test_get_opportunity_200_JWT`) are a newer convention. Should there be a standard convention for auth-variant naming?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 13. Session-Scoped Fixtures for Expensive Resources

**Confidence:** High
**Frequency:** Universal in search/OpenSearch tests and auth setup
**Source PRs:** #4406

**Proposed Rule:**
> ALWAYS use `scope="session"` for fixtures that create expensive or shared resources (OpenSearch clients, search index aliases, RSA key pairs for JWT). Use `monkeypatch_session` (not `monkeypatch`) for environment variables needed across the session.

**Rationale:**
Creating search clients, generating RSA keys, and setting up index aliases are slow operations. Session scoping ensures they happen once per test run.

**Code Examples:**
```python
# From PR #4406 — session-scoped search index alias
@pytest.fixture(scope="session")
def agency_index_alias(search_client, monkeypatch_session):
    alias = f"test-agency-index-alias-{uuid.uuid4().int}"
    monkeypatch_session.setenv("AGENCY_SEARCH_INDEX_ALIAS", alias)
    return alias
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

### 14. Separate Service-Layer Tests from Route Tests

**Confidence:** High
**Frequency:** Growing pattern, consistently applied in 2025-2026 PRs
**Source PRs:** #8584, #7818

**Proposed Rule:**
> ALWAYS create dedicated test files for service-layer logic separate from route/endpoint tests. Service tests call the Python function directly and use `pytest.raises` for errors. Route tests exercise the HTTP layer via `client` and check status codes.

**Rationale:**
Service tests are faster (no HTTP overhead), provide more granular error testing, and test business logic in isolation.

**Code Examples:**
```python
# From PR #8584 — two separate test files for the same feature:
# api/tests/src/api/workflows/test_workflow_routes.py — route-level:
def test_start_workflow_integration(client, user_auth_token, enable_factory_create):
    response = client.put(
        "/v1/workflows/events", json=payload, headers={"X-SGG-Token": user_auth_token}
    )
    assert response.status_code == 200

# api/tests/src/services/workflows/test_ingest_workflow_event.py — service-level:
def test_start_workflow_entity_not_found(db_session: db.Session):
    with pytest.raises(apiflask.exceptions.HTTPError) as exc_info:
        ingest_workflow_event(db_session, payload)
    assert exc_info.value.status_code == 404
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

### 15. Use `pytest.mark.parametrize` for Input Variations

**Confidence:** High
**Frequency:** Moderate but consistently applied across all domains
**Source PRs:** #4314, #8584

**Proposed Rule:**
> ALWAYS use `@pytest.mark.parametrize` when testing the same logic with multiple input combinations rather than duplicating test functions.

**Rationale:**
Parametrize reduces code duplication and makes it easy to add new test cases. Each parameter set runs as a distinct test.

**Code Examples:**
```python
# From PR #4314 — parametrized validation warning tests
@pytest.mark.parametrize(
    "application_response,expected_warnings",
    [
        ({}, [{"field": "$", "message": "'name' is a required property", "type": "required"}]),
        (
            {"name": "bob", "age": 500},
            [{"field": "$.age", "message": "500 is greater than the maximum of 200", "type": "maximum"}],
        ),
        ({"name": "bob", "age": 50, "something_else": ""}, []),
    ],
)
def test_application_form_update_with_validation_warnings(
    client, enable_factory_create, db_session, api_auth_token,
    application_response, expected_warnings,
):
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

### 16. Real Infrastructure Over Mocks

**Confidence:** High
**Frequency:** ~90% of tests use real infrastructure
**Source PRs:** #4346, #8614

**Proposed Rule:**
> ALWAYS test against real infrastructure (Postgres via Docker, OpenSearch via Docker, LocalStack for S3) rather than mocking database or search operations. ONLY mock external third-party services (login.gov OAuth, AWS Pinpoint, external HTTP APIs).

**Rationale:**
Tests against real infrastructure catch integration bugs that mocks would miss.

**Code Examples:**
```python
# From PR #8614 — one of the few cases where mocking is appropriate (S3 hash)
@pytest.fixture
def patch_hash():
    """Patch AttachmentFile.compute_base64_sha1 to return a stable fake hash."""
    with patch(
        "src.services.xml_generation.utils.attachment_mapping.AttachmentFile.compute_base64_sha1",
        return_value=FAKE_HASH,
    ) as mock_hash:
        yield mock_hash
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

### 17. Move Helpers and Constants to Top of File

**Confidence:** Medium
**Frequency:** Explicitly corrected in PR #8614
**Source PRs:** #8614, #4314

**Proposed Rule:**
> ALWAYS define test helper functions, constants, and module-level factory builds at the top of the test file, before any test functions or classes. NEVER interleave helper definitions between tests.

**Rationale:**
Placing helpers at the top makes them easy to find and keeps the test function section clean and sequential.

**Code Examples:**
```python
# From PR #8614 — reviewer correction (chouinar):
# "Could we move this to the top of the file, not between other tests?"

# From PR #4314 — correct placement at module top
SIMPLE_FORM = FormFactory.build(form_json_schema={...})
IF_THEN_FORM = FormFactory.build(form_json_schema={...})

# Tests follow below...
@pytest.mark.parametrize(...)
def test_validate_json_schema_for_form_simple(data, expected_issues):
    ...
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

### 18. Section Headers in Large Test Files

**Confidence:** Medium
**Frequency:** Common in larger test files. Two styles observed.
**Source PRs:** #7775, #8584

**Proposed Rule:**
> In test files with many tests covering different aspects of a feature, use comment banners to group related tests into visual sections.

**Rationale:**
In files with 10+ test functions, section headers improve navigability and make it clear which tests are conceptually grouped.

**Code Examples:**
```python
# From PR #7775 — style 1 (hash banners)
##################################################################################
# GET opportunity tests
##################################################################################

# From PR #8584 — style 2 (equals banners)
# ========================================
# Start Workflow Validation Tests
# ========================================
```

**Conflicting Examples:**
Two banner styles (`####` vs `====`) are both used. Should one be standardized?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 19. Task Metrics Assertions

**Confidence:** High
**Frequency:** Common for all task tests
**Source PRs:** #9082, #4406

**Proposed Rule:**
> When testing background tasks that inherit from the `Task` base class, ALWAYS assert expected values from `task.metrics[task.Metrics.METRIC_NAME]` to verify the task processed the expected number of records.

**Rationale:**
Metrics provide a structured, declarative way to verify that tasks processed the expected volume of data.

**Code Examples:**
```python
# From PR #9082
assert task.metrics[task.Metrics.OPPORTUNITY_CREATED_COUNT] == 20
assert task.metrics[task.Metrics.OPPORTUNITY_ALREADY_EXIST_COUNT] == 0

# If we rerun the task, all opportunities should be skipped
task = BuildAutomaticOpportunities(db_session, form_ids)
task.run()
assert task.metrics[task.Metrics.OPPORTUNITY_CREATED_COUNT] == 0
assert task.metrics[task.Metrics.OPPORTUNITY_ALREADY_EXIST_COUNT] == 20
```

```python
# From PR #4406
assert load_agencies_to_index.metrics[load_agencies_to_index.Metrics.RECORDS_LOADED] == len(agencies)
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

### 20. Shared Test Utility Modules for Complex Domains

**Confidence:** Medium
**Frequency:** Growing pattern. Key examples: `tests/lib/organization_test_utils.py`
**Source PRs:** #6505

**Proposed Rule:**
> When multiple test files need the same setup logic (especially complex factory orchestration like creating users with roles/privileges in organizations), extract that logic into a shared utility module under `tests/lib/`. ALWAYS add a docstring explaining the utility's purpose.

**Rationale:**
Complex setup logic is error-prone when duplicated. Shared utilities ensure consistency and reduce cognitive load.

**Code Examples:**
```python
# From PR #6505 — tests/lib/organization_test_utils.py
def create_user_in_org(
    privileges: list[Privilege], db_session,
    is_organization_owner: bool = True, organization=None, sam_gov_entity=None, **kwargs
) -> tuple:
    """Create a user in an organization with specified privileges."""
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

**Conflicting Examples:**
None found. Open question: Is there a naming convention for utility modules (`*_test_utils.py` vs other names)?

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

## Coverage Gaps

1. **No lint rule to enforce `select()` over `query()`.** The SQLAlchemy 2.0 style is enforced by reviewer diligence only. Existing tests using `query()` have not all been migrated.

2. **No lint rule or fixture deprecation for `X-Auth` / `api_auth_token`.** The migration to `X-API-Key` and `X-SGG-Token` is convention-based.

3. **No formal naming convention for test utility modules.** The `*_test_utils.py` pattern is emerging but not standardized.

## Inconsistencies Requiring Resolution

1. **Section header banner style:** `####` vs. `====` in large test files. Should one be standardized?

2. **Auth header migration timeline:** When will `X-Auth` be fully deprecated and removed from test infrastructure?

3. **Auth-variant test naming convention:** The `_JWT` and `_legacy` suffixes (e.g., `test_get_opportunity_200_JWT`) are a newer convention. Should there be a standard?

4. **Test cleanup pattern:** Some test classes use `cascade_delete_from_db_table` in autouse fixtures while the general guidance is to avoid table truncation. When exactly is each approach appropriate?
