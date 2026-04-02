# API Database/Models — Conventions & Rules

> **Status:** Draft — pending tech lead validation. Items marked (⏳) are
> awaiting team confirmation. All other patterns reflect high-confidence
> conventions observed consistently across the codebase.

## Overview

The API database layer (`api/src/db/`) defines the data model for the Simpler Grants platform using SQLAlchemy 2.0 ORM with PostgreSQL. All models live under `api/src/db/models/` organized by domain (e.g., `opportunity_models.py`, `user_models.py`, `agency_models.py`). Schema migrations are managed via Alembic with auto-generated migration files that receive manual adjustments as needed. Reference architecture guide Section 4.

The database architecture uses a multi-schema PostgreSQL design: the `api` schema holds application tables, the `staging` schema holds Oracle migration staging tables, and foreign tables connect to the legacy Oracle database via FDW. Every model in the `api` schema inherits from `ApiSchemaTable` (for schema routing) and `TimestampMixin` (for audit timestamps). The project completed a systematic BigInteger-to-UUID primary key migration in early 2025, and UUID primary keys are now mandatory for all new tables.

Lookup/enumeration values follow a strict four-layer pattern (StrEnum, LookupConfig, LookupTable, LookupColumn) with automatic sync — no migrations are needed for new lookup values. The primary reviewer and database architecture authority is chouinar, who enforces conventions through active code review. Test data uses centralized factories in `api/tests/src/db/models/factories.py` with Traits for variant configurations.

## Rules

### Model Definition

#### Rule: Base Class Inheritance — `ApiSchemaTable` + `TimestampMixin`

**Confidence:** High
**Observed in:** Universal across all 151 PRs | PR refs: #5949, #7498, #4865

Every model in the `api` schema must inherit from both `ApiSchemaTable` and `TimestampMixin`.

**DO:**
```python
# From PR #5949 — ExcludedOpportunityReview with both base classes
class ExcludedOpportunityReview(ApiSchemaTable, TimestampMixin):
    __tablename__ = "excluded_opportunity_review"

    opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    omb_review_status_display: Mapped[str]
    omb_review_status_date: Mapped[date | None]
    last_update_date: Mapped[datetime | None]
```

**DON'T:**
```python
# Anti-pattern — missing TimestampMixin
class ExcludedOpportunityReview(ApiSchemaTable):
    __tablename__ = "excluded_opportunity_review"
    # Missing created_at/updated_at audit columns
```

> **Rationale:** `ApiSchemaTable` sets `schema="api"` so all tables are created in the `api` PostgreSQL schema. `TimestampMixin` provides `created_at` and `updated_at` TIMESTAMP(timezone=True) columns with `server_default=sa.text("now()")`, ensuring every row is auditable.

---

#### Rule: UUID Primary Keys with Explicit Default

**Confidence:** High
**Observed in:** Universal for new tables (~30+ PRs) | PR refs: #6251, #6268, #4316

Always use `uuid.UUID` primary keys with `default=uuid.uuid4` for new tables. Never use `BigInteger` primary keys for new API-schema tables.

**DO:**
```python
# From PR #6251 — Role table with UUID primary key
class Role(ApiSchemaTable, TimestampMixin):
    __tablename__ = "role"

    role_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    role_name: Mapped[str]
    is_core: Mapped[bool] = mapped_column(default=False)
```

**DON'T:**
```python
# Anti-pattern — BigInteger primary key on a new table
class Role(ApiSchemaTable, TimestampMixin):
    __tablename__ = "role"
    role_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
```

> **Rationale:** UUIDs avoid sequential ID enumeration attacks, enable distributed ID generation, and decouple ID assignment from the database. The project completed a systematic BigInt-to-UUID migration driven by reviewer chouinar across PRs #4316, #4392, #4846. Legacy integer IDs are retained as separate `legacy_*_id` columns with `index=True, unique=True`.

---

#### Rule: Primary Key Naming Convention — `<table_name>_id`

**Confidence:** High
**Observed in:** Universal | PR refs: #4865, #7498, #6251

Always name the primary key column `<singular_table_name>_id`.

**DO:**
```python
# From PR #4865 — PK named after table
sam_extract_file_id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
```

```python
# From PR #7498 — PK named after table
organization_audit_id: Mapped[uuid.UUID] = mapped_column(
    UUID, primary_key=True, default=uuid.uuid4
)
```

**DON'T:**
```python
# Anti-pattern — generic "id" column name
id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
```

> **Rationale:** Consistent naming eliminates ambiguity when joining tables. A column named `role_id` immediately tells you it references the `role` table. Reviewer chouinar explicitly stated: "Prefer to just name the primary key `<table_name>_id` generally." (PR #4865)

---

#### Rule: Singular Table Names

**Confidence:** High
**Observed in:** Universal | PR refs: #4865, #7498, #6268

Always use singular table names, not plural.

**DO:**
```python
# From PR #4865 — singular table name (corrected from plural)
__tablename__ = "sam_extract_file"
```

**DON'T:**
```python
# Anti-pattern — plural table name (corrected in PR #4865)
__tablename__ = "sam_extract_files"
```

> **Rationale:** Consistent singular naming is a project convention enforced by the database architecture lead. Reviewer chouinar corrected plural naming in PR #4865, renaming `sam_extract_files` to `sam_extract_file`.

---

#### Rule: SQLAlchemy 2.0 Mapped Column Annotations

**Confidence:** High
**Observed in:** Universal across all PRs | PR refs: #7498, #7409, #5949

Always use SQLAlchemy 2.0 `Mapped[T]` style type annotations with `mapped_column()`. Use `Mapped[T | None]` for nullable columns. Use `Mapped[T]` for non-nullable columns. Never use legacy `Column()` syntax.

**DO:**
```python
# From PR #7498 — mix of nullable and non-nullable with Mapped annotations
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), nullable=False, index=True
)
target_user_id: Mapped[uuid.UUID | None] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), index=True
)
audit_metadata: Mapped[dict | None] = mapped_column(JSONB)
```

**DON'T:**
```python
# Anti-pattern — legacy Column() syntax
user_id = Column(UUID, ForeignKey("api.user.user_id"), nullable=False, index=True)
```

> **Rationale:** SQLAlchemy 2.0 style provides better static type-checking integration and is the modern, supported approach. The `Mapped[T | None]` pattern uses Python 3.10+ union syntax, which was further simplified with the Python 3.14 upgrade (PR #7268) that removed quoted forward references.

---

#### Rule: Relationship Declarations with `back_populates`

**Confidence:** High
**Observed in:** All model files with relationships | PR refs: #7498, #6251, #7409

Always use `back_populates=` for bidirectional relationships. Never use `backref=`. Parent-to-children relationships always include `uselist=True` and `cascade="all, delete-orphan"`.

**DO:**
```python
# From PR #7498 — parent-to-children with back_populates
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
# From PR #7409 — viewonly relationship for non-standard joins
agency_record: Mapped[Agency | None] = relationship(
    Agency,
    primaryjoin="Opportunity.agency_code == foreign(Agency.agency_code)",
    uselist=False,
    viewonly=True,
)
```

**DON'T:**
```python
# Anti-pattern — using backref instead of back_populates
organization_audits = relationship("OrganizationAudit", backref="organization")
```

> **Rationale:** `back_populates` is explicit and less magical than `backref`. The `cascade="all, delete-orphan"` on parent ensures children are cleaned up when the parent is deleted. `viewonly=True` is used for non-standard joins where SQLAlchemy should not attempt writes through the relationship.

---

### Lookup Tables

#### Rule: Four-Layer Lookup Table Pattern

**Confidence:** High
**Observed in:** 15+ lookup tables added | PR refs: #4865, #6251, #4624

Always implement lookup/enumeration values using the four-layer pattern: (1) StrEnum in `lookup_constants.py`, (2) LookupConfig with LookupStr entries in `lookup_models.py`, (3) LookupTable model class with `@LookupRegistry.register_lookup()`, (4) LookupColumn type decorator on referencing models.

**DO:**
```python
# From PR #4865 — Layer 1: StrEnum
# api/src/constants/lookup_constants.py
class SamGovProcessingStatus(StrEnum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
```

```python
# From PR #4865 — Layer 2: LookupConfig
# api/src/db/models/lookup_models.py
SAM_GOV_PROCESSING_STATUS_CONFIG = LookupConfig(
    [
        LookupStr(SamGovProcessingStatus.PENDING, 1),
        LookupStr(SamGovProcessingStatus.COMPLETED, 2),
        LookupStr(SamGovProcessingStatus.FAILED, 3),
    ]
)
```

```python
# From PR #4865 — Layer 3: LookupTable model
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

```python
# From PR #4865 — Layer 4: LookupColumn on referencing model
# api/src/db/models/sam_extract_models.py
processing_status: Mapped[SamGovProcessingStatus] = mapped_column(
    "processing_status_id",
    LookupColumn(LkSamGovProcessingStatus),
    ForeignKey(LkSamGovProcessingStatus.sam_gov_processing_status_id),
    index=True,
)
```

**DON'T:**
```python
# Anti-pattern — storing enum strings directly in a column
processing_status: Mapped[str] = mapped_column()  # No lookup table, no int IDs
```

> **Rationale:** This pattern provides a clean abstraction where application code works with Python StrEnum values while the database stores integer IDs for performance. The `LookupColumn` type decorator handles the int-to-enum conversion transparently. The `LookupRegistry` auto-syncs values during migrations.

---

#### Rule: No Migration Needed for New Lookup Values

**Confidence:** High
**Observed in:** Explicitly corrected; demonstrated correctly in multiple PRs | PR refs: #6162, #7270, #9276

Never create a dedicated Alembic migration to add new lookup enum values. Just add the `LookupStr` entry to the config in `lookup_models.py` and the enum value in `lookup_constants.py`. The `sync_lookup_values()` function called by `make db-migrate` handles syncing automatically.

**DO:**
```python
# From PR #7270 — adding a new funding category (no migration needed)
# api/src/constants/lookup_constants.py — add enum value
class FundingCategory(StrEnum):
    ...
    ENERGY_INFRASTRUCTURE_AND_CRITICAL_MINERAL_AND_MATERIALS = (
        "energy_infrastructure_and_critical_mineral_and_materials"  # EIC
    )

# api/src/db/models/lookup_models.py — add LookupStr entry
    LookupStr(FundingCategory.ENERGY_INFRASTRUCTURE_AND_CRITICAL_MINERAL_AND_MATERIALS, 27),
```

**DON'T:**
```python
# Anti-pattern — creating a migration for a new lookup value (corrected in PR #6162)
# The author created: 2025_08_23_add_deleted_status_to_sam_gov_processing_status.py
# Reviewer chouinar: "We do not need to use a migration to add new lookup values.
#  The migration process already sync lookup values."
# The migration file was deleted.
```

> **Rationale:** The `LookupRegistry` and `sync_lookup_values()` infrastructure automatically reconciles lookup table contents with the Python config during `make db-migrate`. Creating manual migrations for lookup values is redundant and clutters the migration history.

---

### Table Naming

#### Rule: Link and Lookup Table Name Prefixes

**Confidence:** High
**Observed in:** Universal across all lookup and link tables | PR refs: #4624, #6251, #7498

Always prefix lookup tables with `lk_` and many-to-many link tables with `link_`.

**DO:**
```python
# From PR #6251 — lookup and link table naming
__tablename__ = "lk_privilege"
__tablename__ = "lk_role_type"
__tablename__ = "link_role_privilege"
__tablename__ = "link_role_role_type"
```

```python
# From PR #4624 — consistent prefixes
__tablename__ = "lk_form_family"
__tablename__ = "lk_competition_open_to_applicant"
__tablename__ = "link_competition_open_to_applicant"
```

**DON'T:**
```python
# Anti-pattern — missing prefix for lookup/link tables
__tablename__ = "privilege"          # Should be lk_privilege
__tablename__ = "role_privilege"     # Should be link_role_privilege
```

> **Rationale:** Prefixes provide immediate visual identification of table purpose. `lk_` tables hold reference/enumeration data. `link_` tables are join tables for many-to-many relationships.

---

### Column Conventions

#### Rule: Foreign Key Columns Must Be Indexed

**Confidence:** High
**Observed in:** Universal | PR refs: #7498, #7409, #5949

Always include `index=True` on foreign key columns. Never add `index=True` on primary key columns (they are already indexed).

**DO:**
```python
# From PR #7498 — FK columns with index=True
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey("api.user.user_id"), nullable=False, index=True
)
organization_id: Mapped[uuid.UUID] = mapped_column(
    UUID, ForeignKey(Organization.organization_id), nullable=False, index=True
)
```

**DON'T:**
```python
# Anti-pattern — redundant index on PK (corrected in PR #5949)
# chouinar: "A primary key is already indexed - can exclude that"
opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
```

> **Rationale:** FK columns are frequently used in JOINs and WHERE clauses, so indexing them improves query performance. PKs are automatically indexed by PostgreSQL and adding `index=True` is redundant overhead.

---

#### Rule: Association Proxy for Many-to-Many via Lookup Tables

**Confidence:** High
**Observed in:** ~5 instances, consistently implemented | PR refs: #6251, #4624

Always use SQLAlchemy `association_proxy` for many-to-many relationships through link tables that join to lookup tables.

**DO:**
```python
# From PR #6251 — Role privileges via association proxy
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

**DON'T:**
```python
# Anti-pattern — manual management of link table rows
def add_privilege(role, privilege):
    link = LinkRolePrivilege(role_id=role.role_id, privilege=privilege)
    db_session.add(link)  # Manual management instead of proxy
```

> **Rationale:** Association proxies let business logic work with Python enum sets (e.g., `role.privileges = {Privilege.VIEW_APPLICATION, Privilege.MODIFY_APPLICATION}`) while the ORM manages the link table rows automatically.

---

### Query Patterns

#### Rule: Wrap DB Operations in `db_session.begin()`

**Confidence:** High
**Observed in:** Enforced in multiple reviews | PR refs: #6162, #4865

Always wrap database operations in a `with db_session.begin():` block. Never perform DB reads or writes outside of an explicit transaction context.

**DO:**
```python
# From PR #6162 — DB operations wrapped in begin()
def run_task(self) -> None:
    with self.db_session.begin():
        old_files = self._get_old_files_to_cleanup()
        if not old_files:
            return
        for sam_extract_file in old_files:
            self._cleanup_file(sam_extract_file)
```

**DON'T:**
```python
# Anti-pattern — DB operations without explicit transaction
def run_task(self) -> None:
    old_files = self._get_old_files_to_cleanup()  # No begin() wrapper
    for sam_extract_file in old_files:
        self._cleanup_file(sam_extract_file)
```

> **Rationale:** Explicit transaction boundaries ensure atomicity (all-or-nothing commits), proper rollback on errors, and avoid surprising autocommit behavior. Reviewer chouinar stated: "Any code we have for interacting with the db_session should have `db_session.begin()` wrapping it."

---

#### Rule: Use `is_()` for Boolean Comparisons

**Confidence:** High
**Observed in:** Enforced when encountered | PR refs: #9276

Always use `Model.column.is_(True)` or `Model.column.is_(False)` for boolean column comparisons in SQLAlchemy queries. Never use `== True` or `== False`.

**DO:**
```python
# From PR #9276 — is_() for boolean comparison
existing_workflow = db_session.scalar(
    select(Workflow).where(
        Workflow.workflow_type == workflow_type,
        entity_column == entity_id,
        Workflow.is_active.is_(True),
    )
)
```

**DON'T:**
```python
# Anti-pattern — direct == True comparison (corrected in PR #9276)
existing_workflow = db_session.scalar(
    select(Workflow).where(
        Workflow.is_active == True,  # Triggers linting warning E712
    )
)
```

> **Rationale:** `== True` triggers Python linting warnings (`E712`) and type-checker complaints because it uses identity comparison. `is_(True)` is the idiomatic SQLAlchemy approach that generates the same SQL but satisfies linters and type checkers. Reviewer chouinar: "SQLAlchemy has an `is_` function for doing bool comparisons to avoid type-checking complaints."

---

#### Rule: Use `datetime_util.utcnow()` for Timestamps

**Confidence:** High
**Observed in:** Enforced when encountered | PR refs: #4865

Always use `datetime_util.utcnow()` for any application-level timestamp needs. Never use `datetime.now()` or `datetime.utcnow()` directly.

**DO:**
```python
# From PR #4865 — using datetime_util for timestamps
from src.util import datetime_util

current_date = datetime_util.utcnow().date()
```

**DON'T:**
```python
# Anti-pattern — using stdlib datetime directly
from datetime import datetime

current_date = datetime.now().date()      # WRONG — may produce naive datetime
current_date = datetime.utcnow().date()   # WRONG — deprecated in Python 3.12
```

> **Rationale:** The project's `datetime_util.utcnow()` ensures consistent timezone-aware UTC timestamps across the application. Using `datetime.now()` can produce naive datetimes that cause comparison bugs with the database's `TIMESTAMP(timezone=True)` columns. Reviewer chouinar: "Use the datetime util for anything, it better handles timezones."

---

#### Rule: Set UUIDs Explicitly at Object Creation

**Confidence:** High
**Observed in:** Enforced in multiple PRs | PR refs: #6407, #6410, #4865

Always set UUID primary keys explicitly at object creation time. Never call `db_session.flush()` solely to get auto-generated IDs.

**DO:**
```python
# From PR #4865 — setting UUID explicitly at creation
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

**DON'T:**
```python
# Anti-pattern — flushing to get auto-generated ID
extract = SamExtractFile(extract_type=SamGovExtractType.MONTHLY, ...)
self.db_session.add(extract)
self.db_session.flush()  # WRONG — unnecessary round-trip just to get the ID
logger.info("Created extract", extra={"id": extract.sam_extract_file_id})
```

> **Rationale:** Flushing mid-transaction to obtain IDs can cause subtle session state issues and unnecessary round-trips. Since UUIDs can be generated client-side, explicitly setting them avoids these problems and enables immediate use of the ID (e.g., in logging). Reviewer chouinar: "Sometimes flushes can be a bit iffy. Setting the IDs would also help with logging."

---

### Migration Patterns

#### Rule: Migration File Naming Convention

**Confidence:** High
**Observed in:** Universal across all migration files | PR refs: #5949, #6251, #7409, #7498

Always name migration files as `YYYY_MM_DD_<descriptive_slug>.py` where the slug is a lowercase, underscore-separated description of the change.

**DO:**
```
# From PR #5949
2025_08_18_create_excluded_opportunity_review_table.py

# From PR #6251
2025_09_02_add_user_role_and_privilege_tables.py

# From PR #7409
2025_12_09_add_fk_opportunity_to_agency.py
```

**DON'T:**
```
# Anti-pattern — auto-generated Alembic hash name without description
abcdef123456_migration.py
```

> **Rationale:** Date-prefixed filenames provide chronological ordering in the filesystem. The descriptive slug enables quick identification of what each migration does without opening the file.

---

#### Rule: Explicit Schema in Migrations

**Confidence:** High
**Observed in:** Universal across all migration files | PR refs: #6251, #7409

Always specify `schema="api"` for API tables and `schema="staging"` for staging tables in all migration operations.

**DO:**
```python
# From PR #6251 — schema specified in create_table
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
# From PR #7409 — schema specified in add_column and create_index
op.add_column("opportunity", sa.Column("agency_id", sa.UUID(), nullable=True), schema="api")
op.create_index(
    op.f("opportunity_agency_id_idx"), "opportunity", ["agency_id"],
    unique=False, schema="api"
)
```

**DON'T:**
```python
# Anti-pattern — omitting schema (would create in public schema)
op.create_table("role", sa.Column("role_id", sa.UUID(), nullable=False))
```

> **Rationale:** The project uses PostgreSQL schemas to separate concerns. Omitting the schema parameter would create tables in the `public` schema by default, breaking the architecture.

---

#### Rule: Deterministic Constraint Names via `op.f()`

**Confidence:** High
**Observed in:** Universal | PR refs: #7498, #6251

Always use `op.f()` wrapper for constraint names in migrations. Follow naming patterns: PK `<table>_pkey`, FK `<table>_<column>_<referenced_table>_fkey`, Index `<table>_<column>_idx`.

**DO:**
```python
# From PR #7498 — deterministic constraint naming
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

**DON'T:**
```python
# Anti-pattern — hardcoded constraint names without op.f()
sa.PrimaryKeyConstraint("organization_audit_id", name="org_audit_pk")
```

> **Rationale:** `op.f()` delegates to Alembic's configured naming convention, producing deterministic, human-readable constraint names. This ensures consistent naming across all environments and enables reliable downgrade operations.

---

#### Rule: Drop-Then-Recreate for Primary Key Type Changes

**Confidence:** High
**Observed in:** Applied in BigInt-to-UUID migration wave | PR refs: #4316, #4392, #4846

When changing primary key types (e.g., BigInteger to UUID), always use paired migrations: one to drop the table(s), then one to recreate with the new schema. Never attempt in-place ALTER TABLE for PK type changes.

**DO:**
```python
# From PR #4316 — paired migrations for agency BigInt to UUID
# Migration 1: 2025_03_25_remove_agency_and_agency_contact_info_.py
def upgrade():
    op.drop_table("link_agency_download_file_type", schema="api")
    op.drop_index(op.f("agency_agency_code_idx"), table_name="agency", schema="api")
    op.drop_table("agency", schema="api")
    op.drop_table("agency_contact_info", schema="api")

# Migration 2: 2025_03_25_update_agency_tables_to_use_uuid.py
# Recreates with sa.Column("agency_id", sa.UUID(), nullable=False)
```

**DON'T:**
```python
# Anti-pattern — in-place ALTER TABLE for PK type change
op.alter_column("agency", "agency_id", type_=sa.UUID())  # Complex, error-prone
```

> **Rationale:** PostgreSQL does not easily support changing a PK column's type in place, especially when foreign keys reference it. The drop-recreate approach is cleaner. This pattern was appropriate during early development when tables could be repopulated. Tech lead should clarify the approach for future PK changes on data-bearing production tables.

---

#### Rule: Raw SQL Data Migrations with Bind Parameters

**Confidence:** High
**Observed in:** ~3 PRs, consistently implemented | PR refs: #6407, #6410

Always use `op.execute(text("...").params(...))` for data-backfill migrations. Always use `NOT EXISTS` guards for idempotency. Downgrade functions for data migrations may be left as `pass`.

**DO:**
```python
# From PR #6407 — parameterized data migration with idempotency guard
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

**DON'T:**
```python
# Anti-pattern — unparameterized SQL without idempotency
def upgrade():
    op.execute("INSERT INTO api.organization_user_role VALUES (...)")  # No params, not idempotent
```

> **Rationale:** Parameterized queries prevent SQL injection. `NOT EXISTS` guards make the migration idempotent (safe to re-run). Empty downgrades are acceptable for data migrations where reversal is non-trivial. Reviewer chouinar noted that data migration downgrades are often best handled manually.

---

### Composite Keys and Constraints

#### Rule: Composite Primary Key Implies Unique Constraint

**Confidence:** High
**Observed in:** Explicitly clarified | PR refs: #6268

Never add a separate unique constraint on a composite primary key. A composite PK already enforces uniqueness.

**DO:**
```python
# From PR #6268 — composite PK without redundant unique constraint
class OrganizationUserRole(ApiSchemaTable, TimestampMixin):
    __tablename__ = "organization_user_role"

    organization_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey(OrganizationUser.organization_user_id), primary_key=True
    )
    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(Role.role_id), primary_key=True)
```

**DON'T:**
```python
# Anti-pattern — redundant unique constraint on composite PK
class OrganizationUserRole(ApiSchemaTable, TimestampMixin):
    __tablename__ = "organization_user_role"
    __table_args__ = (
        UniqueConstraint("organization_user_id", "role_id"),  # WRONG — PK already unique
    )
    organization_user_id: Mapped[uuid.UUID] = mapped_column(..., primary_key=True)
    role_id: Mapped[uuid.UUID] = mapped_column(..., primary_key=True)
```

> **Rationale:** PostgreSQL enforces uniqueness on the composite PK automatically. Adding a separate UniqueConstraint is redundant overhead. Reviewer chouinar clarified: "A primary key of role_id + <entity>_user_id is also a unique constraint."

---

### Legacy Data

#### Rule: Legacy IDs as Plain Columns, Not Foreign Keys

**Confidence:** High
**Observed in:** Explicitly corrected, applied across migration PRs | PR refs: #5949

Never make legacy integer ID columns (e.g., `legacy_opportunity_id`) foreign keys to other tables. Store them as plain indexed columns for reference only.

**DO:**
```python
# From PR #5949 — legacy ID as plain column, no FK
opportunity_id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
# Note: no ForeignKey() — this is an integer reference, not a real FK
```

**DON'T:**
```python
# Anti-pattern — legacy ID as foreign key
opportunity_id: Mapped[int] = mapped_column(
    BigInteger, ForeignKey("api.opportunity.legacy_opportunity_id"), primary_key=True
)
```

> **Rationale:** Legacy IDs from Oracle are retained for cross-referencing during data migration but should not create FK dependency chains. Reviewer chouinar explained: "If it's a foreign key, when we build the process to copy over, we have to change the order of operations... I'd say we just make this an integer and don't have it be a foreign key."

---

### Model Registration

#### Rule: Register New Model Files in `__init__.py`

**Confidence:** High
**Observed in:** Applied whenever a new model file is created | PR refs: #4865

Always register new model files in `api/src/db/models/__init__.py` when adding a new model module.

**DO:**
```python
# From PR #4865 — registering sam_extract_models in __init__.py
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

**DON'T:**
```python
# Anti-pattern — creating a model file without registering it
# api/src/db/models/new_models.py exists but is not imported in __init__.py
# Result: Alembic will not detect the model and migrations will not be generated
```

> **Rationale:** SQLAlchemy needs all model modules imported to register them with the metadata. Unregistered models will not be detected by Alembic's autogenerate, and migrations will not be created.

---

### Testing

#### Rule: Centralized Factory Architecture

**Confidence:** High
**Observed in:** Universal — every PR that adds a model also adds a factory | PR refs: #7498, #6268, #5949

Always define test factories in `api/tests/src/db/models/factories.py`. Each model must have a corresponding `<Model>Factory(BaseFactory)`. Use `factory.SubFactory()` for relationships, `factory.LazyAttribute()` for derived IDs, `Generators.UuidObj` for UUID fields, and `factory.Trait()` for role/variant configurations.

**DO:**
```python
# From PR #7498 — factory with Traits for variant configurations
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

**DON'T:**
```python
# Anti-pattern — factories scattered across test files or using raw dicts
def make_test_audit():
    return {"organization_audit_id": str(uuid.uuid4()), "event": "USER_ADDED"}
```

> **Rationale:** Centralized factories ensure consistent test data creation across the entire test suite. `SubFactory` + `LazyAttribute` keeps referential integrity correct. Traits enable concise configuration of common variants (e.g., `OrganizationAuditFactory(is_user_added=True)`). See also cross-cutting pattern CCP-3.

---

#### Rule: Test Cleanup with `cascade_delete_from_db_table` (⏳)

**Confidence:** Medium
**Observed in:** Moderate — used in cleanup-sensitive tests | PR refs: #4865, #6162

Use `cascade_delete_from_db_table(db_session, Model)` in test setup/teardown fixtures when tests create database records that could interfere with other tests.

**DO:**
```python
# From PR #6162 — setup/teardown cleanup fixture
class TestCleanupOldSamExtractsTask(BaseTestClass):
    @pytest.fixture(autouse=True)
    def setup_method(self, db_session):
        cascade_delete_from_db_table(db_session, SamExtractFile)
        db_session.commit()
        yield
        cascade_delete_from_db_table(db_session, SamExtractFile)
        db_session.commit()
```

**DON'T:**
```python
# Anti-pattern — no cleanup, risking test pollution
class TestCleanupOldSamExtractsTask(BaseTestClass):
    def test_something(self, db_session):
        SamExtractFileFactory.create()  # Left behind after test
```

> **Rationale:** Ensures test isolation by removing all rows from the table (and cascading to dependent tables) before and after each test method. Prevents flaky tests caused by leftover data. The `autouse=True` pattern with both setup and teardown may be heavier than needed for all cases — tech lead should confirm when this is required.

---

## Anti-Patterns

| Anti-Pattern | Why It's Wrong | Caught In |
|---|---|---|
| `BigInteger` primary keys on new tables | Sequential IDs enable enumeration attacks; UUIDs are mandatory | PR #4316, #4392 |
| Plural table names | Project convention is singular | PR #4865 |
| Dedicated migration for new lookup values | `sync_lookup_values()` handles this automatically | PR #6162 |
| `== True` / `== False` on boolean columns | Triggers E712 linting; use `.is_(True)` | PR #9276 |
| `datetime.now()` for timestamps | Produces naive datetimes; use `datetime_util.utcnow()` | PR #4865 |
| DB operations without `begin()` | No explicit transaction = surprising autocommit behavior | PR #4865, #6162 |
| Redundant `index=True` on primary keys | PKs are already indexed by PostgreSQL | PR #5949 |
| Legacy IDs as foreign keys | Creates complex ordering dependencies in ETL pipelines | PR #5949 |
| `db_session.flush()` to get auto-generated IDs | Set UUIDs explicitly; flushes can cause session state issues | PR #6407 |
| Using `.value` on StrEnum in assertions | StrEnum values work directly without `.value` | PR #6118 |
| `backref=` on relationships | Use explicit `back_populates=` | Project-wide convention |
| Redundant unique constraint on composite PK | Composite PK already enforces uniqueness | PR #6268 |

## Known Inconsistencies

1. **Legacy mixin column ordering** — Column order in legacy mixin classes must exactly match Oracle schema order (PR #4385 bugfix). This is fragile and has caused production bugs, but no automated validation exists.

2. **Drop-then-recreate viability** — The paired migration pattern for PK type changes was used during early development when data loss was acceptable. No guidance exists for PK type changes on production tables with data that cannot be dropped.

3. **`cascade_delete_from_db_table` usage** — Not all tests use cleanup fixtures. The boundary between tests that need cleanup and those that don't is not formally documented.

4. **Explicit UUID assignment with complex relationships** — PR #6407 reported difficulty setting UUIDs explicitly when bidirectional relationships needed a flush to populate. Tech lead should clarify guidance for relationship-heavy cases.

5. **Query performance guidelines gap** — While `selectinload("*")` is banned, there are no documented guidelines for `selectinload` vs. `joinedload` vs. `subqueryload` selection, N+1 detection, or index creation beyond FK columns. (See GAP-4 in cross-domain synthesis)

## Related Documents

- [API Services — Conventions & Rules](api-services.md) — Service layer patterns, transaction management from the service perspective, query patterns in services
- [API Routes — Conventions & Rules](api-routes.md) — Route handler patterns, `@flask_db.with_db_session()` decorator usage
- [API Tests — Conventions & Rules](api-tests.md) — Factory patterns, `.build()` vs `.create()` usage, test organization
- [API Auth — Conventions & Rules](api-auth.md) — User model relationships, token session handling
- [Cross-Domain Synthesis](../analysis/pass3/cross-domain-synthesis.md) — CCP-3 (factory pattern), CCP-6 (boolean naming), CCP-9 (no wildcard loading), AP-4 (database as source of truth), GAP-4 (query performance), GAP-8 (migration rollback)
