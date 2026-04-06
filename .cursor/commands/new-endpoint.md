# New Endpoint

Scaffold a new API endpoint end-to-end in the simpler-grants-gov monorepo.

## What I Need From You

Describe the endpoint:

1. **What does it do?** — "List all grants matching search criteria" / "Submit a grant application"
2. **HTTP method and path** (optional) — "GET /api/grants/search" / agent will suggest if not provided
3. **Domain** — which area of the application (grants, applications, users, search, etc.)

## What Happens Next

The New Endpoint Agent will:
1. Scaffold the route handler, service, and database layer
2. Define request/response schemas
3. Add authentication and authorization
4. Write unit tests and integration tests
5. Update API documentation
6. Validate against all applicable project conventions

## Tips for Better Results
- Mention if this is similar to an existing endpoint (agent will use it as a template)
- Describe the expected request and response shapes if you have them
- Mention any authorization requirements (public, authenticated, admin-only)
