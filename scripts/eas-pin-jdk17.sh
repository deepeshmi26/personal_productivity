#!/usr/bin/env bash
# Runs on the EAS Build worker after dependencies are installed but before
# gradle invokes the Android build. Finds JDK 17 on the machine and pins it
# in android/gradle.properties so gradle ignores any Java 11 default.
#
# Also dumps extensive diagnostics so that if detection ever fails, the next
# build log will tell us exactly what's on the image.
set -uo pipefail

echo ""
echo "============================================================"
echo "=== eas-pin-jdk17: JDK environment diagnostics"
echo "============================================================"
echo "PWD: $(pwd)"
echo "USER: ${USER:-unknown}  HOME: ${HOME:-unknown}"
echo ""
echo "--- env vars ---"
echo "JAVA_HOME=${JAVA_HOME:-<unset>}"
echo "PATH=${PATH:-<unset>}"
echo ""
echo "--- which java / java -version ---"
which java 2>&1 || echo "  no java on PATH"
java -version 2>&1 || true
echo ""
echo "--- /usr/lib/jvm ---"
ls -la /usr/lib/jvm 2>&1 || echo "  (missing)"
echo ""
echo "--- /opt ---"
ls -la /opt 2>&1 | head -40 || true
echo ""
echo "--- update-alternatives java ---"
update-alternatives --list java 2>&1 || true
update-alternatives --list javac 2>&1 || true
echo ""
echo "--- update-java-alternatives -l ---"
update-java-alternatives -l 2>&1 || true
echo ""
if [ -n "${HOME:-}" ]; then
  echo "--- $HOME (depth 1) ---"
  ls -la "$HOME" 2>&1 | head -40 || true
  if [ -d "$HOME/.sdkman/candidates/java" ]; then
    echo "--- $HOME/.sdkman/candidates/java ---"
    ls -la "$HOME/.sdkman/candidates/java" 2>&1 || true
  fi
  if [ -d "$HOME/.gradle/jdks" ]; then
    echo "--- $HOME/.gradle/jdks ---"
    ls -la "$HOME/.gradle/jdks" 2>&1 || true
  fi
fi
echo ""
echo "--- exhaustive search for javac binaries ---"
# Search common roots, limit depth to keep it fast, ignore permission errors.
SEARCH_ROOTS=(/usr/lib/jvm /usr/java /opt /home /root)
for root in "${SEARCH_ROOTS[@]}"; do
  [ -d "$root" ] || continue
  find "$root" -maxdepth 6 -type f -name javac 2>/dev/null
done | sort -u | tee /tmp/javac-binaries.txt
echo ""

echo "============================================================"
echo "=== eas-pin-jdk17: choose JDK 17"
echo "============================================================"

JDK17_PATH=""
choose_jdk17() {
  local jhome="$1"
  [ -z "$jhome" ] && return 1
  [ -x "$jhome/bin/javac" ] || return 1
  local ver
  ver=$("$jhome/bin/javac" -version 2>&1 | awk '{print $2}' | cut -d. -f1)
  if [ "$ver" = "17" ]; then
    JDK17_PATH="$jhome"
    return 0
  fi
  return 1
}

# Strategy 1: respect JAVA_HOME if it points at JDK 17
choose_jdk17 "${JAVA_HOME:-}" && echo "Selected via JAVA_HOME: $JDK17_PATH"

# Strategy 2: known paths
if [ -z "$JDK17_PATH" ]; then
  for candidate in \
    /usr/lib/jvm/java-17-openjdk-amd64 \
    /usr/lib/jvm/java-1.17.0-openjdk-amd64 \
    /usr/lib/jvm/temurin-17-jdk-amd64 \
    /usr/lib/jvm/zulu17-ca-amd64 \
    /usr/lib/jvm/zulu-17-amd64 \
    /opt/java/openjdk \
    /opt/jdk-17 \
    /opt/openjdk-17 \
    /opt/temurin-17; do
    choose_jdk17 "$candidate" && { echo "Selected via known path: $JDK17_PATH"; break; }
  done
fi

# Strategy 3: glob common dirs for *17*
if [ -z "$JDK17_PATH" ]; then
  for candidate in /usr/lib/jvm/*17* /opt/*17* /opt/java/*17* "${HOME:-/nonexistent}"/.sdkman/candidates/java/17* "${HOME:-/nonexistent}"/.gradle/jdks/*17*; do
    choose_jdk17 "$candidate" && { echo "Selected via glob: $JDK17_PATH"; break; }
  done
fi

# Strategy 4: walk every javac we found and ask its version
if [ -z "$JDK17_PATH" ] && [ -s /tmp/javac-binaries.txt ]; then
  while IFS= read -r javac_bin; do
    jhome="${javac_bin%/bin/javac}"
    choose_jdk17 "$jhome" && { echo "Selected via javac scan: $JDK17_PATH"; break; }
  done < /tmp/javac-binaries.txt
fi

echo ""
# Strategy 5 (guaranteed fallback): download a portable Temurin 17 JDK.
if [ -z "$JDK17_PATH" ]; then
  echo "No JDK 17 found on system. Downloading portable Temurin 17..."
  DOWNLOAD_DIR="${EAS_BUILD_WORKINGDIR:-/tmp}/jdk17"
  mkdir -p "$DOWNLOAD_DIR"
  cd "$DOWNLOAD_DIR"
  if [ ! -d jdk-17.0.13+11 ]; then
    TEMURIN_URL="https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.13%2B11/OpenJDK17U-jdk_x64_linux_hotspot_17.0.13_11.tar.gz"
    curl -fsSL "$TEMURIN_URL" -o jdk17.tar.gz
    tar -xzf jdk17.tar.gz
    rm -f jdk17.tar.gz
  fi
  cd - > /dev/null
  choose_jdk17 "$DOWNLOAD_DIR/jdk-17.0.13+11" && echo "Downloaded JDK 17 to: $JDK17_PATH"
fi

if [ -z "$JDK17_PATH" ]; then
  echo "FATAL: Could not locate or download JDK 17."
  exit 1
fi

echo "Using JDK 17: $JDK17_PATH"
"$JDK17_PATH/bin/javac" -version 2>&1 || true

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$REPO_ROOT/artifacts/focus-app"

# Java 8+ removed PermGen; MaxPermSize crashes JDK 17 (common on older EAS Gradle defaults).
GRADLE_JVMARGS="-Xmx4g -XX:MaxMetaspaceSize=1g -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8"

patch_gradle_properties() {
  local file="$1"
  [ -f "$file" ] || return 0

  echo "Patching $file"

  if grep -q "^org.gradle.java.home=" "$file"; then
    sed -i.bak '/^org.gradle.java.home=/d' "$file" && rm -f "$file.bak"
  fi
  if grep -q "^org.gradle.jvmargs=" "$file"; then
    sed -i.bak '/^org.gradle.jvmargs=/d' "$file" && rm -f "$file.bak"
  fi
  # Strip legacy PermGen flags if they appear on other lines.
  sed -i.bak '/MaxPermSize/d' "$file" && rm -f "$file.bak"

  {
    echo ""
    echo "org.gradle.jvmargs=$GRADLE_JVMARGS"
    echo "org.gradle.java.home=$JDK17_PATH"
  } >> "$file"
}

# EAS may run Gradle from repo-root android/ (symlink) or artifacts/focus-app/android/.
declare -a GRADLE_PROPS_PATHS=()
for candidate in "$REPO_ROOT/android/gradle.properties" "$APP_DIR/android/gradle.properties"; do
  if [ -f "$candidate" ]; then
    resolved="$(cd "$(dirname "$candidate")" && pwd)/$(basename "$candidate")"
    GRADLE_PROPS_PATHS+=("$resolved")
  fi
done

if [ "${#GRADLE_PROPS_PATHS[@]}" -eq 0 ]; then
  echo "WARNING: android/gradle.properties not found yet (prebuild may not have run). Skipping pin."
  exit 0
fi

# Deduplicate (root android/ is often a symlink to focus-app/android/).
UNIQUE_PROPS="$(printf '%s\n' "${GRADLE_PROPS_PATHS[@]}" | sort -u)"
while IFS= read -r props; do
  [ -n "$props" ] || continue
  patch_gradle_properties "$props"
  echo "Pinned JDK 17 + jvmargs in $props"
done <<EOF
$UNIQUE_PROPS
EOF

# EAS worker global Gradle config sometimes injects MaxPermSize.
if [ -f "${HOME:-}/.gradle/gradle.properties" ]; then
  sed -i.bak '/MaxPermSize/d' "${HOME}/.gradle/gradle.properties" && rm -f "${HOME}/.gradle/gradle.properties.bak"
  echo "Stripped MaxPermSize from ~/.gradle/gradle.properties (if present)"
fi

echo "============================================================"
