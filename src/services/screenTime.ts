import { NativeModules, Platform } from 'react-native';

/**
 * Screen Time (pickups, social-app minutes).
 *
 * iOS: the numbers come from Apple's DeviceActivityReport extension, which
 * Apple sandboxes so it "cannot move sensitive content outside the
 * extension's address space" — they are rendered by Apple and can never be
 * read by this app. So on iOS this service only OPENS the report.
 *
 * Android: UsageStatsManager hands the same numbers straight to the app
 * (behind the "Usage access" special permission), so `getTodayScreenTime`
 * returns real values there. Either way nothing in Slay's scoring depends
 * on them — the Wellbeing score stays display-only for screen time.
 */

// Read at call time, not import time: the module is swapped in tests and the
// bridge may register it after this file is first evaluated.
const nativeModule = () => NativeModules.ScreenTimeReport;

export type ScreenTimeState = {
  /** iOS 16+ with the report extension present; always true on Android. */
  supported: boolean;
  /**
   * iOS: Screen Time authorization already granted (shared with App Lock).
   * Android: "Usage access" turned on in system Settings.
   */
  authorized: boolean;
};

export type ScreenTimeApp = {
  packageName: string;
  /** Launcher label, or the package name when the app is not visible to us. */
  label: string;
  minutes: number;
};

/** Today (local midnight → now) — Android only; iOS never sees these. */
export type ScreenTimeReport = {
  pickups: number;
  totalMinutes: number;
  socialMinutes: number;
  /** Up to five apps, longest foreground time first. */
  topApps: ScreenTimeApp[];
};

const UNSUPPORTED: ScreenTimeState = { supported: false, authorized: false };

export const getScreenTimeState = async (): Promise<ScreenTimeState> => {
  const native = nativeModule();
  if (!native?.getState) {
    return UNSUPPORTED;
  }
  try {
    const state = await native.getState();
    return { supported: !!state?.supported, authorized: !!state?.authorized };
  } catch {
    return UNSUPPORTED;
  }
};

/**
 * iOS: opens Apple's report sheet. Android: routes an unauthorized user to
 * the Usage access page (the numbers themselves render in-app). Resolves
 * false when nothing could be shown.
 */
export const openScreenTimeReport = async (): Promise<boolean> => {
  const native = nativeModule();
  if (!native?.present) {
    return false;
  }
  try {
    await native.present();
    return true;
  } catch {
    return false;
  }
};

/** Android: opens the system "Usage access" page. No-op elsewhere. */
export const requestScreenTimeAccess = async (): Promise<void> => {
  const native = nativeModule();
  if (Platform.OS !== 'android' || !native?.requestAccess) {
    return;
  }
  try {
    await native.requestAccess();
  } catch {
    // The settings page is missing on a few OEM builds; nothing to recover.
  }
};

const toCount = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;

/**
 * Today's report, or null when the platform cannot hand the numbers over
 * (iOS, always) or Usage access is off. Keyed on the native method rather
 * than Platform.OS so the iOS module — which has no getTodayReport — stays
 * null without a platform check drifting out of sync with the bridge.
 */
export const getTodayScreenTime =
  async (): Promise<ScreenTimeReport | null> => {
    const native = nativeModule();
    if (!native?.getTodayReport) {
      return null;
    }
    try {
      const raw = await native.getTodayReport();
      if (!raw || raw.authorized === false) {
        return null;
      }
      const topApps: ScreenTimeApp[] = Array.isArray(raw.topApps)
        ? raw.topApps
            .filter((a: unknown) => !!a && typeof a === 'object')
            .map((a: Record<string, unknown>) => {
              const packageName = String(a.packageName ?? '');
              return {
                packageName,
                label:
                  typeof a.label === 'string' && a.label.trim()
                    ? a.label
                    : packageName,
                minutes: toCount(a.minutes),
              };
            })
            .filter((a: ScreenTimeApp) => a.packageName)
            .sort((a: ScreenTimeApp, b: ScreenTimeApp) => b.minutes - a.minutes)
            .slice(0, 5)
        : [];
      return {
        pickups: toCount(raw.pickups),
        totalMinutes: toCount(raw.totalMinutes),
        socialMinutes: toCount(raw.socialMinutes),
        topApps,
      };
    } catch {
      return null;
    }
  };
