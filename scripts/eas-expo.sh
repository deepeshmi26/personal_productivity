#!/usr/bin/env bash
# Proxy script used by the root `expo` npm script.
# EAS Build runs `pnpm expo ...` from the workspace root, but the real expo
# binary and app config live in artifacts/focus-app. We forward the command
# into that workspace, then symlink any generated native dirs (android, ios)
# back to the workspace root so EAS's subsequent credential injection and
# gradle build can find them where they expect.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/artifacts/focus-app"

cd "$REPO_ROOT"
pnpm --filter @workspace/focus-app exec expo "$@"

for native in android ios; do
  if [ -d "$APP_DIR/$native" ] && [ ! -e "$REPO_ROOT/$native" ]; then
    ln -sfn "artifacts/focus-app/$native" "$REPO_ROOT/$native"
    echo "Linked $REPO_ROOT/$native -> artifacts/focus-app/$native"
  fi
done
