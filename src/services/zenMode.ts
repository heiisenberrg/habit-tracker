/**
 * System-level quiet mode behind a Zen session.
 *
 *  - iOS: Zen runs the user's "Slay Zen" Shortcut (Set Focus) when the
 *    `zen.useFocusShortcut` preference is on — handled in ZenControls via
 *    the shortcuts:// URL. Nothing here does anything on iOS.
 *  - Android: Zen turns on Do Not Disturb through NotificationManager
 *    (needs the "Notification policy access" special permission) and arms
 *    a native alarm that restores the previous filter at `until`, so DND
 *    never outlives the session even if the app is killed.
 *
 * The same `zen.useFocusShortcut` preference gates both platforms — it
 * means "run the system quiet mode too" — and it is read HERE so callers
 * (ZenControls, the App-level session effect) stay dumb: they call
 * startSystemZen/endSystemZen unconditionally.
 *
 * Contract (kept identical on both platforms; every call is safe to make
 * anywhere — unsupported platforms and a missing/failing module resolve to
 * the neutral value, never reject):
 */
import { NativeModules, Platform } from 'react-native';
import { useStore } from '../store/useStore';

export type ZenAccessState = {
  /** The platform can run a system quiet mode from the app at all. */
  supported: boolean;
  /** The special permission is granted (Android: notification policy access). */
  granted: boolean;
  /** Android only: a DND session we started is still running natively. */
  active?: boolean;
};

type ZenModeNative = {
  getState(): Promise<{ supported: boolean; granted: boolean; active: boolean }>;
  openAccessSettings(): Promise<void>;
  start(untilMs: number): Promise<boolean>;
  end(): Promise<void>;
};

// Resolved per call, not at import: tests swap Platform.OS and the module,
// and a bridgeless app may register native modules after the JS bundle loads.
const nativeModule = (): ZenModeNative | null =>
  Platform.OS === 'android'
    ? (NativeModules.ZenMode as ZenModeNative | undefined) ?? null
    : null;

export const getZenAccessState = async (): Promise<ZenAccessState> => {
  const mod = nativeModule();
  if (!mod) {
    return { supported: false, granted: false };
  }
  try {
    const st = await mod.getState();
    return {
      supported: st.supported !== false,
      granted: !!st.granted,
      active: !!st.active,
    };
  } catch {
    return { supported: true, granted: false, active: false };
  }
};

/** Opens the system page where the user grants the permission. */
export const openZenAccessSettings = async (): Promise<void> => {
  const mod = nativeModule();
  if (!mod) {
    return;
  }
  try {
    await mod.openAccessSettings();
  } catch {
    // The row keeps showing its red recovery line; nothing else to do.
  }
};

/**
 * Turn the system quiet mode ON until `untilIso` (ISO timestamp).
 * Resolves true only when DND actually went on: the preference is on, the
 * platform supports it, access is granted and the end time is ahead of us.
 */
export const startSystemZen = async (untilIso: string): Promise<boolean> => {
  if (!useStore.getState().zen.useFocusShortcut) {
    return false;
  }
  const mod = nativeModule();
  if (!mod) {
    return false;
  }
  const untilMs = Date.parse(untilIso);
  if (!Number.isFinite(untilMs) || untilMs <= Date.now()) {
    return false;
  }
  try {
    return !!(await mod.start(untilMs));
  } catch {
    return false;
  }
};

/**
 * Turn the system quiet mode OFF now (early end / natural end). Not gated on
 * the preference on purpose: if the user switched it off mid-session, the
 * DND we already turned on must still be undone. Natively a no-op when no
 * session of ours is running.
 */
export const endSystemZen = async (): Promise<void> => {
  const mod = nativeModule();
  if (!mod) {
    return;
  }
  try {
    await mod.end();
  } catch {
    // The native end alarm (or the next self-heal) restores the filter.
  }
};

export const ZEN_SYSTEM_MODE_LABEL =
  Platform.OS === 'android' ? 'Do Not Disturb' : 'iOS Focus';
