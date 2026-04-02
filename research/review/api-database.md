# API Database — Pattern Review

**Reviewer(s):** chouinar
**PRs analyzed:** 151
**Rules proposed:** 25
**Open questions:** 3

---

> **IMPORTANT: A note on inconsistencies**
>
> This extraction will surface patterns that are inconsistent — where the codebase
> does things two or three different ways. Some of these inconsistencies may be
> intentional (different contexts warranting different approaches) or evolutionary
> (the team moved from approach A to approach B but hasn't migrated everything).
>
> A big part of this review is resolving that ambiguity — deciding which patterns
> are canonical, which are legacy, and which represent intentional variation.
> Please don't assume that the most common pattern is automatically the right one.

---

## How to Review

For each pattern below, check one box and optionally add notes:
- **CONFIRMED** — This is the canonical pattern. Enforce it.
- **DEPRECATED** — This pattern is legacy. The correct approach is noted in your comments.
- **NEEDS NUANCE** — The rule is directionally correct but needs caveats or exceptions.
- **SPLIT** — This is actually two or more valid patterns for different contexts.

---

## Patterns

### 1. Base Class Inheritance

**Confidence:** High
**Frequency:** Universal -- every model across all 151 PRs
**Source PRs:** #5949, #7498, #4865

**Proposed Rule:**
> ALWAYS inherit from both `ApiSchemaTable` and `TimestampMixin` for every model in the `api` schema.

**Rationale:**
`ApiSchemaTable` sets `schema="api"` so all tables are created in the `api` PostgreSQL schema. `TimestampMixin` provides `created_at` and `updated_at` TIMESTAMP(timezone=True) columns with `server_default=sa.text("now()")`, ensuring every row is auditable.

**Code Examples:**
```python
# From PR #5949 — ExcludedOpportunityReview
class ExcludedOpportunityReview(ApiSchemaTable, TimestampMixin):
    __tablename__ = "excluded_opportunity_review"

    opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    omb_review_status_display: Mapped[str]
    omb_review_status_date: Mapped[date | None]
    last_update_date: Mapped[datetime | None]
```

```python
# From PR #7498 — OrganizationAudit
class OrganizationAudit(ApiSchemaTable, TimestampMixin):
    __tablename__ = "organization_audit"

    organization_audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4
    )
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 2. UUID Primary Keys

**Confidence:** High
**Frequency:** Universal for all new tables since Q1 2025 (~30+ PRs)
**Source PRs:** #6251, #6268, #4316

**Proposed Rule:**
> ALWAYS use `uuid.UUID` primary keys with `default=uuid.uuid4` for new tables. NEVER use `BigInteger` primary keys for new API-schema tables.

**Rationale:**
UUIDs avoid sequential ID enumeration attacks, enable distributed ID generation, and decouple ID assignment from the database. The BigInt-to-UUID migration was driven by reviewer chouinar across multiple PRs.

**Code Examples:**
```python
# From PR #6251 — Role table
class Role(ApiSchemaTable, TimestampMixin):
    __tablename__ = "role"

    role_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    role_name: Mapped[str]
    is_core: Mapped[bool] = mapped_column(default=False)
```

```python
# From PR #6268 — AgencyUser table
class AgencyUser(ApiSchemaTable, TimestampMixin):
    __tablename__ = "agency_user"

    agency_user_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(Agency.agency_id), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(User.user_id), index=True)
```

**Conflicting Examples:**
Legacy tables (e.g., `ExcludedOpportunityReview` from PR #5949) still use `BigInteger` primary keys for cross-referencing with Oracle-era data.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 3. Primary Key Naming Convention

**Confidence:** High
**Frequency:** Universal. Explicitly enforced by reviewer chouinar in PR #4865.
**Source PRs:** #4865, #7498, #6251

**Proposed Rule:**
> ALWAYS name the primary key column `<singular_table_name>_id`. Example: table `role` has PK `role_id`; table `organization_audit` has PK `organization_audit_id`.

**Rationale:**
Consistent naming eliminates ambiguity when joining tables. A column named `role_id` immediately tells you it references the `role` table. Reviewer chouinar explicitly stated: "Prefer to just name the primary key `<table_name>_id` generally."

**Code Examples:**
```python
# From PR #4865 — SamExtractFile
sam_extract_file_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
```

```python
# From PR #7498 — OrganizationAudit
organization_audit_id: Mapped[uuid.UUID] = mapped_column(
    UUID, primary_key=True, default=uuid.uuid4
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 4. Singular Table Names

**Confidence:** High
**Frequency:** Universal. Reviewer chouinar corrected plural naming in PR #4865.
**Source PRs:** #4865, #7498, #6268

**Proposed Rule:**
> ALWAYS use singular table names, not plural. Example: `sam_extract_file` not `sam_extract_files`; `organization_audit` not `organization_audits`.

**Rationale:**
Consistent singular naming is a project convention enforced by the database architecture lead.

**Code Examples:**
```python
# From PR #4865 — corrected from plural
__tablename__ = "sam_extract_file"
```

```python
# From PR #6268 — consistent singular naming
__tablename__ = "agency_user"
__tablename__ = "agency_user_role"
__tablename__ = "organization_user_role"
__tablename__ = "internal_user_role"
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 5. SQLAlchemy 2.0 Mapped Column Annotations

**Confidence:** High
**Frequency:** Universal across all PRs.
**Source PRs:** #7498, #7409, #5949

**Proposed Rule:**
> ALWAYS use SQLAlchemy 2.0 `Mapped[T]` style type annotations with `mapped_column()`. Use `Mapped[T | None]` for nullable columns. Use `Mapped[T]` for non-nullable columns. NEVER use legacy `Column()` syntax.

**Rationale:**
SQLAlchemy 2.0 style provides better static type-checking integration and is the modern, supported approach.

**Code Examples:**
```python
# From PR #7498 — OrganizationAudit: mix of nullable and non-nullable
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), nullable=False, index=True
)
target_user_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), index=True
)
audit_metadata: Mapped[dict | None] = mapped_column(JSONB)
```

```python
# From PR #5949 — simple nullable/non-nullable
omb_review_status_display: Mapped[str]
omb_review_status_date: Mapped[date | None]
last_update_date: Mapped[datetime | None]
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 6. Relationship Declarations with `back_populates`

**Confidence:** High
**Frequency:** High -- consistently applied across all model files with relationships.
**Source PRs:** #7498, #6251, #7409

**Proposed Rule:**
> ALWAYS use `back_populates=` for bidirectional relationships. NEVER use `backref=`. Parent-to-children relationships ALWAYS include `uselist=True` and `cascade="all, delete-orphan"`.

**Rationale:**
`back_populates` is explicit and less magical than `backref`. The `cascade="all, delete-orphan"` on parent ensures children are cleaned up when the parent is deleted. `viewonly=True` is used for non-standard joins where SQLAlchemy should not attempt writes through the relationship.

**Code Examples:**
```python
# From PR #7498 — Organization to OrganizationAudit (parent-to-children)
# On Organization model:
organization_audits: Mapped[list[OrganizationAudit]] = relationship(
    "OrganizationAudit",
    uselist=True,
    back_populates="organization",
    cascade="all, delete-orphan",
)

# On OrganizationAudit model:
organization: Mapped[Organization] = relationship(Organization)
```

```python
# From PR #7409 — viewonly relationship for agency_code joins
agency_record: Mapped[Agency | None] = relationship(
    Agency,
    primaryjoin="Opportunity.agency_code == foreign(Agency.agency_code)",
    uselist=False,
    viewonly=True,
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 7. Lookup Table Four-Layer Pattern

**Confidence:** High
**Frequency:** Very high -- 15+ lookup tables added across the date range.
**Source PRs:** #4865, #6251, #4624

**Proposed Rule:**
> ALWAYS implement lookup/enumeration values using the four-layer pattern: (1) `StrEnum` in `lookup_constants.py`, (2) `LookupConfig` with `LookupStr` entries in `lookup_models.py`, (3) `LookupTable` model class with `@LookupRegistry.register_lookup()` decorator, (4) `LookupColumn` type decorator on referencing models.

**Rationale:**
This pattern provides a clean abstraction where application code works with Python StrEnum values while the database stores integer IDs for performance. The `LookupColumn` type decorator handles the int-to-enum conversion transparently.

**Code Examples:**
```python
# From PR #4865 — Layer 1: StrEnum
class SamGovExtractType(StrEnum):
    MONTHLY = "monthly"
    DAILY = "daily"

class SamGovProcessingStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
```

```python
# From PR #4865 — Layer 2: LookupConfig
SAM_GOV_PROCESSING_STATUS_CONFIG = LookupConfig(
    [
        LookupStr(SamGovProcessingStatus.PENDING, 1),
        LookupStr(SamGovProcessingStatus.COMPLETED, 2),
        LookupStr(SamGovProcessingStatus.FAILED, 3),
    ]
)
```

```python
# From PR #4865 — Layer 4: LookupColumn on referencing model
processing_status: Mapped[SamGovProcessingStatus] = mapped_column(
    "processing_status_id",
    LookupColumn(LkSamGovProcessingStatus),
    ForeignKey(LkSamGovProcessingStatus.sam_gov_processing_status_id),
    index=True,
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 8. No Migration Needed for New Lookup Values

**Confidence:** High
**Frequency:** Explicitly corrected in PR #6162; demonstrated correctly in PR #7270 and PR #9276.
**Source PRs:** #6162, #7270, #9276

**Proposed Rule:**
> NEVER create a dedicated Alembic migration to add new lookup enum values. ALWAYS just add the `LookupStr` entry to the config in `lookup_models.py` and the enum value in `lookup_constants.py`. The `sync_lookup_values()` function called by `make db-migrate` handles syncing automatically.

**Rationale:**
The `LookupRegistry` and `sync_lookup_values()` infrastructure automatically reconciles lookup table contents with the Python config during `make db-migrate`. Creating manual migrations for lookup values is redundant and clutters the migration history.

**Code Examples:**
```python
# From PR #7270 — adding a new funding category (no migration, just config changes)
# api/src/constants/lookup_constants.py — add enum value
class FundingCategory(StrEnum):
    ...
    ENERGY_INFRASTRUCTURE_AND_CRITICAL_MINERAL_AND_MATERIALS = (
        "energy_infrastructure_and_critical_mineral_and_materials"  # EIC
    )

# api/src/db/models/lookup_models.py — add LookupStr entry
    LookupStr(FundingCategory.ENERGY_INFRASTRUCTURE_AND_CRITICAL_MINERAL_AND_MATERIALS, 27),
```

```python
# From PR #6162 — reviewer chouinar correcting an unnecessary migration:
# "We do not need to use a migration to add new lookup values. The migration
#  process already sync lookup values. By just adding the LookupStr to the
#  list of values, running make db-migrate will automatically do basically this."
# The migration file was deleted.
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 9. Foreign Key Columns Must Be Indexed

**Confidence:** High
**Frequency:** Universal. Redundant PK index corrected by chouinar in PR #5949.
**Source PRs:** #7498, #7409, #5949

**Proposed Rule:**
> ALWAYS include `index=True` on foreign key columns. NEVER add `index=True` on primary key columns (they are already indexed).

**Rationale:**
FK columns are frequently used in JOINs and WHERE clauses, so indexing them improves query performance. PKs are automatically indexed by PostgreSQL and adding `index=True` is redundant.

**Code Examples:**
```python
# From PR #7498 — FK columns with index=True
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), nullable=False, index=True
)
organization_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey(Organization.organization_id), nullable=False, index=True
)
```

```python
# From PR #5949 — reviewer correction removing redundant PK index
# chouinar: "A primary key is already indexed - can exclude that"
# Before: opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
# After:
opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 10. Migration File Naming Convention

**Confidence:** High
**Frequency:** Universal across all migration files.
**Source PRs:** #5949, #6251, #7409, #7498

**Proposed Rule:**
> ALWAYS name migration files as `YYYY_MM_DD_<descriptive_slug>.py` where the slug is a lowercase, underscore-separated description of the change.

**Rationale:**
Date-prefixed filenames provide chronological ordering in the filesystem. The descriptive slug enables quick identification of what each migration does without opening the file.

**Code Examples:**
```
# From PR #5949
2025_08_18_create_excluded_opportunity_review_table.py

# From PR #6251
2025_09_02_add_user_role_and_privilege_tables.py

# From PR #7409
2025_12_09_add_fk_opportunity_to_agency.py

# From PR #7498
2025_12_17_add_organization_audit_table.py
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 11. Migration Schema Declaration

**Confidence:** High
**Frequency:** Universal across all migration files.
**Source PRs:** #6251, #7409

**Proposed Rule:**
> ALWAYS specify `schema="api"` for API tables and `schema="staging"` for staging tables in all migration operations (`create_table`, `drop_table`, `add_column`, `create_index`, etc.).

**Rationale:**
The project uses PostgreSQL schemas to separate concerns. Omitting the schema parameter would create tables in the `public` schema by default, breaking the architecture.

**Code Examples:**
```python
# From PR #6251
op.create_table(
    "role",
    sa.Column("role_id", sa.UUID(), nullable=False),
    sa.Column("role_name", sa.Text(), nullable=False),
    ...
    sa.PrimaryKeyConstraint("role_id", name=op.f("role_pkey")),
    schema="api",
)
```

```python
# From PR #7409
op.add_column("opportunity", sa.Column("agency_id", sa.UUID(), nullable=True), schema="api")
op.create_index(
    op.f("opportunity_agency_id_idx"), "opportunity", ["agency_id"],
    unique=False, schema="api"
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 12. Constraint Naming Convention

**Confidence:** High
**Frequency:** Universal -- auto-generated by Alembic's naming convention configuration.
**Source PRs:** #7498, #6251

**Proposed Rule:**
> ALWAYS use `op.f()` wrapper for constraint names in migrations. Follow these naming patterns: PK `<table>_pkey`, FK `<table>_<column>_<referenced_table>_fkey`, Index `<table>_<column>_idx`.

**Rationale:**
`op.f()` delegates to Alembic's configured naming convention, producing deterministic, human-readable constraint names. This ensures consistent naming across all environments and enables reliable downgrade operations.

**Code Examples:**
```python
# From PR #7498
sa.PrimaryKeyConstraint("organization_audit_id", name=op.f("organization_audit_pkey"))
sa.ForeignKeyConstraint(
    ["organization_id"],
    ["api.organization.organization_id"],
    name=op.f("organization_audit_organization_id_organization_fkey"),
)
op.create_index(
    op.f("organization_audit_organization_id_idx"),
    "organization_audit", ["organization_id"],
    unique=False, schema="api",
)
```

```python
# From PR #6251
sa.PrimaryKeyConstraint("role_id", "privilege_id", name=op.f("link_role_privilege_pkey"))
sa.ForeignKeyConstraint(
    ["privilege_id"],
    ["api.lk_privilege.privilege_id"],
    name=op.f("link_role_privilege_privilege_id_lk_privilege_fkey"),
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 13. Association Proxy for Many-to-Many via Lookup Tables

**Confidence:** High
**Frequency:** Moderate -- ~5 instances across the codebase, consistently implemented.
**Source PRs:** #6251, #4624

**Proposed Rule:**
> ALWAYS use SQLAlchemy `association_proxy` for many-to-many relationships through link tables that join to lookup tables. The proxy provides a set-like interface using enum values while the link table manages the actual DB records.

**Rationale:**
Association proxies let business logic work with Python enum sets (e.g., `role.privileges = {Privilege.VIEW_APPLICATION, Privilege.MODIFY_APPLICATION}`) while the ORM manages the link table rows automatically.

**Code Examples:**
```python
# From PR #6251 — Role privileges
class Role(ApiSchemaTable, TimestampMixin):
    link_privileges: Mapped[list["LinkRolePrivilege"]] = relationship(
        back_populates="role", uselist=True, cascade="all, delete-orphan"
    )
    privileges: AssociationProxy[set[Privilege]] = association_proxy(
        "link_privileges",
        "privilege",
        creator=lambda obj: LinkRolePrivilege(privilege=obj),
    )
```

```python
# From PR #4624 — Competition open_to_applicants
open_to_applicants: AssociationProxy[set[CompetitionOpenToApplicant]] = association_proxy(
    "link_competition_open_to_applicant",
    "competition_open_to_applicant",
    creator=lambda obj: LinkCompetitionOpenToApplicant(competition_open_to_applicant=obj),
)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 14. Wrap DB Operations in `db_session.begin()`

**Confidence:** High
**Frequency:** Enforced in multiple reviews by chouinar (PRs #4865, #6162).
**Source PRs:** #6162, #4865

**Proposed Rule:**
> ALWAYS wrap database operations in a `with db_session.begin():` block. NEVER perform DB reads or writes outside of an explicit transaction context.

**Rationale:**
Explicit transaction boundaries ensure atomicity (all-or-nothing commits), proper rollback on errors, and avoid surprising autocommit behavior. Reviewer chouinar stated: "Any code we have for interacting with the db_session should have `db_session.begin()` wrapping it."

**Code Examples:**
```python
# From PR #6162 — cleanup task
def run_task(self) -> None:
    with self.db_session.begin():
        old_files = self._get_old_files_to_cleanup()
        if not old_files:
            return
        for sam_extract_file in old_files:
            self._cleanup_file(sam_extract_file)
```

```python
# From PR #4865 — fetch extracts task
def run_task(self) -> None:
    with self.db_session.begin():
        logger.info("Attempting to fetch monthly extract.")
        monthly_extract_date = self._fetch_monthly_extract()
        logger.info("Attempting to fetch daily extracts.")
        self._fetch_daily_extracts(monthly_extract_date)
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 15. Use `is_()` for Boolean Comparisons

**Confidence:** High
**Frequency:** Enforced when encountered. Explicitly corrected in PR #9276.
**Source PRs:** #9276

**Proposed Rule:**
> ALWAYS use `Model.column.is_(True)` or `Model.column.is_(False)` for boolean column comparisons in SQLAlchemy queries. NEVER use `== True` or `== False`.

**Rationale:**
`== True` triggers Python linting warnings (`E712`) and type-checker complaints. `is_(True)` is the idiomatic SQLAlchemy approach that generates the same SQL but satisfies linters and type checkers.

**Code Examples:**
```python
# From PR #9276 — reviewer chouinar: "SQLAlchemy has an is_ function for doing bool
# comparisons to avoid type-checking complaints."

# Correct:
existing_workflow = db_session.scalar(
    select(Workflow).where(
        Workflow.workflow_type == workflow_type,
        entity_column == entity_id,
        Workflow.is_active.is_(True),
    )
)

# Anti-pattern (what was submitted before review):
# Workflow.is_active == True
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 16. Use `datetime_util.utcnow()` for Timestamps

**Confidence:** High
**Frequency:** Enforced when encountered. Corrected by chouinar in PR #4865.
**Source PRs:** #4865

**Proposed Rule:**
> ALWAYS use `datetime_util.utcnow()` for any application-level timestamp needs. NEVER use `datetime.now()` or `datetime.utcnow()` directly.

**Rationale:**
The project's `datetime_util.utcnow()` ensures consistent timezone-aware UTC timestamps across the application. Using `datetime.now()` can produce naive datetimes that cause comparison bugs with the database's `TIMESTAMP(timezone=True)` columns.

**Code Examples:**
```python
# From PR #4865 — fetch extracts task
from src.util import datetime_util

current_date = datetime_util.utcnow().date()
```

**Conflicting Examples:**
None found. Reviewer chouinar stated in PR #4865: "Use the datetime util for anything, it better handles timezones."

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 17. Set UUIDs Explicitly at Object Creation

**Confidence:** High
**Frequency:** Enforced in PRs #6407, #6410 by reviewer chouinar.
**Source PRs:** #4865, #6407

**Proposed Rule:**
> ALWAYS set UUID primary keys explicitly at object creation time (e.g., `Model(model_id=uuid.uuid4(), ...)`). NEVER call `db_session.flush()` solely to get auto-generated IDs.

**Rationale:**
Flushing mid-transaction to obtain IDs can cause subtle session state issues and unnecessary round-trips. Since UUIDs can be generated client-side, explicitly setting them avoids these problems and enables immediate use of the ID (e.g., in logging).

**Code Examples:**
```python
# From PR #4865 — setting UUID explicitly
extract = SamExtractFile(
    extract_type=SamGovExtractType.MONTHLY,
    extract_date=target_date,
    filename=filename,
    s3_path=s3_path,
    processing_status=SamGovProcessingStatus.PENDING,
    sam_extract_file_id=uuid.uuid4(),  # Set UUID explicitly to avoid flush
)
self.db_session.add(extract)
```

```python
# From PR #6407 — reviewer chouinar correction:
# "Alternatively you can add the IDs when we create the objects
# (eg. organization_user = OrganizationUser(organization_user_id=uuid.uuid4(), ...)).
# Sometimes flushes can be a bit iffy. Setting the IDs would also help with logging."
```

**Conflicting Examples:**
The PR #6407 author reported difficulty implementing this in some cases where SQLAlchemy relationship mapping didn't populate `organization_user_roles` without a flush. This suggests the pattern may not always be straightforward when bidirectional relationships are involved.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 18. Legacy IDs as Plain Columns, Not Foreign Keys

**Confidence:** High
**Frequency:** Explicitly corrected in PR #5949, applied across UUID migration PRs.
**Source PRs:** #5949

**Proposed Rule:**
> NEVER make legacy integer ID columns (e.g., `legacy_opportunity_id`) foreign keys to other tables. ALWAYS store them as plain indexed columns for reference only.

**Rationale:**
Legacy IDs from Oracle are retained for cross-referencing during data migration but should not create FK dependency chains. FK constraints on legacy IDs would force complex ordering in ETL pipelines.

**Code Examples:**
```python
# From PR #5949 — reviewer chouinar on ExcludedOpportunityReview:
# "The ID we store in this table shouldn't be a foreign key &
# will be the legacy integer ID. If it's a foreign key, when we build the
# process to copy over, we have to change the order of operations..."

# Result:
opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
# Note: no ForeignKey() — this is an integer reference, not a real FK
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 19. Composite Primary Key Implies Unique Constraint

**Confidence:** High
**Frequency:** Explicitly clarified by chouinar in PR #6268.
**Source PRs:** #6268

**Proposed Rule:**
> NEVER add a separate unique constraint on a composite primary key. A composite PK already enforces uniqueness on the combination of its columns.

**Rationale:**
PostgreSQL enforces uniqueness on the composite PK automatically. Adding a separate UniqueConstraint would be redundant overhead.

**Code Examples:**
```python
# From PR #6268 — composite PK on role assignment tables
class OrganizationUserRole(ApiSchemaTable, TimestampMixin):
    __tablename__ = "organization_user_role"

    organization_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(OrganizationUser.organization_user_id), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(Role.role_id), primary_key=True)
```

**Conflicting Examples:**
None found. Reviewer chouinar clarified: "A primary key of role_id + <entity>_user_id is also a unique constraint."

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 20. Data Migration Pattern

**Confidence:** High
**Frequency:** Low-moderate (~3 PRs), but consistently implemented.
**Source PRs:** #6407

**Proposed Rule:**
> ALWAYS use `op.execute(text("...").params(...))` for data-backfill migrations. ALWAYS use `NOT EXISTS` guards to ensure idempotency. Downgrade functions for data migrations may be left as `pass` when rollback logic is complex.

**Rationale:**
Parameterized queries prevent SQL injection. `NOT EXISTS` guards make the migration idempotent (safe to re-run). Empty downgrades are acceptable for data migrations where reversal is non-trivial.

**Code Examples:**
```python
# From PR #6407 — assigning org admin role to existing owners
from sqlalchemy import text
from src.constants.static_role_values import ORG_ADMIN_ID

def upgrade():
    op.execute(
        text(
            """
        INSERT INTO api.organization_user_role (organization_user_id, role_id, created_at, updated_at)
        SELECT
            ou.organization_user_id,
            :role_id,
            NOW(),
            NOW()
        FROM api.organization_user ou
        WHERE ou.is_organization_owner = true
        AND NOT EXISTS (
            SELECT 1
            FROM api.organization_user_role our
            WHERE our.organization_user_id = ou.organization_user_id
            AND our.role_id = :role_id
        );
        """
        ).params(role_id=ORG_ADMIN_ID)
    )

def downgrade():
    pass
```

**Conflicting Examples:**
None found. Reviewer chouinar noted: "I think the downgrade to undo this might be more complex... Might be best to just exclude a downgrade and we'd fix it manually."

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 21. Factory Pattern for Tests

**Confidence:** High
**Frequency:** Universal -- every PR that adds a model also adds a factory.
**Source PRs:** #7498, #6268, #5949

**Proposed Rule:**
> ALWAYS define test factories in `api/tests/src/db/models/factories.py`. Each model MUST have a corresponding `<Model>Factory(BaseFactory)`. Use `factory.SubFactory()` for relationships, `factory.LazyAttribute()` for derived IDs, `Generators.UuidObj` for UUID fields, and `factory.Trait()` for role/variant configurations.

**Rationale:**
Centralized factories ensure consistent test data creation across the entire test suite. `SubFactory` + `LazyAttribute` keeps referential integrity correct. Traits enable concise configuration of common variants.

**Code Examples:**
```python
# From PR #7498 — OrganizationAuditFactory with Traits
class OrganizationAuditFactory(BaseFactory):
    class Meta:
        model = entity_models.OrganizationAudit

    organization_audit_id = Generators.UuidObj

    user = factory.SubFactory(UserFactory, with_profile=True)
    user_id = factory.LazyAttribute(lambda u: u.user.user_id)

    organization = factory.SubFactory(OrganizationFactory)
    organization_id = factory.LazyAttribute(lambda o: o.organization.organization_id)

    organization_audit_event = OrganizationAuditEvent.USER_ADDED

    class Params:
        is_user_added = factory.Trait(
            organization_audit_event=OrganizationAuditEvent.USER_ADDED,
            target_user=factory.SubFactory(UserFactory, with_profile=True),
            target_user_id=factory.LazyAttribute(lambda o: o.target_user.user_id),
        )
```

```python
# From PR #6268 — Trait-based role factories, requested by chouinar
class RoleFactory(BaseFactory):
    class Meta:
        model = user_models.Role

    role_id = Generators.UuidObj
    role_name = factory.Faker("sentence", nb_words=3)

    class Params:
        is_org_role = factory.Trait(
            privileges=[
                Privilege.VIEW_APPLICATION,
                Privilege.MODIFY_APPLICATION,
                Privilege.MANAGE_ORG_MEMBERS,
            ],
            role_types=[RoleType.ORGANIZATION],
        )
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 22. Model File Registration

**Confidence:** High
**Frequency:** Applied whenever a new model file is created.
**Source PRs:** #4865

**Proposed Rule:**
> ALWAYS register new model files in `api/src/db/models/__init__.py` when adding a new model module.

**Rationale:**
SQLAlchemy needs all model modules imported to register them with the metadata. Unregistered models will not be detected by Alembic's autogenerate, and migrations will not be created.

**Code Examples:**
```python
# From PR #4865 — registering sam_extract_models
# api/src/db/models/__init__.py
from src.db.models import (
    ...
    extract_models,
    lookup_models,
    opportunity_models,
    sam_extract_models,   # <-- added
    task_models,
    user_models,
)

__all__ = [
    ...
    "sam_extract_models",  # <-- added
    ...
]
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 23. Table Name Prefixes for Special Table Types

**Confidence:** High
**Frequency:** Universal across all lookup and link tables.
**Source PRs:** #4624, #6251, #7498

**Proposed Rule:**
> ALWAYS prefix lookup tables with `lk_` (e.g., `lk_form_family`, `lk_privilege`). ALWAYS prefix many-to-many link tables with `link_` (e.g., `link_role_privilege`, `link_competition_open_to_applicant`).

**Rationale:**
Prefixes provide immediate visual identification of table purpose. `lk_` tables hold reference/enumeration data. `link_` tables are join tables for many-to-many relationships.

**Code Examples:**
```python
# From PR #4624
__tablename__ = "lk_form_family"
__tablename__ = "lk_competition_open_to_applicant"
__tablename__ = "link_competition_open_to_applicant"
```

```python
# From PR #6251
__tablename__ = "lk_privilege"
__tablename__ = "lk_role_type"
__tablename__ = "link_role_privilege"
__tablename__ = "link_role_role_type"
```

**Conflicting Examples:**
None found.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 24. Drop-Then-Recreate for PK Type Changes

**Confidence:** High
**Frequency:** Applied in the BigInt-to-UUID migration wave (PRs #4316, #4392, #4846).
**Source PRs:** #4316

**Proposed Rule:**
> When changing primary key types (e.g., BigInteger to UUID), ALWAYS use paired migrations: one to drop the table(s), then one to recreate with the new schema. NEVER attempt in-place ALTER TABLE for PK type changes.

**Rationale:**
PostgreSQL does not easily support changing a PK column's type in place, especially when foreign keys reference it. The drop-recreate approach is cleaner. This was acceptable because the project was in early development and the tables could be repopulated.

**Code Examples:**
```python
# From PR #4316 — agency BigInt to UUID
# Migration 1: 2025_03_25_remove_agency_and_agency_contact_info_.py
def upgrade():
    op.drop_table("link_agency_download_file_type", schema="api")
    op.drop_index(op.f("agency_agency_code_idx"), table_name="agency", schema="api")
    op.drop_table("agency", schema="api")
    op.drop_table("agency_contact_info", schema="api")

# Migration 2: 2025_03_25_update_agency_tables_to_use_uuid.py
# Recreates agency with sa.Column("agency_id", sa.UUID(), nullable=False)
```

**Conflicting Examples:**
This pattern is specific to the early-development migration-era context and may not be appropriate for production tables with data that cannot be dropped.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

### 25. Test Cleanup with `cascade_delete_from_db_table`

**Confidence:** Medium
**Frequency:** Moderate -- used in PRs #4865, #6162.
**Source PRs:** #6162

**Proposed Rule:**
> ALWAYS use `cascade_delete_from_db_table(db_session, Model)` in test setup/teardown fixtures when tests create database records that could interfere with other tests.

**Rationale:**
Ensures test isolation by removing all rows from the table (and cascading to dependent tables) before and after each test method.

**Code Examples:**
```python
# From PR #6162 — cleanup task tests
class TestCleanupOldSamExtractsTask(BaseTestClass):
    @pytest.fixture(autouse=True)
    def setup_method(self, db_session):
        cascade_delete_from_db_table(db_session, SamExtractFile)
        db_session.commit()
        yield
        cascade_delete_from_db_table(db_session, SamExtractFile)
        db_session.commit()
```

**Conflicting Examples:**
This pattern conflicts with the api-tests domain guidance (Rule 11) that says to avoid table truncation unless the test processes an entire table. The `autouse=True` pattern with both setup and teardown may be heavier than necessary.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

---

## Coverage Gaps

1. **No database query performance guidelines (Cross-domain GAP-4).** While `selectinload("*")` is banned, there are no documented guidelines for when to use `selectinload` vs. `joinedload` vs. `subqueryload`, query complexity limits, or N+1 detection.

2. **No migration rollback strategy (Cross-domain GAP-8).** Migrations use Alembic with `upgrade()` and `downgrade()` functions, but there is no documented policy for when/how to roll back migrations in production, how to handle data migrations that cannot be cleanly reversed, or testing downgrade paths.

3. **No guidance on explicit UUID assignment when bidirectional relationships are involved.** PR #6407 author reported difficulty; tech lead should clarify.

## Inconsistencies Requiring Resolution

1. **Test cleanup pattern conflict:** The database domain's Rule 25 (`cascade_delete_from_db_table` in setup/teardown) conflicts with api-tests Rule 11 (avoid unnecessary table truncation). Tech lead should clarify when each approach is appropriate.

2. **Drop-then-recreate applicability:** Rule 24 was appropriate during early development. Should this be marked as legacy/inapplicable for production tables, or is there a modified version for production PK changes?

3. **Boolean field naming (Cross-domain CCP-6):** Boolean fields across all models should use question-form prefixes (`is_`, `has_`, `can_`, `was_`). This is implicitly followed in all database models but is not documented as a database-specific rule.
