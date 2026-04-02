# Pass 2: Pattern Codification -- API Database/Models Domain

**Source:** 151 merged PRs from HHS/simpler-grants-gov (`api/src/db/`)
**Date range:** 2025-03-31 to 2026-03-26
**Pass 1 completed:** 2026-03-27
**Pass 2 completed:** 2026-03-30
**PRs sampled for code examples:** #4316, #4624, #4865, #5949, #6162, #6251, #6268, #6407, #7270, #7409, #7498, #9276

---

## Rule 1: Base Class Inheritance

**Pattern Name:** API Schema Table Base Classes

**Rule Statement:** ALWAYS inherit from both `ApiSchemaTable` and `TimestampMixin` for every model in the `api` schema.

**Confidence:** High

**Frequency:** Universal -- every model across all 151 PRs follows this pattern.

**Code Examples:**

From PR #5949 (ExcludedOpportunityReview):
```python
class ExcludedOpportunityReview(ApiSchemaTable, TimestampMixin):
    __tablename__ = "excluded_opportunity_review"

    opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    omb_review_status_display: Mapped[str]
    omb_review_status_date: Mapped[date | None]
    last_update_date: Mapped[datetime | None]
```

From PR #7498 (OrganizationAudit):
```python
class OrganizationAudit(ApiSchemaTable, TimestampMixin):
    __tablename__ = "organization_audit"

    organization_audit_id: Mapped[uuid.UUID] = mapped_column(
        UUID, primary_key=True, default=uuid.uuid4
    )
```

From PR #4865 (SamExtractFile):
```python
class SamExtractFile(ApiSchemaTable, TimestampMixin):
    """Represents a SAM.gov extract file that has been processed"""

    __tablename__ = "sam_extract_file"

    sam_extract_file_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
```

**Rationale:** `ApiSchemaTable` sets `schema="api"` so all tables are created in the `api` PostgreSQL schema. `TimestampMixin` provides `created_at` and `updated_at` TIMESTAMP(timezone=True) columns with `server_default=sa.text("now()")`, ensuring every row is auditable.

**Open Questions:** None. This is fully consistent.

---

## Rule 2: UUID Primary Keys

**Pattern Name:** UUID Primary Keys with Explicit Default

**Rule Statement:** ALWAYS use `uuid.UUID` primary keys with `default=uuid.uuid4` for new tables. NEVER use `BigInteger` primary keys for new API-schema tables.

**Confidence:** High

**Frequency:** Universal for all new tables since Q1 2025 (~30+ PRs). The project completed a systematic BigInt-to-UUID migration across agency, opportunity, competition, and extract tables.

**Code Examples:**

From PR #6251 (Role table):
```python
class Role(ApiSchemaTable, TimestampMixin):
    __tablename__ = "role"

    role_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    role_name: Mapped[str]
    is_core: Mapped[bool] = mapped_column(default=False)
```

From PR #6268 (AgencyUser table):
```python
class AgencyUser(ApiSchemaTable, TimestampMixin):
    __tablename__ = "agency_user"

    agency_user_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    agency_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(Agency.agency_id), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(User.user_id), index=True)
```

From PR #4316 (drop-and-recreate migration to convert agency PK from BigInteger to UUID):
```
# Migration 1: 2025_03_25_remove_agency_and_agency_contact_info_.py
def upgrade():
    op.drop_table("link_agency_download_file_type", schema="api")
    op.drop_table("agency", schema="api")
    op.drop_table("agency_contact_info", schema="api")

# Migration 2: 2025_03_25_update_agency_tables_to_use_uuid.py
# Recreates with sa.Column("agency_id", sa.UUID(), nullable=False)
```

**Rationale:** UUIDs avoid sequential ID enumeration attacks, enable distributed ID generation, and decouple ID assignment from the database. The BigInt-to-UUID migration was driven by reviewer chouinar across multiple PRs.

**Open Questions:** None. This is settled policy.

---

## Rule 3: Primary Key Naming Convention

**Pattern Name:** Table-Name-Prefixed Primary Key

**Rule Statement:** ALWAYS name the primary key column `<singular_table_name>_id`. Example: table `role` has PK `role_id`; table `organization_audit` has PK `organization_audit_id`.

**Confidence:** High

**Frequency:** Universal. Explicitly enforced by reviewer chouinar in PR #4865.

**Code Examples:**

From PR #4865 (SamExtractFile):
```python
sam_extract_file_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
```

From PR #7498 (OrganizationAudit):
```python
organization_audit_id: Mapped[uuid.UUID] = mapped_column(
    UUID, primary_key=True, default=uuid.uuid4
)
```

From PR #6251 (Role):
```python
role_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
```

**Rationale:** Consistent naming eliminates ambiguity when joining tables. A column named `role_id` immediately tells you it references the `role` table. Reviewer chouinar explicitly stated: "Prefer to just name the primary key `<table_name>_id` generally."

**Open Questions:** None.

---

## Rule 4: Singular Table Names

**Pattern Name:** Singular Table Naming

**Rule Statement:** ALWAYS use singular table names, not plural. Example: `sam_extract_file` not `sam_extract_files`; `organization_audit` not `organization_audits`.

**Confidence:** High

**Frequency:** Universal. Reviewer chouinar corrected plural naming in PR #4865, renaming `sam_extract_files` to `sam_extract_file`.

**Code Examples:**

From PR #4865 (corrected from plural):
```python
__tablename__ = "sam_extract_file"
```

From PR #7498:
```python
__tablename__ = "organization_audit"
```

From PR #6268:
```python
__tablename__ = "agency_user"
__tablename__ = "agency_user_role"
__tablename__ = "organization_user_role"
__tablename__ = "internal_user_role"
```

**Rationale:** Consistent singular naming is a project convention enforced by the database architecture lead.

**Open Questions:** None.

---

## Rule 5: SQLAlchemy 2.0 Mapped Column Annotations

**Pattern Name:** Mapped Column Type Annotations

**Rule Statement:** ALWAYS use SQLAlchemy 2.0 `Mapped[T]` style type annotations with `mapped_column()`. Use `Mapped[T | None]` for nullable columns. Use `Mapped[T]` for non-nullable columns. NEVER use legacy `Column()` syntax.

**Confidence:** High

**Frequency:** Universal across all PRs.

**Code Examples:**

From PR #7498 (OrganizationAudit -- mix of nullable and non-nullable):
```python
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), nullable=False, index=True
)
target_user_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), index=True
)
audit_metadata: Mapped[dict | None] = mapped_column(JSONB)
```

From PR #7409 (adding nullable FK to opportunity):
```python
agency_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID, ForeignKey(Agency.agency_id), index=True
)
```

From PR #5949:
```python
omb_review_status_display: Mapped[str]
omb_review_status_date: Mapped[date | None]
last_update_date: Mapped[datetime | None]
```

**Rationale:** SQLAlchemy 2.0 style provides better static type-checking integration and is the modern, supported approach. The `Mapped[T | None]` pattern uses Python 3.10+ union syntax, which was further simplified with the Python 3.14 upgrade (PR #7268) that removed quoted forward references.

**Open Questions:** None.

---

## Rule 6: Relationship Declarations

**Pattern Name:** Relationship Pattern with `back_populates`

**Rule Statement:** ALWAYS use `back_populates=` for bidirectional relationships. NEVER use `backref=`. Parent-to-children relationships ALWAYS include `uselist=True` and `cascade="all, delete-orphan"`.

**Confidence:** High

**Frequency:** High -- consistently applied across all model files with relationships.

**Code Examples:**

From PR #7498 (Organization to OrganizationAudit -- parent-to-children):
```python
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

From PR #6251 (Role to LinkRolePrivilege):
```python
# On Role model:
link_privileges: Mapped[list["LinkRolePrivilege"]] = relationship(
    back_populates="role", uselist=True, cascade="all, delete-orphan"
)

# On LinkRolePrivilege model:
role: Mapped[Role] = relationship(Role)
```

From PR #7409 (viewonly relationship for agency_code joins):
```python
agency_record: Mapped[Agency | None] = relationship(
    Agency,
    primaryjoin="Opportunity.agency_code == foreign(Agency.agency_code)",
    uselist=False,
    viewonly=True,
)
```

**Rationale:** `back_populates` is explicit and less magical than `backref`. The `cascade="all, delete-orphan"` on parent ensures children are cleaned up when the parent is deleted. `viewonly=True` is used for non-standard joins (e.g., code-based joins) where SQLAlchemy should not attempt writes through the relationship.

**Open Questions:** None.

---

## Rule 7: Lookup Table Four-Layer Pattern

**Pattern Name:** Lookup Table Architecture (StrEnum + LookupConfig + LookupTable + LookupColumn)

**Rule Statement:** ALWAYS implement lookup/enumeration values using the four-layer pattern: (1) `StrEnum` in `lookup_constants.py`, (2) `LookupConfig` with `LookupStr` entries in `lookup_models.py`, (3) `LookupTable` model class with `@LookupRegistry.register_lookup()` decorator, (4) `LookupColumn` type decorator on referencing models.

**Confidence:** High

**Frequency:** Very high -- 15+ lookup tables added across the date range.

**Code Examples:**

Layer 1 -- StrEnum (from PR #4865):
```python
# api/src/constants/lookup_constants.py
class SamGovExtractType(StrEnum):
    MONTHLY = "monthly"
    DAILY = "daily"

class SamGovProcessingStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
```

Layer 2 -- LookupConfig (from PR #4865):
```python
# api/src/db/models/lookup_models.py
SAM_GOV_PROCESSING_STATUS_CONFIG = LookupConfig(
    [
        LookupStr(SamGovProcessingStatus.PENDING, 1),
        LookupStr(SamGovProcessingStatus.COMPLETED, 2),
        LookupStr(SamGovProcessingStatus.FAILED, 3),
    ]
)
```

Layer 3 -- LookupTable model (from PR #4865):
```python
@LookupRegistry.register_lookup(SAM_GOV_PROCESSING_STATUS_CONFIG)
class LkSamGovProcessingStatus(LookupTable, TimestampMixin):
    __tablename__ = "lk_sam_gov_processing_status"

    sam_gov_processing_status_id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str]

    @classmethod
    def from_lookup(cls, lookup: Lookup) -> "LkSamGovProcessingStatus":
        return LkSamGovProcessingStatus(
            sam_gov_processing_status_id=lookup.lookup_val,
            description=lookup.get_description()
        )
```

Layer 4 -- LookupColumn on referencing model (from PR #4865):
```python
# api/src/db/models/sam_extract_models.py
processing_status: Mapped[SamGovProcessingStatus] = mapped_column(
    "processing_status_id",
    LookupColumn(LkSamGovProcessingStatus),
    ForeignKey(LkSamGovProcessingStatus.sam_gov_processing_status_id),
    index=True,
)
```

**Rationale:** This pattern provides a clean abstraction where application code works with Python StrEnum values while the database stores integer IDs for performance. The `LookupColumn` type decorator handles the int-to-enum conversion transparently. The `LookupRegistry` auto-syncs values during migrations.

**Open Questions:** None.

---

## Rule 8: No Migration Needed for New Lookup Values

**Pattern Name:** Lookup Value Sync Without Migration

**Rule Statement:** NEVER create a dedicated Alembic migration to add new lookup enum values. ALWAYS just add the `LookupStr` entry to the config in `lookup_models.py` and the enum value in `lookup_constants.py`. The `sync_lookup_values()` function called by `make db-migrate` handles syncing automatically.

**Confidence:** High

**Frequency:** Explicitly corrected in PR #6162; demonstrated correctly in PR #7270 and PR #9276.

**Code Examples:**

From PR #7270 (adding a new funding category -- no migration, just config changes):
```python
# api/src/constants/lookup_constants.py -- add enum value
class FundingCategory(StrEnum):
    ...
    ENERGY_INFRASTRUCTURE_AND_CRITICAL_MINERAL_AND_MATERIALS = (
        "energy_infrastructure_and_critical_mineral_and_materials"  # EIC
    )

# api/src/db/models/lookup_models.py -- add LookupStr entry
    LookupStr(FundingCategory.ENERGY_INFRASTRUCTURE_AND_CRITICAL_MINERAL_AND_MATERIALS, 27),
```

From PR #6162 (reviewer chouinar correcting an unnecessary migration):
```python
# The author had created: 2025_08_23_add_deleted_status_to_sam_gov_processing_status.py
# Reviewer chouinar commented:
# "We do not need to use a migration to add new lookup values. The migration
#  process already sync lookup values. By just adding the LookupStr to the
#  list of values, running make db-migrate will automatically do basically this."
# The migration file was deleted.
```

From PR #9276 (adding a test workflow type -- just config, no migration):
```python
# lookup_constants.py
class WorkflowType(StrEnum):
    ...
    NO_CONCURRENT_TEST_WORKFLOW = "no_concurrent_test_workflow"

# lookup_models.py
    LookupStr(WorkflowType.NO_CONCURRENT_TEST_WORKFLOW, 5),
```

**Rationale:** The `LookupRegistry` and `sync_lookup_values()` infrastructure automatically reconciles lookup table contents with the Python config during `make db-migrate`. Creating manual migrations for lookup values is redundant and clutters the migration history.

**Open Questions:** None. This was explicitly clarified by the database architecture lead.

---

## Rule 9: Foreign Key Columns Must Be Indexed

**Pattern Name:** Foreign Key Column Indexing

**Rule Statement:** ALWAYS include `index=True` on foreign key columns. NEVER add `index=True` on primary key columns (they are already indexed).

**Confidence:** High

**Frequency:** Universal. The redundant PK index was corrected by chouinar in PR #5949.

**Code Examples:**

From PR #7498 (FK columns with index=True):
```python
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), nullable=False, index=True
)
organization_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey(Organization.organization_id), nullable=False, index=True
)
target_user_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), index=True
)
```

From PR #7409 (adding FK to existing table):
```python
agency_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID, ForeignKey(Agency.agency_id), index=True
)
```

From PR #5949 (reviewer correction -- removing redundant PK index):
```
# chouinar: "A primary key is already indexed - can exclude that"
# Before: opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
# After:
opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
```

**Rationale:** FK columns are frequently used in JOINs and WHERE clauses, so indexing them improves query performance. PKs are automatically indexed by PostgreSQL and adding `index=True` is redundant.

**Open Questions:** None.

---

## Rule 10: Migration File Naming Convention

**Pattern Name:** Date-Prefixed Migration Naming

**Rule Statement:** ALWAYS name migration files as `YYYY_MM_DD_<descriptive_slug>.py` where the slug is a lowercase, underscore-separated description of the change.

**Confidence:** High

**Frequency:** Universal across all migration files.

**Code Examples:**

From PR #5949:
```
2025_08_18_create_excluded_opportunity_review_table.py
```

From PR #6251:
```
2025_09_02_add_user_role_and_privilege_tables.py
```

From PR #7409:
```
2025_12_09_add_fk_opportunity_to_agency.py
```

From PR #7498:
```
2025_12_17_add_organization_audit_table.py
```

**Rationale:** Date-prefixed filenames provide chronological ordering in the filesystem. The descriptive slug enables quick identification of what each migration does without opening the file.

**Open Questions:** None.

---

## Rule 11: Migration Schema Declaration

**Pattern Name:** Explicit Schema in Migrations

**Rule Statement:** ALWAYS specify `schema="api"` for API tables and `schema="staging"` for staging tables in all migration operations (`create_table`, `drop_table`, `add_column`, `create_index`, etc.).

**Confidence:** High

**Frequency:** Universal across all migration files.

**Code Examples:**

From PR #6251:
```python
op.create_table(
    "role",
    sa.Column("role_id", sa.UUID(), nullable=False),
    sa.Column("role_name", sa.Text(), nullable=False),
    ...
    sa.PrimaryKeyConstraint("role_id", name=op.f("role_pkey")),
    schema="api",
)
```

From PR #7409:
```python
op.add_column("opportunity", sa.Column("agency_id", sa.UUID(), nullable=True), schema="api")
op.create_index(
    op.f("opportunity_agency_id_idx"), "opportunity", ["agency_id"],
    unique=False, schema="api"
)
```

**Rationale:** The project uses PostgreSQL schemas to separate concerns. Omitting the schema parameter would create tables in the `public` schema by default, breaking the architecture.

**Open Questions:** None.

---

## Rule 12: Constraint Naming Convention

**Pattern Name:** Deterministic Constraint Names via `op.f()`

**Rule Statement:** ALWAYS use `op.f()` wrapper for constraint names in migrations. Follow these naming patterns: PK `<table>_pkey`, FK `<table>_<column>_<referenced_table>_fkey`, Index `<table>_<column>_idx`.

**Confidence:** High

**Frequency:** Universal -- auto-generated by Alembic's naming convention configuration.

**Code Examples:**

From PR #7498:
```python
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

From PR #6251:
```python
sa.PrimaryKeyConstraint("role_id", "privilege_id", name=op.f("link_role_privilege_pkey"))
sa.ForeignKeyConstraint(
    ["privilege_id"],
    ["api.lk_privilege.privilege_id"],
    name=op.f("link_role_privilege_privilege_id_lk_privilege_fkey"),
)
```

**Rationale:** `op.f()` delegates to Alembic's configured naming convention, producing deterministic, human-readable constraint names. This ensures consistent naming across all environments and enables reliable downgrade operations.

**Open Questions:** None.

---

## Rule 13: Association Proxy for Many-to-Many via Lookup Tables

**Pattern Name:** Association Proxy Pattern

**Rule Statement:** ALWAYS use SQLAlchemy `association_proxy` for many-to-many relationships through link tables that join to lookup tables. The proxy provides a set-like interface using enum values while the link table manages the actual DB records.

**Confidence:** High

**Frequency:** Moderate -- ~5 instances across the codebase, consistently implemented.

**Code Examples:**

From PR #6251 (Role privileges):
```python
class Role(ApiSchemaTable, TimestampMixin):
    link_privileges: Mapped[list["LinkRolePrivilege"]] = relationship(
        back_populates="role", uselist=True, cascade="all, delete-orphan"
    )
    privileges: AssociationProxy[set[Privilege]] = association_proxy(
        "link_privileges",
        "privilege",
        creator=lambda obj: LinkRolePrivilege(privilege=obj),
    )
    role_types: AssociationProxy[set[RoleType]] = association_proxy(
        "link_role_types",
        "role_type",
        creator=lambda obj: LinkRoleRoleType(role_type=obj),
    )
```

From PR #4624 (Competition open_to_applicants):
```python
open_to_applicants: AssociationProxy[set[CompetitionOpenToApplicant]] = association_proxy(
    "link_competition_open_to_applicant",
    "competition_open_to_applicant",
    creator=lambda obj: LinkCompetitionOpenToApplicant(competition_open_to_applicant=obj),
)
```

**Rationale:** Association proxies let business logic work with Python enum sets (e.g., `role.privileges = {Privilege.VIEW_APPLICATION, Privilege.MODIFY_APPLICATION}`) while the ORM manages the link table rows automatically.

**Open Questions:** None.

---

## Rule 14: Wrap DB Operations in `db_session.begin()`

**Pattern Name:** Transaction Wrapping

**Rule Statement:** ALWAYS wrap database operations in a `with db_session.begin():` block. NEVER perform DB reads or writes outside of an explicit transaction context.

**Confidence:** High

**Frequency:** Enforced in multiple reviews by chouinar (PRs #4865, #6162).

**Code Examples:**

From PR #6162 (cleanup task -- reviewer requested wrapping in begin()):
```python
def run_task(self) -> None:
    with self.db_session.begin():
        old_files = self._get_old_files_to_cleanup()
        if not old_files:
            return
        for sam_extract_file in old_files:
            self._cleanup_file(sam_extract_file)
```

From PR #4865 (fetch extracts task):
```python
def run_task(self) -> None:
    with self.db_session.begin():
        logger.info("Attempting to fetch monthly extract.")
        monthly_extract_date = self._fetch_monthly_extract()
        logger.info("Attempting to fetch daily extracts.")
        self._fetch_daily_extracts(monthly_extract_date)
```

**Rationale:** Explicit transaction boundaries ensure atomicity (all-or-nothing commits), proper rollback on errors, and avoid surprising autocommit behavior. Reviewer chouinar stated: "Any code we have for interacting with the db_session should have `db_session.begin()` wrapping it."

**Open Questions:** None.

---

## Rule 15: Use `is_()` for Boolean Comparisons

**Pattern Name:** SQLAlchemy Boolean Comparison with `is_()`

**Rule Statement:** ALWAYS use `Model.column.is_(True)` or `Model.column.is_(False)` for boolean column comparisons in SQLAlchemy queries. NEVER use `== True` or `== False`.

**Confidence:** High

**Frequency:** Enforced when encountered. Explicitly corrected in PR #9276.

**Code Examples:**

From PR #9276 (reviewer correction):
```python
# Reviewer chouinar: "SQLAlchemy has an is_ function for doing bool
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

**Rationale:** `== True` triggers Python linting warnings (`E712`) and type-checker complaints because it uses identity comparison. `is_(True)` is the idiomatic SQLAlchemy approach that generates the same SQL but satisfies linters and type checkers.

**Open Questions:** None.

---

## Rule 16: Use `datetime_util.utcnow()` for Timestamps

**Pattern Name:** UTC Timestamp Utility

**Rule Statement:** ALWAYS use `datetime_util.utcnow()` for any application-level timestamp needs. NEVER use `datetime.now()` or `datetime.utcnow()` directly.

**Confidence:** High

**Frequency:** Enforced when encountered. Corrected by chouinar in PR #4865.

**Code Examples:**

From PR #4865 (fetch extracts task):
```python
from src.util import datetime_util

current_date = datetime_util.utcnow().date()
```

Reviewer chouinar stated in PR #4865: "Use the datetime util for anything, it better handles timezones."

**Rationale:** The project's `datetime_util.utcnow()` ensures consistent timezone-aware UTC timestamps across the application. Using `datetime.now()` can produce naive datetimes that cause comparison bugs with the database's `TIMESTAMP(timezone=True)` columns.

**Open Questions:** None.

---

## Rule 17: Set UUIDs Explicitly at Object Creation

**Pattern Name:** Explicit UUID Assignment

**Rule Statement:** ALWAYS set UUID primary keys explicitly at object creation time (e.g., `Model(model_id=uuid.uuid4(), ...)`). NEVER call `db_session.flush()` solely to get auto-generated IDs.

**Confidence:** High

**Frequency:** Enforced in PRs #6407, #6410 by reviewer chouinar.

**Code Examples:**

From PR #4865 (setting UUID explicitly):
```python
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

From PR #6407 (reviewer chouinar correction):
```
# chouinar: "Alternatively you can add the IDs when we create the objects
# (eg. organization_user = OrganizationUser(organization_user_id=uuid.uuid4(), ...)).
# Sometimes flushes can be a bit iffy. Setting the IDs would also help with logging."
```

**Rationale:** Flushing mid-transaction to obtain IDs can cause subtle session state issues and unnecessary round-trips. Since UUIDs can be generated client-side, explicitly setting them avoids these problems and enables immediate use of the ID (e.g., in logging).

**Open Questions:** The PR #6407 author reported difficulty implementing this in some cases where SQLAlchemy relationship mapping didn't populate `organization_user_roles` without a flush. This suggests the pattern may not always be straightforward when bidirectional relationships are involved. Tech lead should clarify guidance for relationship-heavy cases.

---

## Rule 18: Legacy IDs as Plain Columns, Not Foreign Keys

**Pattern Name:** Legacy ID Storage Without FK Constraints

**Rule Statement:** NEVER make legacy integer ID columns (e.g., `legacy_opportunity_id`) foreign keys to other tables. ALWAYS store them as plain indexed columns for reference only.

**Confidence:** High

**Frequency:** Explicitly corrected in PR #5949, applied across UUID migration PRs.

**Code Examples:**

From PR #5949 (reviewer chouinar on ExcludedOpportunityReview):
```
# chouinar: "The ID we store in this table shouldn't be a foreign key &
# will be the legacy integer ID. If it's a foreign key, when we build the
# process to copy over, we have to change the order of operations to do
# this after we copy opportunities which could be more complex, and have
# to resolve the legacy ID to map to our new ID. I'd say we just make
# this an integer and don't have it be a foreign key as we're just going
# to do an where not exists with it."
```

Result:
```python
opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
# Note: no ForeignKey() -- this is an integer reference, not a real FK
```

**Rationale:** Legacy IDs from Oracle are retained for cross-referencing during data migration but should not create FK dependency chains. FK constraints on legacy IDs would force complex ordering in ETL pipelines and complicate the data migration architecture.

**Open Questions:** None.

---

## Rule 19: Composite Primary Key Implies Unique Constraint

**Pattern Name:** No Redundant Unique Constraints on Composite PKs

**Rule Statement:** NEVER add a separate unique constraint on a composite primary key. A composite PK already enforces uniqueness on the combination of its columns.

**Confidence:** High

**Frequency:** Explicitly clarified by chouinar in PR #6268.

**Code Examples:**

From PR #6268 (composite PK on role assignment tables):
```python
class OrganizationUserRole(ApiSchemaTable, TimestampMixin):
    __tablename__ = "organization_user_role"

    organization_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(OrganizationUser.organization_user_id), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(Role.role_id), primary_key=True)
```

Reviewer chouinar clarified in response to a question about adding a unique constraint:
```
"A primary key of role_id + <entity>_user_id is also a unique constraint.
We wouldn't be able to add multiple of the same role to a user with this."
```

**Rationale:** PostgreSQL enforces uniqueness on the composite PK automatically. Adding a separate UniqueConstraint would be redundant overhead.

**Open Questions:** None.

---

## Rule 20: Data Migration Pattern

**Pattern Name:** Raw SQL Data Migrations with Bind Parameters

**Rule Statement:** ALWAYS use `op.execute(text("...").params(...))` for data-backfill migrations. ALWAYS use `NOT EXISTS` guards to ensure idempotency. Downgrade functions for data migrations may be left as `pass` when rollback logic is complex.

**Confidence:** High

**Frequency:** Low-moderate (~3 PRs), but consistently implemented.

**Code Examples:**

From PR #6407 (assigning org admin role to existing owners):
```python
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

Reviewer chouinar noted: "I think the downgrade to undo this might be more complex... Might be best to just exclude a downgrade and we'd fix it manually."

**Rationale:** Parameterized queries prevent SQL injection. `NOT EXISTS` guards make the migration idempotent (safe to re-run). Empty downgrades are acceptable for data migrations where reversal is non-trivial.

**Open Questions:** None.

---

## Rule 21: Factory Pattern for Tests

**Pattern Name:** Centralized Factory Architecture

**Rule Statement:** ALWAYS define test factories in `api/tests/src/db/models/factories.py`. Each model MUST have a corresponding `<Model>Factory(BaseFactory)`. Use `factory.SubFactory()` for relationships, `factory.LazyAttribute()` for derived IDs, `Generators.UuidObj` for UUID fields, and `factory.Trait()` for role/variant configurations.

**Confidence:** High

**Frequency:** Universal -- every PR that adds a model also adds a factory.

**Code Examples:**

From PR #7498 (OrganizationAuditFactory with Traits):
```python
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
        is_user_removed = factory.Trait(
            organization_audit_event=OrganizationAuditEvent.USER_REMOVED,
            target_user=factory.SubFactory(UserFactory, with_profile=True),
            target_user_id=factory.LazyAttribute(lambda o: o.target_user.user_id),
        )
```

From PR #6268 (Trait-based role factories, requested by chouinar):
```python
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
        is_application_role = factory.Trait(
            privileges=[Privilege.VIEW_APPLICATION, Privilege.MODIFY_APPLICATION],
            role_types=[RoleType.APPLICATION],
        )
```

From PR #5949 (simple factory):
```python
class ExcludedOpportunityReviewFactory(BaseFactory):
    class Meta:
        model = opportunity_models.ExcludedOpportunityReview

    opportunity_id = factory.Sequence(lambda n: n)
    omb_review_status_display = factory.Faker(
        "random_element", elements=["RETURNED", "REVIEWABLE"]
    )
    omb_review_status_date = factory.Faker("date_between", start_date="-5y", end_date="-3y")
```

**Rationale:** Centralized factories ensure consistent test data creation across the entire test suite. `SubFactory` + `LazyAttribute` keeps referential integrity correct. Traits enable concise configuration of common variants (e.g., `RoleFactory(is_org_role=True)`).

**Open Questions:** None.

---

## Rule 22: Model File Registration

**Pattern Name:** Model Module Registration in `__init__.py`

**Rule Statement:** ALWAYS register new model files in `api/src/db/models/__init__.py` when adding a new model module.

**Confidence:** High

**Frequency:** Applied whenever a new model file is created.

**Code Examples:**

From PR #4865 (registering sam_extract_models):
```python
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

**Rationale:** SQLAlchemy needs all model modules imported to register them with the metadata. Unregistered models will not be detected by Alembic's autogenerate, and migrations will not be created.

**Open Questions:** None.

---

## Rule 23: Table Name Prefixes for Special Table Types

**Pattern Name:** Link and Lookup Table Naming Conventions

**Rule Statement:** ALWAYS prefix lookup tables with `lk_` (e.g., `lk_form_family`, `lk_privilege`). ALWAYS prefix many-to-many link tables with `link_` (e.g., `link_role_privilege`, `link_competition_open_to_applicant`).

**Confidence:** High

**Frequency:** Universal across all lookup and link tables.

**Code Examples:**

From PR #4624:
```python
__tablename__ = "lk_form_family"
__tablename__ = "lk_competition_open_to_applicant"
__tablename__ = "link_competition_open_to_applicant"
```

From PR #6251:
```python
__tablename__ = "lk_privilege"
__tablename__ = "lk_role_type"
__tablename__ = "link_role_privilege"
__tablename__ = "link_role_role_type"
```

From PR #7498:
```python
__tablename__ = "lk_organization_audit_event"
```

**Rationale:** Prefixes provide immediate visual identification of table purpose. `lk_` tables hold reference/enumeration data. `link_` tables are join tables for many-to-many relationships.

**Open Questions:** None.

---

## Rule 24: Drop-Then-Recreate for PK Type Changes

**Pattern Name:** Paired Migrations for Primary Key Type Changes

**Rule Statement:** When changing primary key types (e.g., BigInteger to UUID), ALWAYS use paired migrations: one to drop the table(s), then one to recreate with the new schema. NEVER attempt in-place ALTER TABLE for PK type changes.

**Confidence:** High

**Frequency:** Applied in the BigInt-to-UUID migration wave (PRs #4316, #4392, #4846).

**Code Examples:**

From PR #4316 (agency BigInt to UUID):
```python
# Migration 1: 2025_03_25_remove_agency_and_agency_contact_info_.py
def upgrade():
    op.drop_table("link_agency_download_file_type", schema="api")
    op.drop_index(op.f("agency_agency_code_idx"), table_name="agency", schema="api")
    op.drop_table("agency", schema="api")
    op.drop_table("agency_contact_info", schema="api")

# Migration 2: 2025_03_25_update_agency_tables_to_use_uuid.py
# Recreates agency with sa.Column("agency_id", sa.UUID(), nullable=False)
```

**Rationale:** PostgreSQL does not easily support changing a PK column's type in place, especially when foreign keys reference it. The drop-recreate approach is cleaner and avoids complex ALTER TABLE chains. This is acceptable because the project was in early development and the tables could be repopulated.

**Open Questions:** This pattern is specific to the migration-era context and may not be appropriate for production tables with data that cannot be dropped. Tech lead should clarify the approach for future PK changes on data-bearing production tables.

---

## Rule 25: Test Cleanup with `cascade_delete_from_db_table`

**Pattern Name:** Test Data Cleanup Fixture

**Rule Statement:** ALWAYS use `cascade_delete_from_db_table(db_session, Model)` in test setup/teardown fixtures when tests create database records that could interfere with other tests.

**Confidence:** Medium

**Frequency:** Moderate -- used in PRs #4865, #6162. Not all tests use it, but it is the established pattern for cleanup-sensitive tests.

**Code Examples:**

From PR #6162 (cleanup task tests):
```python
class TestCleanupOldSamExtractsTask(BaseTestClass):
    @pytest.fixture(autouse=True)
    def setup_method(self, db_session):
        cascade_delete_from_db_table(db_session, SamExtractFile)
        db_session.commit()
        yield
        cascade_delete_from_db_table(db_session, SamExtractFile)
        db_session.commit()
```

**Rationale:** Ensures test isolation by removing all rows from the table (and cascading to dependent tables) before and after each test method. Prevents flaky tests caused by leftover data.

**Open Questions:** The `autouse=True` pattern with both setup and teardown is somewhat heavy. It would be worth confirming whether the project prefers this approach universally or only for specific test classes.
