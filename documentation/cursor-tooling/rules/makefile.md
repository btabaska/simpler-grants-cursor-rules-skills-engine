# makefile

## Purpose
Conventions for top-level and sub-project Makefiles used as the canonical task runner.

## Scope / Globs
`**/Makefile`, `**/*.mk`

## Conventions Enforced
- `.PHONY` declared for non-file targets
- Namespaced targets (`api-*`, `frontend-*`, `infra-*`)
- Self-documenting `help` default target
- `:=` and `?=` assignment; POSIX-compatible recipes
- Thin dispatch — delegate to `poetry`, `npm`, `terraform`, `docker compose`
- Same targets used in CI and local dev
- No hardcoded secrets; `.env` sourcing documented

## Examples
Correct: `api-test: ## Run API tests\n\tcd api && poetry run pytest`.
Incorrect: duplicated shell in CI workflow instead of calling `make api-test`.

## Related Rules
`ci-cd`, `docker`, `api-cli`, `infra`.
