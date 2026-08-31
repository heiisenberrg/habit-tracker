# TODOS

## Build

### Device Release build + install (T14, blocked 2026-08-30)

**What:** Rebuild and reinstall the Release app on Ajaykkumar's iPhone
(device id 2BD53F45-8B43-56CE-87E6-BE52A34440E6).

**Why blocked:** `security find-identity` shows ZERO valid code-signing
identities — the iOS Development certificate for team QAW658347B is gone or
expired (the last device build is from Aug 21). Its cached provisioning
profile also predates the family-controls entitlement, which means the
CURRENTLY INSTALLED device app cannot actually raise the Screen Time shield.

**To fix (one sitting):** Xcode → Settings → Accounts → sign in to
arajendran@lucidbots.com (mints a fresh cert), then:
`cd ios && xcodebuild -workspace habittracker.xcworkspace -scheme habittracker -configuration Release -destination 'generic/platform=iOS' -derivedDataPath build-device -allowProvisioningUpdates build`
and install with `xcrun devicectl device install app` while the iPhone is
connected and unlocked. Doing the Shield activation (below) first makes it
a single build.

**Effort:** S (after re-auth)
**Priority:** P1
**Depends on:** Apple ID re-auth in Xcode

## Polish

### Onboarding page 2 artwork still shows social demo content (found 2026-08-31 QA)

**What:** `src/assets` onboarding illustration for "Track Your Progress" is a
baked PNG showing "Best Runners! · 2 friends joined", friend avatars and a
"+3" pile on habit cards. The T13 copy scrub covered strings, not artwork;
for a single-user app this promises a social layer that does not exist.

**Fix:** replace the page-2 (and ideally page-3 avatar) illustrations with
Routiner-only art (progress ring + week strip). Needs a supplied/generated
image asset — same blocker class as the widget avatar swap.

**Effort:** S (once art exists) · **Priority:** P3

## Shield

### Activate the ShieldConfiguration extension (D8, auto-deferred 2026-08-30)

**What:** Register the ready-made RoutinerShield extension target and ship the
custom Screen Time shield screen (labels/icon only, no buttons — v1 scope).

**Why:** The shield currently shows Apple's generic screen; the custom copy
names the unlock habit and its progress from the `sharedState` payload.

**Context:** The provisioning spike (OV3) was blocked on credentials, not an
entitlement refusal: Xcode's session for arajendran@lucidbots.com is expired,
so no profile for `com.lucidbots.lucidbots.RoutinerShield` could be created.
Everything else is DONE and committed: `ios/RoutinerShield/` (Swift data
source reading `sharedState`, Info.plist, family-controls entitlements) and
`ios/add-shield-target.rb`. The extension compiles clean for simulator.

**To activate:**
1. Xcode → Settings → Accounts → sign in to arajendran@lucidbots.com again.
2. `cd ios && ruby add-shield-target.rb`
3. Build once with `-allowProvisioningUpdates` (or from Xcode) so automatic
   signing mints the profile; then rebuild + reinstall the device app.
If Apple refuses the family-controls profile for the new bundle id, D8 stays
deferred per plan OV3 (the main app already holds the entitlement, so a
refusal is unlikely).

**Effort:** S (once signed in)
**Priority:** P2
**Depends on:** Apple ID re-auth in Xcode

## Widget

### Lock-status widget upgrade (D10, deferred 2026-08-30 CEO review)

**What:** Add 🔒/🔓 lock state + unlock-habit line and a today-progress ring to the home-screen widget; add a lock-screen (accessory) family.

**Why:** Puts the earn-your-apps loop on the phone's face without opening anything.

**Context:** The consolidated App Group `sharedState` payload (decision 1A, 2026-08-30 CEO plan) already carries lock state + habit + progress, so this is pure widget-side Swift/layout work in `ios/RoutinerWidget/RoutinerWidget.swift`. Best after the ShieldConfiguration extension lands and proves the loop.

**Effort:** M
**Priority:** P3
**Depends on:** Shield extension + 1A payload (in the 2026-08-30 plan)

## Design

### Write the design system down — DESIGN.md via /design-consultation (design review 2026-08-31)

**What:** Run `/design-consultation` to produce DESIGN.md: palette + usage rules
(text under 16pt uses `ink60`; `ink40` is for glyphs/disabled), the type scale,
radius/spacing/shadow policy, the icon-language decision (emoji-forward vs
vector), and the card-vs-layout stance.

**Why:** Three reviews in two days each re-derived the same calibration from
`src/theme/theme.ts`, and the 2026-08-31 design review parked one decision
(Settings emoji icon chips) explicitly on this missing document.

**Pros:** Every future UI decision has a reference; slop tells get a considered
answer once. **Cons:** ~30 min interactive session; it will also surface
opinions on pre-existing screens.

**Context:** Tokens in `src/theme/theme.ts`; component vocabulary in
`src/components/common.tsx` and `icons.tsx`; today's simulator screenshots
under `e2e/maestro/shots/out/` are the corpus.

**Effort:** S · **Priority:** P2 · **Depends on:** nothing

### Sweep pre-existing `ink40` text to `ink60` (design review 2026-08-31, decision 10A)

**What:** Change every `variant="alt"` / `body` text using `colors.ink40` on
light surfaces (habit card meta, hero sub-lines, Activity captions, calendar
labels, chip captions) to `ink60`; keep `ink40` for icons, dividers and
disabled states. Add an a11y-suite assertion that no `alt` text uses `ink40`.

**Why:** `ink40` (#9B9BA1) measures 2.6:1 on the light background — below the
4.5:1 floor for text under 18pt. D9 fixes only the surfaces added on
2026-08-31; the same token sits under most secondary text in the app.

**Pros:** Light mode passes AA for body-size text everywhere. **Cons:** ~40
sites across a dozen screens; the app reads slightly louder; needs a
both-modes screenshot sweep.

**Context:** `grep -rn "ink40" src` is the worklist; today's Maestro flows
provide the before/after captures.

**Effort:** S · **Priority:** P2 · **Depends on:** D9 (rule documented in
`src/theme/theme.ts`)

### Support iOS large text (Dynamic Type) in fixed-height layouts (design review 2026-08-31)

**What:** Audit at iOS accessibility text sizes; replace fixed heights with
min-heights (48pt icon buttons, 56pt CTA, 44pt hero actions, 64pt week cells,
single-line habit names, picker tiles) and set `maxFontSizeMultiplier` only
where wrapping would destroy meaning.

**Why:** Labels and roles are done; usable-with-accessibility-settings is not.
At AX3+ names truncate, the hero sub-line wraps under the ring, picker tiles
overflow.

**Pros:** Honest a11y story; catches layout assumptions before more screens
are built. **Cons:** Touches a dozen layouts; needs a screenshot matrix at
2–3 sizes.

**Context:** Capture at other sizes with
`xcrun simctl ui <udid> content_size extra-extra-extra-large` before running
the Maestro flows; today's captures are the default-size baseline.

**Effort:** M · **Priority:** P3 · **Depends on:** nothing

## Store

### Prune `completions` entries older than the 83-day history window (eng review 2026-08-31)

**What:** In `rollDays` (src/store/useStore.ts), after the per-day `histories`
shift, delete `completions[habitId][dateKey]` entries whose dateKey has
rolled out of the 83-slot window.

**Why:** The map grows forever (habits × logged days). Every scan of it
(`engaged` on Home, backup export, widget payload, `dayCompletion` for old
dates) gets linearly slower and the persisted JSON blob grows with it.

**Pros:** Bounded store size; scans stay O(83 × habits).
**Cons:** Rollover gains a deletion step; any future view looking back past
83 days must read `histories`, not raw completions.

**Context:** Surfaced by the Performance section of the 2026-08-31 eng
review of the QA-fix diff. Cost today is negligible (~2k entries after a
year with 6 habits), so this is hygiene. The reconciliation branch of
`rollDays` already iterates dateKeys — start there.

**Effort:** S · **Priority:** P4
**Depends on:** Rollover trusted on the device for a few weeks first.

## CI

### Run the Maestro e2e flows on every push (eng review 2026-08-31)

**What:** GitHub Actions job on a macOS runner: build the Release simulator
app (`xcodebuild … -sdk iphonesimulator CODE_SIGN_IDENTITY="-"`), boot an
iPhone simulator, `brew install --formula mobile-dev-inc/tap/maestro`, then
`SIM_UDID=<booted> ./e2e/maestro/run-flows.sh 00-new-user 10-home-flows
15-dark-mode 20-create-habit 30-monkey` and upload `e2e/maestro/shots/out`.

**Why:** The five flows only run when someone remembers to; the new-user
path, dark mode and the crash monkey are the checks most likely to regress
silently.

**Pros:** Every push proves the first-run experience and zero crashes;
screenshots become a per-commit visual record.
**Cons:** macOS runners are slow (~10 min cold build) and metered; simulator
flakiness needs a retry; the Maestro iOS driver install adds ~1 min.

**Context:** `run-flows.sh` already reports app-process liveness and new
crash reports, so the job is plumbing. This repo has no CI at all yet —
a unit-test job (`npm test`) should land first in the same workflow.

**Effort:** M · **Priority:** P3
**Depends on:** T8 env-parameterized runner (2026-08-31 eng review); a
GitHub Actions macOS budget.

## UI

### Extract shared TaskRow component

**What:** Deduplicate the near-identical task-card/checkbox/meta-row styles in HomeScreen and CalendarScreen into `src/components/TaskRow.tsx`.

**Why:** Two copies already drifted once (border tokens); every task-UI tweak is made twice.

**Context:** Style blocks in `src/screens/HomeScreen.tsx` and `src/screens/CalendarScreen.tsx`; cleanest right after the 2A HomeScreen component split.

**Effort:** S
**Priority:** P3
**Depends on:** 2A HomeScreen split (in the 2026-08-30 plan)

### Shareable streak-card image export

**What:** Render the current streak/heatmap as an image and share it via the share sheet.

**Why:** Bragging rights; zero platform risk.

**Context:** Unpicked candidate from the 2026-08-30 CEO review; react-native-view-shot or Skia snapshot of a dedicated card component.

**Effort:** S
**Priority:** P4
**Depends on:** None

## Android

### Android parity (incl. dark theming pass)

**What:** Dark-palette theming pass (deferred from the active plan, decision 11B), Google Fit steps, home-screen widget, AppCompatDelegate-driven dark mode, notification action parity.

**Why:** The release APK works today but is a second-class citizen; parity makes it a real fallback device.

**Context:** iOS-first by design (2026-08-30 CEO review; outside voice called Android polish "audience of zero" and the user agreed to defer). Services already Platform-guard cleanly, so each item is additive.

**Effort:** L
**Priority:** P4
**Depends on:** None

## Completed
