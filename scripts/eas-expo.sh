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

# Expo inlines EXPO_PUBLIC_* at Metro startup. Load monorepo root + app env files.
load_env_file() {
  local file="$1"
  if [ -f "$file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$file"
    set +a
  fi
}

load_env_file "$APP_DIR/.env"
load_env_file "$REPO_ROOT/.env"

# Expo/Gradle Metro loads .env from the app package dir, not the monorepo root.
# Mirror resolved EXPO_PUBLIC_* into artifacts/focus-app/.env for release embed.
env | grep '^EXPO_PUBLIC_' > "$APP_DIR/.env" || true

# Gradle skips createBundleReleaseJsAndAssets when up-to-date, so EXPO_PUBLIC_*
# changes in .env won't reach the APK unless we clear the cached release bundle.
if [[ " $* " == *" run:android "* ]] && [[ " $* " == *" release"* ]]; then
  echo "Clearing cached release JS bundle (Gradle would otherwise reuse old EXPO_PUBLIC_* values)..."
  rm -rf "$APP_DIR/android/app/build/generated/assets/createBundleReleaseJsAndAssets"
fi

# Apply Gradle/JDK fixes before native builds (expo run:android invokes Gradle internally).
if [ -d "$APP_DIR/android" ]; then
  bash "$REPO_ROOT/scripts/eas-pin-jdk17.sh" || true
fi

cd "$REPO_ROOT"
pnpm --filter @workspace/focus-app exec expo "$@"

for native in android ios; do
  if [ -d "$APP_DIR/$native" ] && [ ! -e "$REPO_ROOT/$native" ]; then
    ln -sfn "artifacts/focus-app/$native" "$REPO_ROOT/$native"
    echo "Linked $REPO_ROOT/$native -> artifacts/focus-app/$native"
  fi
done

# Pin JDK 17 in android/gradle.properties (now that prebuild has created it).
# Detection + diagnostics live in a dedicated script so they also run as the
# eas-build-post-install hook -- belt-and-suspenders.
bash "$REPO_ROOT/scripts/eas-pin-jdk17.sh" || true
