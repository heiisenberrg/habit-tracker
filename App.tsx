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
import { resyncReminders } from './src/services/notifications';
import { applyInterfaceStyle } from './src/services/theme';
import { pushStreakToWidget } from './src/services/widget';
import { useStore } from './src/store/useStore';

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

  // Apply the persisted dark-mode choice deterministically: on = dark, off = light.
  // __DEV__ guard (6A): release builds compile the harness constant away.
  const applied =
    (__DEV__ ? FORCE_SCHEME : null) ?? (darkMode ? 'dark' : 'light');
  useEffect(() => {
    Appearance.setColorScheme(applied);
    applyInterfaceStyle(applied);
  }, [applied]);

  // Keep the home-screen streak widget in sync with the store.
  useEffect(() => {
    pushStreakToWidget({
      habits,
      completions,
      statuses,
      planner,
      histories,
      streak,
    });
  }, [habits, completions, statuses, planner, histories, streak]);

  // App Lock: shield/unshield the picked apps as completions change —
  // finishing the unlock habit releases them immediately. A running zen
  // session keeps the shield up regardless.
  const appLock = useStore(s => s.appLock);
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
