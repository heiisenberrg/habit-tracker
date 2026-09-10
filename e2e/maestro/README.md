# Maestro e2e flows (iOS simulator; Android with PLATFORM=android)

Drive the Release simulator build like a new user. Requires `brew install
--formula mobile-dev-inc/tap/maestro` and a JDK 17+. The runner defaults to
the booted simulator and the zulu-17 JDK; override with `SIM_UDID=… JAVA_HOME=…`.
Before `00-new-user` it terminates the app and resets its privacy grants so a
prompt left up by an earlier session cannot poison the run.

    ./e2e/maestro/run-flows.sh 00-new-user 10-home-flows 15-dark-mode 20-create-habit 30-monkey

- `00-new-user` — clear state, permissions unset: onboarding → e-mail →
  3-step account → Home; asserts NO OS prompt appears on first Home.
- `10-home-flows` — logging (no prompt: permissions are owned by Settings
  toggles), habit detail, zen, assistant quick-log + habit flow, tabs, Settings.
- `15-dark-mode` — toggles Dark Mode, then the Evening recap and Weather
  toggles (the only places the OS permission dialogs may appear), and
  screenshots every screen.
- `20-create-habit` — custom habit with a daily reminder (notification prompt
  appears here, in context) and logs it to completion.
- `30-monkey` — 160 seeded random taps/swipes; the runner reports app-process
  liveness and any new crash reports afterwards.
- `40-grocery` — Grocery tab: add two list lines, run a shop at Lidl with a
  price and an expiry, finish it, then check the month summary and the
  per-store split on Insights. Run it after `00-new-user`, and AFTER
  `10-home-flows`: whichever flow launches first on a given day gets the
  quote-of-the-day screen, and only `10-home-flows` asserts it.
- `65-logbook` — Logbook behind the Activity header: add a "Haircut"
  tracker, log it today and backdate one, check "days ago" and the rhythm
  line. Same ordering rule as `40-grocery`.
- `55-expenses` — Expenses tab: add the rent by hand, check it lands in the
  list and the month total (groceries join from the Grocery tab's trips).
  Same ordering rule as `40-grocery`.
- `50-dates` — Remember dates: Settings → Remember dates, add "Ajay's
  birthday" (25 June 1996, 1 day before), and check the row shows the date,
  the age and the reminder. The notification prompt may appear on Save (a
  user-initiated ask, like a habit reminder). Same ordering rule as
  `40-grocery`.

Screenshots land in `e2e/maestro/shots/out/<timestamp>/` (gitignored).

## Android

    PLATFORM=android ./e2e/maestro/run-flows.sh 00-new-user 10-home-flows 20-create-habit 30-monkey

Same flows, same step summary; the default (`PLATFORM` unset) is the iOS
path above, unchanged. The runner uses `adb` from `$ANDROID_HOME` (default
`~/Library/Android/sdk`) and targets `$ANDROID_SERIAL`, else the first online
device in `adb devices`. Install the app first (`pnpm android`) — Maestro
does not build. Before `00-new-user` it runs `pm clear` on the app and
revokes POST_NOTIFICATIONS / ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION
(the `simctl privacy reset` equivalent; failures are ignored, e.g. no
POST_NOTIFICATIONS below Android 13). Health is `pidof`; "new crash reports"
counts `FATAL EXCEPTION` lines in logcat since the run started (`logcat -c`
at start) and a second line counts native `Fatal signal`s; the dump is kept
at `shots/out/logcat.txt`.

A flow that Maestro aborts without a FAILED line (e.g. the adb transport
dropping mid-screenshot: `DeviceServerDiedException … device offline`) is
reported as `!! maestro exited 1`; the stack is in the newest
`~/.maestro/tests/*/maestro.log`, and the later flows usually fail only
because that one never finished (rerun the set).

The flows were written against the iOS simulator. Known iOS-only spots —
they pass or skip harmlessly on Android, but do not test the same thing:

- Maestro's Android `launchApp` grants every runtime permission the
  manifest declares (notifications, location, Health Connect reads) unless
  the step says otherwise, so after `00-new-user` no OS dialog ever
  appears in `10`/`15`/`20` — the permission paths are only exercised by
  hand (`pm revoke …`, then flip the Settings toggle).
- OS prompt strings and buttons: "Would Like to Send You Notifications",
  "use your location", "Allow While Using App" (Android's location dialog
  says "While using the app"). All are `optional` taps or `assertNotVisible`,
  so they never fail; they just cannot catch an Android prompt.
- Merged-element regexes such as `.*Milk.*Add price.*`, `.*Drink water,
  .*opens details`, `.*Ajay's birthday.*25 June 1996.*`,
  `.*Home rent.*€650.00.*`, `.*Haircut.*today.*` and the grocery chart
  marks: iOS folds an accessible card's children (and the accessibility
  hint) into one element; Android keeps them as separate nodes unless the
  row carries an explicit accessibilityLabel.
- Keyboard notes: a chip tap dismissing the number pad (`50-dates`,
  `65-logbook`), drag-to-dismiss on the decimal pad (`55-expenses`); on
  Android the keyboard may stay up and cover the next control.
- Coordinate taps assume the iOS header and status-bar layout
  (`15-dark-mode` opens the calendar at `20%,29%`).
- `id:` matches (`switch-dark`, `draft-price`, `date-title`…) rely on
  `testID` being exposed as the Android `resource-id`; confirm on the
  device before trusting an id-based step.
