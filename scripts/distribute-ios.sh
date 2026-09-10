#!/bin/zsh
# Build a signed device IPA and push it to Firebase App Distribution.
#
# ONE-TIME PREREQUISITES (only you can do these — interactive / Apple account):
#   1. Signing: open ios/habittracker.xcworkspace in Xcode, sign in with your
#      Apple ID (Settings > Accounts), and let automatic signing create an
#      "Apple Development"/ad-hoc cert + provisioning profile for
#      com.lucidbots.lucidapp.adhoc. Add each tester's device UDID in the Apple
#      Developer portal so the ad-hoc profile includes them.
#        Verify:  security find-identity -v -p codesigning   (must be > 0)
#   2. Firebase CLI (the currently installed one is broken):
#        npm i -g firebase-tools    # or: brew reinstall firebase-cli
#        firebase login             # opens a browser (interactive)
#   3. Add testers once in the Firebase console (project slay-d7d4f):
#      App Distribution > Testers & Groups > create a group named "testers".
#
# Then just run:  ./scripts/distribute-ios.sh "optional release notes"
set -euo pipefail
cd "$(dirname "$0")/.."
NOTES="${1:-New build}"
WS=ios/habittracker.xcworkspace
SCHEME=habittracker
ARCHIVE=ios/build/Slay.xcarchive
EXPORT_DIR=ios/build/ipa
PLIST=ios/habittracker/GoogleService-Info.plist

APP_ID=$(/usr/bin/plutil -extract GOOGLE_APP_ID raw "$PLIST")
echo "-> Firebase app id: $APP_ID"

echo "-> Archiving (device, Release)..."
xcodebuild -workspace "$WS" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  clean archive

echo "-> Exporting signed IPA..."
/bin/rm -rf "$EXPORT_DIR"
xcodebuild -exportArchive -archivePath "$ARCHIVE" \
  -exportOptionsPlist ios/ExportOptions.plist -exportPath "$EXPORT_DIR"

IPA=$(ls "$EXPORT_DIR"/*.ipa | head -1)
echo "-> Built: $IPA"

# Prefer the global firebase CLI; fall back to npx if it is missing/broken.
FIREBASE="firebase"
command -v firebase >/dev/null 2>&1 && firebase --version >/dev/null 2>&1 || FIREBASE="npx --yes firebase-tools"

echo "-> Uploading to Firebase App Distribution..."
$FIREBASE appdistribution:distribute "$IPA" \
  --app "$APP_ID" \
  --groups "testers" \
  --release-notes "$NOTES"

echo "OK - distributed. Testers in group 'testers' get an email / App Tester invite."
