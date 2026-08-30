# TODOS

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
