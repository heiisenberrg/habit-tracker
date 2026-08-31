#!/bin/zsh
# Usage: SIM_UDID=<udid> ./run-flows.sh <flow-basename>...
# Runs each Maestro flow, prints a step summary, then reports app-process
# liveness and any new crash reports. Defaults suit this machine; override
# SIM_UDID / JAVA_HOME for another.
set -u
Q="$(cd "$(dirname "$0")" && pwd)"
APP_ID=com.lucidbots.lucidbots
: "${SIM_UDID:=$(xcrun simctl list devices booted -j 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next((x["udid"] for v in d["devices"].values() for x in v if x.get("state")=="Booted"), ""))' 2>/dev/null)}"
: "${SIM_UDID:=28E25F3F-29A2-4686-9BC9-56D7EB8FCAA0}"
: "${JAVA_HOME:=/Library/Java/JavaVirtualMachines/zulu-17.jdk/Contents/Home}"
export JAVA_HOME
MAESTRO=${MAESTRO:-/opt/homebrew/bin/maestro}
[ -x "$MAESTRO" ] || { echo "maestro not found at $MAESTRO (brew install --formula mobile-dev-inc/tap/maestro)"; exit 2; }
xcrun simctl list devices booted 2>/dev/null | grep -q "$SIM_UDID" || { echo "simulator $SIM_UDID is not booted (xcrun simctl boot $SIM_UDID)"; exit 2; }
mkdir -p "$Q/shots/out"
cd "$Q/shots"
BASE=$(ls ~/Library/Logs/DiagnosticReports 2>/dev/null | grep -ci habittracker)
for f in "$@"; do
  echo "=============== $f ==============="
  if [ "$f" = "00-new-user" ]; then
    # A prompt left up by an earlier session survives clearState; start clean.
    xcrun simctl terminate "$SIM_UDID" "$APP_ID" 2>/dev/null
    xcrun simctl privacy reset all "$APP_ID" 2>/dev/null
  fi
  "$MAESTRO" --device "$SIM_UDID" test --test-output-dir "$Q/shots/out" "$Q/flows/$f.yaml" 2>&1 \
    | grep -E "COMPLETED|FAILED|Assertion|Element not found|Flow " \
    | awk '{ if ($0 ~ /FAILED|Assertion|not found/) print "  !! " $0; else n++ } END { print "  ok steps: " n }'
done
echo "=============== health ==============="
xcrun simctl spawn "$SIM_UDID" launchctl list 2>/dev/null | grep -q "$APP_ID" && echo "app process: alive" || echo "app process: NOT RUNNING"
NOW=$(ls ~/Library/Logs/DiagnosticReports 2>/dev/null | grep -ci habittracker)
echo "new crash reports: $((NOW-BASE))"
