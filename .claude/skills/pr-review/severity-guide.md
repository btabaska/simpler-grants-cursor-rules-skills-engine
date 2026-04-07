# Severity Classification Guide

## Severity Levels

| Prefix | Meaning | Blocking? | When to Use |
|--------|---------|-----------|-------------|
| `bug:` | Likely functional/security/data issue | Yes | Code will break, data could be lost, security vulnerability |
| `a11y:` | Accessibility issue | Yes (user-facing) | WCAG 2.1 AA / Section 508 violation |
| `testing:` | Missing critical test coverage | Yes | New behavior or bug-prone logic untested |
| `suggestion:` | Meaningful improvement | No (usually) | Better approach exists, non-blocking unless high risk |
| `question:` | Clarification needed | No | Intent or risk is unclear |
| `nit:` | Minor style/preference | No | Style only, never a blocker |

## Convention Violation Severity

| Confidence Level | Severity | Action |
|-----------------|----------|--------|
| High-confidence rule violation (no pending marker) | `bug:` | Team-agreed convention — must fix |
| Medium-confidence (pending validation) | `suggestion:` | Flag but don't block |
| Low-confidence / emerging convention | `nit:` | Informational only |

## Priority Order

When specialists overlap or disagree, prioritize by:
1. **Correctness / Security / Data loss** — highest priority
2. **Regressions** — breaking existing behavior
3. **Maintainability** — long-term code health
4. **Style** — lowest priority
