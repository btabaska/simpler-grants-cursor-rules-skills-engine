# Frontend i18n — Pattern Review

**Reviewer(s):** doug-s-nava
**PRs analyzed:** 145
**Rules proposed:** 15 (12 rules + 3 anti-patterns)
**Open questions:** 8

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

### 1. Single Centralized Translation File

**Confidence:** High
**Frequency:** ~100+ of 145 PRs modify this single file. Every PR that introduces or changes UI text touches `messages/en/index.ts`.
**Source PRs:** #4424, #7362, #9274

**Proposed Rule:**
> ALWAYS add all user-facing text to the single centralized file `frontend/src/i18n/messages/en/index.ts`. NEVER create separate translation files per page or feature.

**Rationale:**
Centralizing translations in one file makes it easy to audit all user-facing text and ensures a single source of truth. The team has acknowledged the file is a "hodgepodge" (reviewer comment, PR #4424), but no movement toward splitting has occurred across 145 PRs.

**Code Examples:**
```ts
# From PR #4424 — Adding an entire Events page namespace to the single file
// frontend/src/i18n/messages/en/index.ts
export const messages = {
  Events: {
    pageTitle: "Events | Simpler.Grants.gov",
    pageDescription:
      "From new developments to upcoming opportunities, we want you to be a part of the journey.",
    header: "Events",
    upcoming: {
      title: "Upcoming Events",
      startDate: "Begins March 10, 2025",
      header: "Spring 2025 Collaborative Coding Challenge",
      description: "The next Simpler.Grants.gov Coding Challenge gives participants...",
      link: "Sign up to participate",
    },
    // ... more nested keys
  },
```

```ts
# From PR #7362 — Adding Application history table translations to the same file
    historyTable: {
      applicationHistory: "Application History",
      timestamp: "Timestamp",
      activity: "Activity",
      performedBy: "Performed By",
      error: "We have encountered an error loading your application activity history...",
      activities: {
        application_created: "Application created",
        attachment_added: "Attachment added: ",
        // ...
      },
    },
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

**Open Question:** As the file grows, will there be a threshold at which splitting by feature/page is warranted? Should there be a lint rule to enforce that no hardcoded English strings appear in components?

---

### 2. `useTranslations` Hook with Dot-Namespaced Scoping

**Confidence:** High
**Frequency:** Observed in virtually every component that renders user-facing text (~80+ PRs).
**Source PRs:** #4424, #7392, #7362

**Proposed Rule:**
> ALWAYS access translations via `useTranslations("Namespace.path")` from `next-intl` in client components. ALWAYS use `getTranslations()` or `getTranslations("Namespace")` for async server components. ALWAYS scope the hook as narrowly as practical to avoid repeating key prefixes in `t()` calls.

**Rationale:**
Narrow scoping reduces key repetition within `t()` calls, making component code cleaner and more readable. A reviewer on PR #5714 explicitly advised narrowing the hook scope to reduce prefix repetition.

**Code Examples:**
```tsx
# From PR #4424 — Page-level scoping in client component
// frontend/src/app/[locale]/events/EventsCoding.tsx
export default function EventsCoding() {
  const t = useTranslations("Events.codingChallenge");
  return (
    // ...
    <h2>{t("title")}</h2>
    <p>{t("descriptionP1")}</p>
  );
}
```

```tsx
# From PR #7392 — Server-side getTranslations in generateMetadata
export async function generateMetadata({ params }: LocalizedPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const meta: Metadata = {
    title: t("Settings.pageTitle"),
    description: t("Index.metaDescription"),
  };
  return meta;
}

async function Settings() {
  const t = await getTranslations("Settings");
  // ...
  return (
    <h1>{t("title")}</h1>
  );
}
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

### 3. camelCase Translation Keys

**Confidence:** High
**Frequency:** Enforced project-wide via PR #5143 (59 files changed, 120+ key renames). All post-enforcement PRs comply.
**Source PRs:** #5143, #7362

**Proposed Rule:**
> ALWAYS use camelCase for translation key names. NEVER use snake_case for new translation keys. The sole exception is keys that must match API enum values (e.g., `application_created`, `attachment_added` under activity history).

**Rationale:**
camelCase is the standard JavaScript/TypeScript naming convention. PR #4424 reviewer (doug-s-nava) flagged the inconsistency and advocated for camelCase. PR #5143 enforced it project-wide.

**Code Examples:**
```tsx
# From PR #5143 — The enforcement PR, renaming snake_case to camelCase
// Before:
title: t("ErrorPages.page_not_found.title"),
description: t("Index.meta_description"),

// After:
title: t("ErrorPages.pageNotFound.title"),
description: t("Index.metaDescription"),
```

```ts
# From PR #7362 — Intentional snake_case exception for API enum values
// frontend/src/i18n/messages/en/index.ts
activities: {
  application_created: "Application created",
  application_name_changed: "Application name changed",
  attachment_added: "Attachment added: ",
  // ...
},
```

**Conflicting Examples:**
PR #7713 noted "(nit): We are using snake case for the overwhelming majority of this file" -- suggesting some legacy areas may still need cleanup.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** Should there be a lint rule or CI check preventing snake_case keys in `messages/en/index.ts` (excluding the `activities` section)? Are there remaining legacy areas that need cleanup?

---

### 4. PascalCase Top-Level Namespace Keys with Nested camelCase

**Confidence:** High
**Frequency:** Universal across all 145 PRs.
**Source PRs:** #4318, #7392, #5714

**Proposed Rule:**
> ALWAYS use PascalCase for top-level namespace keys (matching page or feature names). ALWAYS use camelCase for nested keys below the top level. ALWAYS organize keys in a hierarchy that mirrors the component/feature structure.

**Rationale:**
This convention creates a discoverable mapping between the translation file structure and the component tree, making it easy to find and update translations for specific UI sections.

**Code Examples:**
```ts
# From PR #4318 — Restructuring Header keys from flat snake_case to nested camelCase
// Before:
Header: {
  nav_link_home: "Home",
  nav_link_roadmap: "Roadmap",
  nav_link_search: "Search",
  nav_link_login: "Sign in",
}

// After:
Header: {
  navLinks: {
    home: "Home",
    roadmap: "Roadmap",
    search: "Search",
    login: "Sign in",
    workspace: "Workspace",
    savedGrants: "Saved opportunities",
    savedSearches: "Saved search queries",
  },
  title: "Simpler.Grants.gov",
},
```

```ts
# From PR #7392 — Renaming a top-level namespace
// Before:
UserAccount: {
  pageTitle: "User Account | Simpler.Grants.gov",
  title: "User Account",
}

// After:
Settings: {
  pageTitle: "Settings | Simpler.Grants.gov",
  title: "Settings",
  contactInfoHeading: "Contact information",
  contactInfoBody: "Your name and email will be visible to others...",
}
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

### 5. `t.rich()` for Inline Rich Text

**Confidence:** High
**Frequency:** ~15-20 PRs use this pattern, with increasing adoption over time.
**Source PRs:** #5715, #5707, #7392

**Proposed Rule:**
> ALWAYS use `t.rich()` (not string concatenation or JSX interpolation) when a translation string contains inline HTML elements such as links, emphasis, or paragraphs. Translation values MUST use XML-like tags (e.g., `<link>`, `<mailToGrants>`) that map to React component renderers in the `t.rich()` call.

**Rationale:**
`t.rich()` keeps the full translatable sentence together (important for future multi-language support) while allowing React elements to be embedded safely. It avoids splitting sentences across multiple keys.

**Code Examples:**
```ts
# From PR #5715 — mailto link in BookmarkBanner
// In messages/en/index.ts:
BookmarkBanner: {
  technicalSupportMessage:
    "For technical support or to give feedback, email <mailToGrants>simpler@grants.gov</mailToGrants>.",
},
```
```tsx
// In component:
{t.rich("technicalSupportMessage", {
  mailToGrants: (content) => (
    <a href="mailto:simpler@grants.gov">{content}</a>
  ),
})}
```

```ts
# From PR #5707 — Multiple rich text tags in roadmap timeline
// In messages/en/index.ts:
content:
  "<p>Our easier-to-use search experience will become the default...</p><p><link-search>Try the new search now</link-search>.</p>",
```
```tsx
// In component:
{t.rich(`contentItems.${key}.content`, {
  p: (content) => <p>{content}</p>,
  "link-search": (content) => (
    <a href="https://simpler.grants.gov/search">{content}</a>
  ),
  "link-form": (content) => (
    <a href="https://docs.google.com/forms/..." target="_blank">
      {content}
    </a>
  ),
})}
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

**Open Question:** Should there be a naming convention for the XML tag names (e.g., always use descriptive names like `mailToGrants` vs generic `link`)?

---

### 6. `useMessages()` for Dynamic Key Iteration

**Confidence:** Medium-High
**Frequency:** ~5-8 PRs (primarily content-heavy sections like Roadmap).
**Source PRs:** #5707

**Proposed Rule:**
> When a component needs to iterate over a structured list of translated items, use `useMessages()` to access the raw messages object and iterate over its keys, using `t()` for each individual value. ALWAYS update the test mock file (`intlMocks.ts`) to mirror the structure when adding new `useMessages()` usage.

**Rationale:**
`next-intl` does not provide a built-in way to iterate over translation keys. Using `useMessages()` to access the raw structure is the supported workaround for content-heavy list/timeline sections.

**Code Examples:**
```tsx
# From PR #5707 — RoadmapTimeline iterating over content items
export default function RoadmapTimeline() {
  const t = useTranslations("Roadmap.sections.timeline");
  const messages = useMessages() as unknown as IntlMessages;
  const { contentItems = {} } = messages.Roadmap.sections.timeline;

  return (
    <RoadmapPageSection className="bg-base-lightest" title={t("title")}>
      {contentItems &&
        Object.keys(contentItems).map((key) => {
          const title = t(`contentItems.${key}.title`);
          return (
            <div key={`roadmap-timeline-${title}-key`}>
              <h3>{t(`contentItems.${key}.date`)}</h3>
              <h4>{t(`contentItems.${key}.title`)}</h4>
              {t.rich(`contentItems.${key}.content`, { /* ... */ })}
            </div>
          );
        })}
    </RoadmapPageSection>
  );
}
```

```tsx
# From PR #5707 — Required mock update in intlMocks.ts
export const mockMessages = {
  Roadmap: {
    sections: {
      timeline: {
        title: "timeline test title",
        contentItems: [
          [{ date: "Smarch 13", title: "test title 1", content: "test content 1" }],
          [{ date: "Smarch 14", title: "test title 2", content: "test content 2" }],
        ],
      },
    },
  },
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

**Open Question:** Is there a cleaner pattern for this? The `as unknown as IntlMessages` cast is a code smell. Should there be a helper function that encapsulates the `useMessages()` iteration pattern?

---

### 7. Test Mocking Convention for i18n

**Confidence:** High
**Frequency:** ~60+ test files across all PRs follow this pattern.
**Source PRs:** #7377, #8549

**Proposed Rule:**
> ALWAYS mock `next-intl` in tests using `useTranslationsMock()` from `src/utils/testing/intlMocks.ts`. Tests MUST assert on translation keys (not actual translated text). For server components, mock `next-intl/server` with `getTranslations: () => useTranslationsMock()`. ALWAYS import `useTranslations` from `next-intl`, NEVER from `use-intl`.

**Rationale:**
Asserting on keys rather than actual text decouples tests from content changes. A reviewer on PR #7877 stated: "I prefer not to have unit tests rely on the actual translated text, if we assert on the key instead that allows us to update the actual text without breaking tests."

**Code Examples:**
```tsx
# From PR #7377 — Standard client-side mock pattern
jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

```tsx
# From PR #8549 — Server-side mock pattern
jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(() => useTranslationsMock()),
}));
```

```tsx
# From PR #7377 — Test asserting on key names (not translated text)
it("shows the appropriate error message", () => {
  const component = InviteLegacyUsersErrorPage({
    organizationId: "org-123",
  });
  render(component);
  expect(screen.getByText("dataLoadingError")).toBeVisible();
});
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

### 8. Page Title Format Convention

**Confidence:** High
**Frequency:** ~15+ pages follow this pattern consistently.
**Source PRs:** #4424, #7392

**Proposed Rule:**
> ALWAYS format page titles as `<Page Name> | Simpler.Grants.gov` and store them under a `pageTitle` key in the page's top-level namespace. ALWAYS set the page title via `generateMetadata` using `getTranslations`.

**Rationale:**
Follows federal website standards for consistent browser tab titles. Reviewer (doug-s-nava) in PR #4424 confirmed the pattern references federal design conventions.

**Code Examples:**
```ts
# From PR #4424 — Events page title
Events: {
  pageTitle: "Events | Simpler.Grants.gov",
```

```tsx
# From PR #7392 — Using pageTitle in generateMetadata
export async function generateMetadata({ params }: LocalizedPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const meta: Metadata = {
    title: t("Settings.pageTitle"),
    description: t("Index.metaDescription"),
  };
  return meta;
}
```

**Conflicting Examples:**
PR #8549 used `defaultValue` in the `t()` call for page titles (`t("AwardRecommendation.pageTitle", { defaultValue: "Award Recommendation" })`). A reviewer flagged this as non-standard.

---

**TECH LEAD REVIEW:**

- [ ] CONFIRMED — This is the canonical pattern
- [ ] DEPRECATED — This pattern is legacy; the correct approach is: ___
- [ ] NEEDS NUANCE — This is correct but with caveats: ___
- [ ] SPLIT — This is actually two valid patterns for different contexts: ___

**Notes:** ___

**Open Question:** PR #8549 used `defaultValue` in the `t()` call for page titles. Should `defaultValue` usage be prohibited?

---

### 9. English-Only Single Locale

**Confidence:** High
**Frequency:** 145 out of 145 PRs only modify `messages/en/index.ts`. No non-English file exists.
**Source PRs:** #4424, #4318

**Proposed Rule:**
> ALWAYS add translations only to `messages/en/index.ts`. The codebase supports locale routing infrastructure (`[locale]` path segments, `setRequestLocale(locale)`) but only English is implemented. Do NOT add non-English translation files unless the project formally adopts multi-language support.

**Rationale:**
The infrastructure supports future internationalization, but the project currently only serves English. Adding non-English files without a full i18n strategy would create maintenance burden.

**Code Examples:**
```tsx
# From PR #4424 — Server page using locale infrastructure
export default function Events({ params }: LocalizedPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);
  // ... renders in English only
}
```

```ts
# From PR #4318 — Path matching accounts for locale prefixes
// note that the regexp is taking into account /en & /es localized pathnames
export const isCurrentPath = (href: string, currentPath: string): boolean =>
  !!currentPath.match(new RegExp(`^(?:/e[ns])?${href.split("?")[0]}`));
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

**Open Question:** When (if ever) will multi-language support be activated? Should the `/es/` route be removed or redirected to prevent serving untranslated content?

---

### 10. Translation Key Restructuring During Feature Evolution

**Confidence:** Medium-High
**Frequency:** ~10-15 PRs involve key reorganization.
**Source PRs:** #4318, #7392

**Proposed Rule:**
> When renaming or restructuring a page/feature, ALWAYS update the corresponding top-level translation namespace and all references to it in one atomic PR. ALWAYS move from flat structures to nested, component-aligned hierarchies when refactoring.

**Rationale:**
Atomic restructuring prevents broken references and ensures all components, tests, and metadata stay in sync during renames.

**Code Examples:**
```ts
# From PR #4318 — Restructuring Header nav links from flat to nested
// Before:
Header: {
  nav_link_home: "Home",
  nav_link_roadmap: "Roadmap",
  nav_link_search: "Search",
}
// After:
Header: {
  navLinks: {
    home: "Home",
    roadmap: "Roadmap",
    search: "Search",
  },
}
```

```ts
# From PR #7392 — Renaming UserAccount to Settings
// Before:
UserAccount: {
  pageTitle: "User Account | Simpler.Grants.gov",
  title: "User Account",
}
// After:
Settings: {
  pageTitle: "Settings | Simpler.Grants.gov",
  title: "Settings",
  contactInfoHeading: "Contact information",
}
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

**Open Question:** Should there be a migration script or documentation for large-scale key renames?

---

### 11. Content Directly in Translation Values

**Confidence:** High
**Frequency:** ~20+ PRs add substantial content blocks directly in the translation file.
**Source PRs:** #4424, #5707

**Proposed Rule:**
> ALWAYS store long-form content (paragraphs, descriptions, multi-sentence text) directly as translation string values. NEVER use separate content files, Markdown files, or a CMS for page content.

**Rationale:**
Keeping content in the translation file ensures it goes through the same i18n pipeline and is available for future localization without architectural changes.

**Code Examples:**
```ts
# From PR #4424 — Multi-paragraph event descriptions
codingChallenge: {
  title: "Collaborative Coding Challenge",
  descriptionP1:
    "The Simpler.Grants.gov Collaborative Coding Challenge is an entirely virtual interactive event attended by members of the public, government, stakeholders, and our internal development team.",
  descriptionP2:
    "Small teams of external developers, designers, and researchers pitch a proposal to solve a problem with the strongest of them added to the product roadmap.",
  link: "Read about the Spring 2025 Coding Challenge",
},
```

```ts
# From PR #5707 — Rich content with inline markup in translation values
{
  date: "Summer 2025",
  title: "Simpler search, by default",
  content:
    "<p>Our easier-to-use search experience will become the default way to discover funding opportunities on Grants.gov.</p><p><link-search>Try the new search now</link-search>.</p>",
},
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

**Open Question:** For very long content pages (roadmap, vision), should there be a maximum recommended length per translation value? Does content-in-translations make non-developer content updates harder?

---

### 12. Translation Mock Structure Must Mirror Real Structure

**Confidence:** High
**Frequency:** ~10+ PRs modify `intlMocks.ts`. Explicitly caught in PR #5707 review.
**Source PRs:** #5707

**Proposed Rule:**
> ALWAYS update `src/utils/testing/intlMocks.ts` with matching structure when adding translation keys used by components that call `useMessages()`. Failure to do so will cause `TypeError: Cannot read properties of undefined` in tests.

**Rationale:**
Components using `useMessages()` access the raw messages object directly, bypassing the mock function. The mock object must contain the expected structure or tests will fail with runtime errors.

**Code Examples:**
```tsx
# From PR #5707 — Adding timeline mock data after reviewer caught the error
// frontend/src/utils/testing/intlMocks.ts
export const mockMessages = {
  Roadmap: {
    sections: {
      timeline: {
        title: "timeline test title",
        contentItems: [
          [{ date: "Smarch 13", title: "test title 1", content: "test content 1" }],
          [{ date: "Smarch 14", title: "test title 2", content: "test content 2" }],
        ],
      },
    },
  },
```

```
# From PR #5707 — Reviewer comment (andycochran)
> Not sure what I'm doing wrong here. But it's causing tests to fail. Getting this error:
> `TypeError: Cannot read properties of undefined (reading 'contentItems')`

# Resolved by doug-s-nava pointing to the mock file:
> you need to add a "timeline" item in the mocked useMessages response here
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

**Open Question:** Should there be a test helper or type guard that validates mock structure against real messages?

---

### Anti-Pattern A: Numbered Key Suffixes

**Confidence:** Medium-High
**Frequency:** ~5 PRs (primarily early PRs like #4433).
**Source PRs:** #4433

**Proposed Rule:**
> NEVER use numbered suffixes (`title_1`, `paragraph_2`, `link_text_1`) for translation keys. ALWAYS use semantically meaningful names that describe the content.

**Rationale:**
Numbered keys obscure the purpose of the content and make the translation file harder to maintain. Later PRs adopted more descriptive names (e.g., `descriptionP1`, `watchLink`, `inviteYourTeam`).

**Code Examples:**
```ts
# From PR #4433 — Vision page with numbered keys (what NOT to do)
Vision: {
  get_there: {
    title_1: "How we'll get there",
    title_2: "What we've learned from you",
    paragraph_1: "From our research, we know...",
    paragraph_2: "We're building a grants experience...",
    link_text_1: "Learn more about Grants.gov user archetypes",
    link_text_2: "Help us improve Grants.gov",
  },
}
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

### Anti-Pattern B: Importing from `use-intl` Instead of `next-intl`

**Confidence:** Medium
**Frequency:** Rare (1-2 instances in PR #5756).
**Source PRs:** #5756

**Proposed Rule:**
> ALWAYS import `useTranslations` from `next-intl`. NEVER import from `use-intl` directly, even though `next-intl` re-exports from it.

**Rationale:**
Using `next-intl` as the canonical import source ensures consistency across the codebase and avoids confusion about which package provides the hook.

**Code Examples:**
```
# PR #5756 — AttachmentsCardTable.tsx and AttachmentsCardTableHeaders.tsx
# imported from `use-intl` instead of `next-intl` (anti-pattern)
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

### Anti-Pattern C: Using `defaultValue` in Translation Calls

**Confidence:** Medium
**Frequency:** 1 observed instance (PR #8549).
**Source PRs:** #8549

**Proposed Rule:**
> NEVER pass `defaultValue` to `t()` calls. ALWAYS ensure the corresponding key exists in `messages/en/index.ts`.

**Rationale:**
`defaultValue` bypasses the centralized translation file, creating a shadow copy of the text that can drift out of sync. All text should live in the translation file.

**Code Examples:**
```tsx
# From PR #8549 — Using defaultValue (what NOT to do)
{t("pageTitle", { defaultValue: "Award Recommendation" })}
{t("description", { defaultValue: "Award Recommendation flow coming soon." })}
```

```
# Reviewer (doug-s-nava) flagged:
> "I don't see any other pages that are providing a 'defaultValue' here.
> Do we need to do that?"
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

## Coverage Gaps

1. **No automated enforcement of camelCase keys** — The camelCase convention (Rule 3) is enforced only through code review. No lint rule or CI check exists to prevent snake_case keys in the translation file. (Also flagged in cross-domain gap GAP-1.)
2. **No lint rule for hardcoded strings** — There is no ESLint rule to detect hardcoded English strings in component JSX that should be using `t()` calls.
3. **No validation of mock structure against real translations** — Components using `useMessages()` can silently break in tests if the mock structure in `intlMocks.ts` drifts from the real `messages/en/index.ts`.

## Inconsistencies Requiring Resolution

### Filter Options: i18n vs. Constants

Filter/sort option labels were originally in the i18n messages file but are being progressively moved to `src/constants/searchFilterOptions.ts` (PR #6252). The reviewer confirmed the team wants to keep i18n infrastructure in place, but a clear boundary between what lives in i18n vs. constants has not been documented.

**Question:** What criteria determine whether a user-facing string should live in the translation file vs. a constants file?

### Legacy snake_case Keys

PR #7713 noted "(nit): We are using snake case for the overwhelming majority of this file" -- suggesting some areas still have legacy snake_case keys despite the project-wide cleanup in PR #5143.

**Question:** Should a follow-up cleanup PR address remaining snake_case keys?

### Rich Text Tag Naming

Rich text translation tags use inconsistent naming: sometimes descriptive (`mailToGrants`, `link-search`), sometimes generic (`link`). No naming convention has been established.

**Question:** Should descriptive tag names be required for all rich text interpolations?

### Cross-Domain: Translation File as Architectural Decision (AP-4)

The Pass 3 synthesis identifies the single translation file as part of the project's "Database as Source of Truth, Code as Configuration" architectural principle. This is a deliberate design choice, not an accident.
