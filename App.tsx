/**
 * Routiner — habit tracker app (Figma community design), built on React Native 0.87.
 *
 * @format
 */

import React, { useEffect } from 'react';
import {
  Appearance,
  AppState,
  StatusBar,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { applyAppLock } from './src/services/appLock';
import { mirrorBackup } from './src/services/backup';
import { resyncDateReminders } from './src/services/dateReminders';
import {
  registerForegroundHandler,
  resyncReminders,
} from './src/services/notifications';
import { scheduleRecap } from './src/services/recap';
import { applyInterfaceStyle } from './src/services/theme';
import { configureGeolocation } from './src/services/weather';
import { pushStreakToWidget } from './src/services/widget';
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
  const scheme = useColorScheme();

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

  // Foreground notification action presses (previously dropped — OV #10).
  useEffect(() => registerForegroundHandler(), []);

  // Auto-mirror the full store to the backup slot whenever the app leaves
  // the foreground (8A: corruption guard; Export is the off-device copy).
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'background') {
        mirrorBackup();
      }
    });
    return () => sub.remove();
  }, []);

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
          barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export default App;
