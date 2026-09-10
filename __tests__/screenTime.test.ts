/**
 * @format
 *
 * Screen Time service contract. iOS never gets numbers (Apple renders them
 * inside its sandboxed extension), Android gets them from UsageStatsManager
 * once "Usage access" is on. The JS layer must hand the screen `null` in
 * every case where a real report is not available, never a zeroed one.
 */
import { NativeModules, Platform } from 'react-native';
import {
  getScreenTimeState,
  getTodayScreenTime,
  openScreenTimeReport,
  requestScreenTimeAccess,
} from '../src/services/screenTime';

const platform = Platform as unknown as { OS: string };
const originalOS = platform.OS;

const authorizedReport = {
  authorized: true,
  pickups: 23,
  totalMinutes: 187,
  socialMinutes: 64,
  topApps: [
    { packageName: 'com.instagram.android', label: 'Instagram', minutes: 42 },
    { packageName: 'com.whatsapp', label: 'WhatsApp', minutes: 22 },
    { packageName: 'com.android.chrome', label: 'Chrome', minutes: 61 },
  ],
};

/** Minimal Android module: every promise resolves, like the Kotlin side. */
const androidModule = (overrides: Record<string, unknown> = {}) => ({
  getState: jest.fn(async () => ({ supported: true, authorized: true })),
  present: jest.fn(async () => true),
  requestAccess: jest.fn(async () => true),
  getTodayReport: jest.fn(async () => authorizedReport),
  ...overrides,
});

/** The iOS module presents Apple's sheet and has no getTodayReport. */
const iosModule = () => ({
  getState: jest.fn(async () => ({ supported: true, authorized: true })),
  present: jest.fn(async () => true),
});

afterEach(() => {
  platform.OS = originalOS;
  NativeModules.ScreenTimeReport = undefined;
});

describe('getTodayScreenTime', () => {
  test('Android, Usage access on → the mapped report, top apps longest first', async () => {
    platform.OS = 'android';
    NativeModules.ScreenTimeReport = androidModule();
    const report = await getTodayScreenTime();
    expect(report).toEqual({
      pickups: 23,
      totalMinutes: 187,
      socialMinutes: 64,
      topApps: [
        { packageName: 'com.android.chrome', label: 'Chrome', minutes: 61 },
        { packageName: 'com.instagram.android', label: 'Instagram', minutes: 42 },
        { packageName: 'com.whatsapp', label: 'WhatsApp', minutes: 22 },
      ],
    });
  });

  test('Android, Usage access off → null (never a zeroed report)', async () => {
    platform.OS = 'android';
    NativeModules.ScreenTimeReport = androidModule({
      getState: jest.fn(async () => ({ supported: true, authorized: false })),
      getTodayReport: jest.fn(async () => ({
        authorized: false,
        pickups: 0,
        totalMinutes: 0,
        socialMinutes: 0,
        topApps: [],
      })),
    });
    expect(await getTodayScreenTime()).toBeNull();
  });

  test('iOS → null even when Screen Time is authorized', async () => {
    platform.OS = 'ios';
    NativeModules.ScreenTimeReport = iosModule();
    expect(await getTodayScreenTime()).toBeNull();
    expect(await getScreenTimeState()).toEqual({
      supported: true,
      authorized: true,
    });
  });

  test('no native module at all → null', async () => {
    platform.OS = 'android';
    NativeModules.ScreenTimeReport = undefined;
    expect(await getTodayScreenTime()).toBeNull();
  });

  test('a throwing bridge → null, not a rejection', async () => {
    platform.OS = 'android';
    NativeModules.ScreenTimeReport = androidModule({
      getTodayReport: jest.fn(async () => {
        throw new Error('boom');
      }),
    });
    await expect(getTodayScreenTime()).resolves.toBeNull();
  });

  test('sanitises the bridge payload: caps at five apps, blank labels fall back to the package', async () => {
    platform.OS = 'android';
    NativeModules.ScreenTimeReport = androidModule({
      getTodayReport: jest.fn(async () => ({
        authorized: true,
        pickups: 3.6,
        totalMinutes: -4,
        socialMinutes: 'nope',
        topApps: [
          ...Array.from({ length: 7 }, (_, i) => ({
            packageName: `app.${i}`,
            label: i === 0 ? '   ' : `App ${i}`,
            minutes: 10 + i,
          })),
          null,
          { label: 'no package', minutes: 99 },
        ],
      })),
    });
    const report = await getTodayScreenTime();
    expect(report?.pickups).toBe(4);
    expect(report?.totalMinutes).toBe(0);
    expect(report?.socialMinutes).toBe(0);
    expect(report?.topApps).toHaveLength(5);
    expect(report?.topApps[0]).toEqual({
      packageName: 'app.6',
      label: 'App 6',
      minutes: 16,
    });
    // The blank-labelled app.0 (10 min) is the smallest and falls off the
    // top five; a label-less entry elsewhere reads as its package name.
    NativeModules.ScreenTimeReport = androidModule({
      getTodayReport: jest.fn(async () => ({
        authorized: true,
        pickups: 1,
        totalMinutes: 5,
        socialMinutes: 0,
        topApps: [{ packageName: 'org.example', label: '', minutes: 5 }],
      })),
    });
    expect((await getTodayScreenTime())?.topApps[0].label).toBe('org.example');
  });
});

describe('permission plumbing', () => {
  test('requestScreenTimeAccess opens the Usage access page on Android only', async () => {
    platform.OS = 'android';
    const android = androidModule();
    NativeModules.ScreenTimeReport = android;
    await requestScreenTimeAccess();
    expect(android.requestAccess).toHaveBeenCalledTimes(1);

    platform.OS = 'ios';
    const ios = { ...iosModule(), requestAccess: jest.fn() };
    NativeModules.ScreenTimeReport = ios;
    await requestScreenTimeAccess();
    expect(ios.requestAccess).not.toHaveBeenCalled();
  });

  test('getScreenTimeState reports unsupported without a module', async () => {
    NativeModules.ScreenTimeReport = undefined;
    expect(await getScreenTimeState()).toEqual({
      supported: false,
      authorized: false,
    });
  });

  test('openScreenTimeReport keeps presenting on iOS and is false without a module', async () => {
    platform.OS = 'ios';
    const ios = iosModule();
    NativeModules.ScreenTimeReport = ios;
    expect(await openScreenTimeReport()).toBe(true);
    expect(ios.present).toHaveBeenCalledTimes(1);
    NativeModules.ScreenTimeReport = undefined;
    expect(await openScreenTimeReport()).toBe(false);
  });
});
