# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"Learn5" — a learning-capture mobile app that nudges the user every few minutes to write down what they just learned, plus a journal of past entries and a settings screen to tune the reminder cadence.

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9, pnpm@10.26.1 (enforced by `preinstall`)
- Mobile: Expo SDK 54 + Expo Router + React Native, `expo-notifications` for local repeating reminders
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval generates React Query hooks from an OpenAPI spec
- API bundle: esbuild (CJS)

## Workspace layout

- `artifacts/api-server` — Express API at `/api` (`/responses`, `/responses/stats`, `/settings`)
- `artifacts/focus-app` — Expo mobile app (tabs: Capture, Journal, Settings)
- `artifacts/mockup-sandbox` — design sandbox scaffold
- `lib/db` — Drizzle schema + client
- `lib/api-spec` — OpenAPI spec (source of truth for client codegen)
- `lib/api-client-react` — generated React Query hooks (consumed by focus-app)
- `lib/api-zod` — generated Zod schemas
- `lib/integrations-openai-ai-server` — OpenAI integration
- `scripts` — workspace scripts (e.g. DB seed)

TypeScript uses project references (see [tsconfig.json](tsconfig.json)) and the `workspace` custom condition for resolving internal packages.

## Common commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks + Zod schemas from OpenAPI
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed sample data
- `pnpm --filter @workspace/api-server run dev` — run API server locally (port 8080)
- `pnpm expo start --lan` — start the Expo dev server (wraps `scripts/eas-expo.sh`)
- `pnpm expo run:android` — build/install Android dev client

## Local dev setup

1. `cp .env.example .env` — `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learn5`, `PORT=8080`
2. `docker compose up -d` — Postgres 16 (see [docker-compose.yml](docker-compose.yml))
3. `pnpm --filter @workspace/db run push`
4. `pnpm --filter @workspace/api-server run dev`; verify with `curl http://localhost:8080/api/responses`

### Pointing the Expo app at the local API

Phone `localhost` ≠ laptop. Find LAN IP with `ipconfig getifaddr en0`, then set in either root `.env` or `artifacts/focus-app/.env` (both are loaded by `pnpm expo`):

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080
```

Restart Metro after changing. `app.json` enables `usesCleartextTraffic` for local HTTP — if it was built before that flag, the Android dev client must be rebuilt (`pnpm expo run:android` or a new EAS build).

USB alternative: `adb reverse tcp:8080 tcp:8080` and use `EXPO_PUBLIC_API_URL=http://localhost:8080`.

## Architecture notes

- **API contract flows one way**: edit OpenAPI in `lib/api-spec` → run codegen → consume generated hooks in `artifacts/focus-app`. Do not hand-write API client code.
- **Notifications (focus-app)**: `contexts/NotificationContext.tsx` schedules a batch of date-triggered local notifications respecting quiet hours, listens for tap/dismiss to reset the timer, and registers an `expo-background-fetch` task that tops up the schedule when the OS wakes the app. All `expo-notifications`/`expo-background-fetch`/`expo-task-manager` calls are lazy-loaded and crash-safe so the app still runs in Expo Go (with an in-app countdown only).
- **Scheduling logic** lives in `artifacts/focus-app/lib/scheduling.ts` as pure helpers — keep new "skip quiet hours" logic there, not inside the context.
- **DB tables**: `responses` (id, text, skipped, created_at), `settings` (singleton row: `reminder_interval_minutes`, `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`).

## Product plans (read before related implementation work)

- [docs/product/threads-intelligent-question-generation.md](docs/product/threads-intelligent-question-generation.md) — "Threads" initiative: noise filtering, topic auto-clustering, thread-scoped quiz sessions, thread digest view. Source of truth for any work touching question generation, embeddings, topics, or noise classification.

## Conventions / gotchas

- **pnpm only** — `preinstall` aborts npm/yarn and deletes their lockfiles.
- **`minimumReleaseAge: 1440`** in [pnpm-workspace.yaml](pnpm-workspace.yaml) blocks installing npm packages less than 1 day old (supply-chain defense). Do not disable. Add to `minimumReleaseAgeExclude` only for trusted-publisher urgent fixes.
- **`react`/`react-dom` are pinned to exact `19.1.0`** in the workspace catalog because Expo requires it.
- **Platform-specific native binaries** for esbuild/lightningcss/rollup/etc. are stripped via `overrides: "-"` to keep Replit (linux-x64) installs small — when adding a new native dep, mirror that pattern.
- **EAS Build** uses the `eas-build-pre-install` hook to force-install `pnpm@10.26.1`, and `eas-build-post-install` runs `scripts/eas-pin-jdk17.sh` to pin JDK 17 for Android builds. `eas.json` `preview` profile produces an installable internal Android APK.
