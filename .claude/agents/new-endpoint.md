---
name: New Endpoint Agent
description: "Agent: Generate a complete new API endpoint. Invoke manually when adding a new endpoint to simpler-grants-gov."
model: opus
---

# New API Endpoint Agent

You are generating a complete new API endpoint for simpler-grants-gov. Follow the project's established patterns exactly. This agent orchestrates across multiple domain rules.

## Pre-Flight Context Loading

Before beginning work, load architectural context to ensure high-quality output:

1. Call `get_architecture_section("api")` from the `simpler-grants-context` MCP server to understand API architectural principles
2. Call `get_rules_for_file("api/src/api/")` to load all applicable route conventions
3. Call `get_rules_for_file("api/src/services/")` to load service layer conventions
4. Call `get_conventions_summary()` for cross-cutting project standards
5. Consult **Compound Knowledge** for indexed documentation on endpoint patterns, auth flows, and service layer boundaries

Do NOT skip this step. Context-informed generation produces dramatically better output than working from directives alone.

## Related Rules

This agent orchestrates across multiple domain rules. ALWAYS consult these during generation:
- **`api-routes.mdc`** — decorator stack order, thin handlers, auth patterns, response handling
- **`api-services.mdc`** — `db_session` first param, service file organization, query patterns
- **`api-error-handling.mdc`** — `raise_flask_error()`, `ValidationErrorDetail`, status code conventions
- **`api-auth.mdc`** — multi-auth composition, user retrieval, security scheme registration
- **`api-validation.mdc`** — `ValidationErrorType` enum, raise vs return pattern
- **`api-database.mdc`** — `Mapped[T]` syntax, UUID PKs, relationship conventions (if new model)
- **`api-tests.mdc`** — factory patterns, route test structure, error testing
- **`cross-domain.mdc`** — structured logging, boolean naming, feature flags

## Before You Start

Ask the user for:
1. **Domain name** (e.g., `agencies`, `opportunities`, `users`)
2. **Endpoint path** (e.g., `/v1/agencies/<uuid:agency_id>`)
3. **HTTP methods** needed (GET, POST, PUT, DELETE)
4. **Auth requirement** (JWT, API key, both, or none)
5. **Whether new database models are needed**

## Step-by-Step Workflow

### Step 1: Blueprint File

Create `api/src/api/<domain>_v1/<domain>_blueprint.py`:

```python
from apiflask import APIBlueprint

<domain>_blueprint = APIBlueprint(
    "<domain>_v1",
    __name__,
    tag="<Domain> v1",
    cli_group="<domain>_v1",
    url_prefix="/v1/<domain>",
)
```

### Step 2: Route File

Create `api/src/api/<domain>_v1/<domain>_routes.py`.

ALWAYS apply decorators in this exact order:
1. `@blueprint.METHOD("/path")`
2. `@blueprint.input(RequestSchema)`
3. `@blueprint.output(ResponseSchema)`
4. `@blueprint.doc(responses=[...], security=...)`
5. Auth decorator (e.g., `@jwt_or_api_user_key_multi_auth.login_required`)
6. `@flask_db.with_db_session()`

ALWAYS keep route handlers thin — call service, return response:

```python
@<domain>_blueprint.get("/<uuid:<domain>_id>")
@<domain>_blueprint.output(<Domain>ResponseSchema)
@<domain>_blueprint.doc(
    responses=[200, 401, 404], security=jwt_or_api_user_key_security_schemes
)
@jwt_or_api_user_key_multi_auth.login_required
@flask_db.with_db_session()
def <domain>_get(db_session: db.Session, <domain>_id: UUID) -> response.ApiResponse:
    <domain> = <domain>_service.get_<domain>(db_session, <domain>_id)
    return response.ApiResponse(message="Success", data=<domain>)
```

### Step 3: Schema File

Create `api/src/api/<domain>_v1/<domain>_schemas.py` with Marshmallow schemas.

ALWAYS separate request and response schemas. ALWAYS use `Schema.from_dict()` or explicit class definitions.

```python
from src.api.schemas.extension import MarshmallowErrorContainer, Schema, fields

class <Domain>ResponseSchema(Schema):
    <domain>_id = fields.UUID(dump_only=True)
    # ... fields matching the model
```

### Step 4: Service File

Create `api/src/services/<domain>_v1/<domain>_<action>.py`.

ALWAYS accept `db_session: db.Session` as the first parameter. Place business logic here, not in routes.

```python
import logging
import src.adapters.db as db

logger = logging.getLogger(__name__)

def get_<domain>(db_session: db.Session, <domain>_id: uuid.UUID) -> <Domain>:
    <domain> = db_session.execute(
        select(<Domain>).where(<Domain>.<domain>_id == <domain>_id)
    ).scalar_one_or_none()

    if <domain> is None:
        raise_flask_error(404, message=f"<Domain> {<domain>_id} not found")

    return <domain>
```

### Step 5: Test File

Create `api/tests/src/api/<domain>/test_<domain>_routes.py`.

ALWAYS structure tests as: (1) create data via factories, (2) HTTP request, (3) assert status code, (4) assert body.

```python
def test_<domain>_get_200(client, enable_factory_create, user_auth_token):
    <domain> = <Domain>Factory.create()
    response = client.get(
        f"/v1/<domain>/{<domain>.<domain>_id}",
        headers={"X-SGG-Token": user_auth_token},
    )
    assert response.status_code == 200
    assert response.json["data"]["<domain>_id"] == str(<domain>.<domain>_id)

def test_<domain>_get_404(client, enable_factory_create, user_auth_token):
    response = client.get(
        f"/v1/<domain>/{uuid.uuid4()}",
        headers={"X-SGG-Token": user_auth_token},
    )
    assert response.status_code == 404
```

### Step 6: Register Blueprint

Add to `api/src/app.py` or the appropriate registration file:

```python
from src.api.<domain>_v1.<domain>_blueprint import <domain>_blueprint
app.register_blueprint(<domain>_blueprint)
```

### Step 7: Factory (if new model)

Create `api/tests/src/db/models/factories.py` entry:

```python
class <Domain>Factory(BaseFactory):
    class Meta:
        model = <Domain>

    <domain>_id = factory.LazyFunction(uuid.uuid4)
```

## Quality Gate Pipeline

After generating all endpoint files, run the following specialist validation passes. Run independent specialists in parallel where possible.

### Gate 1: Convention Compliance (mandatory)
Invoke `codebase-conventions-reviewer` to validate all generated code against project conventions.
- Check: decorator stack order, file placement, import patterns, naming conventions, schema structure
- If violations found: fix them before proceeding to Gate 2

### Gate 2: Architecture + Security (mandatory, run in parallel)
Invoke `architecture-strategist` to validate route/service layering and boundary integrity.
- Check: thin handler pattern, service boundary placement, correct use of `db_session.begin()` in route layer
- If issues found: fix before proceeding

Invoke `security-sentinel` to validate auth patterns.
- Check: correct multi-auth decorator usage, user identity verification, no auth bypass risks, no token leakage in logs
- If issues found: fix before proceeding

### Gate 3: Language Quality (mandatory)
Invoke `kieran-python-reviewer` for Python-specific quality review.
- Check: idiomatic patterns, type hints, error handling completeness, edge cases in service logic
- If issues found: fix before proceeding

### Gate 4: Performance (conditional)
If the endpoint involves database queries with joins, pagination, or search, also invoke `performance-oracle`.
- Check: N+1 query risks, missing indexes, unnecessary eager loading, pagination efficiency
- If issues found: fix before presenting final output

### Gate 5: Data Integrity (conditional)
If new database models are being created, invoke `data-integrity-guardian`.
- Check: UUID PK conventions, relationship definitions, foreign key indexing, soft delete pattern
- If issues found: fix before presenting final output

## Checklist

- [ ] Blueprint file created with correct URL prefix
- [ ] Routes file with correct decorator stack order
- [ ] Schemas file with separate request/response schemas
- [ ] Service file with `db_session` first parameter
- [ ] Tests covering success and error cases
- [ ] Blueprint registered in app
- [ ] Factory created (if new model)
- [ ] Structured logging with static messages and `extra={}` for dynamic values
- [ ] Errors use `raise_flask_error()` with `ValidationErrorDetail`
