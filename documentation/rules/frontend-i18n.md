# Frontend i18n -- Conventions & Rules

> **Status:** Draft -- pending tech lead validation. Items marked with a pending
> marker are awaiting team confirmation. All other patterns reflect
> high-confidence conventions observed consistently across the codebase.

## Overview

The simpler-grants-gov frontend uses `next-intl` for all internationalization, with a single centralized translation file at `frontend/src/i18n/messages/en/index.ts`. Despite only English being implemented, the full i18n infrastructure is maintained in preparation for future multi-language support. Every user-facing string must go through the translation pipeline -- hardcoded strings are rejected in code review.

Translation keys follow a strict naming convention: PascalCase for top-level namespace keys (matching page or feature names), camelCase for all nested keys below that. This was enforced project-wide via PR #5143, which renamed 120+ keys across 59 files. The sole exception is keys that must match API enum values (e.g., `application_created` under activity history).

Testing follows a key-assertion pattern: tests mock `next-intl` using shared utilities from `intlMocks.ts` and assert on translation key names rather than actual translated text. This decouples tests from content changes. Components that use `useMessages()` for dynamic key iteration require their mock structure to mirror the real translation file structure.

## Rules

### Translation File Organization

#### Rule: Single Centralized Translation File

**Confidence:** High
**Observed in:** ~100+ of 145 PRs modify this single file | PR refs: #4424, #7362, #9274

ALWAYS add all user-facing text to the single centralized file `frontend/src/i18n/messages/en/index.ts`. NEVER create separate translation files per page or feature.

**DO:**
```ts
// From PR #4424 -- Adding an entire Events page namespace to the single file
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

**DON'T:**
```
# Anti-pattern -- splitting translations into per-page files
frontend/src/i18n/messages/en/events.ts
frontend/src/i18n/messages/en/search.ts
frontend/src/i18n/messages/en/settings.ts
```

> **Rationale:** Centralizing translations in one file makes it easy to audit all user-facing text and ensures a single source of truth. The team has acknowledged the file is a "hodgepodge" (reviewer comment, PR #4424), but no movement toward splitting has occurred across 145 PRs.

---

#### Rule: English-Only Single Locale

**Confidence:** High
**Observed in:** 145 out of 145 PRs only modify `messages/en/index.ts` | PR refs: #4424

ALWAYS add translations only to `messages/en/index.ts`. The codebase supports locale routing infrastructure (`[locale]` path segments, `setRequestLocale(locale)`) but only English is implemented. Do NOT add non-English translation files unless the project formally adopts multi-language support.

**DO:**
```tsx
// From PR #4424 -- Server page using locale infrastructure
export default function Events({ params }: LocalizedPageProps) {
  const { locale } = use(params);
  setRequestLocale(locale);
  // ... renders in English only
}
```

**DON'T:**
```
# Anti-pattern -- adding untranslated locale files
frontend/src/i18n/messages/es/index.ts  # no translation strategy exists
```

> **Rationale:** The infrastructure supports future internationalization, but the project currently only serves English. Adding non-English files without a full i18n strategy would create maintenance burden.

---

#### Rule: Content Directly in Translation Values

**Confidence:** High
**Observed in:** ~20+ PRs add substantial content blocks | PR refs: #4424, #5707

ALWAYS store long-form content (paragraphs, descriptions, multi-sentence text) directly as translation string values. NEVER use separate content files, Markdown files, or a CMS for page content.

**DO:**
```ts
// From PR #4424 -- Multi-paragraph event descriptions
codingChallenge: {
  title: "Collaborative Coding Challenge",
  descriptionP1:
    "The Simpler.Grants.gov Collaborative Coding Challenge is an entirely virtual interactive event attended by members of the public, government, stakeholders, and our internal development team.",
  descriptionP2:
    "Small teams of external developers, designers, and researchers pitch a proposal to solve a problem with the strongest of them added to the product roadmap.",
  link: "Read about the Spring 2025 Coding Challenge",
},
```

**DON'T:**
```
# Anti-pattern -- separate content files outside the i18n system
frontend/src/content/events.md
frontend/src/content/vision.md
```

> **Rationale:** Keeping content in the translation file ensures it goes through the same i18n pipeline and is available for future localization without architectural changes.

---

### Key Naming Conventions

#### Rule: camelCase Translation Keys

**Confidence:** High
**Observed in:** Enforced project-wide via PR #5143 (59 files changed, 120+ key renames) | PR refs: #5143, #4424

ALWAYS use camelCase for translation key names. NEVER use snake_case for new translation keys. The sole exception is keys that must match API enum values (e.g., `application_created`, `attachment_added` under activity history).

**DO:**
```tsx
// From PR #5143 -- The enforcement PR itself
// After:
title: t("ErrorPages.pageNotFound.title"),
description: t("Index.metaDescription"),
const t = useTranslations("SubscriptionConfirmation");
```

**DON'T:**
```tsx
// Anti-pattern -- snake_case keys (fixed in PR #5143)
// Before:
title: t("ErrorPages.page_not_found.title"),
description: t("Index.meta_description"),
const t = useTranslations("Subscription_confirmation");
```

> **Rationale:** camelCase is the standard JavaScript/TypeScript naming convention. PR #4424 reviewer (doug-s-nava) flagged the inconsistency and advocated for camelCase. PR #5143 enforced it project-wide.

---

#### Rule: PascalCase Top-Level Namespace Keys with Nested camelCase

**Confidence:** High
**Observed in:** Universal across all 145 PRs | PR refs: #4318, #7392, #5714

ALWAYS use PascalCase for top-level namespace keys (matching page or feature names). ALWAYS use camelCase for nested keys below the top level. ALWAYS organize keys in a hierarchy that mirrors the component/feature structure.

**DO:**
```ts
// From PR #4318 -- Nested structure with PascalCase top-level
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

**DON'T:**
```ts
// Anti-pattern -- flat snake_case structure (refactored in PR #4318)
Header: {
  nav_link_home: "Home",
  nav_link_roadmap: "Roadmap",
  nav_link_search: "Search",
  nav_link_login: "Sign in",
}
```

> **Rationale:** This convention creates a discoverable mapping between the translation file structure and the component tree, making it easy to find and update translations for specific UI sections.

---

#### Rule: Page Title Format Convention

**Confidence:** High
**Observed in:** ~15+ pages follow this pattern consistently | PR refs: #4424, #7392

ALWAYS format page titles as `<Page Name> | Simpler.Grants.gov` and store them under a `pageTitle` key in the page's top-level namespace. ALWAYS set the page title via `generateMetadata` using `getTranslations`.

**DO:**
```ts
// From PR #7392 -- Settings page title
Settings: {
  pageTitle: "Settings | Simpler.Grants.gov",
```

```tsx
// From PR #7392 -- Using pageTitle in generateMetadata
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

**DON'T:**
```tsx
// Anti-pattern -- using defaultValue (flagged in PR #8549)
{t("pageTitle", { defaultValue: "Award Recommendation" })}
```

> **Rationale:** Follows federal website standards for consistent browser tab titles. Reviewer (doug-s-nava) in PR #4424 confirmed the pattern references federal design conventions.

---

### Translation Usage Patterns

#### Rule: Namespaced Translation Hook with Narrow Scoping

**Confidence:** High
**Observed in:** Virtually every component that renders user-facing text (~80+ PRs) | PR refs: #4424, #7392, #7362

ALWAYS access translations via `useTranslations("Namespace.path")` from `next-intl` in client components. ALWAYS use `getTranslations()` or `getTranslations("Namespace")` for async server components. ALWAYS scope the hook as narrowly as practical to avoid repeating key prefixes in `t()` calls.

**DO:**
```tsx
// From PR #4424 -- Page-level scoping in client component
export default function EventsCoding() {
  const t = useTranslations("Events.codingChallenge");
  return (
    <h2>{t("title")}</h2>
    <p>{t("descriptionP1")}</p>
  );
}
```

```tsx
// From PR #7392 -- Server-side getTranslations
async function Settings() {
  const t = await getTranslations("Settings");
  return (
    <h1>{t("title")}</h1>
  );
}
```

```tsx
// From PR #7362 -- Deep scoping for a sub-section
const activityTranslations = useTranslations(
  "Application.historyTable.activities",
);
activityTranslations(history.application_audit_event)
```

**DON'T:**
```tsx
// Anti-pattern -- broad scoping with repeated prefixes
const t = useTranslations("Application");
t("historyTable.activities.application_created")
t("historyTable.activities.attachment_added")
t("historyTable.applicationHistory")
// could be narrowed to useTranslations("Application.historyTable")
```

> **Rationale:** Narrow scoping reduces key repetition within `t()` calls, making component code cleaner and more readable. A reviewer on PR #5714 explicitly advised narrowing the hook scope to reduce prefix repetition.

---

#### Rule: Rich Text via `t.rich()`

**Confidence:** High
**Observed in:** ~15-20 PRs with increasing adoption | PR refs: #5715, #5707, #7392

ALWAYS use `t.rich()` (not string concatenation or JSX interpolation) when a translation string contains inline HTML elements such as links, emphasis, or paragraphs. Translation values MUST use XML-like tags that map to React component renderers in the `t.rich()` call.

**DO:**
```ts
// From PR #5715 -- in messages/en/index.ts
BookmarkBanner: {
  technicalSupportMessage:
    "For technical support or to give feedback, email <mailToGrants>simpler@grants.gov</mailToGrants>.",
},
```
```tsx
// From PR #5715 -- in component
{t.rich("technicalSupportMessage", {
  mailToGrants: (content) => (
    <a href="mailto:simpler@grants.gov">{content}</a>
  ),
})}
```

```tsx
// From PR #7392 -- login.gov link in Settings page
{t.rich("contactInfoBody", {
  link: (chunk) => (
    <a href="https://login.gov" target="_blank">
      {chunk}
    </a>
  ),
})}
```

**DON'T:**
```tsx
// Anti-pattern -- splitting sentences across multiple keys or concatenating JSX
<p>{t("supportPrefix")} <a href="mailto:simpler@grants.gov">{t("supportEmail")}</a> {t("supportSuffix")}</p>
```

> **Rationale:** `t.rich()` keeps the full translatable sentence together (important for future multi-language support) while allowing React elements to be embedded safely. It avoids splitting sentences across multiple keys.

---

#### Rule: `useMessages()` for Dynamic Key Iteration

**Confidence:** Medium-High (Pending)
**Observed in:** ~5-8 PRs (primarily content-heavy sections) | PR refs: #5707

When a component needs to iterate over a structured list of translated items, use `useMessages()` to access the raw messages object and iterate over its keys, using `t()` for each individual value. ALWAYS update the test mock file (`intlMocks.ts`) to mirror the structure when adding new `useMessages()` usage.

**DO:**
```tsx
// From PR #5707 -- RoadmapTimeline iterating over content items
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

**DON'T:**
```tsx
// Anti-pattern -- hardcoding the number of items
<h3>{t("contentItems.0.date")}</h3>
<h3>{t("contentItems.1.date")}</h3>
<h3>{t("contentItems.2.date")}</h3>
// not extensible without code changes
```

> **Rationale:** `next-intl` does not provide a built-in way to iterate over translation keys. Using `useMessages()` to access the raw structure is the supported workaround for content-heavy list/timeline sections.

---

#### Rule: Translation Key Restructuring During Feature Evolution

**Confidence:** Medium-High (Pending)
**Observed in:** ~10-15 PRs involve key reorganization | PR refs: #4318, #7392

When renaming or restructuring a page/feature, ALWAYS update the corresponding top-level translation namespace and all references to it in one atomic PR. ALWAYS move from flat structures to nested, component-aligned hierarchies when refactoring.

**DO:**
```ts
// From PR #7392 -- Renaming UserAccount to Settings (all in one PR)
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

```tsx
// Corresponding component update in the same PR:
// Before:
const t = useTranslations("UserAccount");
// After:
const t = useTranslations("Settings");
```

**DON'T:**
```
# Anti-pattern -- renaming the namespace in one PR and updating references in another
# This leaves broken references between merges
```

> **Rationale:** Atomic restructuring prevents broken references and ensures all components, tests, and metadata stay in sync during renames.

---

### Testing i18n

#### Rule: Translation Test Mock Pattern

**Confidence:** High
**Observed in:** ~60+ test files across all PRs | PR refs: #7377, #8549

ALWAYS mock `next-intl` in tests using `useTranslationsMock()` from `src/utils/testing/intlMocks.ts`. Tests MUST assert on translation keys (not actual translated text). For server components, mock `next-intl/server` with `getTranslations: () => useTranslationsMock()`. ALWAYS import `useTranslations` from `next-intl`, NEVER from `use-intl`. See `frontend-tests.md` for the complete testing convention set.

**DO:**
```tsx
// From PR #7377 -- Standard client-side mock pattern
jest.mock("next-intl", () => ({
  useTranslations: () => useTranslationsMock(),
}));
```

```tsx
// From PR #8549 -- Server-side mock pattern
jest.mock("next-intl/server", () => ({
  getTranslations: jest.fn(() => useTranslationsMock()),
}));
```

```tsx
// From PR #7377 -- Test asserting on key names (not translated text)
it("shows the appropriate error message", () => {
  const component = InviteLegacyUsersErrorPage({
    organizationId: "org-123",
  });
  render(component);
  expect(screen.getByText("dataLoadingError")).toBeVisible();
});
```

**DON'T:**
```tsx
// Anti-pattern -- custom inline translation mock (replaced in PR #7346)
type TranslationFn = (key: string) => string;
const getTranslationsMock = jest.fn<Promise<TranslationFn>, [string]>(
  (_namespace: string) => Promise.resolve((key: string) => key),
);
```

> **Rationale:** Asserting on keys rather than actual text decouples tests from content changes. A reviewer stated: "I prefer not to have unit tests rely on the actual translated text, if we assert on the key instead that allows us to update the actual text without breaking tests."

---

#### Rule: Mock Structure Must Mirror Real Structure

**Confidence:** High
**Observed in:** ~10+ PRs modify `intlMocks.ts`; explicitly caught in PR #5707 | PR refs: #5707

ALWAYS update `src/utils/testing/intlMocks.ts` with matching structure when adding translation keys used by components that call `useMessages()`. Failure to do so will cause `TypeError: Cannot read properties of undefined` in tests.

**DO:**
```tsx
// From PR #5707 -- Adding timeline mock data after reviewer caught the error
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

**DON'T:**
```tsx
// Anti-pattern -- forgetting to update mock structure
// Results in: TypeError: Cannot read properties of undefined (reading 'contentItems')
export const mockMessages = {
  Roadmap: {
    sections: {
      // missing 'timeline' entry!
    },
  },
```

> **Rationale:** Components using `useMessages()` access the raw messages object directly, bypassing the mock function. The mock object must contain the expected structure or tests will fail with runtime errors.

---

## Anti-Patterns

### Anti-Pattern: Numbered Key Suffixes

NEVER use numbered suffixes (`title_1`, `paragraph_2`, `link_text_1`) for translation keys. ALWAYS use semantically meaningful names that describe the content.

```ts
// From PR #4433 -- what NOT to do (Vision page with numbered keys)
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

> Numbered keys obscure the purpose of the content and make the translation file harder to maintain. Later PRs adopted more descriptive names (e.g., `descriptionP1`, `watchLink`, `inviteYourTeam`).

### Anti-Pattern: Importing from `use-intl` Instead of `next-intl`

ALWAYS import `useTranslations` from `next-intl`. NEVER import from `use-intl` directly, even though `next-intl` re-exports from it.

### Anti-Pattern: Using `defaultValue` in Translation Calls

NEVER pass `defaultValue` to `t()` calls. ALWAYS ensure the corresponding key exists in `messages/en/index.ts`.

```tsx
// From PR #8549 -- what NOT to do
{t("pageTitle", { defaultValue: "Award Recommendation" })}
{t("description", { defaultValue: "Award Recommendation flow coming soon." })}
```

Reviewer (doug-s-nava) flagged: "I don't see any other pages that are providing a 'defaultValue' here. Do we need to do that?"

> `defaultValue` bypasses the centralized translation file, creating a shadow copy of the text that can drift out of sync.

## Known Inconsistencies

### Filter Options: i18n vs. Constants

PR #6252 moved sort option labels from the i18n file to `src/constants/searchFilterOptions.ts` as plain objects. This creates a hybrid approach where some user-facing labels live in the translation file and others live in constants. The boundary between what stays in i18n vs. what goes to constants has not been formally defined.

### Legacy snake_case Keys

While PR #5143 enforced camelCase project-wide, PR #7713 noted "(nit): We are using snake case for the overwhelming majority of this file" -- suggesting some legacy areas may still need cleanup.

### `useMessages()` Type Cast

The `as unknown as IntlMessages` cast used with `useMessages()` is acknowledged as a code smell. Whether a helper function should encapsulate this pattern is an open question.

## Related Documents
- **Cursor Rules:** `.cursor/rules/frontend-i18n.md`
- **Related Domains:** `frontend-components.md` (mandatory i18n for user-facing strings), `frontend-tests.md` (i18n mock patterns), `frontend-hooks.md` (hook usage patterns)
