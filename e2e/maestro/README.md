# Maestro e2e flows (iOS simulator)

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

Screenshots land in `e2e/maestro/shots/out/<timestamp>/` (gitignored).
