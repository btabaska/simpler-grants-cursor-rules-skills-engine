# api-cli

## Purpose
Standardize Flask CLI commands under `api/src/cli/`: module layout, Click argument parsing, output/verbosity, error handling, DB sessions, logging, and tests.

## Scope / Globs
`api/src/cli/**/*.py`

## Conventions Enforced
- One command group per module; central registration in `api/src/cli/__init__.py`
- Click decorators with typed options and help text
- `click.echo` / `click.secho`, never `print`
- Click exceptions, not raw `sys.exit`
- `@flask_db.with_db_session()` and `with db_session.begin():`
- Structured logging; no PII
- `CliRunner` tests with mocked services

## Examples
Correct: `@click.group()` + typed options + `flask_db.with_db_session()`.
Incorrect: `print()` for output, raw `sys.exit(1)`, manual session commit.

## Related Rules
`api-routes`, `api-services`, `api-logging`, `api-error-handling`, `cross-domain`.
