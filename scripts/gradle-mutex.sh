#!/bin/zsh
# Serializes Gradle invocations across concurrent agents/sessions: two
# builds in the same android/ dir corrupt each other's outputs. Usage:
#   scripts/gradle-mutex.sh :app:compileDebugKotlin
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCK="$ROOT/android/.gradle-mutex"
export JAVA_HOME="${JAVA_HOME:-/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
waited=0
until mkdir "$LOCK" 2>/dev/null; do
  sleep 3; waited=$((waited+3))
  if [ $waited -gt 1500 ]; then echo "gradle-mutex: gave up waiting for $LOCK"; exit 3; fi
  # stale lock (owner died): older than 25 min
  if [ -n "$(find "$LOCK" -maxdepth 0 -mmin +25 2>/dev/null)" ]; then rmdir "$LOCK" 2>/dev/null; fi
done
trap 'rmdir "$LOCK" 2>/dev/null' EXIT INT TERM
cd "$ROOT/android" && ./gradlew --console=plain -q "$@"
