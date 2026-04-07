# openapi

## Purpose
Generation and documentation conventions for the API's OpenAPI spec derived from APIFlask blueprints and Marshmallow schemas.

## Scope / Globs
`api/src/api/**/*_schemas.py`, `api/src/api/**/*_routes.py`, `api/openapi.yaml`, `api/openapi.json`, `api/src/api/__init__.py`

## Conventions Enforced
- Spec generated from code — never hand-edited
- `@blueprint.doc` with `summary`, `description`, `responses`, `security`, `tags`
- Marshmallow fields with `metadata={"description": ...}` and `required=True`
- URL-prefixed versioning (`/v1/`), no breaking field changes in-place
- Registered security schemes aligned with auth decorators
- Spec linted (Spectral) in CI; regenerated spec committed

## Examples
Correct: new endpoint adds `responses=[200, 401, 403, 404, 422]` and a tag.
Incorrect: hand-editing `openapi.yaml` to add a description.

## Related Rules
`api-routes`, `api-form-schema`, `api-validation`, `api-auth`, `api-constants`.
