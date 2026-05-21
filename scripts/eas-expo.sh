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

# Force gradle to use JDK 17 regardless of JAVA_HOME defaults on the EAS image.
# Path varies by image (openjdk vs temurin vs zulu, sdkman, etc.) so detect at runtime.
GRADLE_PROPS="$APP_DIR/android/gradle.properties"
if [ -f "$GRADLE_PROPS" ] && ! grep -q "^org.gradle.java.home=" "$GRADLE_PROPS"; then
  JDK17_PATH=""
  # 1. Common /usr/lib/jvm layouts
  for candidate in \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/temurin-17-jdk-amd64 \
    /usr/lib/jvm/zulu-17-amd64 \
    /opt/java/openjdk \
    "${JAVA_HOME:-}"; do
    if [ -n "$candidate" ] && [ -x "$candidate/bin/javac" ]; then
      VER=$("$candidate/bin/javac" -version 2>&1 | awk '{print $2}' | cut -d. -f1)
      if [ "$VER" = "17" ]; then
        JDK17_PATH="$candidate"
        break
      fi
    fi
  done
  # 2. Fallback: glob /usr/lib/jvm for anything containing "17"
  if [ -z "$JDK17_PATH" ]; then
    for candidate in /usr/lib/jvm/*17*; do
      if [ -x "$candidate/bin/javac" ]; then
        VER=$("$candidate/bin/javac" -version 2>&1 | awk '{print $2}' | cut -d. -f1)
        if [ "$VER" = "17" ]; then
          JDK17_PATH="$candidate"
          break
        fi
      fi
    done
  fi
  # 3. Fallback: sdkman
  if [ -z "$JDK17_PATH" ] && [ -d "$HOME/.sdkman/candidates/java" ]; then
    for candidate in "$HOME"/.sdkman/candidates/java/17*; do
      if [ -x "$candidate/bin/javac" ]; then
        JDK17_PATH="$candidate"
        break
      fi
    done
  fi

  if [ -n "$JDK17_PATH" ]; then
    echo "" >> "$GRADLE_PROPS"
    echo "org.gradle.java.home=$JDK17_PATH" >> "$GRADLE_PROPS"
    echo "Pinned org.gradle.java.home to $JDK17_PATH in $GRADLE_PROPS"
  else
    echo "WARNING: No JDK 17 found on system; relying on default JAVA_HOME"
    echo "Available /usr/lib/jvm entries:"
    ls -la /usr/lib/jvm 2>/dev/null || echo "  (none)"
  fi
fi
