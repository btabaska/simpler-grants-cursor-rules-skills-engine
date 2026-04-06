# Frontend App Router Pages Rules

## Server Components by Default

ALWAYS use server components at the page level. NEVER add `"use client"` to page.tsx or layout.tsx unless the page itself requires interactivity.

## Metadata Generation

ALWAYS use async `generateMetadata()` for page-specific metadata. ALWAYS integrate with `next-intl` for translated titles.

Example from codebase:
```tsx
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: t("opportunities.title"),
    description: t("opportunities.description"),
  };
}
```

## Async Params

ALWAYS type page params as `Promise<{...}>` and await them.

Example from codebase:
```tsx
type Props = {
  params: Promise<{ id: string; locale: string }>;
};

export default async function OpportunityPage({ params }: Props) {
  const { id, locale } = await params;
  ...
}
```

## ISR and Dynamic Classification

ALWAYS set `export const revalidate = 600` for ISR pages. ALWAYS set `export const dynamic = "force-dynamic"` for user-specific pages. NEVER leave data-fetching pages without a caching strategy.

## Layout Hierarchy

ALWAYS define shared metadata at the layout level. Use `generateMetadata()` in page.tsx for page-specific overrides.

## Locale Routing

ALWAYS use `[locale]/(base)/` for localized pages. ALWAYS use `[locale]/(print)/` for print layouts. NEVER create routes outside `[locale]`.

## API Routes

ALWAYS use `respondWithTraceAndLogs()` middleware wrapper for API routes.

## Error and Loading Boundaries

ALWAYS provide `error.tsx` for routes that fetch data. ALWAYS provide `loading.tsx` for routes with significant loading. NEVER show raw error messages.

## Page Structure

NEVER place business logic in page.tsx. ALWAYS delegate to components and services. Pages should be thin orchestrators.

## Not Found Handling

ALWAYS use `[...not-found]/` catch-all for 404 pages. ALWAYS provide localized 404 content.
