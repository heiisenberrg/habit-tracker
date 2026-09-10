#!/bin/zsh
# Usage: SIM_UDID=<udid> ./run-flows.sh <flow-basename>...
#        PLATFORM=android [ANDROID_SERIAL=<serial>] ./run-flows.sh <flow-basename>...
# Runs each Maestro flow, prints a step summary, then reports app-process
# liveness and any new crash reports. Defaults suit this machine; override
# SIM_UDID / JAVA_HOME (iOS) or ANDROID_SERIAL / ANDROID_HOME (Android) for
# another.
set -u
Q="$(cd "$(dirname "$0")" && pwd)"
APP_ID=com.lucidbots.lucidapp.adhoc
PLATFORM=${PLATFORM:-ios}
: "${JAVA_HOME:=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home}"
export JAVA_HOME
MAESTRO=${MAESTRO:-/opt/homebrew/bin/maestro}
[ -x "$MAESTRO" ] || { echo "maestro not found at $MAESTRO (brew install --formula mobile-dev-inc/tap/maestro)"; exit 2; }
if [ "$PLATFORM" = android ]; then
  : "${ANDROID_HOME:=$HOME/Library/Android/sdk}"
  export ANDROID_HOME
  ADB=$ANDROID_HOME/platform-tools/adb
  [ -x "$ADB" ] || { echo "adb not found at $ADB (set ANDROID_HOME)"; exit 2; }
  # $ANDROID_SERIAL, else the first online device; adb honours the export.
  : "${ANDROID_SERIAL:=$("$ADB" devices 2>/dev/null | awk 'NR > 1 && $2 == "device" { print $1; exit }')}"
  [ -n "$ANDROID_SERIAL" ] || { echo "no online Android device (adb devices)"; exit 2; }
  export ANDROID_SERIAL
  DEVICE=$ANDROID_SERIAL
  # "new crash reports" below counts FATAL EXCEPTIONs logged from here on.
  "$ADB" logcat -c 2>/dev/null
else
  : "${SIM_UDID:=$(xcrun simctl list devices booted -j 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next((x["udid"] for v in d["devices"].values() for x in v if x.get("state")=="Booted"), ""))' 2>/dev/null)}"
  : "${SIM_UDID:=28E25F3F-29A2-4686-9BC9-56D7EB8FCAA0}"
  xcrun simctl list devices booted 2>/dev/null | grep -q "$SIM_UDID" || { echo "simulator $SIM_UDID is not booted (xcrun simctl boot $SIM_UDID)"; exit 2; }
  DEVICE=$SIM_UDID
fi
mkdir -p "$Q/shots/out"
cd "$Q/shots"
[ "$PLATFORM" = android ] || BASE=$(ls ~/Library/Logs/DiagnosticReports 2>/dev/null | grep -ci habittracker)
for f in "$@"; do
  echo "=============== $f ==============="
  if [ "$f" = "00-new-user" ]; then
    # A prompt left up by an earlier session survives clearState; start clean.
    if [ "$PLATFORM" = android ]; then
      "$ADB" shell pm clear "$APP_ID" >/dev/null 2>&1
      for p in POST_NOTIFICATIONS ACCESS_FINE_LOCATION ACCESS_COARSE_LOCATION; do
        "$ADB" shell pm revoke "$APP_ID" "android.permission.$p" >/dev/null 2>&1
      done
    else
      xcrun simctl terminate "$SIM_UDID" "$APP_ID" 2>/dev/null
      xcrun simctl privacy reset all "$APP_ID" 2>/dev/null
    fi
  fi
  "$MAESTRO" --device "$DEVICE" test --test-output-dir "$Q/shots/out" "$Q/flows/$f.yaml" 2>&1 \
    | grep -E "COMPLETED|FAILED|Assertion|Element not found|Flow " \
    | awk '{ if ($0 ~ /FAILED|Assertion|not found/) print "  !! " $0; else n++ } END { print "  ok steps: " n }'
  # A driver death (e.g. "device offline" mid-screenshot) ends the flow with
  # no FAILED line on stdout — only the exit code and ~/.maestro/tests say so.
  rc=${pipestatus[1]}
  [ "$rc" -eq 0 ] || echo "  !! maestro exited $rc (flow aborted; see the newest ~/.maestro/tests/*/maestro.log)"
done
echo "=============== health ==============="
if [ "$PLATFORM" = android ]; then
  "$ADB" shell pidof "$APP_ID" >/dev/null 2>&1 && echo "app process: alive" || echo "app process: NOT RUNNING"
  LOG="$Q/shots/out/logcat.txt"
  "$ADB" logcat -d >"$LOG" 2>/dev/null
  echo "new crash reports: $(grep -c 'FATAL EXCEPTION' "$LOG") (logcat: $LOG)"
  echo "native fatal signals: $(grep -c 'Fatal signal' "$LOG")"
else
  xcrun simctl spawn "$SIM_UDID" launchctl list 2>/dev/null | grep -q "$APP_ID" && echo "app process: alive" || echo "app process: NOT RUNNING"
  NOW=$(ls ~/Library/Logs/DiagnosticReports 2>/dev/null | grep -ci habittracker)
  echo "new crash reports: $((NOW-BASE))"
fi
