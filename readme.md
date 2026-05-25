# Local database setup

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

## 1. Environment file

```bash
cp .env.example .env
```

`.env` should contain:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learn5
PORT=8080
```

Replit uses its own injected secrets — this file is for local dev only.

## 2. Start Postgres

```bash
docker compose up -d
```

## 3. Create tables

```bash
pnpm --filter @workspace/db run push
```

## 4. Seed sample data (optional)

```bash
pnpm --filter @workspace/scripts run seed
```

## 5. Run the API for verification

```bash
pnpm --filter @workspace/api-server run dev
```

Verify: `curl http://localhost:8080/api/responses`

## Android app → local API

Phone and laptop must reach each other. `localhost` on the phone means the phone, not your laptop.

### 1. Find your laptop's LAN IP

```bash
ipconfig getifaddr en0
```

Example: `192.168.1.10`

### 2. Point the Expo app at the API

Add to **either** repo root `.env` or `artifacts/focus-app/.env` (both are loaded by `pnpm expo`):

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:8080
```

Use your IP from step 1. **Restart Metro** after changing this value.

### 3. Start Expo (LAN mode)

From the repo root, phone and laptop on the same Wi‑Fi:

```bash
pnpm expo start --lan
```

Scan the QR code with your Android dev build.

### 4. Rebuild the Android app (once)

`app.json` enables HTTP (`usesCleartextTraffic`) for local dev. Rebuild the dev client so it takes effect:

```bash
pnpm expo run:android
```

Or trigger a new EAS build if you install via EAS.

**If the overlay shows the correct API URL but still fails:** your installed APK was built before `usesCleartextTraffic` was added — rebuild is required for HTTP.

### USB alternative (no Wi‑Fi IP)

With the phone connected over USB:

```bash
adb reverse tcp:8080 tcp:8080
```

Set in `artifacts/focus-app/.env`:

```
EXPO_PUBLIC_API_URL=http://localhost:8080
```