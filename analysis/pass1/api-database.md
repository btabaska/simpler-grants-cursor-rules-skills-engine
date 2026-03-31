# Pattern Discovery: API Database/Models Domain

**Source:** 151 merged PRs from HHS/simpler-grants-gov (`api/src/db/`)
**Date range:** 2025-03-31 to 2026-03-26
**Analyzed:** 2026-03-27

---

## 1. Model Definition Patterns

### 1.1 Base Class Inheritance: `ApiSchemaTable` + `TimestampMixin`
- **Frequency:** Universal (every model in `api/src/db/models/`)
- **Exemplar PRs:** #4316 (Agency), #5949 (ExcludedOpportunityReview), #7498 (OrganizationAudit)
- **Pattern:** All API-schema models inherit from both `ApiSchemaTable` and `TimestampMixin`. `ApiSchemaTable` provides the `api` schema prefix; `TimestampMixin` provides `created_at` and `updated_at` TIMESTAMP(timezone=True) columns with `server_default=sa.text("now()")`.
- **Confidence:** Very high

### 1.2 UUID Primary Keys with `default=uuid.uuid4`
- **Frequency:** Very high for new/refactored tables (~30+ PRs)
- **Exemplar PRs:** #4316 (Agency UUID migration), #4392 (ExtractMetadata), #4846 (Opportunity UUID migration)
- **Pattern:** Primary keys use `Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)`. The project underwent a systematic BigInteger-to-UUID migration across all major tables (agency, opportunity, extract_metadata, competition, etc.).
- **Trend:** Strongly enforced. Legacy integer IDs are retained as separate `legacy_*_id` columns (e.g., `legacy_opportunity_id`) with `index=True, unique=True`.
- **Anti-pattern:** Using `BigInteger` primary keys for new tables is not acceptable. Reviewer (chouinar) consistently directed this change.
- **Confidence:** Very high

### 1.3 Primary Key Naming Convention: `<table_name>_id`
- **Frequency:** Universal
- **Exemplar PRs:** #4865 (sam_extract_file), #6251 (role), #7498 (organization_audit)
- **Pattern:** Primary key columns are named `<singular_table_name>_id`. Reviewer chouinar explicitly enforced this: "Prefer to just name the primary key `<table_name>_id` generally." (PR #4865)
- **Confidence:** Very high

### 1.4 Singular Table Names
- **Frequency:** Universal
- **Exemplar PRs:** #4865 (corrected `sam_extract_files` to `sam_extract_file`), #5949, #7498
- **Pattern:** Table names are singular, not plural. Reviewer chouinar explicitly corrected plural naming in PR #4865.
- **Confidence:** Very high

### 1.5 Mapped Column Type Annotations
- **Frequency:** Universal
- **Exemplar PRs:** #4316, #4846, #6251
- **Pattern:** Models use SQLAlchemy 2.0 `Mapped[T]` style type annotations with `mapped_column()`. Nullable columns use `Mapped[T | None]`. Non-nullable columns use `Mapped[T]`. Foreign keys explicitly specify the SQLAlchemy column type (e.g., `UUID`, `BigInteger`).
- **Trend:** Python 3.14 upgrade (PR #7268) removed quoted forward references (e.g., `Mapped[list["CompetitionForm"]]` became `Mapped[list[CompetitionForm]]`).
- **Confidence:** Very high

### 1.6 Relationship Patterns
- **Frequency:** High (most model files)
- **Exemplar PRs:** #4694, #6251, #6268
- **Pattern:**
  - Back-references always use `back_populates=` (not `backref=`)
  - Parent-to-children: `Mapped[list[Child]] = relationship(..., uselist=True, back_populates="parent", cascade="all, delete-orphan")`
  - Child-to-parent: `Mapped[Parent] = relationship(Parent)`
  - Single-parent one-to-one: `single_parent=True, cascade="all, delete-orphan"`
  - View-only relationships use `viewonly=True` (e.g., agency_code joins)
- **Confidence:** Very high

### 1.7 Lookup Table Pattern (LookupColumn + StrEnum)
- **Frequency:** Very high (~15+ lookup tables added)
- **Exemplar PRs:** #4624 (FormFamily, CompetitionOpenToApplicant), #4865 (SamGovExtractType, SamGovProcessingStatus), #6251 (Privilege, RoleType), #7270 (FundingCategory addition)
- **Pattern:** Lookup values follow a strict 4-layer pattern:
  1. **StrEnum** in `lookup_constants.py` defining the string values
  2. **LookupConfig** in `lookup_models.py` mapping enum values to integer IDs via `LookupStr(EnumValue, integer_id)`
  3. **LookupTable** model class with `@LookupRegistry.register_lookup(CONFIG)`, having `<name>_id: Mapped[int]` primary key + `description: Mapped[str]` + `from_lookup()` classmethod
  4. **LookupColumn** type decorator on referencing models: `mapped_column("column_name_id", LookupColumn(LkTableName), ForeignKey(LkTableName.column_name_id), index=True)`
- **Anti-pattern:** Reviewer chouinar explicitly stated that new lookup values do NOT need dedicated migrations -- the sync process handles it automatically: "We do not need to use a migration to add new lookup values. The migration process already sync lookup values." (PR #6162)
- **Confidence:** Very high

### 1.8 Association Proxy Pattern for Many-to-Many via Lookup Tables
- **Frequency:** Moderate (~5 instances)
- **Exemplar PRs:** #4624 (open_to_applicants), #6251 (privileges, role_types), #4316 (download_file_types)
- **Pattern:** Many-to-many relationships through link tables use SQLAlchemy `association_proxy`:
  ```python
  link_<name>: Mapped[list[LinkModel]] = relationship(back_populates="parent", uselist=True, cascade="all, delete-orphan")
  <name>: AssociationProxy[set[EnumType]] = association_proxy("link_<name>", "<field>", creator=lambda obj: LinkModel(<field>=obj))
  ```
- **Confidence:** High

### 1.9 Legacy/Foreign Table Mixin Pattern
- **Frequency:** Moderate (~10 PRs)
- **Exemplar PRs:** #4554 (TcompetitionMixin), #6019 (VOpportunitySummaryMixin), #4385 (user_mixin column order fix)
- **Pattern:** Legacy Oracle tables use a 3-layer architecture:
  1. `@declarative_mixin` class in `legacy_mixin/<domain>_mixin.py` defining columns (column order must match Oracle)
  2. Foreign table model in `foreign/<domain>.py` inheriting from `ForeignBase` + mixin
  3. Staging table model in `staging/<domain>.py` inheriting from `StagingBase` + mixin + `StagingParamMixin`
- **Column order matters:** PR #4385 fixed a column ordering bug because it must match the Oracle schema.
- **Confidence:** High

---

## 2. Migration Patterns

### 2.1 Alembic Auto-Generated with Manual Adjustments
- **Frequency:** Universal
- **Exemplar PRs:** #4316, #4846, #6251
- **Pattern:** Migration files are auto-generated by Alembic (`# ### commands auto generated by Alembic - please adjust! ###`) with manual adjustments as needed. All migrations use `schema="api"` for API tables and `schema="staging"` for staging tables.
- **Confidence:** Very high

### 2.2 Migration File Naming Convention
- **Frequency:** Universal
- **Pattern:** `YYYY_MM_DD_<descriptive_slug>.py`. The slug describes the change (e.g., `add_user_role_and_privilege_tables`, `remove_competition_assistance_listing`).
- **Exemplar PRs:** #5949 (`2025_08_18_create_excluded_opportunity_review_table.py`), #7409 (`2025_12_09_add_fk_opportunity_to_agency.py`)
- **Confidence:** Very high

### 2.3 Drop-Then-Recreate Pattern for Schema Changes
- **Frequency:** Moderate (for major type changes like BigInt-to-UUID)
- **Exemplar PRs:** #4316 (2 migrations: drop agency, recreate with UUID), #4392 (drop extract_metadata, recreate with UUID), #4846 (drop all opportunity tables, recreate with UUID)
- **Pattern:** When changing primary key types, the team uses paired migrations: one to drop the table(s), then one to recreate with the new schema. This avoids complex ALTER TABLE operations for PK type changes.
- **Confidence:** High

### 2.4 Data Migrations Using Raw SQL
- **Frequency:** Low-moderate (~3 PRs)
- **Exemplar PRs:** #6407 (assign org admin role to existing owners), #6410 (assign app owner role)
- **Pattern:** Data-backfill migrations use `op.execute(text("INSERT INTO ... SELECT ..."))` with parameterized queries (`.params(role_id=CONSTANT_ID)`). Downgrade for data migrations is typically left empty or minimal.
- **Confidence:** High

### 2.5 Constraint Naming Convention
- **Frequency:** Universal (via Alembic naming convention)
- **Pattern:** Constraints use `op.f()` wrapper for consistent naming:
  - Primary keys: `<table_name>_pkey`
  - Foreign keys: `<table_name>_<column>_<referenced_table>_fkey`
  - Indexes: `<table_name>_<column>_idx`
- **Confidence:** Very high

### 2.6 Lookup Value Sync (No Migration Needed)
- **Frequency:** High (enforced in reviews)
- **Exemplar PRs:** #6162 (chouinar correction), #7270 (adding funding category without migration)
- **Pattern:** New lookup enum values only require adding a `LookupStr` entry to the config in `lookup_models.py` and the enum value in `lookup_constants.py`. Running `make db-migrate` calls `sync_lookup_values()` which auto-syncs. Migrations are NOT needed for new lookup values.
- **Anti-pattern:** Creating a dedicated migration for new lookup values (explicitly corrected in PR #6162).
- **Confidence:** Very high

---

## 3. Query Patterns

### 3.1 SQLAlchemy `select()` with `db_session.execute()` / `db_session.scalar()`
- **Frequency:** High
- **Exemplar PRs:** #4694, #9276, #6162
- **Pattern:** Queries use the SQLAlchemy 2.0 style: `db_session.execute(select(Model).where(...))` or `db_session.scalar(select(Model).where(...))` for single results.
- **Confidence:** Very high

### 3.2 `db_session.begin()` for Transaction Wrapping
- **Frequency:** Moderate
- **Exemplar PRs:** #6162 (chouinar: "Any code we have for interacting with the db_session should have `db_session.begin()` wrapping it"), #4865
- **Pattern:** Database operations should be wrapped in `with db_session.begin():` blocks. Reviewer chouinar consistently enforced this.
- **Confidence:** High

### 3.3 `is_()` for Boolean Comparisons
- **Frequency:** Moderate (enforced when encountered)
- **Exemplar PRs:** #9276 (chouinar: "SQLAlchemy has an `is_` function for doing bool comparisons")
- **Pattern:** Use `Model.column.is_(True)` or `Model.column.is_(False)` instead of `Model.column == True` to avoid type-checking complaints.
- **Anti-pattern:** Direct `== True` / `== False` comparisons on boolean columns.
- **Confidence:** High

### 3.4 Subquery Exclusion Pattern
- **Frequency:** Low-moderate
- **Exemplar PRs:** #6076 (ExcludedOpportunityReview)
- **Pattern:** Filtering out excluded records uses `~exists(select(ExcludedModel.id).where(ExcludedModel.id == MainModel.id))`.
- **Confidence:** Moderate

---

## 4. Naming Conventions

### 4.1 Table Names
- **Pattern:** Singular, snake_case (e.g., `opportunity`, `competition`, `sam_extract_file`, `organization_audit`)
- **Link tables:** `link_<parent>_<child>` (e.g., `link_competition_open_to_applicant`, `link_role_privilege`)
- **Lookup tables:** `lk_<name>` (e.g., `lk_form_family`, `lk_sam_gov_processing_status`)
- **Confidence:** Very high

### 4.2 Column Names
- **Pattern:** snake_case. Foreign key columns match the referenced primary key name (e.g., `opportunity_id` references `opportunity.opportunity_id`).
- **Legacy columns:** Prefixed with `legacy_` when retaining old integer IDs alongside new UUIDs (e.g., `legacy_opportunity_id`, `legacy_opportunity_assistance_listing_id`).
- **Confidence:** Very high

### 4.3 Foreign Key Column + Index Convention
- **Frequency:** Universal
- **Pattern:** Foreign key columns typically include `index=True`. Reviewer chouinar noted that primary keys are already indexed and don't need additional indexing (PR #5949).
- **Confidence:** Very high

### 4.4 Model File Organization
- **Pattern:** Models are organized by domain in separate files under `api/src/db/models/`:
  - `opportunity_models.py`, `competition_models.py`, `user_models.py`, `entity_models.py`, `agency_models.py`, `sam_extract_models.py`, `extract_models.py`, `lookup_models.py`
  - New model files must be registered in `api/src/db/models/__init__.py`
- **Confidence:** Very high

---

## 5. Factory/Testing Patterns

### 5.1 Centralized Factory File
- **Frequency:** Universal
- **Exemplar PRs:** #5949, #6251, #7498
- **Pattern:** All factories live in `api/tests/src/db/models/factories.py`. Each model has a corresponding `<Model>Factory(BaseFactory)`. Factories use:
  - `factory.SubFactory()` for relationships
  - `factory.LazyAttribute()` for derived values (e.g., `factory.LazyAttribute(lambda o: o.opportunity.opportunity_id)`)
  - `Generators.UuidObj` for UUID fields
  - `factory.Sequence(lambda n: n)` for sequential integers
  - `factory.Trait()` for variant configurations
- **Confidence:** Very high

### 5.2 Factory Traits for Role Variants
- **Frequency:** Moderate
- **Exemplar PRs:** #6268, #7498
- **Pattern:** Factories use `class Params:` with `factory.Trait()` for different configurations (e.g., `is_org_role`, `is_application_role`, `is_user_added`, `is_user_removed`). Reviewer chouinar requested this pattern for role-related factories.
- **Confidence:** High

### 5.3 Test Cleanup with `cascade_delete_from_db_table`
- **Frequency:** Moderate
- **Exemplar PRs:** #4865, #6162
- **Pattern:** Tests that create data use `cascade_delete_from_db_table(db_session, Model)` in setup/teardown fixtures.
- **Confidence:** Moderate

---

## 6. Corrective Patterns (Reviewer Enforcement)

### 6.1 No Migrations for Lookup Values
- **Reviewer:** chouinar
- **Exemplar PR:** #6162
- **Correction:** "We do not need to use a migration to add new lookup values."
- **Frequency:** Corrected at least once, referenced in multiple reviews

### 6.2 Table Names Must Be Singular
- **Reviewer:** chouinar
- **Exemplar PR:** #4865
- **Correction:** Renamed `sam_extract_files` to `sam_extract_file`

### 6.3 Primary Key Index Redundancy
- **Reviewer:** chouinar
- **Exemplar PR:** #5949
- **Correction:** "A primary key is already indexed - can exclude that" (removing redundant `index=True` on PK column)

### 6.4 Composite PK Implies Unique Constraint
- **Reviewer:** chouinar
- **Exemplar PR:** #6268
- **Correction:** "A primary key of `role_id` + `<entity>_user_id` is also a unique constraint" -- no need for separate unique constraint on composite PKs.

### 6.5 Use `is_()` for Boolean Comparisons
- **Reviewer:** chouinar
- **Exemplar PR:** #9276
- **Correction:** Use `Workflow.is_active.is_(True)` instead of `== True`

### 6.6 Use `datetime_util.utcnow` Not `datetime.now`
- **Reviewer:** chouinar
- **Exemplar PR:** #4865
- **Correction:** "Use the datetime util for anything, it better handles timezones"

### 6.7 Wrap DB Operations in `db_session.begin()`
- **Reviewer:** chouinar
- **Exemplar PR:** #4865, #6162
- **Correction:** "Any code we have for interacting with the db_session should have `db_session.begin()` wrapping it"

### 6.8 Legacy IDs Should Not Be Foreign Keys
- **Reviewer:** chouinar
- **Exemplar PR:** #5949
- **Correction:** Legacy integer IDs stored for reference (like `legacy_opportunity_id` in `ExcludedOpportunityReview`) should NOT be foreign keys to avoid complex ordering dependencies in data pipelines.

### 6.9 Prefer Setting UUIDs Directly Over Flushing
- **Reviewer:** chouinar
- **Exemplar PRs:** #6407, #6410
- **Correction:** Rather than calling `db_session.flush()` to get generated IDs, set UUIDs explicitly at object creation time: `Model(model_id=uuid.uuid4(), ...)`.

### 6.10 Column Order Must Match Oracle Schema for Legacy Mixins
- **Reviewer:** Implicit (PR #4385 bugfix), chouinar (PR #4554 type correction)
- **Pattern:** Legacy mixin columns must exactly match Oracle schema order and types.

---

## 7. Anti-Patterns Flagged in Reviews

| Anti-Pattern | Correction | Exemplar PR | Reviewer |
|---|---|---|---|
| BigInteger PK on new tables | Use UUID with `default=uuid.uuid4` | #4316, #4392 | chouinar |
| Plural table names | Use singular | #4865 | chouinar |
| Migration for new lookup values | Just add to LookupConfig; sync handles it | #6162 | chouinar |
| `== True` on boolean columns | Use `.is_(True)` | #9276 | chouinar |
| `datetime.now()` for timestamps | Use `datetime_util.utcnow()` | #4865 | chouinar |
| DB operations without `begin()` | Wrap in `with db_session.begin():` | #4865 | chouinar |
| Redundant index on PK | Primary keys are auto-indexed | #5949 | chouinar |
| Legacy IDs as foreign keys | Store as plain columns, no FK constraint | #5949 | chouinar |
| Flushing to get auto-generated IDs | Set UUID explicitly at creation | #6407 | chouinar |
| Using `.value` on StrEnum in assertions | StrEnum values work directly without `.value` | #6118 | babebe |

---

## 8. Schema Architecture Summary

### Schema Layout
- **`api` schema:** Main application tables (opportunities, competitions, users, agencies, etc.)
- **`staging` schema:** Staging tables for Oracle data migration (mirror Oracle structure + `StagingParamMixin`)
- **Foreign tables:** FDW connections to Oracle database, defined via `ForeignBase`

### Timestamp Convention
All tables include:
```python
created_at: TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False
updated_at: TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False
```
Provided by `TimestampMixin`.

### Key Trends Over Time
1. **BigInt-to-UUID migration** (Q1-Q2 2025): Systematic conversion of all PKs to UUID, with `legacy_*_id` columns retained
2. **Role-based access control buildout** (Q3 2025): Lookup tables for roles/privileges, link tables connecting users to resources
3. **Legacy table cleanup** (Q4 2025): Removing unused Oracle-era tables (tsubscription, tuser_account, etc.)
4. **Audit table additions** (Q4 2025): Organization audit, workflow audit patterns
5. **Python 3.14 upgrade** (Q4 2025): Removed quoted forward references in type annotations

### Primary Reviewer
**chouinar** is the dominant reviewer for database changes, providing the vast majority of corrective feedback and convention enforcement. This individual serves as the de facto database architecture authority.
