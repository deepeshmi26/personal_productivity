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
  - Tabs: Capture (home prompt), Journal (history), Settings (interval + notification status)
  - `contexts/NotificationContext.tsx` schedules a repeating local notification every N minutes and reschedules when the app comes to the foreground (auto-detect device usage)
- `artifacts/mockup-sandbox` — design sandbox (unchanged scaffold)

## Database tables

- `responses` — id, text, skipped, created_at
- `settings` — singleton row holding `reminder_interval_minutes`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
