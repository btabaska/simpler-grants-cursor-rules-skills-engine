# Documentation & ADR Analysis -- Pass 1 Pattern Discovery

## ADR Inventory

| Date | Title | Status | Key Decision |
|------|-------|--------|-------------|
| 2023-06-26 | Recording Architecture Decisions | Active | Use ADRs in repo `documentation/decisions/adr` folder, adapted from MADR template |
| 2023-06-29 | CI/CD Task Runner | Active | GitHub Actions for CI/CD pipeline |
| 2023-06-30 | API Language | Active | Python for the backend API |
| 2023-07-03 | Design Prototyping Tool | Active | Figma for wireframing and prototyping |
| 2023-07-05 | Chat Tool | Accepted | Slack (paid) for internal and public chat |
| 2023-07-05 | Database Choices | Active | PostgreSQL on Amazon RDS |
| 2023-07-07 | API Framework | Active | Flask + APIFlask (with Marshmallow schemas) |
| 2023-07-07 | Backend Code Quality Tools | Active | Ruff (linting), Black (formatting), Mypy (types), Safety (security), Poetry (deps), Make (interface) |
| 2023-07-10 | Front-end Language | Active | TypeScript |
| 2023-07-10 | Wiki Platform | Accepted | GitBook for wiki (synced to GitHub) |
| 2023-07-11 | Design Diagramming Tool | Active | Mural for collaborative diagramming/whiteboarding |
| 2023-07-11 | Ticket Tracking | Accepted | GitHub Issues + GitHub Projects |
| 2023-07-14 | Front-end Framework | Active | Next.js |
| 2023-07-17 | Frontend Code Quality Tools | Active | ESLint, Prettier, TypeScript, npm, Renovate, License Checker |
| 2023-07-18 | Frontend Testing | Active | Jest (unit), Storybook (visual/component) |
| 2023-07-19 | Backend API Type | Accepted | REST API |
| 2023-07-19 | Backend Testing | Accepted | Pytest (unit), Coverage (80% threshold) |
| 2023-07-20 | Deployment Strategy | Accepted | ECS with Fargate launch type |
| 2023-07-20 | FE Design System | Accepted | U.S. Web Design System (USWDS) |
| 2023-07-20 | FE Server Rendering | (No explicit status) | Server-side rendering via `next start` (not static export) |
| 2023-07-20 | FE Package Manager | (No explicit status) | npm over Yarn |
| 2023-07-20 | USWDS in React | Accepted | Use Truss `react-uswds` library |
| 2023-07-24 | Video Conferencing | Accepted | Zoom (with Jitsi as backup) |
| 2023-07-26 | Backend Production Server | Accepted | Gunicorn; Dockerfile defaults to prod, docker-compose overrides for dev |
| 2023-08-01 | Analytics Platform | Accepted | DAP (analytics.usa.gov) for public pages, Google Analytics for authenticated pages |
| 2023-08-21 | Branch/Release Workflow | Accepted | Trunk-based development, squash-and-merge, CalVer releases, no enforced commit convention |
| 2023-08-21 | Cloud Platform | Accepted | AWS (existing HHS relationship, FedRAMP) |
| 2023-08-21 | Infrastructure as Code | Accepted | Terraform with Docker |
| 2023-09-07 | Data Replication Tool | Active | AWS DMS with VPC Peering (Oracle to PostgreSQL replication) |
| 2023-09-22 | HHS Communications Site | Active | GitBook with "private" link (visitor auth as long-term goal) |
| 2023-10-16 | Email Marketing | Active | Sendy (short-term); long-term tool TBD |
| 2023-10-16 | Listserv | Accepted | Google Groups |
| 2023-11-22 | Uptime Monitoring | Active | AWS CloudWatch Synthetic Canary |
| 2023-12-06 | Database Migrations | Accepted | Alembic (auto-generates from SQLAlchemy models) |
| 2023-12-15 | Deliverable Reporting Strategy | Active | "Deliverable" column in GitHub Projects; status-based filtering for reports |
| 2023-12-18 | Measurement Dashboard Architecture | Active | Short-term: S3 + dashboard UI; Long-term: Analytics API + open source dashboard (Metabase/Redash) |
| 2023-12-20 | Contact Us Email | Active | simpler@grants.gov email address |
| 2024-02-26 | E2E Testing Framework | Accepted | Playwright |
| 2024-03-04 | Logging and Monitoring | Active | New Relic (top choice), with Datadog as alternative; CloudWatch retained for security/compliance only |
| 2024-03-19 | Dashboard Data Storage | Active | PostgreSQL (short/medium-term); Redshift if data grows to TB scale |
| 2024-04-10 | Dashboard BI Tool | Active | Metabase (open-source, self-hosted on ECS) |
| 2024-10-02 | Search Engine | Active | OpenSearch (over Elasticsearch and PostgreSQL full-text search) |
| 2024-10-18 | Document Storage | Active | AWS S3 (two buckets: draft and published opportunities) |
| 2024-11-14 | Document Sharing | Accepted | Google Workspace (Drive + Docs Editors Suite) |
| 2024-11-20 | Internal Wiki | Accepted | No dedicated internal wiki; use combination of GitBook (external) and Google Drive (internal) |
| 2024-12-05 | Shared Team Calendar | Accepted | Google Calendar |
| 2024-12-06 | Team Health Survey Tool | Proposed | Google Forms |
| 2024-12-17 | Adding Slack Users | Active | Add all users as full members or guests; discontinue Slack Connect |
| 2025-01-02 | Repo Organization | Accepted | 2-3 top-level repos: simpler-grants-gov (monorepo), simpler-grants-pdf-builder, simpler-grants-protocol, plus planning repos |
| 2025-02-25 | Community Forum | Active | Discourse (for public, async community discussions; note: not FedRAMP compliant) |

**Total: 50 ADRs + 5 non-ADR docs (CONTRIBUTING.md, README.md, documentation/README.md, dependencies.md, goals.md)**

---

## Architectural Decisions by Domain

### API Architecture

| ADR | Decision | Rationale |
|-----|----------|-----------|
| API Language (2023-06-30) | Python | Open source, easy to learn, strong data science libraries, OSS community, ETL/analytics synergy |
| API Framework (2023-07-07) | Flask + APIFlask | Leverages Nava Flask template, auto-generates OpenAPI specs from Marshmallow schemas, code-first paradigm |
| Backend API Type (2023-07-19) | REST | Widely adopted, highly scalable, flexible, easy for consumers to understand |
| Backend Production Server (2023-07-26) | Gunicorn | Industry standard Python WSGI server; Dockerfile defaults to prod, docker-compose overrides for dev |
| Search Engine (2024-10-02) | OpenSearch | Dedicated search engine over PostgreSQL full-text; chose OpenSearch over Elasticsearch due to licensing/open-source commitment |

**Key Architecture Pattern:** Python/Flask REST API -> PostgreSQL (RDS) + OpenSearch -> Next.js frontend. The API is code-first with auto-generated OpenAPI documentation. Marshmallow handles serialization/validation. The API uses SQLAlchemy as its ORM with Alembic for migrations.

### Frontend Architecture

| ADR | Decision | Rationale |
|-----|----------|-----------|
| Front-end Language (2023-07-10) | TypeScript | Strong typing for code quality; JavaScript required for client-side anyway |
| Front-end Framework (2023-07-14) | Next.js | SSG + SSR + CSR support, large community, Nava template available |
| FE Server Rendering (2023-07-20) | Server rendering (`next start`) | Better for authenticated/personalized apps; clearer separation of concerns; lighter client payloads |
| FE Package Manager (2023-07-20) | npm | Pre-bundled with Node; reduces installation steps on government equipment |
| FE Design System (2023-07-20) | USWDS | Section 508 compliant; GSA-maintained; required by 21st Century IDEA Act |
| USWDS in React (2023-07-20) | react-uswds (Truss) | Avoids reinventing the wheel; well-maintained open-source library |

**Key Architecture Pattern:** Next.js with TypeScript, server-side rendering by default, USWDS design system via react-uswds, npm for package management, Storybook for component development.

### Database & Data

| ADR | Decision | Rationale |
|-----|----------|-----------|
| Database Choices (2023-07-05) | PostgreSQL on Amazon RDS | Relational model fits NOFO/grant data; open source; Python library support; FedRAMP compliant hosting |
| Database Migrations (2023-12-06) | Alembic | Auto-generates migrations from SQLAlchemy models; zero-effort for most changes; free/open-source |
| Data Replication (2023-09-07) | AWS DMS + VPC Peering | Replicate Oracle production data to PostgreSQL without impacting production; FedRAMP compliant; schema transformation possible |
| Dashboard Storage (2024-03-19) | PostgreSQL (short/medium-term) | Already in use; Redshift only if data grows to TB scale |
| Document Storage (2024-10-18) | AWS S3 (two buckets) | Lowest TCO; integrates with CloudFront CDN; industry best practice for file storage |

**Key Data Architecture:** Legacy Oracle DB replicated via AWS DMS to PostgreSQL. Opportunity documents stored in S3 with draft/published bucket separation. OpenSearch indexes opportunity data for search. Dashboard analytics data stored in PostgreSQL with Metabase as the BI layer.

### Infrastructure & Deployment

| ADR | Decision | Rationale |
|-----|----------|-----------|
| Cloud Platform (2023-08-21) | AWS | Existing HHS relationship; existing grants.gov on AWS; FedRAMP; team experience |
| Infrastructure as Code (2023-08-21) | Terraform + Docker | Interoperable, declarative, immutable; Nava has templates and experience |
| Deployment Strategy (2023-07-20) | ECS with Fargate | Serverless containers; no EC2 management; scalable; Nava template integration |
| Uptime Monitoring (2023-11-22) | AWS CloudWatch Synthetic Canary | Uses existing ecosystem; configurable in Terraform; FedRAMP compliant |
| Logging/Monitoring (2024-03-04) | New Relic (top choice) | Fully featured APM; FedRAMP; better UX than CloudWatch; simpler pricing than Datadog |

**Key Infrastructure Pattern:** AWS-native infrastructure managed by Terraform. Applications containerized with Docker, deployed on ECS/Fargate. CloudWatch for security/compliance logging, New Relic for production operations monitoring. VPC Peering connects to legacy grants.gov infrastructure.

### Testing

| ADR | Decision | Rationale |
|-----|----------|-----------|
| Frontend Testing (2023-07-18) | Jest + Storybook | Jest integrated in Next.js template; Storybook for component isolation and visual testing |
| Backend Testing (2023-07-19) | Pytest + Coverage (80% threshold) | Integrated in Flask template; lightweight; comprehensive plugin architecture |
| E2E Testing (2024-02-26) | Playwright | Faster than Cypress; modern async/await syntax; multi-browser support; strong debugging tools |

**Testing Strategy:** Three-tier: unit tests (Jest/Pytest), component/visual tests (Storybook), E2E tests (Playwright). 80% code coverage threshold enforced on the backend.

### CI/CD & Process

| ADR | Decision | Rationale |
|-----|----------|-----------|
| CI/CD Task Runner (2023-06-29) | GitHub Actions | Free; FedRAMP; part of already-approved GitHub ecosystem |
| Branch/Release Workflow (2023-08-21) | Trunk-based development, squash-and-merge, CalVer | Facilitates CI/CD; simple; no commit convention enforced on individual commits |
| Backend Tooling (2023-07-07) | Ruff, Black, Mypy, Safety, Poetry, Make | Ruff replaces Flake8 for speed; comprehensive linting/formatting/type-checking/security |
| Frontend Tooling (2023-07-17) | ESLint, Prettier, TypeScript, Renovate | Standard JS ecosystem tools from Next.js template |
| Repo Organization (2025-01-02) | 2-3 top-level repos | simpler-grants-gov monorepo + separate repos for PDF builder and protocol spec |

### Communications & Collaboration Tools

| ADR | Decision | Rationale |
|-----|----------|-----------|
| Chat (2023-07-05) | Slack (paid) | Functionality, usability, integrations, team familiarity |
| Wiki (2023-07-10) | GitBook | Content review, GitHub syncing, public access, i18n support |
| Video Conferencing (2023-07-24) | Zoom | Full feature set, FedRAMP approved, public access without accounts |
| Analytics (2023-08-01) | DAP + Google Analytics | DAP required for public gov sites; GA for authenticated pages |
| Ticket Tracking (2023-07-11) | GitHub Issues + Projects | Free, public access, custom fields/views, covered under ATO |
| Design Prototyping (2023-07-03) | Figma | Cross-platform, collaborative, free tier for OSS |
| Diagramming (2023-07-11) | Mural | Existing HHS licenses, Nava experience, multi-discipline use |
| HHS Comms Site (2023-09-22) | GitBook with private link | Fast deployment, modern UI, content management by staff |
| Email Marketing (2023-10-16) | Sendy (short-term) | Already in use at HHS; long-term solution TBD |
| Listserv (2023-10-16) | Google Groups | Ease of use, security, cost-effective, scalable |
| Contact Us (2023-12-20) | simpler@grants.gov | Simple, accessible, matches project domain |
| Document Sharing (2024-11-14) | Google Workspace | Already available via contractors; no additional cost |
| Internal Wiki (2024-11-20) | No dedicated tool (GitBook + Google Drive) | Reduce tool overhead; GitBook had negative usability feedback |
| Calendar (2024-12-05) | Google Calendar | Existing availability, integration, cost-effective |
| Survey Tool (2024-12-06) | Google Forms | Part of Google Workspace, no additional cost |
| Slack Users (2024-12-17) | Full members/guests only; no Slack Connect | Reduce confusion, prevent user duplication |
| Community Forum (2025-02-25) | Discourse | Search engine indexable, async discussions, non-technical friendly (note: not FedRAMP) |

### Reporting & Dashboards

| ADR | Decision | Rationale |
|-----|----------|-----------|
| Deliverable Reporting (2023-12-15) | Deliverable column in GitHub Projects | Supports filtering/grouping/sorting; engineers keep milestones for sub-organization |
| Dashboard Architecture (2023-12-18) | Short-term S3+UI; long-term API+open source BI tool | Minimize upfront infra; iterate toward promotion pipeline for metrics |
| Dashboard Storage (2024-03-19) | PostgreSQL | Already in use; switch to Redshift only at TB scale |
| Dashboard Tool (2024-04-10) | Metabase | Open-source, self-hosted, lower cost than QuickSight, replicable by community |

---

## Cross-Cutting Themes

### 1. Open Source as a Core Value
Open source is a decision driver in nearly every ADR. The team consistently prioritizes open-source tools (Python, PostgreSQL, OpenSearch, Metabase, Terraform, react-uswds) and explicitly considers whether decisions enable open-source contribution. The Discourse forum ADR and community forum decisions demonstrate a commitment to building in the open.

### 2. Leveraging Nava Templates and Existing Infrastructure
Many foundational decisions (Flask+APIFlask, Next.js, backend tooling, frontend tooling, deployment strategy) were accelerated by leveraging Nava's open-source template repositories. This "template-first" approach is a recurring pattern that reduced time-to-market.

### 3. FedRAMP and Authority to Operate (ATO) as Hard Constraints
Nearly every tool evaluation includes FedRAMP compliance or ATO coverage as a must-have or strong decision driver. This eliminates many otherwise-viable options and explains choices like AWS over other cloud providers, Zoom over Jitsi, and the cautious approach to tools like Discourse.

### 4. Government Usability Concerns
Multiple ADRs (wiki, internal wiki, document sharing, listserv) highlight the challenge of balancing technical sophistication with accessibility for non-technical government staff. GitBook received negative usability feedback leading to the internal wiki being deprecated. The consistent choice of Google Workspace tools (Drive, Calendar, Forms, Groups) reflects a pragmatic preference for familiar, low-friction tools.

### 5. Progressive Architecture Strategy
Several decisions follow a "start simple, evolve later" pattern:
- Dashboard architecture: S3+UI now, Analytics API+BI tool later
- Email marketing: Sendy now, better tool later
- HHS comms site: Private link now, visitor auth later
- Dashboard storage: PostgreSQL now, Redshift if needed later
- Data replication: DMS now, new pipelines when Oracle is deprecated

### 6. Cost Consciousness
Cost is a recurring decision driver. The team consistently chooses free or low-cost options (GitHub Actions, GitHub Projects, Google Groups, Google Forms, Google Calendar) over premium alternatives. When paid tools are chosen (Slack, Metabase, New Relic), the team evaluates pricing models carefully.

### 7. Security-First Data Architecture
The data replication ADR is notably detailed about security, documenting VPC peering, encryption, FedRAMP compliance, and minimal-privilege access patterns. The S3 document storage uses a draft/published bucket separation for access control. The team maintains CloudWatch specifically for security/compliance even while using New Relic for operations.

### 8. Monorepo with Exceptions
The repo organization ADR (2025-01-02) formalizes a "monorepo with exceptions" strategy, keeping the main simpler-grants-gov repo as the center of gravity while allowing separate repos for the PDF builder and protocol spec. This reflects real-world organizational dynamics (different teams, different release cadences).

---

## Potentially Outdated Decisions

### 1. Wiki Platform: GitBook (2023-07-10)
**Status concern:** The Internal Wiki ADR (2024-11-20) explicitly documents negative feedback from the team about GitBook's usability, leading to the deprecation of the internal GitBook wiki. The external wiki remains on GitBook, but the pattern of dissatisfaction suggests this decision may need revisiting for the external wiki as well.

### 2. Email Marketing: Sendy (2023-10-16)
**Status concern:** Explicitly described as a short-term solution with known limitations (cannot send to 1M subscribers quickly). The ADR states a long-term tool selection is needed but does not appear to have been made. This decision is likely still in a transitional state.

### 3. Listserv: Google Groups (2023-10-16)
**Status concern:** The Community Forum ADR (2025-02-25) notes that Google Groups "remain largely unused" and "we have not publicized our Google Group's existence to any members of the public or even to our internal team." The Discourse forum effectively supersedes Google Groups for community engagement.

### 4. Backend Tooling: Black for Auto-formatting (2023-07-07)
**Status concern:** The ADR itself notes that "Ruff may replace the need for Black at some point." Ruff has since gained formatting capabilities (ruff format) and many projects have migrated from Black to Ruff. The codebase may have already made this switch.

### 5. Frontend Testing: Jest + Storybook (2023-07-18)
**Status concern:** The Next.js ecosystem has been shifting toward Vitest as a Jest replacement. If the project has upgraded to newer Next.js versions, Jest may have been replaced. Additionally, the E2E ADR chose Playwright, which can also handle component testing, potentially overlapping with Storybook's role.

### 6. Data Replication: AWS DMS from Oracle (2023-09-07)
**Status concern:** This ADR was created specifically for the transition period while data is replicated from the legacy Oracle database. The ADR itself notes this tool "will need to be deprecated" once the Oracle database is retired. If the Oracle migration is complete, this ADR is no longer relevant.

### 7. HHS Communications Site via GitBook Private Link (2023-09-22)
**Status concern:** The decision was explicitly described as a short-term approach with a plan to move to visitor authentication. The ADR is from September 2023 and the long-term solution may have been implemented by now.

### 8. Logging/Monitoring: New Relic vs Datadog (2024-03-04)
**Status concern:** The ADR recommends starting with a New Relic trial, with Datadog as an alternative. It does not record a final decision. The actual tool in production may differ from the recommendation.

### 9. Dashboard Storage: PostgreSQL (2024-03-19)
**Status concern:** The ADR recommends PostgreSQL with a caveat to switch to Redshift at TB scale. Given that the dashboard tool (Metabase) was deployed, the actual storage backend may have evolved.

### 10. API Framework: Flask + APIFlask (2023-07-07)
**Status concern:** APIFlask was described as "a relatively new library" with a note to "ensure code modularity in case we need to swap it out." The library's maturity and the project's continued use of it should be verified against the current codebase.

---

## Key Rationale Extractions

These are the most important "why" statements for inclusion in a Tier 1 architecture guide.

### Why Python for the API
> "Python...is free and open source and designed to be easy for anyone to learn quickly and contribute. Additionally, while all the languages can support the technical needs, Python in particular is optimized to handle the large and complex grants.gov dataset, and makes other parts of the project simpler, including ETL and data analysis for the analytics endpoints."

The open-source community angle was a primary driver: making it easy for external contributors to participate.

### Why Flask + APIFlask over FastAPI or Django
> "Flask + APIFlask, because it is well established with a broad community of developers and provides good tooling to move quickly... Additionally the Nava Flask template recently adopted it, so we can leverage the template to get going quickly with a well engineered solution."

The Nava template ecosystem was the accelerant. FastAPI was rejected due to sporadic maintenance and being maintained by a single person. Django was rejected as too monolithic and assuming both front/back in one app.

### Why PostgreSQL over MySQL
> "Improved performance for high-frequency write operations and complex queries... PostgreSQL support of most advanced database features such as materialized views... PostgreSQL is open source, in alignment with the Grants.gov strategy."

### Why REST over GraphQL
> "REST, because this option is widely opted, is highly scalable and can meet the demands of a large and active user base, and is flexible."

Simplicity and familiarity were prioritized over the potential efficiency gains of GraphQL.

### Why ECS/Fargate over Lambda or S3
> "ECS with Fargate launch type, because it offers the most consistent and easy to use deployment strategy to host both the front-end and API layers... Current template infrastructure integrates with ECS and the Fargate launch type."

Lambda was rejected due to 15-minute execution limits and deployment complexity. S3 was rejected as only suitable for static sites.

### Why Server-Side Rendering
> "Server rendering is the best option when the web application requires 'live' data, such as the personalized sites we often build... Server rendering requires more upfront effort on the infra side, but it enables teams to achieve a clearer separation of concerns, and write less application code in the long run."

The decision prioritized end-user experience over developer experience: "You can make your server fast, but you can't control the user's device or network."

### Why OpenSearch over Elasticsearch
> "Elastic had licensing issues/controversy that they've since walked back but has lost the trust of the Open Source community. OpenSearch largely tracks Elastic, but has a dedicated community and is directly committed to avoiding situations like Elastic experienced."

Open-source licensing integrity was the differentiator.

### Why AWS DMS for Data Replication
> "It is the only option that allows us to deliver within our period of performance and doesn't impact the production database's ability to perform its existing role."

Pragmatic delivery timeline was the key driver, combined with the ability to transform data during replication (Oracle to PostgreSQL schema changes).

### Why Trunk-Based Development
> "Widely adopted in general and preferred by the supporting engineering organization... Facilitates continuous integration... Facilitates continuous delivery."

The team uses squash-and-merge to reduce the cognitive load of writing individual commit messages, accepting the trade-off of less granular git history.

### Why Terraform over CloudFormation
> "Terraform is interoperable, widely adopted...has excellent documentation, and supports declarative and immutable strategies. The engineering team has Terraform templates and modules that can be used on the project."

Interoperability (not locked to AWS) and Nava's existing templates were decisive.

### Why Metabase over AWS QuickSight
> "Metabase's UX, and open-source nature, make it slightly beat out AWS QuickSight... Metabase is open-source and could be replicated by people outside the project by giving them access to a copy of our analytics database."

Open-source replicability aligned with the project's transparency values. Cost was also a factor ($100/mo vs $300/mo).

### Why Monorepo with Exceptions (Repo Organization)
> "Keeps NOFO builder production releases decoupled from the production releases in HHS/simpler-grants-gov, allowing the teams to have different cadences for development and deployments... Enables existing teams to largely continue working as they are now."

The decision balanced centralization with practical team autonomy, explicitly acknowledging Conway's Law.

---

## Non-ADR Document Summaries

### CONTRIBUTING.md
Defines the external contribution workflow: fork-based PRs against `main`, trunk-based development, issue templates for bugs/features, hybrid review assignment with designated maintainers (@btabaska, @mdragon, @KevinJBoyer), CC0 public domain licensing.

### README.md
Project overview: Simpler.Grants.gov is a modernization effort for Grants.gov. Monorepo with `api/` (Python/Flask), `frontend/` (Next.js), `infra/` (Terraform), `documentation/`, and `.github/` directories.

### documentation/README.md
Points to goals.md, deliverables directory, and decisions directory (ADRs).

### documentation/dependencies.md
Contains a Mermaid dependency diagram of deliverables, auto-generated by a Python script via GitHub Action. Shows workstreams: SimplerFind, SimplerEngagement, SimplerApply, SimplerPlatform, SimplerReporting, SimplerDelivery, CommonGrants, SimplerNOFOs.

### documentation/goals.md
Vision: "We want Grants.gov to be an extremely simple, accessible, and easy-to-use tool for posting, finding, sharing, and applying for federal financial assistance." Three pillars: Make grants.gov easy, accessible & collaborative, and transparent & participatory. Commits to fully open-source code.
