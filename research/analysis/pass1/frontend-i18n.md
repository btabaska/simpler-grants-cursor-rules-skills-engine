# Pattern Discovery: Frontend i18n

**Domain:** `frontend/src/i18n/` and related i18n usage across the frontend
**PRs analyzed:** 145 merged PRs (batch files b0, b1, b2)
**Analysis date:** 2026-03-27

---

## Pattern 1: Single Centralized Translation File

**Description:** All translations live in a single TypeScript file `frontend/src/i18n/messages/en/index.ts` which exports a `messages` object. Every PR that adds or modifies UI text touches this one file. There is no splitting by feature or page.

**Frequency:** ~100+ of 145 PRs modify this file
**Exemplar PRs:** #4304, #4318, #4367, #4424, #4433, #5707, #5714, #7362, #7377, #7392
**Trend:** Stable throughout the entire timeline. No movement toward splitting.
**Confidence:** Very High

**Key observations:**
- The file is acknowledged as a "hodgepodge" by reviewers (PR #4424, doug-s-nava comment)
- Top-level keys correspond to page/feature namespaces: `Search`, `OpportunityListing`, `Header`, `Events`, `Vision`, `Application`, `Settings`, `InviteLegacyUsers`, `BookmarkBanner`, etc.
- New features add new top-level keys (e.g., `Events` in PR #4424, `Vision` in PR #4433, `BookmarkBanner` in PR #5715, `Settings` in PR #7392)

---

## Pattern 2: `useTranslations` with Dot-Namespaced Scoping

**Description:** Components access translations via the `useTranslations` hook from `next-intl`, scoped to a namespace path using dot notation. The hook is called at the top of each component function.

**Frequency:** Observed in virtually every component that renders user-facing text (~80+ PRs)
**Exemplar PRs:** #4304, #4367, #4424, #5707, #5714, #5715, #7362, #7377, #7392
**Trend:** Stable, universal convention
**Confidence:** Very High

**Usage patterns:**
- Page-level scoping: `useTranslations("Search")`, `useTranslations("Events")`
- Section-level scoping: `useTranslations("Search.accordion")`, `useTranslations("Events.codingChallenge")`
- Deep scoping: `useTranslations("OpportunityListing.startApplicationModal.description")`, `useTranslations("OpportunityListing.startApplicationModal.fields.organizationSelect")`
- Server-side equivalent: `getTranslations({ locale })` or `getTranslations("Settings")` for async server components and `generateMetadata`
- Reviewer comment (PR #5714, b1): Doug-s-nava advised using `useTranslations("Applications.noApplicationMessage")` to reduce repeated key prefixes, suggesting a preference for scoping the hook as narrowly as practical

---

## Pattern 3: camelCase Key Convention (Enforced After PR #5143)

**Description:** Translation keys use camelCase. This was inconsistently applied early on (mix of `snake_case` and `camelCase`), then formally standardized via a dedicated cleanup PR.

**Frequency:** Discussed in PR #4424, enforced in PR #5143 (59 files changed, 120 key renames)
**Exemplar PRs:** #4424 (discussion), #5143 (enforcement), #7392 (post-enforcement compliance)
**Trend:** Pre-#5143: mixed snake_case and camelCase. Post-#5143: camelCase is the standard.
**Confidence:** High

**Evidence:**
- PR #4424 reviewer comment (doug-s-nava): "hard to tell since the messages file is such a hodgepodge, but I think we should commit to camelCase for key names in here rather than snake_case"
- PR #5143 title: "code style enforcement for camelCase and error variables" -- converted `page_not_found` to `pageNotFound`, `meta_description` to `metaDescription`, `try_again` to `tryAgain`, etc.
- PR #4433 (Vision page) introduced keys with `snake_case` like `page_title`, `title_1`, `paragraph_1`, `link_text_1` -- this was before the enforcement PR
- Post-enforcement PRs (#7362, #7377, #7392) consistently use camelCase: `applicationHistory`, `performedBy`, `tableHeadings`, `contactInfoHeading`
- One late counter-example: PR #7713 reviewer noted "(nit): We are using snake case for the overwhelming majority of this file" suggesting some areas still had legacy snake_case

---

## Pattern 4: Hierarchical Key Nesting by Feature/Section

**Description:** Translation keys are organized in nested objects that mirror the component/feature hierarchy. Top-level keys are page or feature names (PascalCase), with nested camelCase keys below.

**Frequency:** Universal across all 145 PRs
**Exemplar PRs:** #4304 (Search.accordion.titles/options), #5714 (OpportunityListing.startApplicationModal.fields.organizationSelect), #7362 (Application.historyTable.activities)
**Trend:** Stable. Nesting depth has increased as features grow more complex.
**Confidence:** Very High

**Structure examples:**
```
Search.accordion.titles.status
Search.accordion.options.status.forecasted
Application.historyTable.activities.application_created
Application.attachments.deleteModal.deleting
OpportunityListing.startApplicationModal.fields.name.label
Header.navLinks.home
Settings.validationErrors.firstName
```

**Key observation:** Activity event keys under `Application.historyTable.activities` use snake_case to match API enum values (`application_created`, `attachment_added`), which is an intentional exception to the camelCase rule.

---

## Pattern 5: `t.rich()` for Inline Rich Text (Links, Formatting)

**Description:** The `t.rich()` method from `next-intl` is used to embed HTML elements (links, paragraphs, emphasis) within translation strings. Translation values contain XML-like tags that map to React component renderers.

**Frequency:** ~15-20 PRs use this pattern
**Exemplar PRs:** #5707 (roadmap timeline with `<p>`, `<link-search>`, `<link-form>`), #5714 (SAM.gov link with `<link>`), #5715 (mailto link with `<mailToGrants>`), #7377 (manage users link with `<manageUsersLink>`), #7392 (login.gov link with `<link>`)
**Trend:** Increasing adoption over time as content becomes richer
**Confidence:** High

**Translation value format:**
```
"For technical support, email <mailToGrants>simpler@grants.gov</mailToGrants>."
"Have a valid UEI (a Unique Entity ID <link>registered through SAM.gov</link>)"
"Your email is managed by <link>login.gov</link>."
```

**Component usage:**
```tsx
t.rich("technicalSupportMessage", {
  mailToGrants: (content) => <a href="mailto:simpler@grants.gov">{content}</a>,
})
```

---

## Pattern 6: `useMessages()` for Dynamic Key Iteration

**Description:** When components need to iterate over a list of translated items (arrays of objects), they use `useMessages()` to get the raw messages object and then iterate over keys, using `t()` for each value.

**Frequency:** ~5-8 PRs (primarily Roadmap-related pages)
**Exemplar PRs:** #5707 (RoadmapTimeline iterating over `contentItems`)
**Trend:** Stable, used specifically for content-heavy list/timeline sections
**Confidence:** Medium-High

**Pattern:**
```tsx
const messages = useMessages() as unknown as IntlMessages;
const { contentItems = {} } = messages.Roadmap.sections.timeline;
Object.keys(contentItems).map((key) => {
  const title = t(`contentItems.${key}.title`);
  // ...
});
```

**Reviewer note (PR #5707):** Tests must add corresponding entries to `mockMessages` in `intlMocks.ts` -- a reviewer caught a `TypeError: Cannot read properties of undefined` from missing mock data.

---

## Pattern 7: Test Mocking Convention for i18n

**Description:** Tests consistently mock `next-intl` using a `useTranslationsMock` utility that returns the translation key as the displayed value. This allows tests to assert on key names rather than actual translated text.

**Frequency:** ~60+ test files across all PRs
**Exemplar PRs:** #4304, #4424, #4433, #5714, #5715, #7362, #7377
**Trend:** Stable, universal convention
**Confidence:** Very High

**Standard mock pattern:**
```tsx
jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
  useMessages: () => mockMessages,
}));
```

**Key detail:** The `useTranslationsMock` from `src/utils/testing/intlMocks.ts` returns the key string itself as the value, so tests assert `screen.getByText("description")` rather than `screen.getByText("Full description of the opportunity")`. A reviewer on PR #7877 (b2) explicitly stated: "I prefer not to have unit tests rely on the actual translated text, if we assert on the key instead that allows us to update the actual text without breaking tests."

**Server-side mock:**
```tsx
jest.mock("next-intl/server", () => ({
  getTranslations: () => identity,
  setRequestLocale: identity,
}));
```

---

## Pattern 8: Page Title Convention

**Description:** Page titles follow the pattern `<Page Name> | Simpler.Grants.gov` and are stored as a `pageTitle` key under the page's top-level namespace.

**Frequency:** ~15+ pages follow this pattern
**Exemplar PRs:** #4424 (Events), #4433 (Vision), #7392 (Settings)
**Trend:** Established mid-timeline, consistently followed afterward
**Confidence:** High

**Examples:**
```
Events.pageTitle: "Events | Simpler.Grants.gov"
Vision.pageTitle: "Vision | Simpler.Grants.gov"  (was page_title pre-camelCase)
Settings.pageTitle: "Settings | Simpler.Grants.gov"
```

**Reviewer enforcement (PR #4424):** Doug-s-nava asked: "the general pattern for page titles is `<page name> | Simpler.Grants.gov` @michellemin-nava can you confirm?" -- confirmed by design referencing federal website standards.

---

## Pattern 9: English-Only Single Locale (with Locale Routing)

**Description:** Despite having `[locale]` in the URL routing structure (supporting `/en/` and `/es/` paths), there is only one translation file (`en/index.ts`). No Spanish or other language translations exist.

**Frequency:** Observed across all 145 PRs -- no PR adds a non-English translation file
**Exemplar PRs:** All PRs only touch `messages/en/index.ts`
**Trend:** Stable -- the infrastructure supports multiple locales but only English is implemented
**Confidence:** Very High

**Evidence:**
- URL pattern `[locale]` in page paths (`src/app/[locale]/...`)
- `setRequestLocale(locale)` called in page components
- Path matching in `isCurrentPath` accounts for `/en/` and `/es/` prefixes (PR #4318)
- But only `messages/en/index.ts` exists and is modified

---

## Pattern 10: Translation Key Restructuring During Feature Evolution

**Description:** As features evolve, translation keys are reorganized -- typically moving from flat structures to more nested, component-aligned hierarchies. This happens when components are refactored.

**Frequency:** ~10-15 PRs involve key reorganization
**Exemplar PRs:** #4304 (moved `opportunityStatus.label.*` into `accordion.options.status.*`), #4318 (restructured `nav_link_*` into `navLinks.*`), #7392 (renamed `UserAccount` to `Settings`), #5714 (restructured `startApplicationModal` with nested `fields` and `description`)
**Trend:** Increasing -- keys tend to get more organized over time
**Confidence:** High

**Example from PR #4318:**
```
Before: Header.nav_link_home, Header.nav_link_roadmap, Header.nav_link_login
After:  Header.navLinks.home, Header.navLinks.roadmap, Header.navLinks.login
```

**Example from PR #7392:**
```
Before: UserAccount.pageTitle, UserAccount.title
After:  Settings.pageTitle, Settings.title, Settings.contactInfoHeading
```

---

## Pattern 11: Content Directly in Translation Values (Not Separated)

**Description:** Long-form content (paragraphs, descriptions, multi-sentence text) is stored directly as translation string values rather than being in separate content files or a CMS. This includes roadmap content, event descriptions, and vision page text.

**Frequency:** ~20+ PRs add substantial content blocks
**Exemplar PRs:** #4424 (Events page content), #4433 (Vision page content), #5707 (Roadmap timeline content)
**Trend:** Stable -- all content goes through the translation file
**Confidence:** Very High

**Example (PR #4424):**
```ts
codingChallenge: {
  title: "Collaborative Coding Challenge",
  descriptionP1: "The Simpler.Grants.gov Collaborative Coding Challenge is an entirely virtual interactive event...",
  descriptionP2: "Small teams of external developers, designers, and researchers pitch a proposal...",
  link: "Read about the Spring 2025 Coding Challenge",
}
```

---

## Anti-Pattern 1: Inconsistent Key Naming (Pre-Enforcement)

**Description:** Before PR #5143, translation keys used a mix of `snake_case` and `camelCase` with no consistent rule. Some new features introduced snake_case keys even after camelCase was discussed as the preferred style.

**Frequency:** Widespread pre-May 2025
**Exemplar PRs:** #4433 (Vision page used `page_title`, `title_1`, `paragraph_1`, `link_text_1`), #4486 (used `forecasted_post_date`, `forecasted_close_date`)
**Trend:** Resolved by PR #5143; occasional legacy remnants noted afterward
**Confidence:** High

---

## Anti-Pattern 2: Numbered Key Suffixes Instead of Semantic Names

**Description:** Some translation keys use numbered suffixes (`title_1`, `paragraph_2`, `link_text_1`) instead of semantically meaningful names. This makes it hard to understand what content a key represents without looking at its value.

**Frequency:** ~5 PRs
**Exemplar PRs:** #4433 (Vision page: `title_1` through `title_5`, `paragraph_1` through `paragraph_4`)
**Trend:** Appeared in early PRs; later PRs tend to use more descriptive names
**Confidence:** Medium-High

---

## Anti-Pattern 3: Hardcoded Links in Components (Not Translations)

**Description:** External URLs are sometimes hardcoded directly in component JSX rather than being parameterized through translations. Reviewer feedback has pushed toward extracting these as constants outside component definitions.

**Frequency:** ~5-8 PRs
**Exemplar PRs:** #4424 (EventsCoding had hardcoded wiki link; reviewer suggested moving outside component), #5707 (search and form links in translation rich text)
**Trend:** Reviewers flag this when noticed; some links moved to constants
**Confidence:** Medium

---

## Anti-Pattern 4: `use-intl` Import Instead of `next-intl`

**Description:** At least one file imported `useTranslations` from `use-intl` instead of `next-intl`. While `next-intl` re-exports from `use-intl`, the project convention is to import from `next-intl`.

**Frequency:** Rare (1-2 instances observed)
**Exemplar PRs:** #5756 (AttachmentsCardTable.tsx and AttachmentsCardTableHeaders.tsx imported from `use-intl`)
**Trend:** Isolated occurrence
**Confidence:** Medium

---

## Pattern 12: Translation Mock Structure Mirrors Real Structure

**Description:** The test mock file `src/utils/testing/intlMocks.ts` maintains a `mockMessages` object that mirrors the structure of the real messages file, required for components that use `useMessages()`.

**Frequency:** ~10+ PRs modify intlMocks.ts
**Exemplar PRs:** #5707 (added `timeline` section to mockMessages for RoadmapTimeline), #4424 (Events mocks)
**Trend:** Growing as more components use `useMessages()`
**Confidence:** High

**Lesson learned (PR #5707):** When a component uses `useMessages()` to iterate over translation structure, the mock must include that structure or tests fail with `TypeError: Cannot read properties of undefined`. This was caught in review.

---

## Summary of Key Conventions

| Convention | Status | Enforced By |
|---|---|---|
| Single `en/index.ts` translation file | Active | Convention |
| `useTranslations("Namespace.path")` hook | Active | Convention |
| camelCase translation keys | Active since PR #5143 | Code review + cleanup PR |
| Page title format: `Name \| Simpler.Grants.gov` | Active | Design standard + review |
| `t.rich()` for embedded HTML/links | Active | Convention |
| Test mocks return key strings, not values | Active | Code review |
| PascalCase top-level namespace keys | Active | Convention |
| `getTranslations()` for server components | Active | Convention |
