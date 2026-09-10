/**
 * @format
 *
 * Android App Lock: the JS service drives the same native surface on both
 * platforms, keyed off the module's presence rather than Platform.OS. These
 * cover the Android-specific branches with NativeModules.AppLock mocked —
 * the Settings-page authorization dance, the picker's app list mapping and
 * the shield being armed/disarmed by applyAppLock.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules } from 'react-native';
import { STORE_PERSIST_KEY } from '../src/services/rainAlerts';

const mockNative = {
  getState: jest.fn(),
  requestAuthorization: jest.fn(),
  presentPicker: jest.fn(),
  listApps: jest.fn(),
  setLockedApps: jest.fn(),
  getLockedApps: jest.fn(),
  setShield: jest.fn(),
};
// The service captures NativeModules.AppLock at load, so install the mock
// before requiring it (a hoisted `import` would run first).
NativeModules.AppLock = mockNative;
const appLock: typeof import('../src/services/appLock') = require('../src/services/appLock');

const AUTHORIZED = {
  supported: true,
  authorized: true,
  apps: 2,
  categories: 0,
  active: false,
};

const meditate = {
  id: 'm',
  name: 'Meditate',
  emoji: '🧘',
  type: 'good' as const,
  goal: { amount: 1, unit: 'TIMES' as const },
  step: 1,
  friendIds: [],
  tracking: 'check' as const,
  kind: 'build' as const,
};

const prefs = {
  enabled: true,
  condition: 'habit' as const,
  habitId: 'm',
  until: '18:00',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNative.getState.mockResolvedValue(AUTHORIZED);
  mockNative.requestAuthorization.mockResolvedValue(true);
  mockNative.presentPicker.mockResolvedValue({ apps: 2, categories: 0 });
  mockNative.listApps.mockResolvedValue([]);
  mockNative.setLockedApps.mockImplementation(async (p: string[]) => p.length);
  mockNative.getLockedApps.mockResolvedValue([]);
  mockNative.setShield.mockImplementation(async (a: boolean) => a);
});

describe('state + authorization', () => {
  test('getAppLockState passes the native state through', async () => {
    expect(await appLock.getAppLockState()).toEqual(AUTHORIZED);
  });

  test('getAppLockState degrades to unsupported when native throws', async () => {
    mockNative.getState.mockRejectedValue(new Error('boom'));
    expect(await appLock.getAppLockState()).toEqual({
      supported: false,
      authorized: false,
      apps: 0,
      categories: 0,
      active: false,
    });
  });

  test('requestAppLockAuth is false while a Settings page had to be opened', async () => {
    // Android resolves false after launching Usage access / overlay settings.
    mockNative.requestAuthorization.mockResolvedValue(false);
    expect(await appLock.requestAppLockAuth()).toBe(false);
    expect(mockNative.requestAuthorization).toHaveBeenCalledTimes(1);
  });

  test('requestAppLockAuth is true once both permissions are granted', async () => {
    expect(await appLock.requestAppLockAuth()).toBe(true);
  });

  test('requestAppLockAuth swallows a rejection (iOS denial shape)', async () => {
    mockNative.requestAuthorization.mockRejectedValue(new Error('denied'));
    expect(await appLock.requestAppLockAuth()).toBe(false);
  });

  test('pickLockedApps reports the stored counts (the picker is a JS screen)', async () => {
    expect(await appLock.pickLockedApps()).toEqual({ apps: 2, categories: 0 });
  });
});

describe('installed apps + locked set', () => {
  test('listInstalledApps wraps icons in a data URI and keeps order', async () => {
    mockNative.listApps.mockResolvedValue([
      { packageName: 'com.a', label: 'Alpha', icon: 'AAAA' },
      { packageName: 'com.b', label: 'Beta', icon: null },
      { packageName: 'com.c', label: '', icon: undefined },
      { label: 'no package' },
    ]);
    expect(await appLock.listInstalledApps()).toEqual([
      {
        packageName: 'com.a',
        label: 'Alpha',
        icon: 'data:image/png;base64,AAAA',
      },
      { packageName: 'com.b', label: 'Beta', icon: null },
      // A blank label falls back to the package name; a row without a
      // package is unusable and dropped.
      { packageName: 'com.c', label: 'com.c', icon: null },
    ]);
  });

  test('listInstalledApps is empty when the module rejects or returns null', async () => {
    mockNative.listApps.mockRejectedValue(new Error('pm'));
    expect(await appLock.listInstalledApps()).toEqual([]);
    mockNative.listApps.mockResolvedValue(null);
    expect(await appLock.listInstalledApps()).toEqual([]);
  });

  test('setLockedApps / getLockedApps pass through', async () => {
    expect(await appLock.setLockedApps(['com.a', 'com.b'])).toBe(2);
    expect(mockNative.setLockedApps).toHaveBeenCalledWith(['com.a', 'com.b']);
    mockNative.getLockedApps.mockResolvedValue(['com.a']);
    expect(await appLock.getLockedApps()).toEqual(['com.a']);
    mockNative.getLockedApps.mockResolvedValue(null);
    expect(await appLock.getLockedApps()).toEqual([]);
  });
});

describe('applyAppLock drives setShield', () => {
  test('arms the shield while the unlock habit is not done', async () => {
    expect(await appLock.applyAppLock(prefs, [meditate], {}, {})).toBe(true);
    expect(mockNative.setShield).toHaveBeenLastCalledWith(true);
  });

  test('drops the shield once the habit is done today', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const done = await appLock.applyAppLock(
      prefs,
      [meditate],
      { m: { [today]: 1 } },
      {},
    );
    expect(done).toBe(false);
    expect(mockNative.setShield).toHaveBeenLastCalledWith(false);
  });

  test('a disabled lock never shields, but a running zen session does', async () => {
    const off = { ...prefs, enabled: false };
    expect(await appLock.applyAppLock(off, [meditate], {}, {})).toBe(false);
    expect(mockNative.setShield).toHaveBeenLastCalledWith(false);
    const inAnHour = new Date(Date.now() + 3600_000).toISOString();
    expect(await appLock.applyAppLock(off, [meditate], {}, {}, inAnHour)).toBe(
      true,
    );
    expect(mockNative.setShield).toHaveBeenLastCalledWith(true);
  });

  test('a native failure is swallowed and the verdict still returns', async () => {
    mockNative.setShield.mockRejectedValue(new Error('service'));
    expect(await appLock.applyAppLock(prefs, [meditate], {}, {})).toBe(true);
  });

  test('the background check re-arms from the persisted snapshot', async () => {
    await AsyncStorage.setItem(
      STORE_PERSIST_KEY,
      JSON.stringify({
        state: {
          appLock: prefs,
          zen: { until: null, useFocusShortcut: false },
          habits: [meditate],
          completions: {},
          statuses: {},
          prefs: { vacationMode: false },
        },
        version: 4,
      }),
    );
    await appLock.runBackgroundAppLockCheck();
    expect(mockNative.setShield).toHaveBeenCalledWith(true);
  });
});
