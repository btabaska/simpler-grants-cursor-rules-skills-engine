# Parallel Execution Guide

## Execution Strategy

### Phase 1: Parallel Mandatory Gates
Run simultaneously:
- Convention Compliance (`codebase-conventions-reviewer`)
- Language Quality (`kieran-python-reviewer` / `kieran-typescript-reviewer`)
- Code Simplicity (`code-simplicity-reviewer`)

### Phase 2: Parallel Domain Gates
Run simultaneously (based on domain):
- Domain-specific specialist(s) from the specialist map
- Pattern Consistency (if multi-file change)

### Phase 3: Sequential Conditional Gates
Run only if applicable, after Phase 1 passes:
- Architecture (if structural changes)
- Security (if auth/input changes)
- Performance (if query/render changes)
- Data Integrity (if DB changes)

## Why This Order

1. **Mandatory gates first**: Convention and language issues are the most common — catch them early
2. **Domain gates in parallel**: These are independent and benefit from parallelism
3. **Conditional gates last**: These are deeper analyses that only matter if the code passes basic quality

## Conflict Resolution

When multiple specialists flag the same issue:
1. Keep the most specific finding (domain specialist > general specialist)
2. Use the highest severity from any specialist
3. Merge into a single actionable item
4. Present in the developer's voice, not the specialist's
