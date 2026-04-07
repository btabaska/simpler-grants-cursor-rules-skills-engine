# FedRAMP Compliance Checker

Validate a Terraform plan diff against the FedRAMP Moderate baseline for simpler-grants-gov.

## What I Need From You

1. `terraform show -json plan.bin` output (preferred)
2. A `terraform plan` text diff
3. A list of resource changes with attributes

## What Happens Next

The FedRAMP Compliance Checker Agent will:
1. Inventory each resource change and load relevant ADRs and conventions
2. Check each AWS service against the FedRAMP Marketplace authorized-services list
3. Verify FIPS 140-2 encryption at rest and in transit
4. Enforce approved-region placement (`us-gov-*` or documented commercial)
5. Map findings to NIST 800-53 Rev 5 (AC-2, AC-5, AU-2, SC-7, SC-28, SI-4)
6. Write `documentation/compliance/fedramp-reports/PR-<num>-fedramp.md` with severity-rated gaps and `path:line` evidence

## Tips

- JSON plan output gives the cleanest results
- Run after every infra PR; gaps block merge
- The agent never applies changes
