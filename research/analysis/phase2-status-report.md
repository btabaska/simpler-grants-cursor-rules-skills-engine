# Phase 2 Status Report — LLM Pattern Analysis
**Date:** 2026-03-30
**Status:** ✅ COMPLETE

---

## Executive Summary

Phase 2 (LLM Pattern Analysis) is fully complete. All three analysis passes have been executed across all 14 domain groups plus the documentation/ADR corpus, producing 30 analysis documents totaling ~18,000 lines of structured pattern analysis backed by real code examples from 1,459 merged PRs.

---

## Deliverables Produced

### Pass 1 — Pattern Discovery (15 files, 6,327 lines)
| Domain | PRs Analyzed | File | Key Finding Count |
|--------|-------------|------|-------------------|
| api-tests | 519 | `analysis/pass1/api-tests.md` | 30+ patterns, 12-item quick reference |
| frontend-components | 293 | `analysis/pass1/frontend-components.md` | Server-first components, USWDS wrappers, no barrel files |
| frontend-tests | 279 | `analysis/pass1/frontend-tests.md` | Jest+RTL+jest-axe universal, Playwright E2E sharding |
| api-services | 231 | `analysis/pass1/api-services.md` | db_session first param, raise_flask_error, RBAC patterns |
| infra | 172 | `analysis/pass1/infra.md` | Three-layer module structure, feature-gated resources |
| api-routes | 153 | `analysis/pass1/api-routes.md` | Strict decorator stack, multi-auth migration, thin routes |
| api-database | 151 | `analysis/pass1/api-database.md` | UUID PKs, 4-layer lookup pattern, Alembic conventions |
| frontend-i18n | 145 | `analysis/pass1/frontend-i18n.md` | Single translation file, camelCase keys, English-only |
| ci-cd | 124 | `analysis/pass1/ci-cd.md` | Reusable workflows, 4-env promotion chain, CODEOWNERS removal |
| api-form-schema | 108 | `analysis/pass1/api-form-schema.md` | Three-schema architecture, XML transform pipeline |
| frontend-services | 90 | `analysis/pass1/frontend-services.md` | requesterForEndpoint, useClientFetch, X-SGG-Token |
| api-auth | 65 | `analysis/pass1/api-auth.md` | JWT + API key multi-auth, RBAC buildout |
| api-validation | 44 | `analysis/pass1/api-validation.md` | Marshmallow schemas, ValidationErrorDetail |
| frontend-hooks | 35 | `analysis/pass1/frontend-hooks.md` | useClientFetch, useSearchParamUpdater, UserProvider |
| documentation/ADRs | 55 docs | `analysis/pass1/documentation-adrs.md` | 50 ADRs inventoried, 13 key rationale extractions |

### Pass 2 — Pattern Codification (14 files, 11,335 lines)
Each file contains structured rules with imperative ALWAYS/NEVER statements, confidence ratings, 2-3 real code examples per rule (with PR# references), rationale, and open questions for tech lead review.

| Domain | Rules Codified | File |
|--------|---------------|------|
| api-services | 25 | `analysis/pass2/api-services.md` |
| api-database | 25 | `analysis/pass2/api-database.md` |
| api-tests | 20 | `analysis/pass2/api-tests.md` |
| api-routes | 19 | `analysis/pass2/api-routes.md` |
| ci-cd | 18 | `analysis/pass2/ci-cd.md` |
| frontend-services | 17 + 2 anti-patterns | `analysis/pass2/frontend-services.md` |
| frontend-components | 16 + 4 conflicts | `analysis/pass2/frontend-components.md` |
| infra | 15 + 2 anti-patterns | `analysis/pass2/infra.md` |
| frontend-hooks | 13 | `analysis/pass2/frontend-hooks.md` |
| api-form-schema | ~15 | `analysis/pass2/api-form-schema.md` |
| frontend-i18n | 12 + 3 anti-patterns | `analysis/pass2/frontend-i18n.md` |
| api-auth | ~12 | `analysis/pass2/api-auth.md` |
| frontend-tests | 22 | `analysis/pass2/frontend-tests.md` |
| api-validation | ~10 | `analysis/pass2/api-validation.md` |
| **TOTAL** | **~240 codified rules** | |

### Pass 3 — Cross-Domain Synthesis (1 file, 408 lines)
File: `analysis/pass3/cross-domain-synthesis.md`

---

## Key Findings

### Top 10 Cross-Cutting Patterns (enforced across 3+ domains)
1. **Structured logging** — static messages + flat snake_case `extra={}` keys (most frequently enforced rule across the entire codebase)
2. **Log level discipline** — `info` for 4xx client errors, `warning` only for operational concerns
3. **Factory `.build()` over `.create()`** — avoid DB writes in tests unless necessary
4. **`raise_flask_error()` + `ValidationErrorDetail`** — the API-frontend error contract
5. **Thin routes / service layer separation** — routes orchestrate, services contain logic
6. **Boolean question-form naming** — `is_*`, `has_*` everywhere
7. **Mandatory accessibility testing** — jest-axe on frontend, USWDS compliance
8. **Feature flag gating** — SSM parameters + Terraform `count` + boolean variables
9. **No PII in logs** — enforced across API and frontend
10. **Reviewer-as-authority model** — specific individuals enforce specific domain standards

### Architectural Principles Inferred
- **Fail Loudly, Never Silently** — explicit errors preferred over silent fallbacks
- **Convention Over Configuration, Enforced by Review** — patterns maintained through code review, not tooling
- **Server-First Rendering** — both API (server-side processing) and frontend (RSC by default)
- **Thin Boundary, Fat Core** — routes/components are thin shells around service/hook logic

### Reviewer Authority Map
| Reviewer | Primary Domain | Enforcement Focus |
|----------|---------------|-------------------|
| **chouinar** | API (database, routes, services) | DB patterns, transaction management, UUID PKs, logging |
| **doug-s-nava** | Frontend (all) | Naming, server actions, type conventions, no inline styles |

### Forms Domain Assessment
**Recommendation: YES — warrants dedicated cross-cutting rule set.** The forms domain (SF-424, CD511, attachments, budget narratives) has 10+ unique patterns spanning database models through XML generation, with a three-schema architecture (JSON Schema + UI Schema + Rule Schema) that doesn't exist elsewhere in the codebase.

### Key Inconsistencies Flagged
1. **Three different feature flag naming conventions** across infra, API, and frontend
2. **Validation framework quad-stack** — Marshmallow, Pydantic, JSON Schema, Zod used in different contexts
3. **Singular vs. plural file naming** — unresolved across API routes
4. **Duplicate auth utilities** — `verify_access` vs `check_user_access` in API services
5. **Test file location** — parallel `tests/` vs co-located (frontend, unresolved)

### Documentation/ADR Highlights
- 50 ADRs inventoried spanning 2023-2025
- 13 key rationale extractions for the Tier 1 architecture guide
- 10 potentially outdated decisions flagged (GitBook, Sendy, Google Groups, Black formatter)
- Core themes: open source as value, FedRAMP as hard constraint, Nava template leverage

---

## Coverage Gaps Identified
1. No automated naming convention enforcement (relies entirely on review)
2. No feature flag registry or lifecycle documentation
3. No API versioning strategy
4. No migration rollback strategy
5. No documented error budget or SLA targets
6. No component library documentation beyond code
7. No formal deprecation process for old patterns
8. No cross-team style guide for TypeScript vs Python naming conventions

---

## Metrics

| Metric | Value |
|--------|-------|
| Total PRs analyzed | 1,459 |
| Domain groups | 14 |
| Documentation files analyzed | 55 (50 ADRs + 5 docs) |
| Pass 1 discovery files | 15 |
| Pass 2 codification files | 14 |
| Pass 3 synthesis files | 1 |
| Total analysis output | ~18,070 lines / ~764 KB |
| Codified rules | ~240 |
| Open questions for tech lead review | ~60-80 across all domains |
| Agent runs | ~30 (including retries from rate limits) |

---

## What's Next — Phase 3: Human Review

Per the plan, Phase 3 involves:
1. **Generate review documents** — one per domain, with checkbox format for tech lead annotation (CONFIRMED / DEPRECATED / NEEDS NUANCE / SPLIT)
2. **Distribute to tech leads** — route API domains to chouinar, frontend domains to doug-s-nava (and other relevant reviewers)
3. **Collect annotations** — async review, no meetings needed
4. **Feed annotations back** for Phase 4 final generation

Phase 4 then produces the three-tier output:
- **Tier 1:** Architecture & Philosophy Guide (`docs/architecture-guide.md`)
- **Tier 2:** Contextual Rule Documents (`documentation/rules/*.md`)
- **Tier 3:** Cursor Rules Files (`.cursor/rules/*.md`)

---

## File Tree
```
analysis/
├── pass1/                          # Pattern Discovery (15 files)
│   ├── api-auth.md
│   ├── api-database.md
│   ├── api-form-schema.md
│   ├── api-routes.md
│   ├── api-services.md
│   ├── api-tests.md
│   ├── api-validation.md
│   ├── ci-cd.md
│   ├── documentation-adrs.md
│   ├── frontend-components.md
│   ├── frontend-hooks.md
│   ├── frontend-i18n.md
│   ├── frontend-services.md
│   ├── frontend-tests.md
│   └── infra.md
├── pass2/                          # Pattern Codification (14 files)
│   ├── api-auth.md
│   ├── api-database.md
│   ├── api-form-schema.md
│   ├── api-routes.md
│   ├── api-services.md
│   ├── api-tests.md
│   ├── api-validation.md
│   ├── ci-cd.md
│   ├── frontend-components.md
│   ├── frontend-hooks.md
│   ├── frontend-i18n.md
│   ├── frontend-services.md
│   ├── frontend-tests.md
│   └── infra.md
├── pass3/                          # Cross-Domain Synthesis (1 file)
│   └── cross-domain-synthesis.md
└── phase2-status-report.md         # This file
```
