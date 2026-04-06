# Test

Generate tests following simpler-grants-gov patterns.

## What I Need From You

Describe what needs testing:

1. **What code?** — file path or function/component name
2. **API or Frontend?** — pytest or Jest/Playwright
3. **What scenarios?** (optional) — specific cases you want covered

## What Happens Next

The Test Generation Agent will:
1. Read the code under test and determine the testing surface
2. Choose the correct factory pattern (`.build()` vs `.create()`)
3. Generate tests covering success, error, and edge cases
4. Include accessibility scans for frontend components
5. Validate against testing conventions

## Tips for Better Results
- Mention specific edge cases or error scenarios you're concerned about
- For API tests, mention the auth requirements
- For frontend tests, mention if the component is server or client
