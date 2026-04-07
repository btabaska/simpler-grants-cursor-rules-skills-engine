# Generate Mock

Generate a mock for an interface, service, or module.

## What I Need From You

- Target symbol or module.
- Framework: `pytest`, `vitest`, or `msw`.
- Optional scenario: `success` (default), `error`, `empty`.

## What Happens Next

1. Reads the target signature.
2. Generates a framework-appropriate mock.
3. Places it in the conventional test-utils directory.

## Tips

- Use `error` scenario to test error-handling UI.
- Prefer MSW for anything going over the network.
- Do not mock audit/auth modules in integration tests.
