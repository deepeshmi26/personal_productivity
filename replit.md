# Workspace

## Overview

A learning-capture mobile app ("Learn5") that nudges the user every few minutes to write down what they just learned, plus a journal of past entries and a settings screen to tune the reminder cadence.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile app**: Expo (SDK 54) + Expo Router + React Native, with `expo-notifications` for local repeating reminders
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec) — generates React Query hooks consumed by the Expo app
- **Build**: esbuild (CJS bundle)

## Artifacts

- `artifacts/api-server` — Express API at `/api`
  - `/api/responses` GET / POST — list and create learning responses
  - `/api/responses/stats` GET — daily counts and totals
  - `/api/settings` GET / PUT — reminder interval (minutes)
- `artifacts/focus-app` — Expo mobile app (Learn5)
  - Tabs: Capture (home prompt), Journal (history), Settings (interval, quiet hours, notification status)
  - `contexts/NotificationContext.tsx` schedules a batch of date-triggered local notifications respecting quiet hours, listens for notification tap/dismiss to reset the timer, and registers an `expo-background-fetch` task that tops up the schedule when iOS/Android wakes the app
  - `lib/scheduling.ts` — pure helpers for "next reminder times that skip quiet hours"
  - `eas.json` — EAS Build profiles (`preview` produces an installable Android APK)
  - All `expo-notifications`/`expo-background-fetch`/`expo-task-manager` calls are lazy-loaded and crash-safe so the app still runs in Expo Go (with an in-app countdown only)
- `artifacts/mockup-sandbox` — design sandbox (unchanged scaffold)

## Database tables

- `responses` — id, text, skipped, created_at
- `settings` — singleton row holding `reminder_interval_minutes`, `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
