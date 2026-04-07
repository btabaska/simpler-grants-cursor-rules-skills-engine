# docker

## Purpose
Dockerfile and docker-compose conventions for API and frontend images, covering base images, multi-stage builds, non-root users, secrets, and healthchecks.

## Scope / Globs
`**/Dockerfile`, `**/Dockerfile.*`, `**/docker-compose*.yml`

## Conventions Enforced
- Pinned, FedRAMP-approved base images (no `latest`)
- Multi-stage builds; builder tooling excluded from runtime
- Non-root UID, chowned app files
- Layer ordering for cache efficiency
- No secrets in images; BuildKit secret mounts or runtime env
- HEALTHCHECK and graceful SIGTERM handling
- Pinned service tags and named volumes in compose

## Examples
Correct: `FROM python:3.12-slim AS builder` + runtime stage with `USER 10001`.
Incorrect: `FROM python:latest`, `COPY . .` before `pip install`, root user.

## Related Rules
`infra`, `ci-cd`, `security`, `fedramp`, `makefile`.
