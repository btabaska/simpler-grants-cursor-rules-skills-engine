# PR Review Checklist Template

Use this checklist for every PR review. Skip categories that don't apply.

## 0. Codebase Convention Compliance (run first)
- [ ] Identify which rule files apply based on changed file paths
- [ ] Check every changed file against ALWAYS/NEVER/MUST directives
- [ ] Flag violations with specific rule name and domain
- [ ] Check cross-domain rules against ALL changed files
- [ ] For form changes, check both domain-specific AND forms-vertical rules
- [ ] Verify test changes comply with testing conventions

## 1. Code Quality & Readability
- [ ] Names are clear and descriptive
- [ ] No dead code, commented-out code, or unaddressed TODOs
- [ ] Functions and components are reasonably sized
- [ ] No unnecessary complexity
- [ ] TypeScript types properly defined (no unnecessary `any`)
- [ ] Python type hints used consistently

## 2. Potential Bugs & Edge Cases
- [ ] No off-by-one errors, null/undefined gaps, or race conditions
- [ ] Error states handled gracefully
- [ ] No unhandled promise rejections or missing `await`
- [ ] No security concerns (XSS, SQL injection, auth bypass)
- [ ] Secrets handled safely

## 3. Unit Testing Opportunities
- [ ] New functions/components/endpoints have test coverage
- [ ] Edge cases tested (empty inputs, error states, boundaries)
- [ ] Existing tests updated for changes in this PR
- [ ] Untested logic flagged with suggested test cases

## 4. Potential Regressions
- [ ] Changes won't break existing functionality
- [ ] Shared utilities/components/contracts checked for downstream impact
- [ ] Database migrations backward-compatible
- [ ] No breaking API contract changes
- [ ] Performance impact considered

## 5. Accessibility (Frontend)
- [ ] Interactive elements have proper ARIA labels and roles
- [ ] Keyboard navigation maintained
- [ ] Form inputs associated with labels
- [ ] Color contrast sufficient
- [ ] Heading hierarchy logical
- [ ] Dynamic content announced to screen readers
- [ ] Section 508 and WCAG 2.1 AA compliance

## 6. USWDS Component Usage
- [ ] USWDS components used correctly
- [ ] USWDS utility classes preferred over custom CSS
- [ ] USWDS design tokens used (spacing, color, typography)
- [ ] No custom components duplicating USWDS functionality

## 7. Code Reuse & DRY
- [ ] No duplicated logic that should be shared
- [ ] Existing utilities/hooks/components reused where possible
- [ ] Shared types/interfaces used consistently

## 8. Additional Quality Checks
- [ ] Complex logic documented
- [ ] Naming conventions followed
- [ ] Imports clean and organized
- [ ] Feature flags used appropriately
- [ ] Logging present without leaking sensitive data
- [ ] New dependencies justified and vetted
- [ ] Migrations reversible with existing data handled
