## Cursor Cloud specific instructions

### Prerequisites (handled by update script)

- **Node 24** is required (project uses `--env-file-if-exists` and other Node 24 features). The update script installs it via nvm and activates pnpm via corepack.
- **pnpm 10.26.1** is the enforced package manager. The `preinstall` hook aborts npm/yarn.
- **Docker** is required for PostgreSQL. Must be installed separately (not part of update script).

### Starting services

1. **Docker daemon**: `sudo dockerd &>/dev/null &` — required before docker compose.
2. **PostgreSQL**: `sudo docker compose up -d` from repo root. Container name `learn5-postgres`, port 5432. Wait for health check before proceeding.
3. **DB schema push**: `pnpm --filter @workspace/db run push` — idempotent, safe to re-run.
4. **API server**: `pnpm --filter @workspace/api-server run dev` on port 8080. The `dev` script builds with esbuild then starts.
5. **Verify**: `curl http://localhost:8080/api/healthz` should return `{"status":"ok"}`.

### Environment variables

Create `/workspace/.env` with:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/learn5
PORT=8080
```

### Gotchas

- The API server `dev` script does a full esbuild build before starting (`pnpm run build && pnpm run start`). There is no hot-reload; restart the dev command after code changes.
- The `pnpm-workspace.yaml` has `minimumReleaseAge: 1440` — packages published <1 day ago will be blocked. Do not disable.
- `onlyBuiltDependencies` in `pnpm-workspace.yaml` whitelists `@swc/core`, `esbuild`, `msw`, `unrs-resolver`. If adding a new native dep that needs a postinstall build step, add it there.
- `pnpm run typecheck` covers libs + all artifacts. The mockup-sandbox (`artifacts/mockup-sandbox`) has pre-existing React type conflicts — these do not affect the core API or mobile app.
- OpenAI integration is optional. Without `AI_INTEGRATIONS_OPENAI_API_KEY`, AI quiz generation is disabled gracefully (logs a warning, continues).
- The Expo mobile app (`artifacts/focus-app`) cannot run in headless Cloud VMs. Test mobile changes via typecheck or by running the API server and validating API-level behavior.

### Common commands

See `CLAUDE.md` — key commands: `pnpm run typecheck`, `pnpm run build`, `pnpm --filter @workspace/api-server run dev`, `pnpm --filter @workspace/db run push`, `pnpm --filter @workspace/scripts run seed`.
