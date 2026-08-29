# IS ProTrack Agent Guide

## Project Context

IS ProTrack is an internal procurement tracking system for the Faculty of
Interdisciplinary Studies, Khon Kaen University (KKU). The primary UI language
is Thai. Preserve the established visual language: orange (`#e87722`), dark
stone (`#292724`), and warm off-white (`#f5f4f1`).

## Technology Rules

- Use Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, HeroUI v3,
  Prisma 7, MariaDB, and Better Auth.
- Prefer Server Components. Add `"use client"` only for browser APIs, local
  interaction state, hooks, or HeroUI components that require client behavior.
- Use the `@/*` TypeScript path alias for application imports.
- Do not introduce Pages Router files, a second UI framework, or a duplicate
  database client.
- Keep changes minimal. Reuse existing components, server actions, types, and
  route conventions before creating new abstractions.

## Next.js Conventions

- Place routes under `src/app`. Route groups such as `(dashboard)` do not
  appear in URLs.
- Use Server Actions for authenticated mutations whenever a route handler is
  not needed by an external caller. Validate all `FormData` and authorize the
  current session inside the action.
- Use route handlers under `src/app/api` for API/webhook/file-upload use cases.
- Keep secrets and database access server-only. Never expose server
  environment variables to client components.
- Use `next/link` for internal navigation and `next/navigation` APIs for
  routing.
- Authentication and role enforcement must remain server-side. The proxy is a
  convenience layer, not a replacement for authorization in actions/routes.
- Run `revalidatePath` after a successful write when the affected route renders
  server data.

## HeroUI v3 Is the Default UI System

Use HeroUI v3 components as much as possible. Do not recreate a HeroUI control
with raw HTML when a suitable HeroUI component exists.

### Preferred Components

- Forms: `Form`, `TextField`, `Label`, `Input`, `TextArea`, `Select`,
  `Checkbox`, `RadioGroup`, `Switch`, `Button`
- Content: `Card`, `Table`, `Chip`, `Alert`, `ProgressBar`, `Skeleton`
- Feedback and overlays: `Toast`, `Modal`, `Popover`, `Tooltip`
- Navigation: `Tabs`, `Breadcrumbs`, `Pagination`

### HeroUI v3 API Rules

- HeroUI v3 uses composable namespaces. Use patterns such as `Card.Header`,
  `Card.Content`, `Table.Header`, `Table.Column`, `Table.Body`, `Table.Row`,
  `Table.Cell`, `Alert.Title`, and `Alert.Description`.
- Use `ToastProvider` from `src/components/providers.tsx` and show a toast for
  successful or failed user-initiated mutations.
- Use a visible loading state for every async action: button pending state,
  `ProgressBar`, `Skeleton`, or `Spinner` where appropriate.
- Use `Alert` for validation failures, permission errors, AI uncertainty, or
  data that requires human verification.
- Prefer HeroUI variants and semantic colors over custom CSS. Valid chip colors
  are `default`, `success`, `danger`, `warning`, and `accent`.
- Preserve accessible names for icon-only buttons using `aria-label`, and use
  `Tooltip` to describe unfamiliar actions.

### Design Requirements

- Keep dashboard navigation inside `DashboardShell`; do not create per-page
  sidebars or navbars.
- Design for mobile first. The sidebar must work as a slide-in navigation on
  small screens and fixed navigation on large screens.
- Use Thai labels and concise supporting text for operational screens.
- Show empty, loading, error, and success states for data-driven UI.
- Use icons from `react-icons/fi` only when they improve scanability; do not
  use icon-only labels for critical workflow actions.

## Prisma 7 and MariaDB

- The schema is `prisma/schema.prisma`; CLI configuration is in
  `prisma.config.ts`.
- The Prisma 7 generated client is intentionally output to
  `src/generated/prisma` and is gitignored. Never edit generated files.
- Import the client only through `src/lib/prisma.ts`:

  ```ts
  import { prisma } from "@/lib/prisma";
  ```

- Import generated Prisma types/enums from their explicit generated modules:

  ```ts
  import type { ProcurementStatus } from "@/generated/prisma/enums";
  import { PrismaClient } from "@/generated/prisma/client";
  ```

- Prisma Client must use the existing `PrismaMariaDb` adapter. Do not create a
  new `PrismaClient` in route handlers, server actions, or components.
- Use Prisma queries only on the server. Never import `@/lib/prisma` into a
  client component.
- Use transactions for multi-record state changes that must succeed or fail
  together. Add relevant `AuditLog` entries for procurement actions and AI
  decisions.
- After modifying `schema.prisma`, run `npm run db:generate` before typecheck
  or build. Do not run `db push`, destructive migration commands, or delete
  data unless explicitly requested.

## Thai Date and Buddhist Era Policy

Database storage and UI display are different responsibilities.

- Store dates in Prisma `DateTime` fields as normal UTC/Gregorian (`Date` / ISO
  8601, ค.ศ.). Never add 543 years before saving to the database.
- Send dates from forms as ISO-compatible Gregorian values, for example
  `2026-08-29` or `2026-08-29T00:00:00.000Z`.
- Display every user-facing date in Thai locale and Buddhist Era (พ.ศ.) using
  `Intl.DateTimeFormat("th-TH-u-ca-buddhist", ...)`.
- Do not manually calculate `year + 543`; use `Intl` to avoid locale, calendar,
  and timezone mistakes.
- Use a single shared formatter when adding date UI. The desired display is
  `วัน เดือน ปี พ.ศ.`, for example `29 สิงหาคม 2569`.

  ```ts
  export function formatThaiDate(value: Date | string) {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Bangkok",
    }).format(new Date(value));
  }
  ```

- For date-time displays, add `hour: "2-digit"` and `minute: "2-digit"` while
  retaining `timeZone: "Asia/Bangkok"`.
- Native HTML date inputs always use Gregorian ISO values. Label them in Thai,
  keep the submitted value as ค.ศ., and display the Thai/B.E. formatted value
  next to the input where users need confirmation.

## Security and Data Integrity

- Require a valid Better Auth session for protected actions and API routes.
- Check role authorization in each sensitive server operation, not only in UI
  visibility rules.
- Treat AI/OCR output as untrusted draft data. Display warnings and require
  user review before it changes procurement records.
- Never log credentials, tokens, raw cookies, or sensitive uploaded document
  contents.
- Validate files by MIME type, extension, and size before processing them.

## Required Verification

Run the relevant checks after code changes:

```bash
npm run db:generate  # Required after schema changes
npx prisma validate  # Required after schema/config changes
npx tsc --noEmit
npm run lint
npm run build
```

The build script already generates the Prisma client before running `next build`.
Use real environment variables for runtime testing. Dummy credentials are only
appropriate for compile-time build verification.
