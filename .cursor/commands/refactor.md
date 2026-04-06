# Refactor

Restructure code in the simpler-grants-gov codebase without changing behavior.

## What I Need From You

Describe the refactor in plain English. Good formats:

- **Extract:** "Extract the eligibility check logic from `grant_service.py` into its own `eligibility_service.py`"
- **Split:** "Split `ApplicationForm.tsx` into separate sub-components for each form section"
- **Move:** "Move the email sending logic from the route handler into the service layer"
- **Consolidate:** "We have the same pagination logic in 4 different endpoints — consolidate into a shared utility"
- **Rename:** "Rename `useFormData` to `useApplicationFormData` across the entire frontend"

## What Happens Next

The Refactor Agent will:
1. Classify the refactor type and assess risk level
2. Map the complete blast radius (every file that will be touched)
3. Present a detailed plan for your approval BEFORE making changes
4. Execute in phases: create → update source → update callers → update tests → update types → clean up
5. Run full verification (linting, type checking, test suite)
6. Validate with the quality gate pipeline

## Tips for Better Results
- Be specific about the desired end state, not just what's wrong today
- Mention constraints: "don't change the public API" or "keep backward compatibility"
- If you want to consolidate, mention ALL the places where the pattern is duplicated
