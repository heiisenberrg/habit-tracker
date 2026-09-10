/**
 * @format
 *
 * System quiet mode behind Zen. Android drives Do Not Disturb through the
 * ZenMode native module, gated on the same `zen.useFocusShortcut`
 * preference that runs the iOS Shortcut; iOS is a no-op here. Every call
 * resolves to a neutral value when the module is missing or throws.
 */
import { NativeModules, Platform } from 'react-native';
import {
  endSystemZen,
  getZenAccessState,
  openZenAccessSettings,
  startSystemZen,
} from '../src/services/zenMode';
import { useStore } from '../src/store/useStore';

type Native = {
  getState: jest.Mock;
  openAccessSettings: jest.Mock;
  start: jest.Mock;
  end: jest.Mock;
};

const installNative = (over: Partial<Native> = {}): Native => {
  const n: Native = {
    getState: jest.fn(async () => ({
      supported: true,
      granted: true,
      active: false,
    })),
    openAccessSettings: jest.fn(async () => undefined),
    start: jest.fn(async () => true),
    end: jest.fn(async () => undefined),
    ...over,
  };
  NativeModules.ZenMode = n;
  return n;
};

const inHalfAnHour = () => new Date(Date.now() + 30 * 60_000).toISOString();
const setPreference = (on: boolean) =>
  useStore.getState().setZen({ useFocusShortcut: on });

beforeEach(() => {
  useStore.getState().reset();
  NativeModules.ZenMode = undefined;
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('iOS', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  test('every call is a no-op even with the preference on and a module present', async () => {
    const n = installNative();
    setPreference(true);
    expect(await getZenAccessState()).toEqual({
      supported: false,
      granted: false,
    });
    expect(await startSystemZen(inHalfAnHour())).toBe(false);
    await endSystemZen();
    await openZenAccessSettings();
    expect(n.getState).not.toHaveBeenCalled();
    expect(n.start).not.toHaveBeenCalled();
    expect(n.end).not.toHaveBeenCalled();
    expect(n.openAccessSettings).not.toHaveBeenCalled();
  });
});

describe('Android', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  test('startSystemZen stays off unless zen.useFocusShortcut is on', async () => {
    const n = installNative();
    setPreference(false);
    expect(await startSystemZen(inHalfAnHour())).toBe(false);
    expect(n.start).not.toHaveBeenCalled();

    setPreference(true);
    expect(await startSystemZen(inHalfAnHour())).toBe(true);
    expect(n.start).toHaveBeenCalledTimes(1);
  });

  test('startSystemZen hands the module the end time in epoch ms', async () => {
    const n = installNative();
    setPreference(true);
    const until = inHalfAnHour();
    await startSystemZen(until);
    expect(n.start).toHaveBeenCalledWith(Date.parse(until));
  });

  test('a past or malformed end time never turns DND on', async () => {
    const n = installNative();
    setPreference(true);
    expect(
      await startSystemZen(new Date(Date.now() - 60_000).toISOString()),
    ).toBe(false);
    expect(await startSystemZen('not a date')).toBe(false);
    expect(n.start).not.toHaveBeenCalled();
  });

  test('startSystemZen reports false when the module declines (no access)', async () => {
    const n = installNative({ start: jest.fn(async () => false) });
    setPreference(true);
    expect(await startSystemZen(inHalfAnHour())).toBe(false);
    expect(n.start).toHaveBeenCalledTimes(1);
  });

  test('getZenAccessState mirrors the native state', async () => {
    installNative({
      getState: jest.fn(async () => ({
        supported: true,
        granted: false,
        active: true,
      })),
    });
    expect(await getZenAccessState()).toEqual({
      supported: true,
      granted: false,
      active: true,
    });
  });

  test('endSystemZen and openZenAccessSettings call through regardless of the preference', async () => {
    const n = installNative();
    // Switching the preference off mid-session must not strand DND on.
    setPreference(false);
    await endSystemZen();
    await openZenAccessSettings();
    expect(n.end).toHaveBeenCalledTimes(1);
    expect(n.openAccessSettings).toHaveBeenCalledTimes(1);
  });

  test('a missing module resolves to the neutral values', async () => {
    setPreference(true);
    expect(await getZenAccessState()).toEqual({
      supported: false,
      granted: false,
    });
    expect(await startSystemZen(inHalfAnHour())).toBe(false);
    await expect(endSystemZen()).resolves.toBeUndefined();
    await expect(openZenAccessSettings()).resolves.toBeUndefined();
  });

  test('a rejecting module still resolves neutrally', async () => {
    const boom = jest.fn(async () => {
      throw new Error('bridge down');
    });
    installNative({
      getState: boom,
      start: boom,
      end: boom,
      openAccessSettings: boom,
    });
    setPreference(true);
    expect(await getZenAccessState()).toEqual({
      supported: true,
      granted: false,
      active: false,
    });
    expect(await startSystemZen(inHalfAnHour())).toBe(false);
    await expect(endSystemZen()).resolves.toBeUndefined();
    await expect(openZenAccessSettings()).resolves.toBeUndefined();
  });
});

describe('ZEN_SYSTEM_MODE_LABEL', () => {
  // The label is fixed at import time, so each platform needs a fresh module
  // registry — and Platform must be swapped on THAT registry's react-native,
  // not the one this file imported.
  const labelFor = (os: 'ios' | 'android') => {
    let label = '';
    jest.isolateModules(() => {
      const rn = require('react-native');
      const prop = jest.replaceProperty(rn.Platform, 'OS', os);
      label = require('../src/services/zenMode').ZEN_SYSTEM_MODE_LABEL;
      prop.restore();
    });
    return label;
  };

  test('names the platform quiet mode', () => {
    expect(labelFor('android')).toBe('Do Not Disturb');
    expect(labelFor('ios')).toBe('iOS Focus');
  });
});
