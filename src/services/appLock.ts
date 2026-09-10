import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { Habit } from '../data/seed';
import {
  activeOn,
  AppLockPrefs,
  CompletionMap,
  doneOn,
  StatusMap,
} from '../store/useStore';
import { STORE_PERSIST_KEY } from './rainAlerts';

/**
 * App Lock: shields user-picked apps until an unlock condition is met — a
 * specific habit done today, every habit done, or a daily time reached.
 *
 * Both platforms expose the same native module ("AppLock"); the guards
 * below key off the method's presence, not Platform.OS, so a build without
 * the module (or a test) degrades to "unsupported".
 *  - iOS: Screen Time (FamilyControls). The native side never learns which
 *    apps were picked; it only holds opaque tokens.
 *  - Android: Usage access + "Display over other apps". The picker is our
 *    own screen, the native side keeps package names and a foreground
 *    service draws the shield.
 */

export type { AppLockPrefs } from '../store/useStore';

export type AppLockState = {
  supported: boolean;
  authorized: boolean;
  apps: number;
  categories: number;
  active: boolean;
};

/** A launchable app from the Android picker. `icon` is a PNG data URI or null. */
export type InstalledApp = {
  packageName: string;
  label: string;
  icon: string | null;
};

const native = NativeModules.AppLock;

const UNSUPPORTED: AppLockState = {
  supported: false,
  authorized: false,
  apps: 0,
  categories: 0,
  active: false,
};

export const getAppLockState = async (): Promise<AppLockState> => {
  if (!native?.getState) {
    return UNSUPPORTED;
  }
  try {
    return await native.getState();
  } catch {
    return UNSUPPORTED;
  }
};

/**
 * Ask for permission. iOS shows the Screen Time prompt and rejects on
 * denial. Android cannot prompt: the module opens whichever special
 * permission page is missing and resolves false, so callers re-check on
 * AppState 'active'; it resolves true only when both were already granted.
 * False on denial/simulator/old iOS.
 */
export const requestAppLockAuth = async (): Promise<boolean> => {
  if (!native?.requestAuthorization) {
    return false;
  }
  try {
    const granted = await native.requestAuthorization();
    return granted !== false;
  } catch {
    return false;
  }
};

/**
 * Show the system app picker (iOS); resolves with the stored selection
 * size. On Android the picker is the AppLockPicker screen, and this only
 * reports the counts.
 */
export const pickLockedApps = async (): Promise<{
  apps: number;
  categories: number;
}> => {
  if (!native?.presentPicker) {
    return { apps: 0, categories: 0 };
  }
  try {
    return await native.presentPicker();
  } catch {
    return { apps: 0, categories: 0 };
  }
};

/** Android: launchable apps for the picker, sorted by label. Empty elsewhere. */
export const listInstalledApps = async (): Promise<InstalledApp[]> => {
  if (!native?.listApps) {
    return [];
  }
  try {
    const apps: Array<Partial<InstalledApp>> = (await native.listApps()) ?? [];
    return apps
      .filter(app => typeof app?.packageName === 'string')
      .map(app => ({
        packageName: app.packageName as string,
        label: app.label || (app.packageName as string),
        // The bridge sends bare base64; <Image> wants a data URI.
        icon: app.icon ? `data:image/png;base64,${app.icon}` : null,
      }));
  } catch {
    return [];
  }
};

/** Android: persist the picked packages; resolves with the stored count. */
export const setLockedApps = async (packages: string[]): Promise<number> => {
  if (!native?.setLockedApps) {
    return 0;
  }
  try {
    return await native.setLockedApps(packages);
  } catch {
    return 0;
  }
};

/** Android: the persisted package names (empty elsewhere). */
export const getLockedApps = async (): Promise<string[]> => {
  if (!native?.getLockedApps) {
    return [];
  }
  try {
    return (await native.getLockedApps()) ?? [];
  } catch {
    return [];
  }
};

const setShield = async (active: boolean): Promise<void> => {
  if (!native?.setShield) {
    return;
  }
  try {
    await native.setShield(active);
  } catch {
    // Shield changes are best-effort; the next evaluation retries.
  }
};

/** True when the unlock condition is met (or the lock is disabled). */
export const appLockSatisfied = (
  prefs: AppLockPrefs,
  habits: Habit[],
  completions: CompletionMap,
  statuses: StatusMap,
  now: Date = new Date(),
): boolean => {
  if (!prefs.enabled) {
    return true;
  }
  if (prefs.condition === 'time') {
    const [h, m] = prefs.until.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return true;
    }
    return now.getHours() * 60 + now.getMinutes() >= h * 60 + m;
  }
  if (prefs.condition === 'all') {
    const counting = habits.filter(hb => activeOn(statuses, hb));
    return (
      counting.length === 0 ||
      counting.every(hb => doneOn(completions, statuses, hb))
    );
  }
  const habit = habits.find(hb => hb.id === prefs.habitId);
  if (!habit) {
    return true; // habit was deleted — never hold apps hostage
  }
  return doneOn(completions, statuses, habit);
};

/** Human label for the unlock condition, for Settings/Home copy. */
export const appLockConditionLabel = (
  prefs: AppLockPrefs,
  habits: Habit[],
): string => {
  if (prefs.condition === 'time') {
    return `until ${prefs.until}`;
  }
  if (prefs.condition === 'all') {
    return 'until all habits are done';
  }
  const habit = habits.find(hb => hb.id === prefs.habitId);
  return habit ? `until “${habit.name}” is done` : 'until a habit is chosen';
};

/** True while a zen session end-time lies in the future. */
export const zenActiveAt = (
  until: string | null | undefined,
  now: Date = new Date(),
): boolean => !!until && new Date(until).getTime() > now.getTime();

/**
 * Evaluate the condition and sync the shield. A running zen session
 * shields the picked apps regardless of the App Lock condition. Returns
 * whether apps are locked right now.
 */
export const applyAppLock = async (
  prefs: AppLockPrefs,
  habits: Habit[],
  completions: CompletionMap,
  statuses: StatusMap,
  zenUntil: string | null = null,
): Promise<boolean> => {
  const locked =
    zenActiveAt(zenUntil) ||
    (prefs.enabled && !appLockSatisfied(prefs, habits, completions, statuses));
  await setShield(locked);
  return locked;
};

/**
 * Background-fetch entry point: re-evaluate from the persisted store
 * snapshot so the lock re-arms after midnight (or releases at the unlock
 * time) without the app being opened.
 */
export const runBackgroundAppLockCheck = async (): Promise<void> => {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(STORE_PERSIST_KEY);
  } catch {
    return;
  }
  if (!raw) {
    return;
  }
  try {
    const state = JSON.parse(raw)?.state;
    const prefs: AppLockPrefs | undefined = state?.appLock;
    const zenUntil: string | null = state?.zen?.until ?? null;
    if (!prefs?.enabled && !zenUntil) {
      return;
    }
    await applyAppLock(
      prefs ?? {
        enabled: false,
        condition: 'habit',
        habitId: null,
        until: '18:00',
      },
      state.habits ?? [],
      state.completions ?? {},
      state.statuses ?? {},
      zenActiveAt(zenUntil) ? zenUntil : null,
    );
    // A zen session that ended while the app was closed left its
    // reminders cancelled — re-arm them (resync is idempotent).
    if (zenUntil && !zenActiveAt(zenUntil) && !state?.prefs?.vacationMode) {
      const { resyncReminders } = require('./notifications');
      await resyncReminders(state.habits ?? []);
    }
  } catch {
    // Corrupt snapshot — leave the shield as-is.
  }
};
