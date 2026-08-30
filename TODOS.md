# TODOS

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

### Android parity beyond theming

**What:** Google Fit steps, home-screen widget, AppCompatDelegate-driven dark mode, notification action parity.

**Why:** The release APK works today but is a second-class citizen; parity makes it a real fallback device.

**Context:** iOS-first by design (2026-08-30 CEO review). The theming pass is in the active plan; the rest accumulates here. Services already Platform-guard cleanly, so each item is additive.

**Effort:** L
**Priority:** P4
**Depends on:** Active plan's Android theming pass

## Completed
