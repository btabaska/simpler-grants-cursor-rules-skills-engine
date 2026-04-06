# Flag Cleanup Checklist

## Pre-Removal Verification
- [ ] Flag name: _______________
- [ ] Flag is currently ENABLED in production
- [ ] Flag has been enabled for sufficient time
- [ ] No active incidents related to the flagged feature
- [ ] Team has approved removal

## Surface-by-Surface Removal

### Frontend
- [ ] Removed `useFeatureFlag()` calls for this flag
- [ ] Removed conditional rendering branches (kept enabled UI)
- [ ] Removed flag-related props from components
- [ ] Updated/removed flag-specific tests
- [ ] Removed URL parameter overrides for this flag

### API
- [ ] Removed flag checks in service layer
- [ ] Removed flag-conditional logic (kept enabled path)
- [ ] Updated/removed flag-specific tests
- [ ] Removed flag from any configuration loading

### Infrastructure
- [ ] Removed SSM parameter definition from Terraform
- [ ] Removed from environment variable configs
- [ ] Removed from Docker/container configs
- [ ] Removed from CI/CD pipeline configs

### Documentation
- [ ] Updated any docs referencing the flag
- [ ] Removed flag from feature flag inventory (if one exists)

## Post-Removal Verification
- [ ] No remaining references to the flag name in codebase
- [ ] All tests pass (API + Frontend)
- [ ] Linting and type checking pass
- [ ] Convention check passes on all modified files
- [ ] Quality gate pipeline passes
