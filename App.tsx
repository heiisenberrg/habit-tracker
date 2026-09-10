/**
 * Slay — habit tracker app (Figma community design), built on React Native 0.87.
 *
 * @format
 */

import { InitialState } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Appearance,
  AppState,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ActionSheetHost } from './src/components/ActionSheet';
import {
  maybeAutoDriveBackup,
  useDriveRestorePrompt,
} from './src/hooks/useDriveRestorePrompt';
import RootNavigator from './src/navigation/RootNavigator';
import { applyAppLock } from './src/services/appLock';
import { mirrorBackup } from './src/services/backup';
import { resyncDateReminders } from './src/services/dateReminders';
import { resyncRecurringReminders } from './src/services/recurringExpenses';
import {
  registerForegroundHandler,
  resyncReminders,
} from './src/services/notifications';
import { scheduleRecap } from './src/services/recap';
import { applyInterfaceStyle } from './src/services/theme';
import { configureGeolocation } from './src/services/weather';
import { pushStreakToWidget } from './src/services/widget';
import { endSystemZen } from './src/services/zenMode';
import { useStore } from './src/store/useStore';

// Location prompts are owned by the Settings toggle — never auto-raised.
configureGeolocation();

// DEV screenshot aid: force a scheme for both-mode UI sweeps. Keep null.
const FORCE_SCHEME: 'dark' | 'light' | null = null;

function App() {
  const habits = useStore(s => s.habits);
  const darkMode = useStore(s => s.darkMode);
  const completions = useStore(s => s.completions);
  const statuses = useStore(s => s.statuses);
  const planner = useStore(s => s.planner);
  const histories = useStore(s => s.histories);
  const streak = useStore(s => s.streak);

  // Day rollover triggers (single-writer rule): hydration completion,
  // foregrounding, and a local-midnight timer. rollDays itself is
  // idempotent by lastRolledDay, so overlapping triggers are harmless.
  // hasHydrated() is checked FIRST — onFinishHydration only fires for
  // future hydrations, and (with the getItem wrapper) hydration always
  // succeeds, so this gate cannot deadlock.
  useEffect(() => {
    const roll = () => useStore.getState().rollDays();
    const p = useStore.persist;
    if (p.hasHydrated()) {
      roll();
    }
    const unHydrate = p.onFinishHydration(() => roll());
    const appState = AppState.addEventListener('change', st => {
      if (st === 'active' && p.hasHydrated()) {
        roll();
      }
    });
    let midnightTimer: ReturnType<typeof setTimeout>;
    const armMidnight = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 5, 0); // 00:00:05 local, DST-safe via setHours
      midnightTimer = setTimeout(() => {
        if (p.hasHydrated()) {
          roll();
        }
        armMidnight();
      }, next.getTime() - now.getTime());
    };
    armMidnight();
    return () => {
      unHydrate();
      appState.remove();
      clearTimeout(midnightTimer);
    };
  }, []);

  // Keep daily reminder triggers alive (idempotent re-schedule on boot/changes).
  // Vacation mode wins: resyncing while paused would silently re-arm the
  // reminders Settings just cancelled.
  useEffect(() => {
    if (!useStore.getState().prefs.vacationMode) {
      resyncReminders(habits);
    }
  }, [habits]);

  // Remembered dates: one-shot triggers for each entry's next occurrence,
  // re-armed after hydration and whenever the list changes. Never prompts —
  // the Remember dates screen owns the permission ask. Gated on hydration so
  // the pre-hydration empty list can't race the real one.
  const dates = useStore(s => s.dates);
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      resyncDateReminders(dates);
    }
  }, [dates]);

  // Recurring bills: materialize due months into the ledger, then re-arm
  // each rule's next due-day reminder. Same hydration gate as the dates.
  const recurring = useStore(s => s.recurring);
  useEffect(() => {
    if (useStore.persist.hasHydrated()) {
      useStore.getState().rollRecurring();
      resyncRecurringReminders(recurring);
    }
  }, [recurring]);

  // Foreground notification action presses (previously dropped — OV #10).
  useEffect(() => registerForegroundHandler(), []);

  // Auto-mirror the full store to the backup slot whenever the app leaves
  // the foreground (8A: corruption guard; Export is the off-device copy).
  // Android also pushes the same JSON to the user's Google Drive app folder
  // at most once every 20 h when they are signed in (no-op elsewhere).
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'background') {
        mirrorBackup();
        maybeAutoDriveBackup().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  // Fresh Android install with a Drive backup on the signed-in account:
  // offer to restore once, before onboarding builds an empty store.
  useDriveRestorePrompt();

  // Evening recap stays truthful on the in-app path: re-arm on any change
  // that alters its content (handler/quick-log paths use afterMutation).
  const zen = useStore(s => s.zen);
  const prefs = useStore(s => s.prefs);
  useEffect(() => {
    scheduleRecap();
  }, [completions, statuses, planner, habits, zen, prefs]);

  // Apply the persisted dark-mode choice deterministically: on = dark, off = light.
  // __DEV__ guard (6A): release builds compile the harness constant away.
  const applied =
    (__DEV__ ? FORCE_SCHEME : null) ?? (darkMode ? 'dark' : 'light');
  useEffect(() => {
    Appearance.setColorScheme(applied);
    applyInterfaceStyle(applied);
  }, [applied]);

  // Android: theme tokens are PlatformColor('@color/…') and a created view
  // keeps the colour int it resolved with, so after a scheme flip the tree
  // is remounted (keyed) with its navigation state carried over. The key
  // follows the NATIVE `appearanceChanged` event rather than `applied` or
  // useColorScheme(): Appearance.setColorScheme updates the JS-side cache
  // at once, but night resources only switch (and RN's PlatformColor cache
  // only clears) when AppCompat's config change lands — that event is
  // emitted right after, so a remount on it re-resolves against the new
  // values. iOS keeps a constant key; DynamicColorIOS re-resolves in place.
  const [nativeScheme, setNativeScheme] = useState(() =>
    Appearance.getColorScheme(),
  );
  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }
    const sub = Appearance.addChangeListener(p =>
      setNativeScheme(p.colorScheme),
    );
    return () => sub.remove();
  }, []);
  const navKey = Platform.OS === 'android' ? nativeScheme ?? 'light' : 'nav';
  const navStateRef = useRef<InitialState | undefined>(undefined);

  // Keep the shared widget/shield payload in sync with the store.
  const appLock = useStore(s => s.appLock);
  const dailyQuote = useStore(s => s.dailyQuote);
  useEffect(() => {
    pushStreakToWidget({
      habits,
      completions,
      statuses,
      planner,
      histories,
      streak,
      appLock,
      dailyQuote,
    });
  }, [
    habits,
    completions,
    statuses,
    planner,
    histories,
    streak,
    appLock,
    dailyQuote,
  ]);

  // App Lock: shield/unshield the picked apps as completions change —
  // finishing the unlock habit releases them immediately. A running zen
  // session keeps the shield up regardless.
  const zenUntil = useStore(s => s.zen.until);
  useEffect(() => {
    applyAppLock(appLock, habits, completions, statuses, zenUntil);
  }, [appLock, habits, completions, statuses, zenUntil]);

  // Zen auto-end: when the session expires while the app is open, clear it
  // and re-arm the reminders it silenced.
  useEffect(() => {
    if (!zenUntil) {
      return;
    }
    const endZen = () => {
      useStore.getState().setZen({ until: null });
      if (!useStore.getState().prefs.vacationMode) {
        resyncReminders(useStore.getState().habits);
      }
      endSystemZen().catch(() => {});
    };
    const ms = new Date(zenUntil).getTime() - Date.now();
    if (ms <= 0) {
      endZen();
      return;
    }
    const t = setTimeout(endZen, ms);
    return () => clearTimeout(t);
  }, [zenUntil]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={applied === 'dark' ? 'light-content' : 'dark-content'}
        />
        <RootNavigator
          key={navKey}
          initialState={navStateRef.current}
          onStateChange={state => {
            navStateRef.current = state;
          }}
        />
        <ActionSheetHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
