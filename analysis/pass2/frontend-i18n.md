# Pass 2: Pattern Codification -- Frontend i18n

**Domain:** `frontend/src/i18n/` and related i18n usage across the frontend
**Source:** Pass 1 discovery document + 20 representative PR diffs
**PRs sampled for code examples:** #4304, #4318, #4424, #4433, #5143, #5707, #5714, #5715, #5756, #7362, #7377, #7392, #8549, #9274
**Codification date:** 2026-03-30

---

## Rule 1: Single Centralized Translation File

**Pattern Name:** Single Translation File

**Rule Statement:** ALWAYS add all user-facing text to the single centralized file `frontend/src/i18n/messages/en/index.ts`. NEVER create separate translation files per page or feature.

**Confidence:** High

**Frequency:** ~100+ of 145 PRs modify this single file. Every PR that introduces or changes UI text touches `messages/en/index.ts`.

**Code Examples:**

PR #4424 -- Adding an entire Events page namespace to the single file:
```ts
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

PR #7362 -- Adding Application history table translations to the same file:
```ts
// frontend/src/i18n/messages/en/index.ts
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

PR #9274 -- Adding form field translations in the same file:
```ts
      assistanceListingNumber: "Assistance listing number",
      assistanceListingNumberDesc:
        "Enter the 5-digit code from SAM.gov that identifies the specific federal assistance program (e.g., 10.500)",
```

**Rationale:** Centralizing translations in one file makes it easy to audit all user-facing text and ensures a single source of truth. The team has acknowledged the file is a "hodgepodge" (reviewer comment, PR #4424), but no movement toward splitting has occurred across 145 PRs.

**Open Questions:**
- As the file grows, will there be a threshold at which splitting by feature/page is warranted?
- Should there be a lint rule to enforce that no hardcoded English strings appear in components?

---

## Rule 2: useTranslations Hook with Dot-Namespaced Scoping

**Pattern Name:** Namespaced Translation Hook

**Rule Statement:** ALWAYS access translations via `useTranslations("Namespace.path")` from `next-intl` in client components. ALWAYS use `getTranslations()` or `getTranslations("Namespace")` for async server components. ALWAYS scope the hook as narrowly as practical to avoid repeating key prefixes in `t()` calls.

**Confidence:** High

**Frequency:** Observed in virtually every component that renders user-facing text (~80+ PRs).

**Code Examples:**

PR #4424 -- Page-level scoping in client component:
```tsx
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

PR #7392 -- Server-side `getTranslations` in `generateMetadata`:
```tsx
// frontend/src/app/[locale]/(base)/settings/page.tsx
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

PR #7362 -- Deep scoping for a sub-section:
```tsx
// frontend/src/components/application/ApplicationHistoryTable.tsx
const activityTranslations = useTranslations(
  "Application.historyTable.activities",
);
// Used as:
activityTranslations(history.application_audit_event)
```

**Rationale:** Narrow scoping reduces key repetition within `t()` calls, making component code cleaner and more readable. A reviewer on PR #5714 explicitly advised narrowing the hook scope to reduce prefix repetition.

**Open Questions:**
- None; this is well-established and universally applied.

---

## Rule 3: camelCase Translation Keys

**Pattern Name:** camelCase Key Naming Convention

**Rule Statement:** ALWAYS use camelCase for translation key names. NEVER use snake_case for new translation keys. The sole exception is keys that must match API enum values (e.g., `application_created`, `attachment_added` under activity history).

**Confidence:** High

**Frequency:** Enforced project-wide via PR #5143 (59 files changed, 120+ key renames). All post-enforcement PRs comply.

**Code Examples:**

PR #5143 -- The enforcement PR itself, renaming snake_case to camelCase:
```tsx
// Before:
title: t("ErrorPages.page_not_found.title"),
description: t("Index.meta_description"),

// After:
title: t("ErrorPages.pageNotFound.title"),
description: t("Index.metaDescription"),
```

```tsx
// Before:
const t = useTranslations("Subscription_confirmation");
// After:
const t = useTranslations("SubscriptionConfirmation");
```

PR #7362 -- Intentional snake_case exception for API enum values:
```ts
// frontend/src/i18n/messages/en/index.ts
activities: {
  application_created: "Application created",
  application_name_changed: "Application name changed",
  attachment_added: "Attachment added: ",
  // ...
},
```
These keys match the `ApplicationActivityEvent` type values from the API (`application_audit_event` field), so snake_case is retained deliberately.

**Rationale:** camelCase is the standard JavaScript/TypeScript naming convention. PR #4424 reviewer (doug-s-nava) flagged the inconsistency and advocated for camelCase. PR #5143 enforced it project-wide.

**Open Questions:**
- Should there be a lint rule or CI check preventing snake_case keys in `messages/en/index.ts` (excluding the `activities` section)?
- PR #7713 noted "(nit): We are using snake case for the overwhelming majority of this file" -- are there remaining legacy areas that need cleanup?

---

## Rule 4: PascalCase Top-Level Namespace Keys with Nested camelCase

**Pattern Name:** Hierarchical Key Nesting Convention

**Rule Statement:** ALWAYS use PascalCase for top-level namespace keys (matching page or feature names). ALWAYS use camelCase for nested keys below the top level. ALWAYS organize keys in a hierarchy that mirrors the component/feature structure.

**Confidence:** High

**Frequency:** Universal across all 145 PRs.

**Code Examples:**

PR #4318 -- Restructuring Header keys from flat snake_case to nested camelCase:
```ts
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

PR #7392 -- Renaming a top-level namespace:
```ts
// Before:
UserAccount: {
  pageTitle: "User Account | Simpler.Grants.gov",
  title: "User Account",
  // ...
}

// After:
Settings: {
  pageTitle: "Settings | Simpler.Grants.gov",
  title: "Settings",
  contactInfoHeading: "Contact information",
  contactInfoBody: "Your name and email will be visible to others...",
  // ...
}
```

PR #5714 -- Deep nesting for complex modal:
```
OpportunityListing.startApplicationModal.fields.organizationSelect.label
OpportunityListing.startApplicationModal.description.requirements
```

**Rationale:** This convention creates a discoverable mapping between the translation file structure and the component tree, making it easy to find and update translations for specific UI sections.

**Open Questions:**
- None; well-established.

---

## Rule 5: t.rich() for Inline Rich Text

**Pattern Name:** Rich Text Translation Pattern

**Rule Statement:** ALWAYS use `t.rich()` (not string concatenation or JSX interpolation) when a translation string contains inline HTML elements such as links, emphasis, or paragraphs. Translation values MUST use XML-like tags (e.g., `<link>`, `<mailToGrants>`) that map to React component renderers in the `t.rich()` call.

**Confidence:** High

**Frequency:** ~15-20 PRs use this pattern, with increasing adoption over time.

**Code Examples:**

PR #5715 -- mailto link in BookmarkBanner:
```ts
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

PR #5707 -- Multiple rich text tags in roadmap timeline:
```ts
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

PR #7392 -- login.gov link in Settings page:
```ts
// In messages/en/index.ts:
contactInfoBody:
  "Your name and email will be visible to others in your organization... your email and password are managed by <link>login.gov</link>.",
```
```tsx
// In component:
{t.rich("contactInfoBody", {
  link: (chunk) => (
    <a href="https://login.gov" target="_blank">
      {chunk}
    </a>
  ),
})}
```

**Rationale:** `t.rich()` keeps the full translatable sentence together (important for future multi-language support) while allowing React elements to be embedded safely. It avoids splitting sentences across multiple keys.

**Open Questions:**
- Should there be a naming convention for the XML tag names (e.g., always use descriptive names like `mailToGrants` vs generic `link`)?

---

## Rule 6: useMessages() for Dynamic Key Iteration

**Pattern Name:** Dynamic Message Iteration Pattern

**Rule Statement:** When a component needs to iterate over a structured list of translated items, use `useMessages()` to access the raw messages object and iterate over its keys, using `t()` for each individual value. ALWAYS update the test mock file (`intlMocks.ts`) to mirror the structure when adding new `useMessages()` usage.

**Confidence:** Medium-High

**Frequency:** ~5-8 PRs (primarily content-heavy sections like Roadmap).

**Code Examples:**

PR #5707 -- RoadmapTimeline iterating over content items:
```tsx
// frontend/src/components/roadmap/sections/RoadmapTimeline.tsx
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

PR #5707 -- Required mock update in `intlMocks.ts`:
```tsx
// frontend/src/utils/testing/intlMocks.ts
export const mockMessages = {
  Roadmap: {
    sections: {
      // ...
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

The reviewer (doug-s-nava) caught that the test was failing with `TypeError: Cannot read properties of undefined (reading 'contentItems')` because the mock was missing the `timeline` entry.

**Rationale:** `next-intl` does not provide a built-in way to iterate over translation keys. Using `useMessages()` to access the raw structure is the supported workaround for content-heavy list/timeline sections.

**Open Questions:**
- Is there a cleaner pattern for this? The `as unknown as IntlMessages` cast is a code smell.
- Should there be a helper function that encapsulates the `useMessages()` iteration pattern?

---

## Rule 7: Test Mocking Convention for i18n

**Pattern Name:** Translation Test Mock Pattern

**Rule Statement:** ALWAYS mock `next-intl` in tests using `useTranslationsMock()` from `src/utils/testing/intlMocks.ts`. Tests MUST assert on translation keys (not actual translated text). For server components, mock `next-intl/server` with `getTranslations: () => useTranslationsMock()`. ALWAYS import `useTranslations` from `next-intl`, NEVER from `use-intl`.

**Confidence:** High

**Frequency:** ~60+ test files across all PRs follow this pattern.

**Code Examples:**

PR #7377 -- Standard client-side mock pattern:
```tsx
jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

PR #8549 -- Server-side mock pattern:
```tsx
jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(() => useTranslationsMock()),
}));
```

PR #7377 -- Test asserting on key names (not translated text):
```tsx
it("shows the appropriate error message", () => {
  const component = InviteLegacyUsersErrorPage({
    organizationId: "org-123",
  });
  render(component);
  expect(screen.getByText("dataLoadingError")).toBeVisible();
});
```

```tsx
it("has a table with two columns", () => {
  render(component);
  expect(screen.getAllByText("tableHeadings.email")).toHaveLength(3);
  expect(screen.getAllByText("tableHeadings.name")).toHaveLength(3);
});
```

**Rationale:** Asserting on keys rather than actual text decouples tests from content changes. A reviewer on PR #7877 stated: "I prefer not to have unit tests rely on the actual translated text, if we assert on the key instead that allows us to update the actual text without breaking tests."

**Open Questions:**
- None; this is well-established and universally applied.

---

## Rule 8: Page Title Format Convention

**Pattern Name:** Page Title Format

**Rule Statement:** ALWAYS format page titles as `<Page Name> | Simpler.Grants.gov` and store them under a `pageTitle` key in the page's top-level namespace. ALWAYS set the page title via `generateMetadata` using `getTranslations`.

**Confidence:** High

**Frequency:** ~15+ pages follow this pattern consistently.

**Code Examples:**

PR #4424 -- Events page title:
```ts
Events: {
  pageTitle: "Events | Simpler.Grants.gov",
```

PR #7392 -- Settings page title (renamed from UserAccount):
```ts
Settings: {
  pageTitle: "Settings | Simpler.Grants.gov",
```

PR #7392 -- Using pageTitle in generateMetadata:
```tsx
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

**Rationale:** Follows federal website standards for consistent browser tab titles. Reviewer (doug-s-nava) in PR #4424 confirmed the pattern references federal design conventions.

**Open Questions:**
- PR #8549 used `defaultValue` in the `t()` call for page titles (`t("AwardRecommendation.pageTitle", { defaultValue: "Award Recommendation" })`). A reviewer flagged this as non-standard since no other pages use `defaultValue`. Should `defaultValue` usage be prohibited?

---

## Rule 9: English-Only Single Locale

**Pattern Name:** English-Only Locale

**Rule Statement:** ALWAYS add translations only to `messages/en/index.ts`. The codebase supports locale routing infrastructure (`[locale]` path segments, `setRequestLocale(locale)`) but only English is implemented. Do NOT add non-English translation files unless the project formally adopts multi-language support.

**Confidence:** High

**Frequency:** 145 out of 145 PRs only modify `messages/en/index.ts`. No non-English file exists.

**Code Examples:**

PR #4424 -- Server page using locale infrastructure:
```tsx
export default function Events({ params }: LocalizedPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);
  // ... renders in English only
}
```

PR #4318 -- Path matching accounts for locale prefixes:
```ts
// note that the regexp is taking into account /en & /es localized pathnames
export const isCurrentPath = (href: string, currentPath: string): boolean =>
  !!currentPath.match(new RegExp(`^(?:/e[ns])?${href.split("?")[0]}`));
```

**Rationale:** The infrastructure supports future internationalization, but the project currently only serves English. Adding non-English files without a full i18n strategy would create maintenance burden.

**Open Questions:**
- When (if ever) will multi-language support be activated?
- Should the `/es/` route be removed or redirected to prevent serving untranslated content?

---

## Rule 10: Translation Key Restructuring During Feature Evolution

**Pattern Name:** Key Restructuring Convention

**Rule Statement:** When renaming or restructuring a page/feature, ALWAYS update the corresponding top-level translation namespace and all references to it in one atomic PR. ALWAYS move from flat structures to nested, component-aligned hierarchies when refactoring.

**Confidence:** Medium-High

**Frequency:** ~10-15 PRs involve key reorganization.

**Code Examples:**

PR #4318 -- Restructuring Header nav links from flat to nested:
```ts
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

PR #7392 -- Renaming `UserAccount` to `Settings`:
```ts
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

Corresponding component update in the same PR:
```tsx
// Before:
const t = useTranslations("UserAccount");
// After:
const t = useTranslations("Settings");
```

**Rationale:** Atomic restructuring prevents broken references and ensures all components, tests, and metadata stay in sync during renames.

**Open Questions:**
- Should there be a migration script or documentation for large-scale key renames?

---

## Rule 11: Content Directly in Translation Values

**Pattern Name:** Content-in-Translations

**Rule Statement:** ALWAYS store long-form content (paragraphs, descriptions, multi-sentence text) directly as translation string values. NEVER use separate content files, Markdown files, or a CMS for page content.

**Confidence:** High

**Frequency:** ~20+ PRs add substantial content blocks directly in the translation file.

**Code Examples:**

PR #4424 -- Multi-paragraph event descriptions:
```ts
codingChallenge: {
  title: "Collaborative Coding Challenge",
  descriptionP1:
    "The Simpler.Grants.gov Collaborative Coding Challenge is an entirely virtual interactive event attended by members of the public, government, stakeholders, and our internal development team.",
  descriptionP2:
    "Small teams of external developers, designers, and researchers pitch a proposal to solve a problem with the strongest of them added to the product roadmap.",
  link: "Read about the Spring 2025 Coding Challenge",
},
```

PR #5707 -- Rich content with inline markup in translation values:
```ts
{
  date: "Summer 2025",
  title: "Simpler search, by default",
  content:
    "<p>Our easier-to-use search experience will become the default way to discover funding opportunities on Grants.gov.</p><p><link-search>Try the new search now</link-search>.</p>",
},
```

**Rationale:** Keeping content in the translation file ensures it goes through the same i18n pipeline and is available for future localization without architectural changes.

**Open Questions:**
- For very long content pages (roadmap, vision), should there be a maximum recommended length per translation value?
- Does content-in-translations make non-developer content updates harder?

---

## Rule 12: Translation Mock Structure Must Mirror Real Structure

**Pattern Name:** Mock Structure Parity

**Rule Statement:** ALWAYS update `src/utils/testing/intlMocks.ts` with matching structure when adding translation keys used by components that call `useMessages()`. Failure to do so will cause `TypeError: Cannot read properties of undefined` in tests.

**Confidence:** High

**Frequency:** ~10+ PRs modify `intlMocks.ts`. Explicitly caught in PR #5707 review.

**Code Examples:**

PR #5707 -- Adding timeline mock data after reviewer caught the error:
```tsx
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

Reviewer comment (PR #5707, andycochran):
> Not sure what I'm doing wrong here. But it's causing tests to fail. Getting this error:
> `TypeError: Cannot read properties of undefined (reading 'contentItems')`

Resolved by doug-s-nava pointing to the mock file:
> you need to add a "timeline" item in the mocked useMessages response here

**Rationale:** Components using `useMessages()` access the raw messages object directly, bypassing the mock function. The mock object must contain the expected structure or tests will fail with runtime errors.

**Open Questions:**
- Should there be a test helper or type guard that validates mock structure against real messages?

---

## Anti-Pattern Rules

### Anti-Pattern A: Numbered Key Suffixes

**Rule Statement:** NEVER use numbered suffixes (`title_1`, `paragraph_2`, `link_text_1`) for translation keys. ALWAYS use semantically meaningful names that describe the content.

**Confidence:** Medium-High

**Frequency:** ~5 PRs (primarily early PRs like #4433).

**Code Example (what NOT to do):**

PR #4433 -- Vision page with numbered keys:
```ts
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

**Rationale:** Numbered keys obscure the purpose of the content and make the translation file harder to maintain. Later PRs adopted more descriptive names (e.g., `descriptionP1`, `watchLink`, `inviteYourTeam`).

---

### Anti-Pattern B: Importing from use-intl Instead of next-intl

**Rule Statement:** ALWAYS import `useTranslations` from `next-intl`. NEVER import from `use-intl` directly, even though `next-intl` re-exports from it.

**Confidence:** Medium

**Frequency:** Rare (1-2 instances in PR #5756).

**Rationale:** Using `next-intl` as the canonical import source ensures consistency across the codebase and avoids confusion about which package provides the hook.

---

### Anti-Pattern C: Using defaultValue in Translation Calls

**Rule Statement:** NEVER pass `defaultValue` to `t()` calls. ALWAYS ensure the corresponding key exists in `messages/en/index.ts`.

**Confidence:** Medium

**Frequency:** 1 observed instance (PR #8549).

**Code Example (what NOT to do):**

PR #8549 -- Using defaultValue:
```tsx
{t("pageTitle", { defaultValue: "Award Recommendation" })}
{t("description", { defaultValue: "Award Recommendation flow coming soon." })}
```

Reviewer (doug-s-nava) flagged: "I don't see any other pages that are providing a 'defaultValue' here. Do we need to do that?"

**Rationale:** `defaultValue` bypasses the centralized translation file, creating a shadow copy of the text that can drift out of sync. All text should live in the translation file.

---

## Summary of Rules

| # | Rule Name | Confidence | Key Imperative |
|---|-----------|-----------|----------------|
| 1 | Single Translation File | High | ALWAYS use `messages/en/index.ts` |
| 2 | Namespaced Translation Hook | High | ALWAYS scope `useTranslations()` narrowly |
| 3 | camelCase Key Naming | High | ALWAYS use camelCase (except API enum matches) |
| 4 | Hierarchical Key Nesting | High | ALWAYS PascalCase top-level, camelCase nested |
| 5 | Rich Text via t.rich() | High | ALWAYS use `t.rich()` for inline HTML |
| 6 | Dynamic Key Iteration | Medium-High | Use `useMessages()` + update mocks |
| 7 | Test Mock Convention | High | ALWAYS assert on keys, not translated text |
| 8 | Page Title Format | High | ALWAYS `<Name> \| Simpler.Grants.gov` |
| 9 | English-Only Locale | High | ALWAYS add to `en/index.ts` only |
| 10 | Atomic Key Restructuring | Medium-High | ALWAYS rename keys + references in one PR |
| 11 | Content in Translations | High | ALWAYS store content in translation values |
| 12 | Mock Structure Parity | High | ALWAYS keep mocks in sync with real structure |
| A | No Numbered Suffixes | Medium-High | NEVER use `title_1`, `paragraph_2`, etc. |
| B | Import from next-intl | Medium | NEVER import from `use-intl` |
| C | No defaultValue Usage | Medium | NEVER use `defaultValue` in `t()` calls |
