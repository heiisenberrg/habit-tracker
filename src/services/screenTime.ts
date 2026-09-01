import { NativeModules, Platform } from 'react-native';

/**
 * Screen Time (pickups, social-app minutes) comes from Apple's
 * DeviceActivityReport extension. Apple sandboxes that extension so it
 * "cannot move sensitive content outside the extension's address space" —
 * the numbers are rendered by Apple and can never be read by this app. So
 * this service opens the report; it never returns values, and nothing in
 * Routiner's scoring can depend on them.
 */
const native = NativeModules.ScreenTimeReport;

export type ScreenTimeState = {
  /** iOS 16+ with the report extension present. */
  supported: boolean;
  /** Screen Time authorization already granted (shared with App Lock). */
  authorized: boolean;
};

const UNSUPPORTED: ScreenTimeState = { supported: false, authorized: false };

export const getScreenTimeState = async (): Promise<ScreenTimeState> => {
  if (Platform.OS !== 'ios' || !native?.getState) {
    return UNSUPPORTED;
  }
  try {
    return await native.getState();
  } catch {
    return UNSUPPORTED;
  }
};

/** Opens Apple's report sheet. Resolves false when it could not be shown. */
export const openScreenTimeReport = async (): Promise<boolean> => {
  if (Platform.OS !== 'ios' || !native?.present) {
    return false;
  }
  try {
    await native.present();
    return true;
  } catch {
    return false;
  }
};
